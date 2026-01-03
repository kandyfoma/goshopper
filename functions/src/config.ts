/**
 * Configuration and environment variables
 */

export const config = {
  // Firebase
  firebase: {
    projectId:
      process.env.PROJECT_ID || process.env.GCLOUD_PROJECT || 'goshopperai',
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
    baseUrl:
      process.env.MOKO_AFRIKA_ENVIRONMENT === 'production'
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
    baseUrl:
      process.env.AFRICASTALKING_ENVIRONMENT === 'production'
        ? 'https://api.africastalking.com'
        : 'https://api.sandbox.africastalking.com',
  },

  // SendGrid (Email for international users)
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@goshopper.app',
  },

  // Apple Sign-In
  apple: {
    bundleId: process.env.APPLE_BUNDLE_ID || 'com.goshopper.app',
    teamId: process.env.APPLE_TEAM_ID || 'WZ8VR8WS6H',
    keyId: process.env.APPLE_KEY_ID || '',
    privateKey: process.env.APPLE_PRIVATE_KEY || '',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
  },

  // App settings
  app: {
    id: 'goshopper',
    region: 'us-central1',
    trialScanLimit: 10, // Limited scans during trial
    trialDurationDays: 60, // 2 months
  },

  // Pricing (USD)
  pricing: {
    freemium: {price: 0, scansPerMonth: 3}, // Freemium tier
    free: {price: 0, scansPerMonth: 10}, // Limited during trial
    basic: {price: 1.99, scansPerMonth: 20},
    standard: {price: 2.99, scansPerMonth: 50},
    premium: {price: 4.99, scansPerMonth: 200}
  },
};

// Firestore collection paths
export const collections = {
  users: `artifacts/${config.app.id}/users`,
  userDoc: (userId: string) =>
    `artifacts/${config.app.id}/users/${userId}/profile/data`,
  receipts: (userId: string) =>
    `artifacts/${config.app.id}/users/${userId}/receipts`,
  shops: (userId: string) =>
    `artifacts/${config.app.id}/users/${userId}/shops`,
  subscription: (userId: string) =>
    `artifacts/${config.app.id}/users/${userId}/subscription/status`,
  subscriptions: `artifacts/${config.app.id}/subscriptions`,
  prices: `artifacts/${config.app.id}/public/prices/data`,
  stores: `artifacts/${config.app.id}/public/stores/data`,
  payments: (userId: string) =>
    `artifacts/${config.app.id}/users/${userId}/payments`,
  appleNotifications: `artifacts/${config.app.id}/apple_notifications`,
};
