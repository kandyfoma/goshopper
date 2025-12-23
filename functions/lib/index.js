"use strict";
/**
 * GoShopper Cloud Functions
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
exports.checkSubscriptionExpiration = exports.sendAdminBroadcast = exports.sendSyncCompleteNotification = exports.sendAchievementNotification = exports.sendWeeklySavingsTips = exports.getUserAlerts = exports.createPriceAlert = exports.scheduledAlertCheck = exports.checkPriceAlerts = exports.checkIdentifierAvailability = exports.completeRegistration = exports.verifyCode = exports.sendVerificationCode = exports.getSmartPriceComparison = exports.getPriceHistory = exports.getPriceComparison = exports.savePriceData = exports.sendManualExpirationWarning = exports.checkExpirationWarnings = exports.manuallyRenewSubscription = exports.processAutoRenewals = exports.getUserStats = exports.extendTrial = exports.checkExpiredSubscriptions = exports.cancelSubscription = exports.getSubscriptionPricing = exports.renewSubscription = exports.downgradeSubscription = exports.upgradeSubscription = exports.recordScanUsage = exports.getSubscriptionStatus = exports.listDeadLetterEvents = exports.getWebhookStats = exports.retryWebhookEvent = exports.processWebhookRetries = exports.retryRefund = exports.listUserRefunds = exports.getRefundStatus = exports.requestRefund = exports.stripeWebhook = exports.confirmCardPayment = exports.createCardPaymentIntent = exports.activateSubscriptionFromRailway = exports.mokoPaymentWebhook = exports.verifyMokoPayment = exports.initiateMokoPayment = exports.quickExtractReceipt = exports.parseReceiptMulti = exports.parseReceiptV2 = exports.parseReceipt = void 0;
exports.calculateUserMLFeatures = exports.updateUserBehaviorProfile = exports.testAppleNotification = exports.appleNotifications = exports.manualCleanupUserData = exports.cleanupOldUserData = exports.searchMasterProducts = exports.addProductMapping = exports.initializeMasterProducts = exports.cleanupDeletedReceiptItems = exports.getCityItems = exports.rebuildItemsAggregation = exports.aggregateItemsOnReceipt = exports.getSpendingSuggestions = exports.processNLQuery = exports.sendManualFeatureUnlockNotification = exports.onSubscriptionPlanChange = exports.sendManualMonthlySummary = exports.sendMonthlySummaries = exports.removePriceAlert = exports.setPriceAlert = exports.onCityItemPriceUpdate = exports.sendManualPaymentNotification = exports.sendManualScanLimitWarning = exports.resetScanLimitWarnings = exports.onReceiptCreated = exports.sendManualGracePeriodReminder = exports.checkGracePeriodReminders = void 0;
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
Object.defineProperty(exports, "parseReceiptMulti", { enumerable: true, get: function () { return parseReceipt_1.parseReceiptMulti; } });
var quickExtract_1 = require("./receipt/quickExtract");
Object.defineProperty(exports, "quickExtractReceipt", { enumerable: true, get: function () { return quickExtract_1.quickExtractReceipt; } });
// Payment functions
var mokoAfrika_1 = require("./payments/mokoAfrika");
Object.defineProperty(exports, "initiateMokoPayment", { enumerable: true, get: function () { return mokoAfrika_1.initiateMokoPayment; } });
Object.defineProperty(exports, "verifyMokoPayment", { enumerable: true, get: function () { return mokoAfrika_1.verifyMokoPayment; } });
Object.defineProperty(exports, "mokoPaymentWebhook", { enumerable: true, get: function () { return mokoAfrika_1.mokoPaymentWebhook; } });
Object.defineProperty(exports, "activateSubscriptionFromRailway", { enumerable: true, get: function () { return mokoAfrika_1.activateSubscriptionFromRailway; } });
var stripe_1 = require("./payments/stripe");
Object.defineProperty(exports, "createCardPaymentIntent", { enumerable: true, get: function () { return stripe_1.createCardPaymentIntent; } });
Object.defineProperty(exports, "confirmCardPayment", { enumerable: true, get: function () { return stripe_1.confirmCardPayment; } });
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripe_1.stripeWebhook; } });
var refunds_1 = require("./payments/refunds");
Object.defineProperty(exports, "requestRefund", { enumerable: true, get: function () { return refunds_1.requestRefund; } });
Object.defineProperty(exports, "getRefundStatus", { enumerable: true, get: function () { return refunds_1.getRefundStatus; } });
Object.defineProperty(exports, "listUserRefunds", { enumerable: true, get: function () { return refunds_1.listUserRefunds; } });
Object.defineProperty(exports, "retryRefund", { enumerable: true, get: function () { return refunds_1.retryRefund; } });
// Webhook management functions
var webhookRetry_1 = require("./webhooks/webhookRetry");
Object.defineProperty(exports, "processWebhookRetries", { enumerable: true, get: function () { return webhookRetry_1.processWebhookRetries; } });
Object.defineProperty(exports, "retryWebhookEvent", { enumerable: true, get: function () { return webhookRetry_1.retryWebhookEvent; } });
Object.defineProperty(exports, "getWebhookStats", { enumerable: true, get: function () { return webhookRetry_1.getWebhookStats; } });
Object.defineProperty(exports, "listDeadLetterEvents", { enumerable: true, get: function () { return webhookRetry_1.listDeadLetterEvents; } });
// Subscription functions
var subscriptionManager_1 = require("./subscription/subscriptionManager");
Object.defineProperty(exports, "getSubscriptionStatus", { enumerable: true, get: function () { return subscriptionManager_1.getSubscriptionStatus; } });
Object.defineProperty(exports, "recordScanUsage", { enumerable: true, get: function () { return subscriptionManager_1.recordScanUsage; } });
Object.defineProperty(exports, "upgradeSubscription", { enumerable: true, get: function () { return subscriptionManager_1.upgradeSubscription; } });
Object.defineProperty(exports, "downgradeSubscription", { enumerable: true, get: function () { return subscriptionManager_1.downgradeSubscription; } });
Object.defineProperty(exports, "renewSubscription", { enumerable: true, get: function () { return subscriptionManager_1.renewSubscription; } });
Object.defineProperty(exports, "getSubscriptionPricing", { enumerable: true, get: function () { return subscriptionManager_1.getSubscriptionPricing; } });
Object.defineProperty(exports, "cancelSubscription", { enumerable: true, get: function () { return subscriptionManager_1.cancelSubscription; } });
Object.defineProperty(exports, "checkExpiredSubscriptions", { enumerable: true, get: function () { return subscriptionManager_1.checkExpiredSubscriptions; } });
Object.defineProperty(exports, "extendTrial", { enumerable: true, get: function () { return subscriptionManager_1.extendTrial; } });
Object.defineProperty(exports, "getUserStats", { enumerable: true, get: function () { return subscriptionManager_1.getUserStats; } });
var autoRenewal_1 = require("./subscription/autoRenewal");
Object.defineProperty(exports, "processAutoRenewals", { enumerable: true, get: function () { return autoRenewal_1.processAutoRenewals; } });
Object.defineProperty(exports, "manuallyRenewSubscription", { enumerable: true, get: function () { return autoRenewal_1.manuallyRenewSubscription; } });
var expirationNotifications_1 = require("./subscription/expirationNotifications");
Object.defineProperty(exports, "checkExpirationWarnings", { enumerable: true, get: function () { return expirationNotifications_1.checkExpirationWarnings; } });
Object.defineProperty(exports, "sendManualExpirationWarning", { enumerable: true, get: function () { return expirationNotifications_1.sendManualExpirationWarning; } });
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
// New notification systems
var gracePeriodNotifications_1 = require("./notifications/gracePeriodNotifications");
Object.defineProperty(exports, "checkGracePeriodReminders", { enumerable: true, get: function () { return gracePeriodNotifications_1.checkGracePeriodReminders; } });
Object.defineProperty(exports, "sendManualGracePeriodReminder", { enumerable: true, get: function () { return gracePeriodNotifications_1.sendManualGracePeriodReminder; } });
var scanLimitNotifications_1 = require("./notifications/scanLimitNotifications");
Object.defineProperty(exports, "onReceiptCreated", { enumerable: true, get: function () { return scanLimitNotifications_1.onReceiptCreated; } });
Object.defineProperty(exports, "resetScanLimitWarnings", { enumerable: true, get: function () { return scanLimitNotifications_1.resetScanLimitWarnings; } });
Object.defineProperty(exports, "sendManualScanLimitWarning", { enumerable: true, get: function () { return scanLimitNotifications_1.sendManualScanLimitWarning; } });
var paymentNotifications_1 = require("./notifications/paymentNotifications");
Object.defineProperty(exports, "sendManualPaymentNotification", { enumerable: true, get: function () { return paymentNotifications_1.sendManualPaymentNotification; } });
var priceAlertNotifications_1 = require("./notifications/priceAlertNotifications");
Object.defineProperty(exports, "onCityItemPriceUpdate", { enumerable: true, get: function () { return priceAlertNotifications_1.onCityItemPriceUpdate; } });
Object.defineProperty(exports, "setPriceAlert", { enumerable: true, get: function () { return priceAlertNotifications_1.setPriceAlert; } });
Object.defineProperty(exports, "removePriceAlert", { enumerable: true, get: function () { return priceAlertNotifications_1.removePriceAlert; } });
var monthlySummaryNotifications_1 = require("./notifications/monthlySummaryNotifications");
Object.defineProperty(exports, "sendMonthlySummaries", { enumerable: true, get: function () { return monthlySummaryNotifications_1.sendMonthlySummaries; } });
Object.defineProperty(exports, "sendManualMonthlySummary", { enumerable: true, get: function () { return monthlySummaryNotifications_1.sendManualMonthlySummary; } });
var featureUnlockNotifications_1 = require("./notifications/featureUnlockNotifications");
Object.defineProperty(exports, "onSubscriptionPlanChange", { enumerable: true, get: function () { return featureUnlockNotifications_1.onSubscriptionPlanChange; } });
Object.defineProperty(exports, "sendManualFeatureUnlockNotification", { enumerable: true, get: function () { return featureUnlockNotifications_1.sendManualFeatureUnlockNotification; } });
// Phase 1.2 - Natural Language Query functions
var naturalLanguage_1 = require("./assistant/naturalLanguage");
Object.defineProperty(exports, "processNLQuery", { enumerable: true, get: function () { return naturalLanguage_1.processNLQuery; } });
Object.defineProperty(exports, "getSpendingSuggestions", { enumerable: true, get: function () { return naturalLanguage_1.getSpendingSuggestions; } });
// Item Aggregation functions
var itemAggregation_1 = require("./items/itemAggregation");
Object.defineProperty(exports, "aggregateItemsOnReceipt", { enumerable: true, get: function () { return itemAggregation_1.aggregateItemsOnReceipt; } });
Object.defineProperty(exports, "rebuildItemsAggregation", { enumerable: true, get: function () { return itemAggregation_1.rebuildItemsAggregation; } });
Object.defineProperty(exports, "getCityItems", { enumerable: true, get: function () { return itemAggregation_1.getCityItems; } });
Object.defineProperty(exports, "cleanupDeletedReceiptItems", { enumerable: true, get: function () { return itemAggregation_1.cleanupDeletedReceiptItems; } });
// Product Management functions
var productManagement_1 = require("./products/productManagement");
Object.defineProperty(exports, "initializeMasterProducts", { enumerable: true, get: function () { return productManagement_1.initializeMasterProducts; } });
Object.defineProperty(exports, "addProductMapping", { enumerable: true, get: function () { return productManagement_1.addProductMapping; } });
Object.defineProperty(exports, "searchMasterProducts", { enumerable: true, get: function () { return productManagement_1.searchMasterProducts; } });
// Data Retention and Cleanup functions
var dataRetention_1 = require("./cleanup/dataRetention");
Object.defineProperty(exports, "cleanupOldUserData", { enumerable: true, get: function () { return dataRetention_1.cleanupOldUserData; } });
Object.defineProperty(exports, "manualCleanupUserData", { enumerable: true, get: function () { return dataRetention_1.manualCleanupUserData; } });
// Apple Sign-In Notification functions
var appleNotifications_1 = require("./auth/appleNotifications");
Object.defineProperty(exports, "appleNotifications", { enumerable: true, get: function () { return appleNotifications_1.appleNotifications; } });
Object.defineProperty(exports, "testAppleNotification", { enumerable: true, get: function () { return appleNotifications_1.testAppleNotification; } });
// ML & Behavior Tracking functions
var behaviorProfile_1 = require("./ml/behaviorProfile");
Object.defineProperty(exports, "updateUserBehaviorProfile", { enumerable: true, get: function () { return behaviorProfile_1.updateUserBehaviorProfile; } });
Object.defineProperty(exports, "calculateUserMLFeatures", { enumerable: true, get: function () { return behaviorProfile_1.calculateUserMLFeatures; } });
//# sourceMappingURL=index.js.map