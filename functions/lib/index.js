"use strict";
/**
 * GoShopperAI Cloud Functions
 * Main entry point - exports all cloud functions
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSpendingSuggestions = exports.processNLQuery = exports.checkSubscriptionExpiration = exports.sendAdminBroadcast = exports.sendSyncCompleteNotification = exports.sendAchievementNotification = exports.sendWeeklySavingsTips = exports.getUserAlerts = exports.createPriceAlert = exports.scheduledAlertCheck = exports.checkPriceAlerts = exports.checkIdentifierAvailability = exports.completeRegistration = exports.verifyCode = exports.sendVerificationCode = exports.getPriceHistory = exports.getPriceComparison = exports.savePriceData = exports.extendTrial = exports.checkExpiredSubscriptions = exports.cancelSubscription = exports.getSubscriptionPricing = exports.renewSubscription = exports.upgradeSubscription = exports.recordScanUsage = exports.getSubscriptionStatus = exports.stripeWebhook = exports.confirmCardPayment = exports.createCardPaymentIntent = exports.mokoPaymentWebhook = exports.verifyMokoPayment = exports.initiateMokoPayment = exports.parseReceiptV2 = exports.parseReceipt = void 0;
const admin = __importStar(require("firebase-admin"));
const config_1 = require("./config");
// Initialize Firebase Admin
if (!admin.apps.length) {
    // Check if we're in production (GCP) or local development
    const isProduction = process.env.NODE_ENV === 'production' || process.env.FIREBASE_CONFIG;
    if (isProduction) {
        // Use default credentials for GCP/production
        admin.initializeApp();
    }
    else {
        // Local development - use service account or emulator
        if (config_1.config.firebase.serviceAccountKey) {
            // Use service account key from environment variable
            const serviceAccount = JSON.parse(config_1.config.firebase.serviceAccountKey);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: config_1.config.firebase.projectId,
                databaseURL: config_1.config.firebase.databaseURL,
            });
        }
        else if (process.env.FIREBASE_EMULATOR_HOST) {
            // Use Firebase emulator
            admin.initializeApp({
                projectId: config_1.config.firebase.projectId,
            });
        }
        else {
            // Fallback - try to use default credentials (may fail locally)
            try {
                admin.initializeApp({
                    projectId: config_1.config.firebase.projectId,
                });
            }
            catch (error) {
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
var parseReceipt_1 = require("./receipt/parseReceipt");
Object.defineProperty(exports, "parseReceipt", { enumerable: true, get: function () { return parseReceipt_1.parseReceipt; } });
Object.defineProperty(exports, "parseReceiptV2", { enumerable: true, get: function () { return parseReceipt_1.parseReceiptV2; } });
// Payment functions
var mokoAfrika_1 = require("./payments/mokoAfrika");
Object.defineProperty(exports, "initiateMokoPayment", { enumerable: true, get: function () { return mokoAfrika_1.initiateMokoPayment; } });
Object.defineProperty(exports, "verifyMokoPayment", { enumerable: true, get: function () { return mokoAfrika_1.verifyMokoPayment; } });
Object.defineProperty(exports, "mokoPaymentWebhook", { enumerable: true, get: function () { return mokoAfrika_1.mokoPaymentWebhook; } });
var stripe_1 = require("./payments/stripe");
Object.defineProperty(exports, "createCardPaymentIntent", { enumerable: true, get: function () { return stripe_1.createCardPaymentIntent; } });
Object.defineProperty(exports, "confirmCardPayment", { enumerable: true, get: function () { return stripe_1.confirmCardPayment; } });
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripe_1.stripeWebhook; } });
// Subscription functions
var subscriptionManager_1 = require("./subscription/subscriptionManager");
Object.defineProperty(exports, "getSubscriptionStatus", { enumerable: true, get: function () { return subscriptionManager_1.getSubscriptionStatus; } });
Object.defineProperty(exports, "recordScanUsage", { enumerable: true, get: function () { return subscriptionManager_1.recordScanUsage; } });
Object.defineProperty(exports, "upgradeSubscription", { enumerable: true, get: function () { return subscriptionManager_1.upgradeSubscription; } });
Object.defineProperty(exports, "renewSubscription", { enumerable: true, get: function () { return subscriptionManager_1.renewSubscription; } });
Object.defineProperty(exports, "getSubscriptionPricing", { enumerable: true, get: function () { return subscriptionManager_1.getSubscriptionPricing; } });
Object.defineProperty(exports, "cancelSubscription", { enumerable: true, get: function () { return subscriptionManager_1.cancelSubscription; } });
Object.defineProperty(exports, "checkExpiredSubscriptions", { enumerable: true, get: function () { return subscriptionManager_1.checkExpiredSubscriptions; } });
Object.defineProperty(exports, "extendTrial", { enumerable: true, get: function () { return subscriptionManager_1.extendTrial; } });
// Price functions
var priceService_1 = require("./prices/priceService");
Object.defineProperty(exports, "savePriceData", { enumerable: true, get: function () { return priceService_1.savePriceData; } });
Object.defineProperty(exports, "getPriceComparison", { enumerable: true, get: function () { return priceService_1.getPriceComparison; } });
Object.defineProperty(exports, "getPriceHistory", { enumerable: true, get: function () { return priceService_1.getPriceHistory; } });
// Authentication & Verification functions
var verification_1 = require("./auth/verification");
Object.defineProperty(exports, "sendVerificationCode", { enumerable: true, get: function () { return verification_1.sendVerificationCode; } });
Object.defineProperty(exports, "verifyCode", { enumerable: true, get: function () { return verification_1.verifyCode; } });
Object.defineProperty(exports, "completeRegistration", { enumerable: true, get: function () { return verification_1.completeRegistration; } });
Object.defineProperty(exports, "checkIdentifierAvailability", { enumerable: true, get: function () { return verification_1.checkIdentifierAvailability; } });
// Phase 1.1 - Price Alerts functions
var priceAlerts_1 = require("./alerts/priceAlerts");
Object.defineProperty(exports, "checkPriceAlerts", { enumerable: true, get: function () { return priceAlerts_1.checkPriceAlerts; } });
Object.defineProperty(exports, "scheduledAlertCheck", { enumerable: true, get: function () { return priceAlerts_1.scheduledAlertCheck; } });
Object.defineProperty(exports, "createPriceAlert", { enumerable: true, get: function () { return priceAlerts_1.createPriceAlert; } });
Object.defineProperty(exports, "getUserAlerts", { enumerable: true, get: function () { return priceAlerts_1.getUserAlerts; } });
// Phase 1.1 & General - Notification functions
var notifications_1 = require("./notifications/notifications");
Object.defineProperty(exports, "sendWeeklySavingsTips", { enumerable: true, get: function () { return notifications_1.sendWeeklySavingsTips; } });
Object.defineProperty(exports, "sendAchievementNotification", { enumerable: true, get: function () { return notifications_1.sendAchievementNotification; } });
Object.defineProperty(exports, "sendSyncCompleteNotification", { enumerable: true, get: function () { return notifications_1.sendSyncCompleteNotification; } });
Object.defineProperty(exports, "sendAdminBroadcast", { enumerable: true, get: function () { return notifications_1.sendAdminBroadcast; } });
Object.defineProperty(exports, "checkSubscriptionExpiration", { enumerable: true, get: function () { return notifications_1.checkSubscriptionExpiration; } });
// Phase 1.2 - Natural Language Query functions
var naturalLanguage_1 = require("./assistant/naturalLanguage");
Object.defineProperty(exports, "processNLQuery", { enumerable: true, get: function () { return naturalLanguage_1.processNLQuery; } });
Object.defineProperty(exports, "getSpendingSuggestions", { enumerable: true, get: function () { return naturalLanguage_1.getSpendingSuggestions; } });
//# sourceMappingURL=index.js.map