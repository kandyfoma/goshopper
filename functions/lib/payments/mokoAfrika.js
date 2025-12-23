"use strict";
/**
 * Moko Afrika Payment Integration
 * Handles Mobile Money payments for DRC market
 * Supports: M-Pesa, Orange Money, Airtel Money, AfriMoney
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
exports.activateSubscriptionFromRailway = exports.mokoPaymentWebhook = exports.verifyMokoPayment = exports.initiateMokoPayment = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const config_1 = require("../config");
const paymentNotifications_1 = require("../notifications/paymentNotifications");
const db = admin.firestore();
/**
 * Generate signature for Moko Afrika API
 */
function generateSignature(payload) {
    return crypto
        .createHmac('sha256', config_1.config.moko.secretKey)
        .update(payload)
        .digest('hex');
}
/**
 * Generate unique transaction ID
 */
function generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `GSA-${timestamp}-${random}`.toUpperCase();
}
/**
 * Map provider to Moko Afrika provider code
 */
function getProviderCode(provider) {
    const providerMap = {
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
exports.initiateMokoPayment = functions
    .region(config_1.config.app.region)
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
})
    .https.onCall(async (data, context) => {
    var _a, _b;
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to make payments');
    }
    const userId = context.auth.uid;
    const request = data;
    // Validate request
    if (!request.phoneNumber || !request.provider || !request.planId) {
        throw new functions.https.HttpsError('invalid-argument', 'Phone number, provider, and plan are required');
    }
    // Validate phone number format (DRC format)
    const phoneRegex = /^(\+?243|0)?[89]\d{8}$/;
    if (!phoneRegex.test(request.phoneNumber.replace(/\s/g, ''))) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid phone number format. Use DRC format: +243XXXXXXXXX');
    }
    // Get plan pricing
    const planPricing = config_1.config.pricing[request.planId];
    if (!planPricing) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid plan selected');
    }
    const amount = request.currency === 'CDF'
        ? planPricing.price * 2700 // Approximate USD to CDF
        : planPricing.price;
    const transactionId = generateTransactionId();
    try {
        // Create payment record first
        const paymentRef = db
            .collection(config_1.collections.payments(userId))
            .doc(transactionId);
        const now = admin.firestore.FieldValue.serverTimestamp();
        const paymentRecord = {
            userId,
            transactionId,
            amount,
            currency: request.currency || 'USD',
            provider: request.provider,
            phoneNumber: request.phoneNumber,
            planId: request.planId,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        };
        await paymentRef.set(paymentRecord);
        // Prepare Moko Afrika API request
        const mokoPayload = {
            merchant_id: config_1.config.moko.merchantId,
            transaction_id: transactionId,
            amount: amount.toFixed(2),
            currency: request.currency || 'USD',
            phone_number: request.phoneNumber.replace(/\s/g, ''),
            provider: getProviderCode(request.provider),
            description: `GoShopper ${request.planId} subscription`,
            callback_url: config_1.config.moko.callbackUrl,
            metadata: {
                user_id: userId,
                plan_id: request.planId,
            },
        };
        const signature = generateSignature(JSON.stringify(mokoPayload));
        // Call Moko Afrika API
        const response = await axios_1.default.post(`${config_1.config.moko.baseUrl}/payments/initiate`, mokoPayload, {
            headers: {
                Authorization: `Bearer ${config_1.config.moko.apiKey}`,
                'X-Signature': signature,
                'Content-Type': 'application/json',
            },
            timeout: 25000,
        });
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
    }
    catch (error) {
        console.error('Moko Afrika payment error:', error);
        // Update payment record as failed
        const paymentRef = db
            .collection(config_1.collections.payments(userId))
            .doc(transactionId);
        await paymentRef
            .update({
            status: 'failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
            .catch(() => { }); // Ignore if not created
        if (axios_1.default.isAxiosError(error)) {
            const errorMessage = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Payment service unavailable';
            throw new functions.https.HttpsError('unavailable', errorMessage);
        }
        throw new functions.https.HttpsError('internal', 'Failed to initiate payment. Please try again.');
    }
});
/**
 * Verify payment status
 */
exports.verifyMokoPayment = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const userId = context.auth.uid;
    const { transactionId } = data;
    if (!transactionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Transaction ID required');
    }
    try {
        // Get payment record
        const paymentRef = db
            .collection(config_1.collections.payments(userId))
            .doc(transactionId);
        const paymentDoc = await paymentRef.get();
        if (!paymentDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Payment not found');
        }
        const payment = paymentDoc.data();
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
        const response = await axios_1.default.get(`${config_1.config.moko.baseUrl}/payments/status/${payment.mokoReference || transactionId}`, {
            headers: {
                Authorization: `Bearer ${config_1.config.moko.apiKey}`,
                'X-Signature': signature,
            },
            timeout: 10000,
        });
        const mokoStatus = (_a = response.data.status) === null || _a === void 0 ? void 0 : _a.toUpperCase();
        let newStatus = 'pending';
        if (mokoStatus === 'COMPLETED' || mokoStatus === 'SUCCESS') {
            newStatus = 'completed';
        }
        else if (mokoStatus === 'FAILED' || mokoStatus === 'CANCELLED') {
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
            await activateSubscription(userId, payment.planId, payment);
        }
        return {
            success: newStatus === 'completed',
            status: newStatus,
            transactionId,
        };
    }
    catch (error) {
        console.error('Payment verification error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to verify payment');
    }
});
/**
 * Webhook handler for Moko Afrika callbacks
 */
exports.mokoPaymentWebhook = functions
    .region(config_1.config.app.region)
    .https.onRequest(async (req, res) => {
    // Verify webhook signature
    const signature = req.headers['x-signature'];
    const expectedSignature = generateSignature(JSON.stringify(req.body));
    if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
    }
    const { transaction_id, status, metadata } = req.body;
    if (!transaction_id || !status) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }
    try {
        const userId = metadata === null || metadata === void 0 ? void 0 : metadata.user_id;
        if (!userId) {
            console.error('Missing user_id in webhook metadata');
            res.status(400).json({ error: 'Missing user_id' });
            return;
        }
        const paymentRef = db
            .collection(config_1.collections.payments(userId))
            .doc(transaction_id);
        const paymentDoc = await paymentRef.get();
        if (!paymentDoc.exists) {
            console.error('Payment not found:', transaction_id);
            res.status(404).json({ error: 'Payment not found' });
            return;
        }
        const payment = paymentDoc.data();
        const mokoStatus = status.toUpperCase();
        let newStatus = 'pending';
        if (mokoStatus === 'COMPLETED' || mokoStatus === 'SUCCESS') {
            newStatus = 'completed';
        }
        else if (mokoStatus === 'FAILED' || mokoStatus === 'CANCELLED') {
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
            await activateSubscription(userId, payment.planId, payment);
            // Send payment success notification
            await (0, paymentNotifications_1.sendPaymentSuccessNotification)(userId, payment.planId, payment.amount, payment.provider || 'mobile_money', transaction_id);
        }
        else if (newStatus === 'failed') {
            // Send payment failed notification
            await (0, paymentNotifications_1.sendPaymentFailedNotification)(userId, payment.planId, payment.amount, payment.provider || 'mobile_money', status);
        }
        res.status(200).json({ success: true, status: newStatus });
    }
    catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Helper: Activate subscription after successful payment
 */
async function activateSubscription(userId, planId, payment) {
    const subscriptionRef = db.doc(config_1.collections.subscription(userId));
    const now = new Date();
    // Check for existing active subscription
    const existingSubscription = await subscriptionRef.get();
    const existingData = existingSubscription.exists
        ? existingSubscription.data()
        : null;
    // Calculate subscription end date
    let endDate;
    if ((existingData === null || existingData === void 0 ? void 0 : existingData.isSubscribed) &&
        (existingData === null || existingData === void 0 ? void 0 : existingData.subscriptionEndDate) &&
        existingData.status === 'active') {
        // User has active subscription - extend from current end date
        const currentEndDate = existingData.subscriptionEndDate instanceof admin.firestore.Timestamp
            ? existingData.subscriptionEndDate.toDate()
            : new Date(existingData.subscriptionEndDate);
        if (currentEndDate > now) {
            // Add 1 month to existing end date (user keeps remaining time)
            endDate = new Date(currentEndDate);
            endDate.setMonth(endDate.getMonth() + 1);
            console.log(`Extending subscription from ${currentEndDate.toISOString()} to ${endDate.toISOString()}`);
        }
        else {
            // Old subscription expired, start fresh
            endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + 1);
        }
    }
    else {
        // No active subscription, start fresh
        endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
    }
    await subscriptionRef.set({
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
        mobileMoneyProvider: payment.provider,
        transactionId: payment.transactionId,
        customerPhone: payment.phoneNumber,
        autoRenew: true,
        monthlyScansUsed: 0, // Reset monthly usage on new payment
        // Preserve trial info
        trialScansUsed: admin.firestore.FieldValue.increment(0),
        trialScansLimit: config_1.config.app.trialScanLimit,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`Subscription activated for user ${userId}, plan: ${planId}`);
}
/**
 * Activate subscription from Railway Payment Hub
 * Called by GoShopper after Supabase confirms payment success
 */
exports.activateSubscriptionFromRailway = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = context.auth.uid;
    const { planId, transactionId, amount, phoneNumber, currency = 'USD' } = data;
    if (!planId || !transactionId || !amount || !phoneNumber) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: planId, transactionId, amount, phoneNumber');
    }
    // Validate plan ID
    if (!['basic', 'premium'].includes(planId)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid plan ID. Must be "basic" or "premium"');
    }
    try {
        console.log(`🎯 Activating subscription for user ${userId}, plan: ${planId}, transaction: ${transactionId}`);
        const now = new Date();
        // Create payment record
        const paymentRecord = {
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
        await activateSubscription(userId, planId, paymentRecord);
        // Send success notification
        await (0, paymentNotifications_1.sendPaymentSuccessNotification)(userId, planId, amount, currency);
        console.log(`✅ Subscription activated successfully for user ${userId}`);
        return {
            success: true,
            message: 'Subscription activated successfully',
            planId,
            transactionId,
        };
    }
    catch (error) {
        console.error('Subscription activation error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to activate subscription');
    }
});
//# sourceMappingURL=mokoAfrika.js.map