"use strict";
/**
 * Price Alerts Cloud Functions
 * Monitors prices and triggers alerts when target prices are reached
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
exports.getUserAlerts = exports.createPriceAlert = exports.scheduledAlertCheck = exports.checkPriceAlerts = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const db = admin.firestore();
/**
 * Check price alerts when new prices are recorded
 * Triggered by new price data being added
 */
exports.checkPriceAlerts = functions
    .region(config_1.config.app.region)
    .firestore.document(`${config_1.collections.prices}/{priceId}`)
    .onCreate(async (snapshot, context) => {
    const priceData = snapshot.data();
    if (!priceData) {
        return null;
    }
    const productNameNormalized = priceData.productNameNormalized;
    const newPrice = priceData.price;
    const storeName = priceData.storeName;
    try {
        // Find all active alerts for this product
        const alertsSnapshot = await db
            .collectionGroup('priceAlerts')
            .where('productNameNormalized', '==', productNameNormalized)
            .where('isActive', '==', true)
            .get();
        if (alertsSnapshot.empty) {
            console.log(`No active alerts for product: ${productNameNormalized}`);
            return null;
        }
        const batch = db.batch();
        const triggeredAlerts = [];
        alertsSnapshot.docs.forEach(doc => {
            const alert = doc.data();
            const alertRef = doc.ref;
            // Update current lowest price info
            const updates = {
                currentLowestPrice: newPrice,
                currentLowestStore: storeName,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            // Check if price meets target
            if (newPrice <= alert.targetPrice && !alert.isTriggered) {
                updates.isTriggered = true;
                updates.triggeredAt = admin.firestore.FieldValue.serverTimestamp();
                updates.notificationSent = false;
                triggeredAlerts.push({
                    userId: alert.userId,
                    alertId: doc.id,
                    productName: alert.productName,
                    targetPrice: alert.targetPrice,
                    currentPrice: newPrice,
                    storeName,
                });
            }
            batch.update(alertRef, updates);
        });
        await batch.commit();
        // Send notifications for triggered alerts
        if (triggeredAlerts.length > 0) {
            await sendAlertNotifications(triggeredAlerts);
        }
        console.log(`Checked ${alertsSnapshot.size} alerts, triggered ${triggeredAlerts.length}`);
        return null;
    }
    catch (error) {
        console.error('Check price alerts error:', error);
        return null;
    }
});
/**
 * Send push notifications for triggered alerts
 */
async function sendAlertNotifications(alerts) {
    var _a;
    for (const alert of alerts) {
        try {
            // Get user's FCM token
            const userDoc = await db
                .doc(`artifacts/${config_1.config.app.id}/users/${alert.userId}`)
                .get();
            const fcmToken = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmToken;
            if (!fcmToken) {
                console.log(`No FCM token for user ${alert.userId}`);
                continue;
            }
            const title = '🔔 Alerte Prix!';
            const body = `${alert.productName} est maintenant à $${alert.currentPrice.toFixed(2)} chez ${alert.storeName}!`;
            // Send push notification
            await admin.messaging().send({
                token: fcmToken,
                notification: { title, body },
                data: {
                    type: 'price_alert',
                    alertId: alert.alertId,
                    productName: alert.productName,
                    currentPrice: alert.currentPrice.toString(),
                    storeName: alert.storeName,
                },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'price_alerts',
                        icon: 'ic_notification',
                        color: '#10b981',
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            badge: 1,
                            sound: 'default',
                        },
                    },
                },
            });
            // Save notification to Firestore
            await db
                .collection(`artifacts/${config_1.config.app.id}/users/${alert.userId}/notifications`)
                .add({
                title,
                body,
                type: 'price_alert',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                data: {
                    alertId: alert.alertId,
                    productName: alert.productName,
                    currentPrice: alert.currentPrice,
                    storeName: alert.storeName,
                },
            });
            // Mark notification as sent
            const alertPath = `artifacts/${config_1.config.app.id}/users/${alert.userId}/priceAlerts/${alert.alertId}`;
            await db.doc(alertPath).update({
                notificationSent: true,
            });
            console.log(`Notification sent to user ${alert.userId} for alert ${alert.alertId}`);
        }
        catch (error) {
            console.error(`Failed to send notification for alert ${alert.alertId}:`, error);
        }
    }
}
/**
 * Scheduled function to check all alerts daily
 * Runs every day at 9:00 AM
 */
exports.scheduledAlertCheck = functions
    .region(config_1.config.app.region)
    .pubsub.schedule('0 9 * * *')
    .timeZone('Africa/Kinshasa')
    .onRun(async (context) => {
    console.log('Running scheduled alert check...');
    try {
        // Get all active alerts
        const alertsSnapshot = await db
            .collectionGroup('priceAlerts')
            .where('isActive', '==', true)
            .where('isTriggered', '==', false)
            .get();
        if (alertsSnapshot.empty) {
            console.log('No active alerts to check');
            return null;
        }
        // Group alerts by product
        const alertsByProduct = new Map();
        alertsSnapshot.docs.forEach(doc => {
            const productName = doc.data().productNameNormalized;
            if (!alertsByProduct.has(productName)) {
                alertsByProduct.set(productName, []);
            }
            alertsByProduct.get(productName).push(doc);
        });
        // Check current prices for each product
        for (const [productName, alerts] of alertsByProduct) {
            // Get latest price for this product
            const priceSnapshot = await db
                .collection(config_1.collections.prices)
                .where('productNameNormalized', '==', productName)
                .orderBy('recordedAt', 'desc')
                .limit(1)
                .get();
            if (priceSnapshot.empty)
                continue;
            const latestPrice = priceSnapshot.docs[0].data();
            const batch = db.batch();
            for (const alertDoc of alerts) {
                const alert = alertDoc.data();
                // Update price info
                batch.update(alertDoc.ref, {
                    currentLowestPrice: latestPrice.price,
                    currentLowestStore: latestPrice.storeName,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                // Check if triggered
                if (latestPrice.price <= alert.targetPrice) {
                    batch.update(alertDoc.ref, {
                        isTriggered: true,
                        triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    // Send notification (non-batch)
                    await sendAlertNotifications([
                        {
                            userId: alert.userId,
                            alertId: alertDoc.id,
                            productName: alert.productName,
                            targetPrice: alert.targetPrice,
                            currentPrice: latestPrice.price,
                            storeName: latestPrice.storeName,
                        },
                    ]);
                }
            }
            await batch.commit();
        }
        console.log(`Scheduled check completed for ${alertsByProduct.size} products`);
        return null;
    }
    catch (error) {
        console.error('Scheduled alert check error:', error);
        return null;
    }
});
/**
 * Create price alert (callable function)
 */
exports.createPriceAlert = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const { productName, targetPrice, currency } = data;
    if (!productName || !targetPrice) {
        throw new functions.https.HttpsError('invalid-argument', 'Product name and target price are required');
    }
    const userId = context.auth.uid;
    const productNameNormalized = productName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .trim();
    try {
        // Check for existing alert
        const existingSnapshot = await db
            .collection(`artifacts/${config_1.config.app.id}/users/${userId}/priceAlerts`)
            .where('productNameNormalized', '==', productNameNormalized)
            .where('isActive', '==', true)
            .get();
        if (!existingSnapshot.empty) {
            // Update existing
            const existingDoc = existingSnapshot.docs[0];
            await existingDoc.ref.update({
                targetPrice,
                isTriggered: false,
                notificationSent: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return {
                success: true,
                alertId: existingDoc.id,
                message: 'Alert updated',
            };
        }
        // Get current lowest price
        let currentLowestPrice;
        let currentLowestStore;
        const priceSnapshot = await db
            .collection(config_1.collections.prices)
            .where('productNameNormalized', '==', productNameNormalized)
            .orderBy('price', 'asc')
            .limit(1)
            .get();
        if (!priceSnapshot.empty) {
            const priceData = priceSnapshot.docs[0].data();
            currentLowestPrice = priceData.price;
            currentLowestStore = priceData.storeName;
        }
        // Create new alert
        const alertRef = db
            .collection(`artifacts/${config_1.config.app.id}/users/${userId}/priceAlerts`)
            .doc();
        await alertRef.set({
            id: alertRef.id,
            userId,
            productName,
            productNameNormalized,
            targetPrice,
            currency: currency || 'USD',
            currentLowestPrice,
            currentLowestStore,
            isActive: true,
            isTriggered: currentLowestPrice
                ? currentLowestPrice <= targetPrice
                : false,
            notificationSent: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            success: true,
            alertId: alertRef.id,
            message: 'Alert created',
            currentLowestPrice,
            currentLowestStore,
        };
    }
    catch (error) {
        console.error('Create alert error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create alert');
    }
});
/**
 * Get user's price alerts
 */
exports.getUserAlerts = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const userId = context.auth.uid;
    const activeOnly = data.activeOnly !== false;
    try {
        let query = db.collection(`artifacts/${config_1.config.app.id}/users/${userId}/priceAlerts`);
        if (activeOnly) {
            query = query.where('isActive', '==', true);
        }
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        const alerts = snapshot.docs.map((doc) => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                ...doc.data(),
                id: doc.id,
                createdAt: (_b = (_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) === null || _b === void 0 ? void 0 : _b.toISOString(),
                updatedAt: (_d = (_c = doc.data().updatedAt) === null || _c === void 0 ? void 0 : _c.toDate()) === null || _d === void 0 ? void 0 : _d.toISOString(),
                triggeredAt: (_f = (_e = doc.data().triggeredAt) === null || _e === void 0 ? void 0 : _e.toDate()) === null || _f === void 0 ? void 0 : _f.toISOString(),
            });
        });
        return {
            success: true,
            alerts,
            count: alerts.length,
        };
    }
    catch (error) {
        console.error('Get alerts error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get alerts');
    }
});
//# sourceMappingURL=priceAlerts.js.map