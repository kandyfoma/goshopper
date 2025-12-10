"use strict";
/**
 * Stripe Payment Integration
 * Handles Visa/Card payments for international users (outside DRC)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.confirmCardPayment = exports.createCardPaymentIntent = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const config_1 = require("../config");
const db = admin.firestore();
// Initialize Stripe
const stripe = new stripe_1.default(config_1.config.stripe.secretKey, {
    apiVersion: '2023-10-16',
});
/**
 * Generate unique transaction ID for card payments
 */
function generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `GSA-CARD-${timestamp}-${random}`.toUpperCase();
}
/**
 * Create a Stripe PaymentIntent for card payments
 */
exports.createCardPaymentIntent = functions
    .region(config_1.config.app.region)
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to make payments');
    }
    const userId = context.auth.uid;
    const { planId, currency = 'USD', email } = data;
    // Validate request
    if (!planId) {
        throw new functions.https.HttpsError('invalid-argument', 'Plan ID is required');
    }
    // Get plan pricing
    const planPricing = config_1.config.pricing[planId];
    if (!planPricing) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid plan selected');
    }
    const amount = Math.round(planPricing.price * 100); // Stripe uses cents
    const transactionId = generateTransactionId();
    try {
        // Create payment record first
        const paymentRef = db.collection(config_1.collections.payments(userId)).doc(transactionId);
        const now = admin.firestore.FieldValue.serverTimestamp();
        const paymentRecord = {
            userId,
            transactionId,
            amount: planPricing.price,
            currency: currency,
            provider: 'stripe',
            phoneNumber: '', // Not applicable for card payments
            planId,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
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
    }
    catch (error) {
        console.error('Stripe payment intent error:', error);
        const stripeError = error;
        if (stripeError.message) {
            throw new functions.https.HttpsError('unavailable', stripeError.message);
        }
        throw new functions.https.HttpsError('internal', 'Failed to create payment. Please try again.');
    }
});
/**
 * Confirm card payment after successful Stripe payment
 */
exports.confirmCardPayment = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const userId = context.auth.uid;
    const { paymentIntentId, transactionId } = data;
    if (!paymentIntentId || !transactionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Payment intent ID and transaction ID required');
    }
    try {
        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        // Verify metadata matches
        if (paymentIntent.metadata.userId !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'Payment not authorized');
        }
        const paymentRef = db.collection(config_1.collections.payments(userId)).doc(transactionId);
        const paymentDoc = await paymentRef.get();
        if (!paymentDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Payment not found');
        }
        const payment = paymentDoc.data();
        // Check Stripe payment status
        if (paymentIntent.status === 'succeeded') {
            // Update payment record
            await paymentRef.update({
                status: 'completed',
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Activate subscription
            await activateCardSubscription(userId, payment.planId, payment, paymentIntentId);
            return {
                success: true,
                status: 'completed',
                transactionId,
            };
        }
        else {
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
    }
    catch (error) {
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
exports.stripeWebhook = functions
    .region(config_1.config.app.region)
    .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, config_1.config.stripe.webhookSecret);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Handle payment_intent.succeeded
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const { userId, planId, transactionId } = paymentIntent.metadata;
        if (userId && planId && transactionId) {
            try {
                const paymentRef = db.collection(config_1.collections.payments(userId)).doc(transactionId);
                const paymentDoc = await paymentRef.get();
                if (paymentDoc.exists) {
                    const payment = paymentDoc.data();
                    // Only process if not already completed
                    if (payment.status !== 'completed') {
                        await paymentRef.update({
                            status: 'completed',
                            completedAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        await activateCardSubscription(userId, planId, payment, paymentIntent.id);
                    }
                }
            }
            catch (error) {
                console.error('Webhook processing error:', error);
            }
        }
    }
    // Handle payment_intent.payment_failed
    if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        const { userId, transactionId } = paymentIntent.metadata;
        if (userId && transactionId) {
            try {
                const paymentRef = db.collection(config_1.collections.payments(userId)).doc(transactionId);
                await paymentRef.update({
                    status: 'failed',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            catch (error) {
                console.error('Failed payment webhook error:', error);
            }
        }
    }
    res.status(200).json({ received: true });
});
/**
 * Helper: Activate subscription after successful card payment
 */
async function activateCardSubscription(userId, planId, payment, stripePaymentIntentId) {
    const subscriptionRef = db.doc(config_1.collections.subscription(userId));
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription
    const billingPeriodStart = new Date(now);
    const billingPeriodEnd = new Date(now);
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
    await subscriptionRef.set({
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
    }, { merge: true });
    console.log(`Card subscription activated for user ${userId}, plan: ${planId}`);
}
//# sourceMappingURL=stripe.js.map