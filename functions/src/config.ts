/**
 * Configuration and environment variables
 */
import { defineString, defineSecret } from 'firebase-functions/params'

// Define secure parameters (stored in Firebase, not in repo)
const africastalkingUsername = defineSecret('AFRICASTALKING_USERNAME')
const africastalkingApiKey = defineSecret('AFRICASTALKING_API_KEY')
const africastalkingSenderId = defineString('AFRICASTALKING_SENDER_ID', { default: 'GoShopperAI' })
const africastalkingEnvironment = defineString('AFRICASTALKING_ENVIRONMENT', { default: 'production' })

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
  // Using Firebase params - secrets stored securely in Firebase
  sms: {
    get apiKey() { return africastalkingApiKey.value() },
    get username() { return africastalkingUsername.value() },
    get senderId() { return africastalkingSenderId.value() },
    get baseUrl() {
      return africastalkingEnvironment.value() === 'production'
        ? 'https://api.africastalking.com'
        : 'https://api.sandbox.africastalking.com'
    },
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

  // Test Phone Numbers (for worldwide beta testing - no SMS costs)
  testing: {
    phonePrefix: '+243999999', // Test phone numbers: +243999999XXX
    testOTP: '123456', // Fixed OTP for test phone numbers
    allowTestNumbersInProduction: true, // Enable test numbers even in production
    // Testers enter: 999999001, 999999002, etc. (9 digits in phone field)
    // Backend receives: +243999999001, +243999999002, etc.
    // Each test number creates a separate account (up to 999 test accounts)
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

// Export params for use in function definitions
export const smsParams = {
  secrets: [africastalkingUsername, africastalkingApiKey],
  params: [africastalkingSenderId, africastalkingEnvironment],
}

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
