"use strict";
/**
 * Configuration and environment variables
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collections = exports.config = void 0;
exports.config = {
    // Firebase
    firebase: {
        projectId: process.env.PROJECT_ID || process.env.GCLOUD_PROJECT || 'goshopperai',
        serviceAccountKey: process.env.SERVICE_ACCOUNT_KEY || '',
        databaseURL: process.env.DATABASE_URL || '',
    },
    // Gemini AI
    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: 'gemini-2.0-flash',
        maxTokens: 4096,
    },
    // Moko Afrika (Mobile Money for DRC)
    moko: {
        apiKey: process.env.MOKO_AFRIKA_API_KEY || '',
        secretKey: process.env.MOKO_AFRIKA_SECRET_KEY || '',
        merchantId: process.env.MOKO_AFRIKA_MERCHANT_ID || '',
        baseUrl: process.env.MOKO_AFRIKA_ENVIRONMENT === 'production'
            ? 'https://api.mokoafrika.com/v1'
            : 'https://sandbox.mokoafrika.com/v1',
        callbackUrl: process.env.MOKO_CALLBACK_URL || '',
    },
    // Stripe (Card payments for international users)
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    // SMS Gateway (Africa's Talking for DRC)
    sms: {
        apiKey: process.env.AFRICASTALKING_API_KEY || '',
        username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
        senderId: process.env.AFRICASTALKING_SENDER_ID || 'GoShopperAI',
        baseUrl: process.env.AFRICASTALKING_ENVIRONMENT === 'production'
            ? 'https://api.africastalking.com'
            : 'https://api.sandbox.africastalking.com',
    },
    // SendGrid (Email for international users)
    sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY || '',
        fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@goshopperai.com',
    },
    // App settings
    app: {
        id: 'goshopperai',
        region: 'europe-west1',
        trialScanLimit: -1, // Unlimited during trial
        trialDurationDays: 60, // 2 months
    },
    // Pricing (USD)
    pricing: {
        free: { price: 0, scansPerMonth: -1 }, // Unlimited during trial
        basic: { price: 1.99, scansPerMonth: 25 },
        standard: { price: 2.99, scansPerMonth: 100 },
        premium: { price: 4.99, scansPerMonth: -1 }, // Unlimited
    },
};
// Firestore collection paths
exports.collections = {
    users: (userId) => `artifacts/${exports.config.app.id}/users/${userId}`,
    userDoc: (userId) => `artifacts/${exports.config.app.id}/users/${userId}/profile/data`,
    receipts: (userId) => `artifacts/${exports.config.app.id}/users/${userId}/receipts`,
    subscription: (userId) => `artifacts/${exports.config.app.id}/users/${userId}/subscription/status`,
    prices: `artifacts/${exports.config.app.id}/public/prices/data`,
    stores: `artifacts/${exports.config.app.id}/public/stores/data`,
    payments: (userId) => `artifacts/${exports.config.app.id}/users/${userId}/payments`,
};
//# sourceMappingURL=config.js.map