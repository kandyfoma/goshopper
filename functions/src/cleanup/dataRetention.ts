/**
 * Data Retention Policy
 * Automatically deletes user data based on subscription tier:
 * - Basic: 1 month retention
 * - Standard: 2 months retention  
 * - Premium: 3 months retention
 * - Free/Freemium: 1 month retention
 * Runs on the 1st of every month at 2 AM UTC
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();

/**
 * Get data retention period in months based on subscription plan
 */
function getRetentionMonths(planId?: string): number {
  switch (planId) {
    case 'basic':
    case 'free':
    case 'freemium':
      return 1;
    case 'standard':
      return 2;
    case 'premium':
      return 3;
    default:
      return 1; // Default to 1 month for unsubscribed users
  }
}

/**
 * Delete user data based on subscription-specific retention periods
 * Scheduled to run on the 1st of every month at 2:00 AM UTC
 */
export const cleanupOldUserData = functions
  .region('europe-west1')
  .pubsub.schedule('0 2 1 * *') // Cron: At 02:00 on day-of-month 1
  .timeZone('UTC')
  .onRun(async context => {
    console.log('🧹 Starting monthly data cleanup with subscription-based retention...');

    try {
      // Get all users
      const usersSnapshot = await db
        .collection(`artifacts/${config.app.id}/users`)
        .get();

      console.log(`👥 Processing ${usersSnapshot.size} users...`);

      let totalReceiptsDeleted = 0;
      let totalItemsUpdated = 0;
      let totalShoppingListsDeleted = 0;
      let totalNotificationsDeleted = 0;
      let totalAlertsDeleted = 0;
      let totalBudgetsDeleted = 0;
      let totalUsersProcessed = 0;

      // Process each user
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        try {
          // Get user's subscription to determine retention period
          const subscriptionDoc = await db
            .collection(`artifacts/${config.app.id}/users/${userId}/subscription`)
            .doc('current')
            .get();

          const subscription = subscriptionDoc.data();
          const planId = subscription?.planId || subscription?.plan || 'freemium';
          const retentionMonths = getRetentionMonths(planId);

          // Calculate cutoff date based on user's subscription
          const cutoffDate = new Date();
          cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
          const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

          console.log(`👤 User ${userId} (${planId}): ${retentionMonths} month retention, cutoff: ${cutoffDate.toISOString()}`);

          const userStats = await cleanupUserData(userId, cutoffTimestamp);
          totalReceiptsDeleted += userStats.receiptsDeleted;
          totalItemsUpdated += userStats.itemsUpdated;
          totalShoppingListsDeleted += userStats.shoppingListsDeleted;
          totalNotificationsDeleted += userStats.notificationsDeleted;
          totalAlertsDeleted += userStats.alertsDeleted;
          totalBudgetsDeleted += userStats.budgetsDeleted;
          totalUsersProcessed++;

          if (userStats.receiptsDeleted > 0 || userStats.itemsUpdated > 0) {
            console.log(
              `✅ User ${userId}: ${userStats.receiptsDeleted} receipts, ${userStats.itemsUpdated} items, ${userStats.shoppingListsDeleted} lists, ${userStats.notificationsDeleted} notifications, ${userStats.alertsDeleted} alerts, ${userStats.budgetsDeleted} budgets`,
            );
          }
        } catch (error) {
          console.error(`❌ Error processing user ${userId}:`, error);
          // Continue with other users even if one fails
        }
      }

      console.log('🎉 Monthly cleanup completed!');
      console.log(`📊 Summary:
        - Users processed: ${totalUsersProcessed}
        - Receipts deleted: ${totalReceiptsDeleted}
        - Items updated: ${totalItemsUpdated}
        - Shopping lists deleted: ${totalShoppingListsDeleted}
        - Notifications deleted: ${totalNotificationsDeleted}
        - Price alerts deleted: ${totalAlertsDeleted}
        - Budgets deleted: ${totalBudgetsDeleted}
      `);

      return {
        success: true,
        usersProcessed: totalUsersProcessed,
        receiptsDeleted: totalReceiptsDeleted,
        itemsUpdated: totalItemsUpdated,
        shoppingListsDeleted: totalShoppingListsDeleted,
        notificationsDeleted: totalNotificationsDeleted,
        alertsDeleted: totalAlertsDeleted,
        budgetsDeleted: totalBudgetsDeleted,
        retentionPolicy: 'Subscription-based (Basic: 1mo, Standard: 2mo, Premium: 3mo)',
      };
    } catch (error) {
      console.error('💥 Fatal error in cleanup:', error);
      throw error;
    }
  });

/**
 * Clean up data for a single user
 */
async function cleanupUserData(
  userId: string,
  cutoffTimestamp: admin.firestore.Timestamp,
): Promise<{
  receiptsDeleted: number;
  itemsUpdated: number;
  shoppingListsDeleted: number;
  notificationsDeleted: number;
  alertsDeleted: number;
  budgetsDeleted: number;
}> {
  const receiptsPath = `artifacts/${config.app.id}/users/${userId}/receipts`;
  const itemsPath = `artifacts/${config.app.id}/users/${userId}/items`;
  const shopsPath = `artifacts/${config.app.id}/users/${userId}/shops`;
  const shoppingListsPath = `artifacts/${config.app.id}/users/${userId}/shoppingLists`;
  const notificationsPath = `artifacts/${config.app.id}/users/${userId}/notifications`;
  const alertsPath = `artifacts/${config.app.id}/users/${userId}/priceAlerts`;
  const budgetsPath = `artifacts/${config.app.id}/users/${userId}/budgets`;

  // Find receipts older than cutoff date
  const oldReceiptsSnapshot = await db
    .collection(receiptsPath)
    .where('date', '<', cutoffTimestamp)
    .get();

  if (oldReceiptsSnapshot.empty) {
    // Even if no receipts to delete, check other collections
    const otherCleanupStats = await cleanupOtherCollections(
      userId,
      cutoffTimestamp,
      shoppingListsPath,
      notificationsPath,
      alertsPath,
      budgetsPath,
    );
    return {
      receiptsDeleted: 0,
      itemsUpdated: 0,
      ...otherCleanupStats,
    };
  }

  const receiptIdsToDelete = oldReceiptsSnapshot.docs.map(doc => doc.id);
  const receiptsData = oldReceiptsSnapshot.docs.map(doc => doc.data());

  console.log(
    `  📋 Found ${receiptIdsToDelete.length} old receipts for user ${userId}`,
  );

  // Delete receipts in batches (Firestore limit: 500 operations per batch)
  const batchSize = 500;
  let receiptsDeleted = 0;

  for (let i = 0; i < receiptIdsToDelete.length; i += batchSize) {
    const batch = db.batch();
    const batchIds = receiptIdsToDelete.slice(i, i + batchSize);

    for (const receiptId of batchIds) {
      const receiptRef = db.collection(receiptsPath).doc(receiptId);
      batch.delete(receiptRef);
      receiptsDeleted++;
    }

    await batch.commit();
  }

  // Update aggregated items - remove prices from deleted receipts
  const itemsSnapshot = await db.collection(itemsPath).get();
  let itemsUpdated = 0;

  for (const itemDoc of itemsSnapshot.docs) {
    const itemData = itemDoc.data();
    const prices = itemData.prices || [];

    // Filter out prices from deleted receipts
    const updatedPrices = prices.filter(
      (price: any) => !receiptIdsToDelete.includes(price.receiptId),
    );

    if (updatedPrices.length !== prices.length) {
      // Prices were removed, need to update
      if (updatedPrices.length === 0) {
        // No prices left, delete the item
        await itemDoc.ref.delete();
        itemsUpdated++;
      } else {
        // Recalculate statistics
        const priceValues = updatedPrices.map((p: any) => p.price);
        const minPrice = Math.min(...priceValues);
        const maxPrice = Math.max(...priceValues);
        const avgPrice =
          priceValues.reduce((sum: number, p: number) => sum + p, 0) /
          priceValues.length;
        const storeCount = new Set(
          updatedPrices.map((p: any) => p.storeName),
        ).size;
        const lastPurchaseDate = updatedPrices[0].date; // Assuming sorted by date desc

        await itemDoc.ref.update({
          prices: updatedPrices,
          minPrice,
          maxPrice,
          avgPrice,
          storeCount,
          totalPurchases: updatedPrices.length,
          lastPurchaseDate,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        itemsUpdated++;
      }
    }
  }

  // Update shop stats for deleted receipts
  const shopUpdates = new Map<string, {count: number; totalSpent: number}>();

  for (const receiptData of receiptsData) {
    const shopId = receiptData.storeNameNormalized;
    if (shopId) {
      const current = shopUpdates.get(shopId) || {count: 0, totalSpent: 0};
      shopUpdates.set(shopId, {
        count: current.count + 1,
        totalSpent: current.totalSpent + (receiptData.total || 0),
      });
    }
  }

  // Apply shop updates in batch
  const shopBatch = db.batch();
  for (const [shopId, updates] of shopUpdates.entries()) {
    const shopRef = db.collection(shopsPath).doc(shopId);
    const shopDoc = await shopRef.get();

    if (shopDoc.exists) {
      const currentCount = shopDoc.data()?.receiptCount || 0;
      const newCount = currentCount - updates.count;

      if (newCount <= 0) {
        // Delete shop if no receipts left
        shopBatch.delete(shopRef);
      } else {
        shopBatch.update(shopRef, {
          receiptCount: admin.firestore.FieldValue.increment(-updates.count),
          totalSpent: admin.firestore.FieldValue.increment(-updates.totalSpent),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }
  await shopBatch.commit();

  // Clean up other collections (shopping lists, notifications, alerts, budgets)
  const otherCleanupStats = await cleanupOtherCollections(
    userId,
    cutoffTimestamp,
    shoppingListsPath,
    notificationsPath,
    alertsPath,
    budgetsPath,
  );

  return {
    receiptsDeleted,
    itemsUpdated,
    ...otherCleanupStats,
  };
}

/**
 * Clean up shopping lists, notifications, price alerts, and budgets older than 3 months
 */
async function cleanupOtherCollections(
  userId: string,
  cutoffTimestamp: admin.firestore.Timestamp,
  shoppingListsPath: string,
  notificationsPath: string,
  alertsPath: string,
  budgetsPath: string,
): Promise<{
  shoppingListsDeleted: number;
  notificationsDeleted: number;
  alertsDeleted: number;
  budgetsDeleted: number;
}> {
  let shoppingListsDeleted = 0;
  let notificationsDeleted = 0;
  let alertsDeleted = 0;
  let budgetsDeleted = 0;

  // Delete old shopping lists
  try {
    const oldListsSnapshot = await db
      .collection(shoppingListsPath)
      .where('createdAt', '<', cutoffTimestamp)
      .get();

    if (!oldListsSnapshot.empty) {
      const batch = db.batch();
      oldListsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        shoppingListsDeleted++;
      });
      await batch.commit();
    }
  } catch (error) {
    console.error(`  Error deleting shopping lists for ${userId}:`, error);
  }

  // Delete old notifications
  try {
    const oldNotificationsSnapshot = await db
      .collection(notificationsPath)
      .where('timestamp', '<', cutoffTimestamp)
      .get();

    if (!oldNotificationsSnapshot.empty) {
      const batch = db.batch();
      oldNotificationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        notificationsDeleted++;
      });
      await batch.commit();
    }
  } catch (error) {
    console.error(`  Error deleting notifications for ${userId}:`, error);
  }

  // Delete old or triggered price alerts (older than 3 months OR triggered alerts)
  try {
    const oldAlertsSnapshot = await db
      .collection(alertsPath)
      .where('createdAt', '<', cutoffTimestamp)
      .get();

    // Also get triggered alerts regardless of age
    const triggeredAlertsSnapshot = await db
      .collection(alertsPath)
      .where('isTriggered', '==', true)
      .get();

    const alertsToDelete = new Set<string>();
    oldAlertsSnapshot.docs.forEach(doc => alertsToDelete.add(doc.id));
    triggeredAlertsSnapshot.docs.forEach(doc => alertsToDelete.add(doc.id));

    if (alertsToDelete.size > 0) {
      const batch = db.batch();
      for (const alertId of alertsToDelete) {
        const alertRef = db.collection(alertsPath).doc(alertId);
        batch.delete(alertRef);
        alertsDeleted++;
      }
      await batch.commit();
    }
  } catch (error) {
    console.error(`  Error deleting price alerts for ${userId}:`, error);
  }

  // Delete old budgets (older than 3 months)
  try {
    // Get current month key to calculate 3 months ago
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const cutoffMonthKey = `${threeMonthsAgo.getFullYear()}-${String(
      threeMonthsAgo.getMonth() + 1,
    ).padStart(2, '0')}`;

    const budgetsSnapshot = await db.collection(budgetsPath).get();

    if (!budgetsSnapshot.empty) {
      const batch = db.batch();
      budgetsSnapshot.docs.forEach(doc => {
        const budgetMonth = doc.id; // Document ID is month key (YYYY-MM)
        if (budgetMonth < cutoffMonthKey) {
          batch.delete(doc.ref);
          budgetsDeleted++;
        }
      });
      if (budgetsDeleted > 0) {
        await batch.commit();
      }
    }
  } catch (error) {
    console.error(`  Error deleting budgets for ${userId}:`, error);
  }

  return {
    shoppingListsDeleted,
    notificationsDeleted,
    alertsDeleted,
    budgetsDeleted,
  };
}

/**
 * Callable function to manually trigger cleanup for testing
 * Only available to authenticated users with their own data
 */
export const manualCleanupUserData = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated',
      );
    }

    const userId = context.auth.uid;
    const monthsAgo = data.monthsAgo || 3;

    console.log(
      `🧪 Manual cleanup for user ${userId}, ${monthsAgo} months ago`,
    );

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsAgo);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    try {
      const stats = await cleanupUserData(userId, cutoffTimestamp);

      return {
        success: true,
        receiptsDeleted: stats.receiptsDeleted,
        itemsUpdated: stats.itemsUpdated,
        shoppingListsDeleted: stats.shoppingListsDeleted,
        notificationsDeleted: stats.notificationsDeleted,
        alertsDeleted: stats.alertsDeleted,
        cutoffDate: cutoffDate.toISOString(),
      };
    } catch (error: any) {
      console.error('Error in manual cleanup:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Cleanup failed: ${error.message}`,
      );
    }
  });
