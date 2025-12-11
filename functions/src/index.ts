/**
 * GoShopperAI Cloud Functions
 * Main entry point - exports all cloud functions
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // In Cloud Functions, use default credentials (auto-injected by GCP)
  // Locally, will use GOOGLE_APPLICATION_CREDENTIALS or service account
  try {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

// Export functions
export { parseReceipt, parseReceiptV2 } from './receipt/parseReceipt';

// Payment functions
export { initiateMokoPayment, verifyMokoPayment, mokoPaymentWebhook } from './payments/mokoAfrika';
export { createCardPaymentIntent, confirmCardPayment, stripeWebhook } from './payments/stripe';

// Subscription functions
export { 
  getSubscriptionStatus, 
  recordScanUsage, 
  upgradeSubscription,
  renewSubscription,
  getSubscriptionPricing,
  cancelSubscription,
  checkExpiredSubscriptions,
  extendTrial,
} from './subscription/subscriptionManager';

// Price functions
export { savePriceData, getPriceComparison, getPriceHistory } from './prices/priceService';

// Authentication & Verification functions
export {
  sendVerificationCode,
  verifyCode,
  completeRegistration,
  checkIdentifierAvailability,
} from './auth/verification';

// Phase 1.1 - Price Alerts functions
export {
  checkPriceAlerts,
  scheduledAlertCheck,
  createPriceAlert,
  getUserAlerts,
} from './alerts/priceAlerts';

// Phase 1.1 & General - Notification functions
export {
  sendWeeklySavingsTips,
  sendAchievementNotification,
  sendSyncCompleteNotification,
  sendAdminBroadcast,
  checkSubscriptionExpiration,
} from './notifications/notifications';

// Phase 1.2 - Natural Language Query functions
export {
  processNLQuery,
  getSpendingSuggestions,
} from './assistant/naturalLanguage';
