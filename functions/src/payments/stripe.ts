/**
 * Stripe Payment Integration
 * Handles Visa/Card payments for international users (outside DRC)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { config, collections } from '../config';
import { PaymentRecord } from '../types';

const db = admin.firestore();

// Initialize Stripe
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

/**
 * Generate unique transaction ID for card payments
 */
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `GSA-CARD-${timestamp}-${random}`.toUpperCase();
}

/**
 * Create a Stripe PaymentIntent for card payments
 */
export const createCardPaymentIntent = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to make payments'
      );
    }

    const userId = context.auth.uid;
    const { planId, currency = 'USD', email } = data;

    // Validate request
    if (!planId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Plan ID is required'
      );
    }

    // Get plan pricing
    const planPricing = config.pricing[planId as keyof typeof config.pricing];
    if (!planPricing) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid plan selected'
      );
    }

    const amount = Math.round(planPricing.price * 100); // Stripe uses cents
    const transactionId = generateTransactionId();

    try {
      // Create payment record first
      const paymentRef = db.collection(collections.payments(userId)).doc(transactionId);
      const now = admin.firestore.FieldValue.serverTimestamp();

      const paymentRecord: Partial<PaymentRecord> = {
        userId,
        transactionId,
        amount: planPricing.price,
        currency: currency as 'USD' | 'CDF',
        provider: 'stripe',
        phoneNumber: '', // Not applicable for card payments
        planId,
        status: 'pending',
        createdAt: now as unknown as Date,
        updatedAt: now as unknown as Date,
      };

      await paymentRef.set(paymentRecord);

      // Create Stripe PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          userId,
          planId,
          transactionId,
        },
        receipt_email: email || undefined,
        description: `GoShopperAI ${planId} subscription`,
      });

      // Update payment record with Stripe reference
      await paymentRef.update({
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        transactionId,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: unknown) {
      console.error('Stripe payment intent error:', error);

      if (error instanceof Stripe.errors.StripeError) {
        throw new functions.https.HttpsError('unavailable', error.message);
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to create payment. Please try again.'
      );
    }
  });

/**
 * Confirm card payment after successful Stripe payment
 */
export const confirmCardPayment = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const { paymentIntentId, transactionId } = data;

    if (!paymentIntentId || !transactionId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Payment intent ID and transaction ID required'
      );
    }

    try {
      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Verify metadata matches
      if (paymentIntent.metadata.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Payment not authorized');
      }

      const paymentRef = db.collection(collections.payments(userId)).doc(transactionId);
      const paymentDoc = await paymentRef.get();

      if (!paymentDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Payment not found');
      }

      const payment = paymentDoc.data() as PaymentRecord;

      // Check Stripe payment status
      if (paymentIntent.status === 'succeeded') {
        // Update payment record
        await paymentRef.update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Activate subscription
        await activateCardSubscription(
          userId,
          payment.planId as 'basic' | 'standard' | 'premium',
          payment,
          paymentIntentId
        );

        return {
          success: true,
          status: 'completed',
          transactionId,
        };
      } else {
        // Update as failed
        await paymentRef.update({
          status: 'failed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          success: false,
          status: paymentIntent.status,
          transactionId,
        };
      }
    } catch (error) {
      console.error('Card payment confirmation error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError('internal', 'Failed to confirm payment');
    }
  });

/**
 * Stripe webhook handler for payment events
 */
export const stripeWebhook = functions
  .region(config.app.region)
  .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle payment_intent.succeeded
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { userId, planId, transactionId } = paymentIntent.metadata;

      if (userId && planId && transactionId) {
        try {
          const paymentRef = db.collection(collections.payments(userId)).doc(transactionId);
          const paymentDoc = await paymentRef.get();

          if (paymentDoc.exists) {
            const payment = paymentDoc.data() as PaymentRecord;

            // Only process if not already completed
            if (payment.status !== 'completed') {
              await paymentRef.update({
                status: 'completed',
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              await activateCardSubscription(
                userId,
                planId as 'basic' | 'standard' | 'premium',
                payment,
                paymentIntent.id
              );
            }
          }
        } catch (error) {
          console.error('Webhook processing error:', error);
        }
      }
    }

    // Handle payment_intent.payment_failed
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { userId, transactionId } = paymentIntent.metadata;

      if (userId && transactionId) {
        try {
          const paymentRef = db.collection(collections.payments(userId)).doc(transactionId);
          await paymentRef.update({
            status: 'failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (error) {
          console.error('Failed payment webhook error:', error);
        }
      }
    }

    res.status(200).json({ received: true });
  });

/**
 * Helper: Activate subscription after successful card payment
 */
async function activateCardSubscription(
  userId: string,
  planId: 'basic' | 'standard' | 'premium',
  payment: PaymentRecord,
  stripePaymentIntentId: string
): Promise<void> {
  const subscriptionRef = db.doc(collections.subscription(userId));
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

  const billingPeriodStart = new Date(now);
  const billingPeriodEnd = new Date(now);
  billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);

  const planScanLimits: Record<string, number> = {
    basic: 25,
    standard: 100,
    premium: -1,
  };

  await subscriptionRef.set(
    {
      userId,
      isSubscribed: true,
      planId,
      status: 'active',
      monthlyScansUsed: 0,
      currentBillingPeriodStart: admin.firestore.Timestamp.fromDate(billingPeriodStart),
      currentBillingPeriodEnd: admin.firestore.Timestamp.fromDate(billingPeriodEnd),
      subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
      lastPaymentDate: admin.firestore.Timestamp.fromDate(now),
      lastPaymentAmount: payment.amount,
      currency: payment.currency,
      paymentMethod: 'card',
      paymentProvider: 'stripe',
      transactionId: payment.transactionId,
      stripePaymentIntentId,
      autoRenew: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`Card subscription activated for user ${userId}, plan: ${planId}`);
}
