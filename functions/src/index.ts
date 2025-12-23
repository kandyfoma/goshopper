/**
 * GoShopper Cloud Functions
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
export {parseReceipt, parseReceiptV2, parseReceiptMulti} from './receipt/parseReceipt';
export {quickExtractReceipt} from './receipt/quickExtract';

// Payment functions
export {
  initiateMokoPayment,
  verifyMokoPayment,
  mokoPaymentWebhook,
  activateSubscriptionFromRailway,
} from './payments/mokoAfrika';
export {
  createCardPaymentIntent,
  confirmCardPayment,
  stripeWebhook,
} from './payments/stripe';
export {
  requestRefund,
  getRefundStatus,
  listUserRefunds,
  retryRefund,
} from './payments/refunds';

// Webhook management functions
export {
  processWebhookRetries,
  retryWebhookEvent,
  getWebhookStats,
  listDeadLetterEvents,
} from './webhooks/webhookRetry';

// Subscription functions
export {
  getSubscriptionStatus,
  recordScanUsage,
  upgradeSubscription,
  downgradeSubscription,
  renewSubscription,
  getSubscriptionPricing,
  cancelSubscription,
  checkExpiredSubscriptions,
  extendTrial,
  getUserStats,
} from './subscription/subscriptionManager';
export {
  processAutoRenewals,
  manuallyRenewSubscription,
} from './subscription/autoRenewal';
export {
  checkExpirationWarnings,
  sendManualExpirationWarning,
} from './subscription/expirationNotifications';

// Price functions
export {
  savePriceData,
  getPriceComparison,
  getPriceHistory,
  getSmartPriceComparison,
} from './prices/priceService';

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

// New notification systems
export {
  checkGracePeriodReminders,
  sendManualGracePeriodReminder,
} from './notifications/gracePeriodNotifications';

export {
  onReceiptCreated,
  resetScanLimitWarnings,
  sendManualScanLimitWarning,
} from './notifications/scanLimitNotifications';

export {
  sendManualPaymentNotification,
} from './notifications/paymentNotifications';

export {
  onCityItemPriceUpdate,
  setPriceAlert,
  removePriceAlert,
} from './notifications/priceAlertNotifications';

export {
  sendMonthlySummaries,
  sendManualMonthlySummary,
} from './notifications/monthlySummaryNotifications';

export {
  onSubscriptionPlanChange,
  sendManualFeatureUnlockNotification,
} from './notifications/featureUnlockNotifications';

// Phase 1.2 - Natural Language Query functions
export {
  processNLQuery,
  getSpendingSuggestions,
} from './assistant/naturalLanguage';

// Item Aggregation functions
export {
  aggregateItemsOnReceipt,
  rebuildItemsAggregation,
  getCityItems,
  cleanupDeletedReceiptItems,
} from './items/itemAggregation';

// Product Management functions
export {
  initializeMasterProducts,
  addProductMapping,
  searchMasterProducts,
} from './products/productManagement';

// Data Retention and Cleanup functions
export {
  cleanupOldUserData,
  manualCleanupUserData,
} from './cleanup/dataRetention';

// Apple Sign-In Notification functions
export {
  appleNotifications,
  testAppleNotification,
} from './auth/appleNotifications';

// ML & Behavior Tracking functions
export {
  updateUserBehaviorProfile,
  calculateUserMLFeatures,
} from './ml/behaviorProfile';
