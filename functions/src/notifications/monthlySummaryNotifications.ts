/**
 * Monthly Summary Report System
 * Sends monthly spending summary to users
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();
const messaging = admin.messaging();

interface MonthlyStats {
  totalSpent: number;
  receiptsCount: number;
  itemsCount: number;
  topCategory: {name: string; amount: number} | null;
  topStore: {name: string; amount: number} | null;
  avgReceiptAmount: number;
  comparisonToPreviousMonth: number; // percentage change
}

/**
 * Calculate monthly stats for a user
 */
async function calculateMonthlyStats(
  userId: string,
  year: number,
  month: number,
): Promise<MonthlyStats> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  // Get receipts for this month
  const receiptsSnapshot = await db
    .collection(`artifacts/${config.app.id}/users/${userId}/receipts`)
    .where('date', '>=', admin.firestore.Timestamp.fromDate(monthStart))
    .where('date', '<=', admin.firestore.Timestamp.fromDate(monthEnd))
    .get();

  let totalSpent = 0;
  let itemsCount = 0;
  const categories: {[key: string]: number} = {};
  const stores: {[key: string]: number} = {};

  receiptsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const receiptTotal = data.total || 0;
    totalSpent += receiptTotal;

    const storeName = data.storeName || 'Unknown';
    stores[storeName] = (stores[storeName] || 0) + receiptTotal;

    (data.items || []).forEach((item: any) => {
      itemsCount++;
      const category = item.category || 'Autres';
      const itemTotal = (item.unitPrice || 0) * (item.quantity || 1);
      categories[category] = (categories[category] || 0) + itemTotal;
    });
  });

  const receiptsCount = receiptsSnapshot.size;
  const avgReceiptAmount = receiptsCount > 0 ? totalSpent / receiptsCount : 0;

  // Get top category
  const topCategory = Object.entries(categories).length > 0
    ? (() => {
        const [name, amount] = Object.entries(categories)
          .sort(([, a], [, b]) => b - a)[0];
        return {name, amount};
      })()
    : null;

  // Get top store
  const topStore = Object.entries(stores).length > 0
    ? (() => {
        const [name, amount] = Object.entries(stores)
          .sort(([, a], [, b]) => b - a)[0];
        return {name, amount};
      })()
    : null;

  // Get previous month data for comparison
  const prevMonthStart = new Date(year, month - 2, 1);
  const prevMonthEnd = new Date(year, month - 1, 0, 23, 59, 59);

  const prevMonthReceipts = await db
    .collection(`artifacts/${config.app.id}/users/${userId}/receipts`)
    .where('date', '>=', admin.firestore.Timestamp.fromDate(prevMonthStart))
    .where('date', '<=', admin.firestore.Timestamp.fromDate(prevMonthEnd))
    .get();

  let prevMonthTotal = 0;
  prevMonthReceipts.docs.forEach(doc => {
    prevMonthTotal += doc.data().total || 0;
  });

  const comparisonToPreviousMonth =
    prevMonthTotal > 0
      ? ((totalSpent - prevMonthTotal) / prevMonthTotal) * 100
      : 0;

  return {
    totalSpent,
    receiptsCount,
    itemsCount,
    topCategory,
    topStore,
    avgReceiptAmount,
    comparisonToPreviousMonth,
  };
}

/**
 * Send monthly summary notification
 */
async function sendMonthlySummaryNotification(
  userId: string,
  stats: MonthlyStats,
  month: number,
  year: number,
): Promise<void> {
  try {
    // Get user's FCM token and language
    const userDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;
    const language = userData?.language || 'fr';

    if (!fcmToken) {
      console.log(`No FCM token for user ${userId}`);
      return;
    }

    const monthNames = {
      fr: [
        'Janvier',
        'Février',
        'Mars',
        'Avril',
        'Mai',
        'Juin',
        'Juillet',
        'Août',
        'Septembre',
        'Octobre',
        'Novembre',
        'Décembre',
      ],
      en: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
    };

    const monthName =
      language === 'fr' ? monthNames.fr[month - 1] : monthNames.en[month - 1];

    const title = `📈 Résumé ${monthName} ${year}`;
    const titleEn = `📈 ${monthName} ${year} Summary`;

    // Build summary message
    let message = '';
    let messageEn = '';

    if (stats.receiptsCount === 0) {
      message = `Aucune dépense enregistrée en ${monthName}. Commencez à scanner vos reçus!`;
      messageEn = `No expenses recorded in ${monthName}. Start scanning your receipts!`;
    } else {
      const comparisonEmoji =
        stats.comparisonToPreviousMonth < 0
          ? '💚'
          : stats.comparisonToPreviousMonth > 10
            ? '⚠️'
            : '📊';

      const comparisonText =
        stats.comparisonToPreviousMonth < 0
          ? `${Math.abs(Math.round(stats.comparisonToPreviousMonth))}% de moins que le mois dernier`
          : stats.comparisonToPreviousMonth > 0
            ? `${Math.round(stats.comparisonToPreviousMonth)}% de plus que le mois dernier`
            : 'Identique au mois dernier';

      const comparisonTextEn =
        stats.comparisonToPreviousMonth < 0
          ? `${Math.abs(Math.round(stats.comparisonToPreviousMonth))}% less than last month`
          : stats.comparisonToPreviousMonth > 0
            ? `${Math.round(stats.comparisonToPreviousMonth)}% more than last month`
            : 'Same as last month';

      message = `${comparisonEmoji} $${stats.totalSpent.toFixed(2)} dépensés • ${stats.receiptsCount} reçus • ${stats.itemsCount} articles`;
      if (stats.topCategory) {
        message += ` • Top: ${stats.topCategory.name}`;
      }
      if (stats.comparisonToPreviousMonth !== 0) {
        message += ` • ${comparisonText}`;
      }

      messageEn = `${comparisonEmoji} $${stats.totalSpent.toFixed(2)} spent • ${stats.receiptsCount} receipts • ${stats.itemsCount} items`;
      if (stats.topCategory) {
        messageEn += ` • Top: ${stats.topCategory.name}`;
      }
      if (stats.comparisonToPreviousMonth !== 0) {
        messageEn += ` • ${comparisonTextEn}`;
      }
    }

    // Send FCM notification
    await messaging.send({
      token: fcmToken,
      notification: {
        title: language === 'fr' ? title : titleEn,
        body: language === 'fr' ? message : messageEn,
      },
      data: {
        type: 'monthly_summary',
        month: month.toString(),
        year: year.toString(),
        totalSpent: stats.totalSpent.toString(),
        receiptsCount: stats.receiptsCount.toString(),
        itemsCount: stats.itemsCount.toString(),
        comparisonToPreviousMonth: stats.comparisonToPreviousMonth.toString(),
        action: 'view_stats',
      },
      android: {
        priority: 'normal',
        notification: {
          channelId: 'monthly_summary',
          icon: 'ic_notification',
          color:
            stats.comparisonToPreviousMonth < 0
              ? '#10b981'
              : stats.comparisonToPreviousMonth > 10
                ? '#f59e0b'
                : '#3b82f6',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });

    // Save notification to Firestore
    const notificationsRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('notifications');

    await notificationsRef.add({
      type: 'monthly_summary',
      title: language === 'fr' ? title : titleEn,
      titleFr: title,
      message: language === 'fr' ? message : messageEn,
      messageFr: message,
      priority: 'normal',
      month,
      year,
      stats,
      read: false,
      actionUrl: '/stats',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `📧 Sent monthly summary to user ${userId} (${monthName} ${year}: $${stats.totalSpent.toFixed(2)})`,
    );
  } catch (error) {
    console.error('Error sending monthly summary:', error);
  }
}

/**
 * Scheduled function to send monthly summaries
 * Runs on 1st of every month at 10:00 AM
 */
export const sendMonthlySummaries = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '512MB',
  })
  .pubsub.schedule('0 10 1 * *')
  .timeZone('Africa/Kinshasa')
  .onRun(async context => {
    try {
      console.log('📊 Starting monthly summary generation...');

      const now = new Date();
      const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      // Get all users
      const usersSnapshot = await db
        .collectionGroup('users')
        .where('notificationsEnabled', '==', true)
        .get();

      console.log(`   Processing ${usersSnapshot.size} users...`);

      let summariesSent = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        try {
          // Calculate stats for last month
          const stats = await calculateMonthlyStats(userId, year, lastMonth);

          // Only send if user had any activity
          if (stats.receiptsCount > 0) {
            await sendMonthlySummaryNotification(userId, stats, lastMonth, year);
            summariesSent++;
          } else {
            console.log(`   Skipping user ${userId} - no activity last month`);
          }

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`   Error processing user ${userId}:`, error);
        }
      }

      console.log(`✅ Monthly summaries sent: ${summariesSent}`);
      return null;
    } catch (error) {
      console.error('Monthly summary generation error:', error);
      return null;
    }
  });

/**
 * Manually send monthly summary to a specific user
 */
export const sendManualMonthlySummary = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const requestingUserId = context.auth.uid;
    const {userId = requestingUserId, month, year} = data;

    if (userId !== requestingUserId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Can only send summaries to yourself',
      );
    }

    try {
      const now = new Date();
      const targetMonth = month || (now.getMonth() === 0 ? 12 : now.getMonth());
      const targetYear =
        year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());

      const stats = await calculateMonthlyStats(userId, targetYear, targetMonth);

      await sendMonthlySummaryNotification(userId, stats, targetMonth, targetYear);

      return {
        success: true,
        message: 'Monthly summary sent',
        stats,
        month: targetMonth,
        year: targetYear,
      };
    } catch (error: any) {
      console.error('Manual monthly summary error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to send monthly summary',
      );
    }
  });
