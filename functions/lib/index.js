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
exports.getSpendingSuggestions = exports.processNLQuery = exports.checkSubscriptionExpiration = exports.sendAdminBroadcast = exports.sendSyncCompleteNotification = exports.sendAchievementNotification = exports.sendWeeklySavingsTips = exports.getUserAlerts = exports.createPriceAlert = exports.scheduledAlertCheck = exports.checkPriceAlerts = exports.checkIdentifierAvailability = exports.completeRegistration = exports.verifyCode = exports.sendVerificationCode = exports.getSmartPriceComparison = exports.getPriceHistory = exports.getPriceComparison = exports.savePriceData = exports.getUserStats = exports.extendTrial = exports.checkExpiredSubscriptions = exports.cancelSubscription = exports.getSubscriptionPricing = exports.renewSubscription = exports.upgradeSubscription = exports.recordScanUsage = exports.getSubscriptionStatus = exports.stripeWebhook = exports.confirmCardPayment = exports.createCardPaymentIntent = exports.mokoPaymentWebhook = exports.verifyMokoPayment = exports.initiateMokoPayment = exports.quickExtractReceipt = exports.parseReceiptV2 = exports.parseReceipt = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
if (!admin.apps.length) {
    // In Cloud Functions, use default credentials (auto-injected by GCP)
    // Locally, will use GOOGLE_APPLICATION_CREDENTIALS or service account
    try {
        admin.initializeApp();
        console.log('✅ Firebase Admin initialized');
    }
    catch (error) {
        console.error('Firebase Admin initialization error:', error);
    }
}
// Export functions
var parseReceipt_1 = require("./receipt/parseReceipt");
Object.defineProperty(exports, "parseReceipt", { enumerable: true, get: function () { return parseReceipt_1.parseReceipt; } });
Object.defineProperty(exports, "parseReceiptV2", { enumerable: true, get: function () { return parseReceipt_1.parseReceiptV2; } });
var quickExtract_1 = require("./receipt/quickExtract");
Object.defineProperty(exports, "quickExtractReceipt", { enumerable: true, get: function () { return quickExtract_1.quickExtractReceipt; } });
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
Object.defineProperty(exports, "getUserStats", { enumerable: true, get: function () { return subscriptionManager_1.getUserStats; } });
// Price functions
var priceService_1 = require("./prices/priceService");
Object.defineProperty(exports, "savePriceData", { enumerable: true, get: function () { return priceService_1.savePriceData; } });
Object.defineProperty(exports, "getPriceComparison", { enumerable: true, get: function () { return priceService_1.getPriceComparison; } });
Object.defineProperty(exports, "getPriceHistory", { enumerable: true, get: function () { return priceService_1.getPriceHistory; } });
Object.defineProperty(exports, "getSmartPriceComparison", { enumerable: true, get: function () { return priceService_1.getSmartPriceComparison; } });
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