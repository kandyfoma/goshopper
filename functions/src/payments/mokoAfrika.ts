/**
 * Moko Afrika Payment Integration
 * Handles Mobile Money payments for DRC market
 * Supports: M-Pesa, Orange Money, Airtel Money, AfriMoney
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as crypto from 'crypto';
import {config, collections} from '../config';
import {MokoPaymentRequest, MokoPaymentResponse, PaymentRecord} from '../types';
import {sendPaymentSuccessNotification, sendPaymentFailedNotification} from '../notifications/paymentNotifications';

const db = admin.firestore();

/**
 * Generate signature for Moko Afrika API
 */
function generateSignature(payload: string): string {
  return crypto
    .createHmac('sha256', config.moko.secretKey)
    .update(payload)
    .digest('hex');
}

/**
 * Generate unique transaction ID
 */
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `GSA-${timestamp}-${random}`.toUpperCase();
}

/**
 * Map provider to Moko Afrika provider code
 */
function getProviderCode(provider: string): string {
  const providerMap: Record<string, string> = {
    mpesa: 'MPESA_CD',
    orange: 'ORANGE_CD',
    airtel: 'AIRTEL_CD',
    afrimoney: 'AFRIMONEY_CD',
  };
  return providerMap[provider] || 'MPESA_CD';
}

/**
 * Initiate Mobile Money payment via Moko Afrika
 */
export const initiateMokoPayment = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context): Promise<MokoPaymentResponse> => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to make payments',
      );
    }

    const userId = context.auth.uid;
    const request = data as MokoPaymentRequest;

    // Validate request
    if (!request.phoneNumber || !request.provider || !request.planId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Phone number, provider, and plan are required',
      );
    }

    // Validate phone number format (DRC format)
    const phoneRegex = /^(\+?243|0)?[89]\d{8}$/;
    if (!phoneRegex.test(request.phoneNumber.replace(/\s/g, ''))) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid phone number format. Use DRC format: +243XXXXXXXXX',
      );
    }

    // Get plan pricing
    const planPricing =
      config.pricing[request.planId as keyof typeof config.pricing];
    if (!planPricing) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid plan selected',
      );
    }

    const amount =
      request.currency === 'CDF'
        ? planPricing.price * 2700 // Approximate USD to CDF
        : planPricing.price;

    const transactionId = generateTransactionId();

    try {
      // Create payment record first
      const paymentRef = db
        .collection(collections.payments(userId))
        .doc(transactionId);
      const now = admin.firestore.FieldValue.serverTimestamp();

      const paymentRecord: Partial<PaymentRecord> = {
        userId,
        transactionId,
        amount,
        currency: request.currency || 'USD',
        provider: request.provider,
        phoneNumber: request.phoneNumber,
        planId: request.planId,
        status: 'pending',
        createdAt: now as unknown as Date,
        updatedAt: now as unknown as Date,
      };

      await paymentRef.set(paymentRecord);

      // Prepare Moko Afrika API request
      const mokoPayload = {
        merchant_id: config.moko.merchantId,
        transaction_id: transactionId,
        amount: amount.toFixed(2),
        currency: request.currency || 'USD',
        phone_number: request.phoneNumber.replace(/\s/g, ''),
        provider: getProviderCode(request.provider),
        description: `GoShopper ${request.planId} subscription`,
        callback_url: config.moko.callbackUrl,
        metadata: {
          user_id: userId,
          plan_id: request.planId,
        },
      };

      const signature = generateSignature(JSON.stringify(mokoPayload));

      // Call Moko Afrika API
      const response = await axios.post(
        `${config.moko.baseUrl}/payments/initiate`,
        mokoPayload,
        {
          headers: {
            Authorization: `Bearer ${config.moko.apiKey}`,
            'X-Signature': signature,
            'Content-Type': 'application/json',
          },
          timeout: 25000,
        },
      );

      // Update payment record with Moko reference
      await paymentRef.update({
        mokoReference: response.data.reference || response.data.transaction_id,
        status: response.data.status === 'PENDING' ? 'pending' : 'pending',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        transactionId,
        status: 'pending',
        message: 'Payment initiated. Please confirm on your phone.',
      };
    } catch (error) {
      console.error('Moko Afrika payment error:', error);

      // Update payment record as failed
      const paymentRef = db
        .collection(collections.payments(userId))
        .doc(transactionId);
      await paymentRef
        .update({
          status: 'failed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {}); // Ignore if not created

      if (axios.isAxiosError(error)) {
        const errorMessage =
          error.response?.data?.message || 'Payment service unavailable';
        throw new functions.https.HttpsError('unavailable', errorMessage);
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to initiate payment. Please try again.',
      );
    }
  });

/**
 * Verify payment status
 */
export const verifyMokoPayment = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const {transactionId} = data;

    if (!transactionId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Transaction ID required',
      );
    }

    try {
      // Get payment record
      const paymentRef = db
        .collection(collections.payments(userId))
        .doc(transactionId);
      const paymentDoc = await paymentRef.get();

      if (!paymentDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Payment not found');
      }

      const payment = paymentDoc.data() as PaymentRecord;

      // If already completed or failed, return current status
      if (payment.status === 'completed' || payment.status === 'failed') {
        return {
          success: payment.status === 'completed',
          status: payment.status,
          transactionId,
        };
      }

      // Query Moko Afrika for status
      const signature = generateSignature(transactionId);

      const response = await axios.get(
        `${config.moko.baseUrl}/payments/status/${
          payment.mokoReference || transactionId
        }`,
        {
          headers: {
            Authorization: `Bearer ${config.moko.apiKey}`,
            'X-Signature': signature,
          },
          timeout: 10000,
        },
      );

      const mokoStatus = response.data.status?.toUpperCase();
      let newStatus: PaymentRecord['status'] = 'pending';

      if (mokoStatus === 'COMPLETED' || mokoStatus === 'SUCCESS') {
        newStatus = 'completed';
      } else if (mokoStatus === 'FAILED' || mokoStatus === 'CANCELLED') {
        newStatus = 'failed';
      }

      // Update payment record
      await paymentRef.update({
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(newStatus === 'completed' && {
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      });

      // If completed, update subscription
      if (newStatus === 'completed') {
        await activateSubscription(
          userId,
          payment.planId as 'basic' | 'premium',
          payment,
        );
      }

      return {
        success: newStatus === 'completed',
        status: newStatus,
        transactionId,
      };
    } catch (error) {
      console.error('Payment verification error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to verify payment',
      );
    }
  });

/**
 * Webhook handler for Moko Afrika callbacks
 */
export const mokoPaymentWebhook = functions
  .region(config.app.region)
  .https.onRequest(async (req, res) => {
    // Verify webhook signature
    const signature = req.headers['x-signature'] as string;
    const expectedSignature = generateSignature(JSON.stringify(req.body));

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      res.status(401).json({error: 'Invalid signature'});
      return;
    }

    const {transaction_id, status, metadata} = req.body;

    if (!transaction_id || !status) {
      res.status(400).json({error: 'Missing required fields'});
      return;
    }

    try {
      const userId = metadata?.user_id;

      if (!userId) {
        console.error('Missing user_id in webhook metadata');
        res.status(400).json({error: 'Missing user_id'});
        return;
      }

      const paymentRef = db
        .collection(collections.payments(userId))
        .doc(transaction_id);
      const paymentDoc = await paymentRef.get();

      if (!paymentDoc.exists) {
        console.error('Payment not found:', transaction_id);
        res.status(404).json({error: 'Payment not found'});
        return;
      }

      const payment = paymentDoc.data() as PaymentRecord;

      const mokoStatus = status.toUpperCase();
      let newStatus: PaymentRecord['status'] = 'pending';

      if (mokoStatus === 'COMPLETED' || mokoStatus === 'SUCCESS') {
        newStatus = 'completed';
      } else if (mokoStatus === 'FAILED' || mokoStatus === 'CANCELLED') {
        newStatus = 'failed';
      }

      // Update payment record
      await paymentRef.update({
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(newStatus === 'completed' && {
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      });

      // If completed, activate subscription
      if (newStatus === 'completed') {
        await activateSubscription(
          userId,
          payment.planId as 'basic' | 'premium',
          payment,
        );
        
        // Send payment success notification
        await sendPaymentSuccessNotification(
          userId,
          payment.planId,
          payment.amount,
          payment.provider || 'mobile_money',
          transaction_id,
        );
      } else if (newStatus === 'failed') {
        // Send payment failed notification
        await sendPaymentFailedNotification(
          userId,
          payment.planId,
          payment.amount,
          payment.provider || 'mobile_money',
          status,
        );
      }

      res.status(200).json({success: true, status: newStatus});
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({error: 'Internal server error'});
    }
  });

/**
 * Helper: Activate subscription after successful payment
 */
async function activateSubscription(
  userId: string,
  planId: 'basic' | 'premium',
  payment: PaymentRecord,
): Promise<void> {
  const subscriptionRef = db.doc(collections.subscription(userId));
  const now = new Date();

  // Check for existing active subscription
  const existingSubscription = await subscriptionRef.get();
  const existingData = existingSubscription.exists
    ? (existingSubscription.data() as any)
    : null;

  // Calculate subscription end date
  let endDate: Date;
  
  // Calculate bonus scans from remaining trial/previous plan
  let bonusScans = 0;
  
  if (existingData) {
    // Calculate remaining scans from trial
    if (existingData.status === 'trial' || !existingData.isSubscribed) {
      const trialLimit = existingData.trialScansLimit || config.app.trialScanLimit;
      const trialUsed = existingData.trialScansUsed || 0;
      const trialRemaining = Math.max(0, trialLimit - trialUsed);
      bonusScans += trialRemaining;
      console.log(`Carrying over ${trialRemaining} remaining trial scans`);
    }
    
    // Calculate remaining scans from previous subscription
    if (existingData.isSubscribed && existingData.status === 'active') {
      const prevPlanLimit = existingData.planId === 'premium' ? 1000 : 
                           existingData.planId === 'standard' ? 100 : 25;
      const monthlyUsed = existingData.monthlyScansUsed || 0;
      const monthlyRemaining = Math.max(0, prevPlanLimit - monthlyUsed);
      bonusScans += monthlyRemaining;
      console.log(`Carrying over ${monthlyRemaining} remaining monthly scans from ${existingData.planId} plan`);
    }
  }

  if (
    existingData?.isSubscribed &&
    existingData?.subscriptionEndDate &&
    existingData.status === 'active'
  ) {
    // User has active subscription - extend from current end date
    const currentEndDate =
      existingData.subscriptionEndDate instanceof admin.firestore.Timestamp
        ? existingData.subscriptionEndDate.toDate()
        : new Date(existingData.subscriptionEndDate);

    if (currentEndDate > now) {
      // Add 1 month to existing end date (user keeps remaining time)
      endDate = new Date(currentEndDate);
      endDate.setMonth(endDate.getMonth() + 1);
      console.log(
        `Extending subscription from ${currentEndDate.toISOString()} to ${endDate.toISOString()}`,
      );
    } else {
      // Old subscription expired, start fresh
      endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);
    }
  } else {
    // No active subscription, start fresh
    endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Calculate starting scans: negative monthlyScansUsed means bonus scans
  // E.g., if user has 3 remaining and buys basic (25), they get 28 total
  // We set monthlyScansUsed to -bonusScans, so 25 - (-3) = 28 available
  const startingScansUsed = bonusScans > 0 ? -bonusScans : 0;
  console.log(`New subscription starts with ${bonusScans} bonus scans (monthlyScansUsed: ${startingScansUsed})`);

  await subscriptionRef.set(
    {
      userId,
      isSubscribed: true,
      planId,
      status: 'active',
      subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
      lastPaymentDate: admin.firestore.Timestamp.fromDate(now),
      lastPaymentAmount: payment.amount,
      currency: payment.currency,
      paymentMethod: 'mobile_money',
      paymentProvider: 'moko_afrika',
      mobileMoneyProvider: payment.provider as
        | 'mpesa'
        | 'orange'
        | 'airtel'
        | 'afrimoney',
      transactionId: payment.transactionId,
      customerPhone: payment.phoneNumber,
      autoRenew: true,
      monthlyScansUsed: startingScansUsed, // Negative value = bonus scans carried over
      bonusScansCarriedOver: bonusScans, // Track for transparency
      // Preserve trial info
      trialScansUsed: admin.firestore.FieldValue.increment(0),
      trialScansLimit: config.app.trialScanLimit,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  console.log(`Subscription activated for user ${userId}, plan: ${planId}, bonus scans: ${bonusScans}`);
}

/**
 * Activate subscription from Railway Payment Hub
 * Called by GoShopper after Supabase confirms payment success
 */
export const activateSubscriptionFromRailway = functions
  .region('europe-west1')
  .https.onCall(
  async (data, context) => {
    // Log request details for debugging
    console.log('📱 activateSubscriptionFromRailway called');
    console.log('🔐 Auth context:', context.auth ? `User: ${context.auth.uid}` : 'NOT AUTHENTICATED');
    
    // Verify user is authenticated
    if (!context.auth) {
      console.error('❌ No auth context provided');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const userId = context.auth.uid;
    const {planId, transactionId, amount, phoneNumber, currency = 'USD'} = data;

    if (!planId || !transactionId || !amount || !phoneNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: planId, transactionId, amount, phoneNumber'
      );
    }

    // Validate plan ID
    if (!['basic', 'premium'].includes(planId)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid plan ID. Must be "basic" or "premium"'
      );
    }

    try {
      console.log(`🎯 Activating subscription for user ${userId}, plan: ${planId}, transaction: ${transactionId}`);

      const now = new Date();
      
      // Create payment record
      const paymentRecord: PaymentRecord = {
        userId,
        planId,
        amount,
        currency,
        phoneNumber,
        provider: 'freshpay',
        transactionId,
        mokoReference: transactionId,
        status: 'completed',
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      // Store payment record in Firestore (convert to Timestamps for storage)
      const paymentRef = db.collection('payments').doc(transactionId);
      await paymentRef.set({
        ...paymentRecord,
        completedAt: admin.firestore.Timestamp.fromDate(now),
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      });

      // Activate subscription
      await activateSubscription(userId, planId as 'basic' | 'premium', paymentRecord);

      // Send success notification
      await sendPaymentSuccessNotification(userId, planId, amount, currency);

      console.log(`✅ Subscription activated successfully for user ${userId}`);

      return {
        success: true,
        message: 'Subscription activated successfully',
        planId,
        transactionId,
      };
    } catch (error: any) {
      console.error('Subscription activation error:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to activate subscription'
      );
    }
  }
);

