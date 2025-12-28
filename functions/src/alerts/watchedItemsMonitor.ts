/**
 * Watched Items Monitor - Price Drop Notifications for Premium Users
 * Monitors cityItems for price changes and notifies users who are watching
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();

interface WatchedItem {
  id: string;
  userId: string;
  itemName: string;
  itemNameNormalized: string;
  city: string;
  alertType: 'any_drop' | 'threshold' | 'percentage';
  targetPrice?: number;
  percentageDrop?: number;
  baselinePrice: number;
  lastNotifiedPrice: number;
  currentPrice: number;
  currentStore: string;
  notificationCount: number;
  lastNotificationSent?: FirebaseFirestore.Timestamp;
  cooldownUntil?: FirebaseFirestore.Timestamp;
  isActive: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

interface PriceDropNotification {
  userId: string;
  watchedItemId: string;
  itemName: string;
  oldPrice: number;
  newPrice: number;
  storeName: string;
  dropPercentage: number;
  city: string;
}

/**
 * Monitor cityItems for price changes
 * Triggered when cityItem is updated
 */
export const monitorCityItemPrices = functions
  .region(config.app.region)
  .firestore.document(`artifacts/${config.app.id}/cityItems/{city}/items/{itemId}`)
  .onUpdate(async (change, context) => {
    const {city, itemId} = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if minPrice changed
    const oldMinPrice = beforeData.minPrice;
    const newMinPrice = afterData.minPrice;

    if (!newMinPrice || !oldMinPrice || newMinPrice >= oldMinPrice) {
      // No price drop, exit early
      return null;
    }

    const priceDrop = oldMinPrice - newMinPrice;
    const priceDropPercentage = (priceDrop / oldMinPrice) * 100;

    console.log(
      `💰 Price drop detected for ${itemId} in ${city}: ${oldMinPrice} → ${newMinPrice} (-${priceDropPercentage.toFixed(1)}%)`,
    );

    try {
      // Find all users watching this item in this city
      const watchedItemsSnapshot = await db
        .collectionGroup('watchedItems')
        .where('itemNameNormalized', '==', itemId)
        .where('city', '==', city)
        .where('isActive', '==', true)
        .get();

      if (watchedItemsSnapshot.empty) {
        console.log('No users watching this item');
        return null;
      }

      const notifications: PriceDropNotification[] = [];
      const batch = db.batch();
      const now = new Date();

      // Get best store name from the updated item
      const bestStore = afterData.stores?.[0]?.name || 
                        afterData.prices?.[0]?.storeName || 
                        'Magasin';

      for (const doc of watchedItemsSnapshot.docs) {
        const watchedItem = doc.data() as WatchedItem;
        const userId = watchedItem.userId;

        // Check premium status
        const userDoc = await db
          .doc(`artifacts/${config.app.id}/users/${userId}`)
          .get();
        const userData = userDoc.data();
        const subscription = userData?.subscription;
        const hasPremium =
          subscription?.tier === 'premium' ||
          subscription?.tier === 'gold' ||
          subscription?.plan === 'premium' ||
          subscription?.plan === 'gold';

        if (!hasPremium) {
          console.log(`User ${userId} is not premium, skipping notification`);
          continue;
        }

        // Check cooldown
        if (
          watchedItem.cooldownUntil &&
          watchedItem.cooldownUntil.toDate() > now
        ) {
          console.log(`User ${userId} in cooldown period, skipping`);
          continue;
        }

        // Check notification limit (max 5 per day)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const notificationsTodaySnapshot = await db
          .collection(
            `artifacts/${config.app.id}/users/${userId}/notifications`,
          )
          .where('type', '==', 'price_drop')
          .where('timestamp', '>=', todayStart)
          .get();

        if (notificationsTodaySnapshot.size >= 5) {
          console.log(`User ${userId} reached daily notification limit`);
          continue;
        }

        // Check quiet hours (10 PM - 7 AM)
        const hour = now.getHours();
        if (hour >= 22 || hour < 7) {
          console.log(`Quiet hours, will retry later`);
          continue;
        }

        // Check if alert conditions are met
        let shouldNotify = false;

        switch (watchedItem.alertType) {
          case 'any_drop':
            shouldNotify = newMinPrice < watchedItem.lastNotifiedPrice;
            break;
          case 'threshold':
            shouldNotify =
              watchedItem.targetPrice !== undefined &&
              newMinPrice <= watchedItem.targetPrice;
            break;
          case 'percentage':
            if (watchedItem.percentageDrop !== undefined) {
              const dropFromBaseline =
                ((watchedItem.baselinePrice - newMinPrice) /
                  watchedItem.baselinePrice) *
                100;
              shouldNotify = dropFromBaseline >= watchedItem.percentageDrop;
            }
            break;
        }

        if (!shouldNotify) {
          // Update current price but don't notify
          batch.update(doc.ref, {
            currentPrice: newMinPrice,
            currentStore: bestStore,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          continue;
        }

        // Add to notification queue
        notifications.push({
          userId,
          watchedItemId: doc.id,
          itemName: watchedItem.itemName,
          oldPrice: watchedItem.lastNotifiedPrice,
          newPrice: newMinPrice,
          storeName: bestStore,
          dropPercentage: priceDropPercentage,
          city,
        });

        // Update watchedItem
        batch.update(doc.ref, {
          currentPrice: newMinPrice,
          currentStore: bestStore,
          lastNotifiedPrice: newMinPrice,
          notificationCount: admin.firestore.FieldValue.increment(1),
          lastNotificationSent: admin.firestore.FieldValue.serverTimestamp(),
          cooldownUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      // Send notifications
      if (notifications.length > 0) {
        await sendPriceDropNotifications(notifications);
      }

      console.log(
        `✅ Processed ${watchedItemsSnapshot.size} watchers, sent ${notifications.length} notifications`,
      );
      return null;
    } catch (error) {
      console.error('Error monitoring price:', error);
      return null;
    }
  });

/**
 * Send price drop notifications
 */
async function sendPriceDropNotifications(
  notifications: PriceDropNotification[],
): Promise<void> {
  for (const notif of notifications) {
    try {
      const userDoc = await db
        .doc(`artifacts/${config.app.id}/users/${notif.userId}`)
        .get();
      const fcmToken = userDoc.data()?.fcmToken;

      const priceSavings = notif.oldPrice - notif.newPrice;
      const title = '💰 Baisse de prix!';
      const body = `${notif.itemName} : $${notif.oldPrice.toFixed(2)} → $${notif.newPrice.toFixed(2)} (-${notif.dropPercentage.toFixed(0)}%) chez ${notif.storeName}`;

      // Save notification to Firestore first
      await db
        .collection(
          `artifacts/${config.app.id}/users/${notif.userId}/notifications`,
        )
        .add({
          title,
          body,
          type: 'price_drop',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
          data: {
            itemId: notif.watchedItemId,
            itemName: notif.itemName,
            oldPrice: notif.oldPrice,
            newPrice: notif.newPrice,
            storeName: notif.storeName,
            savings: priceSavings,
            dropPercentage: notif.dropPercentage,
            city: notif.city,
          },
        });

      if (!fcmToken) {
        console.log(`No FCM token for user ${notif.userId}, saved to Firestore only`);
        continue;
      }

      // Send push notification
      await admin.messaging().send({
        token: fcmToken,
        notification: {title, body},
        data: {
          type: 'price_drop',
          itemId: notif.watchedItemId,
          itemName: notif.itemName,
          oldPrice: notif.oldPrice.toString(),
          newPrice: notif.newPrice.toString(),
          storeName: notif.storeName,
          savings: priceSavings.toFixed(2),
          city: notif.city,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'price_drops',
            icon: 'ic_notification',
            color: '#10b981',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
              alert: {title, body},
            },
          },
        },
      });

      console.log(
        `📱 Notification sent to user ${notif.userId} for ${notif.itemName}`,
      );
    } catch (error) {
      console.error(`Failed to send notification to ${notif.userId}:`, error);
    }
  }
}

/**
 * Watch an item (callable function)
 */
export const watchItem = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const {
      itemName,
      itemNameNormalized,
      city,
      alertType,
      targetPrice,
      percentageDrop,
      currentPrice,
      currentStore,
    } = data;

    if (!itemName || !itemNameNormalized || !city || !alertType) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields',
      );
    }

    // Check premium status
    const userDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    const userData = userDoc.data();
    const subscription = userData?.subscription;
    const hasPremium =
      subscription?.tier === 'premium' ||
      subscription?.tier === 'gold' ||
      subscription?.plan === 'premium' ||
      subscription?.plan === 'gold';

    if (!hasPremium) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Premium subscription required for price alerts',
      );
    }

    try {
      const docRef = db
        .collection(`artifacts/${config.app.id}/users/${userId}/watchedItems`)
        .doc(itemNameNormalized);

      const existing = await docRef.get();

      if (existing.exists) {
        // Update existing
        await docRef.update({
          alertType,
          targetPrice: targetPrice || null,
          percentageDrop: percentageDrop || null,
          currentPrice: currentPrice || existing.data()?.currentPrice,
          currentStore: currentStore || existing.data()?.currentStore,
          isActive: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {success: true, message: 'Alert updated', id: docRef.id};
      } else {
        // Create new
        await docRef.set({
          id: itemNameNormalized,
          userId,
          itemName,
          itemNameNormalized,
          city,
          alertType,
          targetPrice: targetPrice || null,
          percentageDrop: percentageDrop || null,
          baselinePrice: currentPrice,
          lastNotifiedPrice: currentPrice,
          currentPrice,
          currentStore: currentStore || 'Unknown',
          notificationCount: 0,
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {success: true, message: 'Alert created', id: docRef.id};
      }
    } catch (error) {
      console.error('Watch item error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to watch item');
    }
  });

/**
 * Unwatch an item (callable function)
 */
export const unwatchItem = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const {itemNameNormalized} = data;

    if (!itemNameNormalized) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Item ID required',
      );
    }

    try {
      await db
        .collection(`artifacts/${config.app.id}/users/${userId}/watchedItems`)
        .doc(itemNameNormalized)
        .delete();

      return {success: true, message: 'Item unwatched'};
    } catch (error) {
      console.error('Unwatch item error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to unwatch item',
      );
    }
  });

/**
 * Get user's watched items (callable function)
 */
export const getWatchedItems = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const activeOnly = data.activeOnly !== false;

    try {
      let query = db.collection(
        `artifacts/${config.app.id}/users/${userId}/watchedItems`,
      ) as FirebaseFirestore.Query;

      if (activeOnly) {
        query = query.where('isActive', '==', true);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();

      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate()?.toISOString(),
        updatedAt: doc.data().updatedAt?.toDate()?.toISOString(),
        lastNotificationSent: doc.data().lastNotificationSent?.toDate()?.toISOString(),
        cooldownUntil: doc.data().cooldownUntil?.toDate()?.toISOString(),
      }));

      return {success: true, items, count: items.length};
    } catch (error) {
      console.error('Get watched items error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get watched items',
      );
    }
  });

/**
 * Toggle watch status (callable function)
 */
export const toggleWatchStatus = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const {itemNameNormalized, isActive} = data;

    if (!itemNameNormalized || typeof isActive !== 'boolean') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Item ID and active status required',
      );
    }

    try {
      await db
        .collection(`artifacts/${config.app.id}/users/${userId}/watchedItems`)
        .doc(itemNameNormalized)
        .update({
          isActive,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      return {success: true, isActive};
    } catch (error) {
      console.error('Toggle watch status error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to toggle watch status',
      );
    }
  });
