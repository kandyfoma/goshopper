/**
 * Webhook Retry Mechanism
 * Ensures reliable webhook event processing with automatic retry and dead letter queue
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {addMinutes, addHours} from 'date-fns';
import {config} from '../config';

const db = admin.firestore();

// Retry configuration
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAYS_MINUTES = [1, 5, 30, 120, 720]; // 1min, 5min, 30min, 2hrs, 12hrs

// Webhook event types
type WebhookProvider = 'stripe' | 'moko_afrika';
type WebhookEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'charge.refunded'
  | 'payment.completed'
  | 'payment.failed'
  | 'refund.completed'
  | 'refund.failed';

interface WebhookEvent {
  id: string;
  provider: WebhookProvider;
  eventType: WebhookEventType;
  eventId: string; // Provider's event ID
  payload: any; // Original webhook payload
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  lastError?: string;
  lastAttemptAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Metadata
  userId?: string;
  transactionId?: string;
  signature?: string; // For verification
}

/**
 * Log webhook event for retry processing
 */
export async function logWebhookEvent(
  provider: WebhookProvider,
  eventType: WebhookEventType,
  eventId: string,
  payload: any,
  metadata?: {userId?: string; transactionId?: string; signature?: string},
): Promise<string> {
  const webhookRef = db.collection('webhook_events').doc();
  const now = new Date();

  const webhookEvent: WebhookEvent = {
    id: webhookRef.id,
    provider,
    eventType,
    eventId,
    payload,
    status: 'pending',
    retryCount: 0,
    maxRetries: MAX_RETRY_ATTEMPTS,
    createdAt: now,
    updatedAt: now,
    ...metadata,
  };

  await webhookRef.set(webhookEvent);
  console.log(`📝 Logged webhook event: ${provider}/${eventType}/${eventId}`);

  return webhookRef.id;
}

/**
 * Mark webhook event as completed
 */
export async function markWebhookCompleted(webhookEventId: string): Promise<void> {
  const webhookRef = db.collection('webhook_events').doc(webhookEventId);
  const now = new Date();

  await webhookRef.update({
    status: 'completed',
    completedAt: now,
    updatedAt: now,
  });

  console.log(`✅ Webhook event completed: ${webhookEventId}`);
}

/**
 * Mark webhook event as failed and schedule retry
 */
export async function markWebhookFailed(
  webhookEventId: string,
  error: string,
): Promise<void> {
  const webhookRef = db.collection('webhook_events').doc(webhookEventId);
  const webhookDoc = await webhookRef.get();

  if (!webhookDoc.exists) {
    console.error(`Webhook event not found: ${webhookEventId}`);
    return;
  }

  const webhook = webhookDoc.data() as WebhookEvent;
  const now = new Date();
  const newRetryCount = webhook.retryCount + 1;

  // Check if we've exceeded max retries
  if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
    await webhookRef.update({
      status: 'dead_letter',
      retryCount: newRetryCount,
      lastError: error,
      lastAttemptAt: now,
      updatedAt: now,
    });

    console.error(
      `💀 Webhook event moved to dead letter queue: ${webhookEventId} (${newRetryCount} attempts)`,
    );

    // Send alert to admin
    await sendDeadLetterAlert(webhook, error);
    return;
  }

  // Calculate next retry time using exponential backoff
  const delayMinutes = RETRY_DELAYS_MINUTES[newRetryCount - 1] || RETRY_DELAYS_MINUTES[RETRY_DELAYS_MINUTES.length - 1];
  const nextRetryAt = addMinutes(now, delayMinutes);

  await webhookRef.update({
    status: 'pending',
    retryCount: newRetryCount,
    lastError: error,
    lastAttemptAt: now,
    nextRetryAt: admin.firestore.Timestamp.fromDate(nextRetryAt),
    updatedAt: now,
  });

  console.log(
    `⚠️ Webhook event retry scheduled: ${webhookEventId} (attempt ${newRetryCount}/${MAX_RETRY_ATTEMPTS}, next retry: ${nextRetryAt.toISOString()})`,
  );
}

/**
 * Process pending webhook events (retry logic)
 * Runs every 5 minutes
 */
export const processWebhookRetries = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '512MB',
  })
  .pubsub.schedule('*/5 * * * *') // Every 5 minutes
  .timeZone('Africa/Kinshasa')
  .onRun(async context => {
    try {
      const now = new Date();
      console.log(`🔄 Starting webhook retry processing at ${now.toISOString()}`);

      // Find pending webhook events that are ready for retry
      const pendingWebhooks = await db
        .collection('webhook_events')
        .where('status', '==', 'pending')
        .where('retryCount', '>', 0) // Only retry failed events
        .where('nextRetryAt', '<=', admin.firestore.Timestamp.fromDate(now))
        .limit(50) // Process in batches
        .get();

      console.log(`📋 Found ${pendingWebhooks.size} webhook(s) to retry`);

      let successCount = 0;
      let failureCount = 0;
      let deadLetterCount = 0;

      for (const doc of pendingWebhooks.docs) {
        const webhook = doc.data() as WebhookEvent;

        console.log(
          `\n🔄 Retrying webhook: ${webhook.provider}/${webhook.eventType} (attempt ${webhook.retryCount + 1}/${MAX_RETRY_ATTEMPTS})`,
        );

        // Mark as processing
        await doc.ref.update({
          status: 'processing',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        try {
          // Process based on provider
          if (webhook.provider === 'stripe') {
            await processStripeWebhookRetry(webhook);
          } else if (webhook.provider === 'moko_afrika') {
            await processMokoWebhookRetry(webhook);
          }

          // Success - mark as completed
          await markWebhookCompleted(webhook.id);
          successCount++;
        } catch (error: any) {
          console.error(`❌ Retry failed:`, error);
          await markWebhookFailed(webhook.id, error.message || 'Unknown error');

          // Check if moved to dead letter
          const updatedDoc = await doc.ref.get();
          if (updatedDoc.exists && updatedDoc.data()?.status === 'dead_letter') {
            deadLetterCount++;
          } else {
            failureCount++;
          }
        }
      }

      console.log(`\n✅ Webhook retry processing complete:`);
      console.log(`   Successful retries: ${successCount}`);
      console.log(`   Failed retries: ${failureCount}`);
      console.log(`   Dead letter queue: ${deadLetterCount}`);

      return null;
    } catch (error) {
      console.error('Webhook retry processing error:', error);
      return null;
    }
  });

/**
 * Process Stripe webhook retry
 */
async function processStripeWebhookRetry(webhook: WebhookEvent): Promise<void> {
  const {eventType, payload, userId, transactionId} = webhook;

  if (eventType === 'payment_intent.succeeded') {
    const paymentIntent = payload.data.object;
    const metadata = paymentIntent.metadata;

    if (!userId || !transactionId) {
      throw new Error('Missing userId or transactionId in webhook metadata');
    }

    // Update payment record
    const paymentRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('payments')
      .doc(transactionId);

    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists) {
      throw new Error(`Payment not found: ${transactionId}`);
    }

    const payment = paymentDoc.data();
    
    // C5 FIX: Check BOTH payment AND subscription status for true idempotency
    const subscriptionRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('subscription')
      .doc(userId);
    
    if (payment?.status === 'completed') {
      // Verify subscription was also activated
      const subscriptionDoc = await subscriptionRef.get();
      const subscription = subscriptionDoc.data();
      
      if (subscription?.isSubscribed && subscription?.transactionId === transactionId) {
        console.log(`Payment and subscription already processed: ${transactionId}`);
        return; // Fully idempotent
      }
      
      console.warn(`Payment completed but subscription not activated - completing activation`);
      // Fall through to activate subscription
    }

    const now = new Date();
    const endDate = addHours(now, 24 * 30); // 30 days

    // Use transaction to ensure atomic payment+subscription update
    await admin.firestore().runTransaction(async (transaction) => {
      transaction.update(paymentRef, {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      transaction.set(subscriptionRef, {
        userId,
        isSubscribed: true,
        planId: metadata.planId,
        status: 'active',
        subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
        lastPaymentDate: admin.firestore.Timestamp.fromDate(now),
        lastPaymentAmount: paymentIntent.amount / 100,
        transactionId,
        stripePaymentIntentId: paymentIntent.id,
        autoRenew: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    });

    console.log(`✅ Stripe payment processed: ${transactionId}`);
  } else if (eventType === 'payment_intent.payment_failed') {
    if (!userId || !transactionId) {
      throw new Error('Missing userId or transactionId');
    }

    const paymentRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('payments')
      .doc(transactionId);

    await paymentRef.update({
      status: 'failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Stripe payment failure processed: ${transactionId}`);
  } else {
    console.log(`⏭️ Skipping unknown Stripe event type: ${eventType}`);
  }
}

/**
 * Process Moko Afrika webhook retry
 */
async function processMokoWebhookRetry(webhook: WebhookEvent): Promise<void> {
  const {eventType, userId, transactionId} = webhook;

  if (eventType === 'payment.completed') {
    if (!userId || !transactionId) {
      throw new Error('Missing userId or transactionId in webhook metadata');
    }

    // Update payment record
    const paymentRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('payments')
      .doc(transactionId);

    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists) {
      throw new Error(`Payment not found: ${transactionId}`);
    }

    const payment = paymentDoc.data();
    
    if (!payment) {
      throw new Error(`Payment data not found: ${transactionId}`);
    }
    
    // C5 FIX: Check BOTH payment AND subscription status for true idempotency
    const subscriptionRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('subscription')
      .doc(userId);
    
    if (payment?.status === 'completed') {
      // Verify subscription was also activated
      const subscriptionDoc = await subscriptionRef.get();
      const subscription = subscriptionDoc.data();
      
      if (subscription?.isSubscribed && subscription?.transactionId === transactionId) {
        console.log(`Payment and subscription already processed: ${transactionId}`);
        return; // Fully idempotent
      }
      
      console.warn(`Payment completed but subscription not activated - completing activation`);
      // Fall through to activate subscription
    }

    const now = new Date();
    const endDate = addHours(now, 24 * 30); // 30 days

    // Use transaction to ensure atomic payment+subscription update
    await admin.firestore().runTransaction(async (transaction) => {
      transaction.update(paymentRef, {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      transaction.set(subscriptionRef, {
        userId,
        isSubscribed: true,
        planId: payment.planId,
        status: 'active',
        subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
        lastPaymentDate: admin.firestore.Timestamp.fromDate(now),
        lastPaymentAmount: payment.amount,
        transactionId,
        paymentMethod: 'mobile_money',
        paymentProvider: 'moko_afrika',
        customerPhone: payment.phoneNumber,
        autoRenew: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    });

    console.log(`✅ Moko payment processed: ${transactionId}`);
  } else if (eventType === 'payment.failed') {
    if (!userId || !transactionId) {
      throw new Error('Missing userId or transactionId');
    }

    const paymentRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('payments')
      .doc(transactionId);

    await paymentRef.update({
      status: 'failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Moko payment failure processed: ${transactionId}`);
  } else {
    console.log(`⏭️ Skipping unknown Moko event type: ${eventType}`);
  }
}

/**
 * Send alert when webhook event moves to dead letter queue
 */
async function sendDeadLetterAlert(
  webhook: WebhookEvent,
  error: string,
): Promise<void> {
  try {
    // Create admin notification
    const notificationRef = db.collection('admin_notifications').doc();

    await notificationRef.set({
      type: 'webhook_dead_letter',
      title: 'Webhook Event Failed',
      message: `Webhook event ${webhook.provider}/${webhook.eventType} failed after ${webhook.retryCount} attempts`,
      priority: 'critical',
      webhookId: webhook.id,
      provider: webhook.provider,
      eventType: webhook.eventType,
      eventId: webhook.eventId,
      error,
      userId: webhook.userId,
      transactionId: webhook.transactionId,
      read: false,
      actionRequired: true,
      actionUrl: `/admin/webhooks/${webhook.id}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`🚨 Dead letter alert sent for webhook: ${webhook.id}`);
  } catch (error) {
    console.error('Error sending dead letter alert:', error);
  }
}

/**
 * Manually retry a failed webhook event (admin function)
 */
export const retryWebhookEvent = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    // Admin authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    // TODO: Add admin role verification
    const {webhookEventId} = data;

    if (!webhookEventId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Webhook event ID is required',
      );
    }

    try {
      const webhookRef = db.collection('webhook_events').doc(webhookEventId);
      const webhookDoc = await webhookRef.get();

      if (!webhookDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Webhook event not found');
      }

      const webhook = webhookDoc.data() as WebhookEvent;

      // Reset retry count and status for manual retry
      await webhookRef.update({
        status: 'processing',
        retryCount: webhook.retryCount, // Keep current count
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Process retry
      if (webhook.provider === 'stripe') {
        await processStripeWebhookRetry(webhook);
      } else if (webhook.provider === 'moko_afrika') {
        await processMokoWebhookRetry(webhook);
      } else {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Unknown webhook provider',
        );
      }

      await markWebhookCompleted(webhookEventId);

      return {
        success: true,
        message: 'Webhook event processed successfully',
        webhookId: webhookEventId,
      };
    } catch (error: any) {
      console.error('Manual retry error:', error);

      // Mark as failed
      await markWebhookFailed(webhookEventId, error.message || 'Manual retry failed');

      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to retry webhook event',
      );
    }
  });

/**
 * Get webhook event statistics (admin function)
 */
export const getWebhookStats = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    // Admin authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    // TODO: Add admin role verification

    try {
      const {startDate, endDate, provider} = data;

      let query: FirebaseFirestore.Query = db.collection('webhook_events');

      if (startDate) {
        query = query.where(
          'createdAt',
          '>=',
          admin.firestore.Timestamp.fromDate(new Date(startDate)),
        );
      }

      if (endDate) {
        query = query.where(
          'createdAt',
          '<=',
          admin.firestore.Timestamp.fromDate(new Date(endDate)),
        );
      }

      if (provider) {
        query = query.where('provider', '==', provider);
      }

      const snapshot = await query.get();

      let total = 0;
      let completed = 0;
      let pending = 0;
      let failed = 0;
      let deadLetter = 0;
      let totalRetries = 0;

      snapshot.forEach(doc => {
        const webhook = doc.data() as WebhookEvent;
        total++;
        totalRetries += webhook.retryCount;

        switch (webhook.status) {
          case 'completed':
            completed++;
            break;
          case 'pending':
          case 'processing':
            pending++;
            break;
          case 'failed':
            failed++;
            break;
          case 'dead_letter':
            deadLetter++;
            break;
        }
      });

      return {
        total,
        completed,
        pending,
        failed,
        deadLetter,
        totalRetries,
        averageRetries: total > 0 ? totalRetries / total : 0,
        successRate: total > 0 ? (completed / total) * 100 : 0,
        deadLetterRate: total > 0 ? (deadLetter / total) * 100 : 0,
      };
    } catch (error: any) {
      console.error('Get webhook stats error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get webhook statistics',
      );
    }
  });

/**
 * List dead letter queue events (admin function)
 */
export const listDeadLetterEvents = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    // Admin authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    // TODO: Add admin role verification

    try {
      const {limit = 50} = data;

      const deadLetterEvents = await db
        .collection('webhook_events')
        .where('status', '==', 'dead_letter')
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();

      const events = deadLetterEvents.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        events,
        total: events.length,
      };
    } catch (error: any) {
      console.error('List dead letter events error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to list dead letter events',
      );
    }
  });
