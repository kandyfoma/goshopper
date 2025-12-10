/**
 * GoShopperAI Cloud Functions
 * Main entry point - exports all cloud functions
 */

import * as admin from 'firebase-admin';
import { config } from './config';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Check if we're in production (GCP) or local development
  const isProduction = process.env.NODE_ENV === 'production' || process.env.FIREBASE_CONFIG;

  if (isProduction) {
    // Use default credentials for GCP/production
    admin.initializeApp();
  } else {
    // Local development - use service account or emulator
    if (config.firebase.serviceAccountKey) {
      // Use service account key from environment variable
      const serviceAccount = JSON.parse(config.firebase.serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebase.projectId,
        databaseURL: config.firebase.databaseURL,
      });
    } else if (process.env.FIREBASE_EMULATOR_HOST) {
      // Use Firebase emulator
      admin.initializeApp({
        projectId: config.firebase.projectId,
      });
    } else {
      // Fallback - try to use default credentials (may fail locally)
      try {
        admin.initializeApp({
          projectId: config.firebase.projectId,
        });
      } catch (error) {
        console.error('\n🚨 Firebase Admin SDK credentials not found!');
        console.error('\nTo run the admin interface locally, you need to set up Firebase credentials:');
        console.error('\n📋 Option 1: Service Account Key (Recommended)');
        console.error('   1. Go to Firebase Console > Project Settings > Service Accounts');
        console.error('   2. Click "Generate new private key"');
        console.error('   3. Download the JSON file');
        console.error('   4. Run: $env:FIREBASE_SERVICE_ACCOUNT_KEY = Get-Content "path/to/serviceAccountKey.json" -Raw');
        console.error('\n📋 Option 2: Use Firebase Emulator');
        console.error('   1. Install Firebase CLI: npm install -g firebase-tools');
        console.error('   2. Login: firebase login');
        console.error('   3. Start emulator: firebase emulators:start');
        console.error('   4. Set: $env:FIREBASE_EMULATOR_HOST = "localhost:8080"');
        console.error('\n🔗 Firebase Console: https://console.firebase.google.com/project/goshopperai/settings/serviceaccounts/adminsdk\n');
        throw new Error('Firebase credentials not configured. See instructions above.');
      }
    }
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
