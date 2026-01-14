/**
 * Auto-Renewal Processing System
 * Automatically renews subscriptions when they expire with autoRenew=true
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {addDays} from 'date-fns';
import {config, collections} from '../config';
import {Subscription} from '../types';

const db = admin.firestore();

// Configuration
const RENEWAL_LOOKBACK_DAYS = 1; // Process subscriptions expiring in next 1 day
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_DAYS = [1, 3, 7]; // Retry after 1, 3, and 7 days

// Base monthly prices per plan (USD)
const BASE_PRICES: Record<string, number> = {
  basic: 1.99,
  standard: 2.99,
  premium: 4.99,
};



/**
 * Generate unique transaction ID for auto-renewal
 */
function generateRenewalTransactionId(subscriptionId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `GSA-RENEW-${timestamp}-${random}`.toUpperCase();
}

/**
 * Process Moko Afrika auto-renewal
 */
async function processMokoRenewal(
  userId: string,
  subscription: Subscription,
  subscriptionRef: FirebaseFirestore.DocumentReference,
): Promise<{success: boolean; message: string; transactionId?: string}> {
  try {
    // Check if we have phone number and provider
    if (!subscription.customerPhone || !subscription.mobileMoneyProvider) {
      return {
        success: false,
        message: 'No mobile money payment method on file',
      };
    }

    // C1 FIX: Check for pending downgrade and apply before renewal
    let planId = subscription.planId || 'basic';
    let amount = BASE_PRICES[planId] || BASE_PRICES.basic;
    let appliedDowngrade = false;
    
    if (subscription.pendingDowngradePlanId) {
      const now = new Date();
      const downgradeDate = subscription.pendingDowngradeEffectiveDate instanceof admin.firestore.Timestamp
        ? subscription.pendingDowngradeEffectiveDate.toDate()
        : subscription.pendingDowngradeEffectiveDate
        ? new Date(subscription.pendingDowngradeEffectiveDate)
        : now;
      
      if (now >= downgradeDate) {
        planId = subscription.pendingDowngradePlanId;
        amount = BASE_PRICES[planId] || BASE_PRICES.basic;
        appliedDowngrade = true;
        
        console.log(`📉 Applying scheduled downgrade before renewal: ${subscription.planId} → ${planId}`);
      }
    }
    
    const transactionId = generateRenewalTransactionId(userId);

    // Call Moko Afrika API for automatic renewal
    const mokoApiUrl = `${config.moko.baseUrl}/payments/auto-renew`;
    const mokoResponse = await fetch(mokoApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.moko.apiKey,
        'X-Secret-Key': config.moko.secretKey,
      },
      body: JSON.stringify({
        amount,
        currency: 'USD',
        phoneNumber: subscription.customerPhone,
        provider: subscription.mobileMoneyProvider,
        planId,
        transactionId,
        description: `GoShopper ${planId} plan auto-renewal`,
        userId,
      }),
    });

    if (!mokoResponse.ok) {
      const errorData = await mokoResponse.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.message || 'Moko Afrika API request failed',
      };
    }

    const mokoData = await mokoResponse.json();

    if (mokoData.status === 'completed' || mokoData.status === 'approved') {
      // Payment successful - extend subscription
      const now = new Date();
      const currentEndDate =
        subscription.subscriptionEndDate instanceof admin.firestore.Timestamp
          ? subscription.subscriptionEndDate.toDate()
          : new Date(subscription.subscriptionEndDate!);

      const newStartDate = currentEndDate > now ? currentEndDate : now;
      const newEndDate = addDays(newStartDate, 30); // 1 month renewal

      // C2 FIX: Use transaction for atomic update
      await admin.firestore().runTransaction(async (transaction) => {
        const latestDoc = await transaction.get(subscriptionRef);
        if (!latestDoc.exists) {
          throw new Error('Subscription not found');
        }

        const updateData: any = {
          subscriptionEndDate: admin.firestore.Timestamp.fromDate(newEndDate),
          lastPaymentDate: admin.firestore.Timestamp.fromDate(now),
          lastPaymentAmount: amount,
          transactionId,
          mokoReference: mokoData.reference,
          status: 'active',
          autoRenewFailureCount: 0,
          lastRenewalAttemptDate: admin.firestore.Timestamp.fromDate(now),
          expirationNotificationSent: false,
          expirationNotificationDate: null,
          daysUntilExpiration: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        
        // Clear pending downgrade if applied
        if (appliedDowngrade) {
          updateData.planId = planId;
          updateData.subscriptionPrice = amount;
          updateData.pendingDowngradePlanId = admin.firestore.FieldValue.delete();
          updateData.pendingDowngradeEffectiveDate = admin.firestore.FieldValue.delete();
        }
        
        transaction.update(subscriptionRef, updateData);
      });

      console.log(`✅ Moko renewal successful for user ${userId}: ${transactionId}`);

      return {
        success: true,
        message: 'Renewal successful',
        transactionId,
      };
    } else if (mokoData.status === 'pending') {
      return {
        success: false,
        message: 'Payment pending user approval',
      };
    } else {
      return {
        success: false,
        message: mokoData.message || 'Mobile money payment failed',
      };
    }
  } catch (error: any) {
    console.error('Moko renewal error:', error);
    return {
      success: false,
      message: error.message || 'Mobile money payment failed',
    };
  }
}

/**
 * Send renewal failure notification
 */
async function sendRenewalFailureNotification(
  userId: string,
  subscription: Subscription,
  failureCount: number,
  nextRetryDate: Date | null,
): Promise<void> {
  try {
    // Create notification document
    const notificationsRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('notifications');

    const message = nextRetryDate
      ? `Your ${subscription.planId} subscription auto-renewal failed (attempt ${failureCount}/${MAX_RETRY_ATTEMPTS}). We'll retry on ${nextRetryDate.toLocaleDateString()}.`
      : `Your ${subscription.planId} subscription auto-renewal failed after ${MAX_RETRY_ATTEMPTS} attempts. Please update your payment method.`;

    await notificationsRef.add({
      type: 'subscription_renewal_failed',
      title: 'Subscription Renewal Failed',
      titleFr: 'Échec du renouvellement',
      message,
      messageFr: nextRetryDate
        ? `Le renouvellement automatique de votre abonnement ${subscription.planId} a échoué (tentative ${failureCount}/${MAX_RETRY_ATTEMPTS}). Nous réessaierons le ${nextRetryDate.toLocaleDateString()}.`
        : `Le renouvellement automatique de votre abonnement ${subscription.planId} a échoué après ${MAX_RETRY_ATTEMPTS} tentatives. Veuillez mettre à jour votre mode de paiement.`,
      priority: 'high',
      read: false,
      actionUrl: '/subscription',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📧 Sent renewal failure notification to user ${userId}`);
  } catch (error) {
    console.error('Error sending renewal failure notification:', error);
  }
}

/**
 * Send renewal success notification
 */
async function sendRenewalSuccessNotification(
  userId: string,
  subscription: Subscription,
  transactionId: string,
  newEndDate: Date,
): Promise<void> {
  try {
    const notificationsRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('notifications');

    await notificationsRef.add({
      type: 'subscription_renewed',
      title: 'Subscription Renewed',
      titleFr: 'Abonnement renouvelé',
      message: `Your ${subscription.planId} subscription has been automatically renewed until ${newEndDate.toLocaleDateString()}.`,
      messageFr: `Votre abonnement ${subscription.planId} a été automatiquement renouvelé jusqu'au ${newEndDate.toLocaleDateString()}.`,
      priority: 'medium',
      read: false,
      transactionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📧 Sent renewal success notification to user ${userId}`);
  } catch (error) {
    console.error('Error sending renewal success notification:', error);
  }
}

/**
 * Scheduled function to process auto-renewals
 * Runs daily at 3 AM Africa/Kinshasa time
 */
export const processAutoRenewals = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '512MB',
  })
  .pubsub.schedule('0 3 * * *')
  .timeZone('Africa/Kinshasa')
  .onRun(async context => {
    try {
      const now = new Date();
      const lookAheadDate = addDays(now, RENEWAL_LOOKBACK_DAYS);

      console.log(`🔄 Starting auto-renewal processing at ${now.toISOString()}`);

      // Find subscriptions that:
      // 1. Have autoRenew enabled
      // 2. Are expiring within RENEWAL_LOOKBACK_DAYS
      // 3. Have active or expiring_soon status
      const subscriptionsToRenew = await db
        .collectionGroup('subscription')
        .where('autoRenew', '==', true)
        .where('subscriptionEndDate', '<=', admin.firestore.Timestamp.fromDate(lookAheadDate))
        .where('subscriptionEndDate', '>', admin.firestore.Timestamp.fromDate(now))
        .get();

      console.log(`📋 Found ${subscriptionsToRenew.size} subscriptions to process`);

      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;

      for (const doc of subscriptionsToRenew.docs) {
        const subscription = doc.data() as Subscription;
        const userId = subscription.userId;

        console.log(`\n🔄 Processing renewal for user ${userId}`);

        // Check if subscription is in valid state
        if (subscription.status !== 'active' && subscription.status !== 'expiring_soon') {
          console.log(`⏭️ Skipping - invalid status: ${subscription.status}`);
          skippedCount++;
          continue;
        }

        // Check retry logic - don't retry if we've exceeded max attempts
        const failureCountField = subscription.autoRenewFailureCount || 0;
        if (failureCountField >= MAX_RETRY_ATTEMPTS) {
          console.log(`⏭️ Skipping - max retry attempts reached (${failureCountField})`);
          
          // C4 FIX: Disable auto-renew with error handling
          try {
            await doc.ref.update({
              autoRenew: false,
              status: 'expiring_soon',
              autoRenewDisabledReason: 'max_failures_reached',
              autoRenewDisabledAt: admin.firestore.Timestamp.fromDate(now),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            console.log(`🔒 Auto-renewal disabled for user ${userId} after max failures`);
          } catch (updateError: any) {
            console.error(`CRITICAL: Failed to disable autoRenew for user ${userId}:`, updateError);
            
            // Add to dead letter queue for manual intervention
            await db.collection('admin_actions_required').add({
              type: 'disable_auto_renew',
              userId,
              subscriptionId: doc.id,
              reason: 'Failed to disable after max attempts',
              error: updateError.message,
              priority: 'critical',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          
          skippedCount++;
          continue;
        }

        // Check if we should retry based on last attempt
        if (subscription.lastRenewalAttemptDate && failureCountField > 0) {
          const lastAttempt =
            subscription.lastRenewalAttemptDate instanceof admin.firestore.Timestamp
              ? subscription.lastRenewalAttemptDate.toDate()
              : new Date(subscription.lastRenewalAttemptDate);

          const retryDelayDays = RETRY_DELAYS_DAYS[failureCountField - 1] || RETRY_DELAYS_DAYS[RETRY_DELAYS_DAYS.length - 1];
          const nextRetryDate = addDays(lastAttempt, retryDelayDays);

          if (now < nextRetryDate) {
            console.log(`⏭️ Skipping - next retry scheduled for ${nextRetryDate.toISOString()}`);
            skippedCount++;
            continue;
          }
        }

        // Process renewal based on payment provider
        let result;
        if (subscription.paymentProvider === 'moko_afrika') {
          result = await processMokoRenewal(userId, subscription, doc.ref);
        } else {
          console.log(`⏭️ Skipping - unknown or unsupported payment provider: ${subscription.paymentProvider}`);
          skippedCount++;
          continue;
        }

        if (result.success) {
          successCount++;
          
          // Get updated subscription to get new end date
          const updatedDoc = await doc.ref.get();
          const updatedSub = updatedDoc.data() as Subscription;
          const newEndDate = updatedSub.subscriptionEndDate instanceof admin.firestore.Timestamp
            ? updatedSub.subscriptionEndDate.toDate()
            : new Date(updatedSub.subscriptionEndDate!);
          
          // Send success notification
          await sendRenewalSuccessNotification(userId, subscription, result.transactionId!, newEndDate);
        } else {
          failureCount++;
          const newFailureCount = failureCountField + 1;

          // Update failure count
          await doc.ref.update({
            autoRenewFailureCount: newFailureCount,
            lastRenewalAttemptDate: admin.firestore.Timestamp.fromDate(now),
            lastRenewalFailureReason: result.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Calculate next retry date
          const nextRetryDate = newFailureCount < MAX_RETRY_ATTEMPTS
            ? addDays(now, RETRY_DELAYS_DAYS[newFailureCount - 1])
            : null;

          // Send failure notification
          await sendRenewalFailureNotification(userId, subscription, newFailureCount, nextRetryDate);

          console.log(`❌ Renewal failed for user ${userId}: ${result.message}`);
        }
      }

      console.log(`\n✅ Auto-renewal processing complete:`);
      console.log(`   Success: ${successCount}`);
      console.log(`   Failures: ${failureCount}`);
      console.log(`   Skipped: ${skippedCount}`);

      return null;
    } catch (error) {
      console.error('Auto-renewal processing error:', error);
      return null;
    }
  });

/**
 * Manually trigger auto-renewal for a specific user (admin function)
 */
export const manuallyRenewSubscription = functions
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

    // TODO: Add admin role check
    // For now, users can only renew their own subscriptions
    const requestingUserId = context.auth.uid;
    const {userId = requestingUserId} = data;

    if (userId !== requestingUserId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Can only renew your own subscription',
      );
    }

    try {
      const subscriptionRef = db.doc(collections.subscription(userId));
      const subscriptionDoc = await subscriptionRef.get();

      if (!subscriptionDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Subscription not found',
        );
      }

      const subscription = subscriptionDoc.data() as Subscription;

      if (!subscription.autoRenew) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Auto-renewal is not enabled',
        );
      }

      // Process renewal based on provider
      let result;
      if (subscription.paymentProvider === 'moko_afrika') {
        result = await processMokoRenewal(userId, subscription, subscriptionRef);
      } else {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No valid payment method on file or unsupported payment provider',
        );
      }

      if (result.success) {
        const updatedDoc = await subscriptionRef.get();
        const updatedSub = updatedDoc.data() as Subscription;
        const newEndDate = updatedSub.subscriptionEndDate instanceof admin.firestore.Timestamp
          ? updatedSub.subscriptionEndDate.toDate()
          : new Date(updatedSub.subscriptionEndDate!);

        await sendRenewalSuccessNotification(userId, subscription, result.transactionId!, newEndDate);

        return {
          success: true,
          message: 'Subscription renewed successfully',
          transactionId: result.transactionId,
          expiresAt: newEndDate.toISOString(),
        };
      } else {
        throw new functions.https.HttpsError(
          'internal',
          result.message || 'Renewal failed',
        );
      }
    } catch (error: any) {
      console.error('Manual renewal error:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        'internal',
        'Failed to process renewal',
      );
    }
  });
