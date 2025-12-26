/**
 * Category Insights Notifications for Premium Users
 * Sends personalized category spending insights every 3 days
 * Excludes "Autres" category and provides actionable shopping habit data
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();
const messaging = admin.messaging();

interface CategorySpending {
  category: string;
  amount: number;
  itemCount: number;
  avgPrice: number;
  currency: 'USD' | 'CDF';
}

interface UserInsight {
  userId: string;
  fcmToken: string;
  language: string;
  selectedCategory: CategorySpending;
}

/**
 * Calculate recent category spending for a user (last 30 days)
 */
async function calculateCategorySpending(
  userId: string,
): Promise<CategorySpending[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get receipts from last 30 days
  const receiptsSnapshot = await db
    .collection(`artifacts/${config.app.id}/users/${userId}/receipts`)
    .where('date', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .get();

  const categories: {
    [key: string]: {
      amount: number;
      itemCount: number;
      currency: 'USD' | 'CDF';
    };
  } = {};

  receiptsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const currency = data.currency || 'USD';

    (data.items || []).forEach((item: any) => {
      const category = item.category || 'Autres';
      const itemTotal = (item.unitPrice || 0) * (item.quantity || 1);

      if (!categories[category]) {
        categories[category] = {amount: 0, itemCount: 0, currency};
      }

      categories[category].amount += itemTotal;
      categories[category].itemCount++;
    });
  });

  // Convert to array and calculate averages, exclude "Autres"
  const categorySpending: CategorySpending[] = Object.entries(categories)
    .filter(([category]) => category !== 'Autres')
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      itemCount: data.itemCount,
      avgPrice: data.itemCount > 0 ? data.amount / data.itemCount : 0,
      currency: data.currency,
    }))
    .sort((a, b) => b.amount - a.amount); // Sort by amount descending

  return categorySpending;
}

/**
 * Check if user is premium (has active subscription)
 */
async function isPremiumUser(userId: string): Promise<boolean> {
  try {
    const subscriptionDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}/subscription/current`)
      .get();

    if (!subscriptionDoc.exists) {
      return false;
    }

    const subscription = subscriptionDoc.data();
    const now = Date.now();

    // Check if subscription is active
    if (
      subscription?.status === 'active' &&
      subscription?.planId !== 'free' &&
      subscription?.expiresAt &&
      subscription.expiresAt.toMillis() > now
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error checking premium status for ${userId}:`, error);
    return false;
  }
}

/**
 * Format currency based on type
 */
function formatCurrency(amount: number, currency: 'USD' | 'CDF'): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  } else {
    return `${Math.round(amount).toLocaleString('fr-FR')} FC`;
  }
}

/**
 * Generate notification content based on language and category
 */
function generateNotificationContent(
  language: string,
  category: string,
  amount: number,
  currency: 'USD' | 'CDF',
  itemCount: number,
  avgPrice: number,
): {title: string; body: string} {
  const formattedAmount = formatCurrency(amount, currency);
  const formattedAvgPrice = formatCurrency(avgPrice, currency);

  if (language === 'en') {
    return {
      title: `💡 ${category} Spending Insight`,
      body: `You've spent ${formattedAmount} on ${category} (${itemCount} items, avg ${formattedAvgPrice}). Track your habits in Stats!`,
    };
  }

  // French (default)
  return {
    title: `💡 Analyse ${category}`,
    body: `Vous avez dépensé ${formattedAmount} en ${category} (${itemCount} articles, moy. ${formattedAvgPrice}). Consultez Stats!`,
  };
}

/**
 * Select a random category for notification (excluding Autres)
 */
function selectRandomCategory(
  categories: CategorySpending[],
): CategorySpending | null {
  if (categories.length === 0) {
    return null;
  }

  // Weight selection towards higher spending categories
  // Top 3 categories have higher chance of being selected
  const weighted: CategorySpending[] = [];

  categories.slice(0, 3).forEach(cat => {
    weighted.push(cat, cat, cat); // Add 3 times for top 3
  });

  categories.slice(3).forEach(cat => {
    weighted.push(cat); // Add once for others
  });

  const randomIndex = Math.floor(Math.random() * weighted.length);
  return weighted[randomIndex];
}

/**
 * Send category insight notification to a user
 */
async function sendCategoryInsightNotification(
  insight: UserInsight,
): Promise<boolean> {
  try {
    const {title, body} = generateNotificationContent(
      insight.language,
      insight.selectedCategory.category,
      insight.selectedCategory.amount,
      insight.selectedCategory.currency,
      insight.selectedCategory.itemCount,
      insight.selectedCategory.avgPrice,
    );

    const message: admin.messaging.Message = {
      token: insight.fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        type: 'category_insight',
        category: insight.selectedCategory.category,
        amount: insight.selectedCategory.amount.toString(),
        currency: insight.selectedCategory.currency,
        itemCount: insight.selectedCategory.itemCount.toString(),
        route: 'Stats',
      },
      android: {
        priority: 'normal',
        notification: {
          channelId: 'insights',
          priority: 'default',
          icon: 'ic_notification',
          color: '#6366F1',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    await messaging.send(message);
    console.log(
      `✅ Sent category insight to user ${insight.userId}: ${insight.selectedCategory.category}`,
    );

    // Log notification to user's history
    await db
      .collection(
        `artifacts/${config.app.id}/users/${insight.userId}/notifications`,
      )
      .add({
        type: 'category_insight',
        title,
        body,
        category: insight.selectedCategory.category,
        amount: insight.selectedCategory.amount,
        currency: insight.selectedCategory.currency,
        itemCount: insight.selectedCategory.itemCount,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return true;
  } catch (error) {
    console.error(
      `Error sending notification to user ${insight.userId}:`,
      error,
    );
    return false;
  }
}

/**
 * Scheduled function to send category insights to premium users
 * Runs every 3 days at 10:00 AM Kinshasa time
 */
export const sendCategoryInsights = functions
  .region(config.app.region)
  .pubsub.schedule('0 10 */3 * *') // Every 3 days at 10:00 AM
  .timeZone('Africa/Kinshasa')
  .onRun(async context => {
    console.log('🔔 Starting category insights notification job...');

    try {
      // Get all users
      const usersSnapshot = await db
        .collectionGroup('users')
        .where('fcmToken', '!=', null)
        .get();

      console.log(`Found ${usersSnapshot.size} users with FCM tokens`);

      const insights: UserInsight[] = [];
      let premiumCount = 0;
      let nonPremiumCount = 0;

      // Process each user
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Check if user is premium
        const isPremium = await isPremiumUser(userId);

        if (!isPremium) {
          nonPremiumCount++;
          continue;
        }

        premiumCount++;

        // Calculate category spending
        const categorySpending = await calculateCategorySpending(userId);

        if (categorySpending.length === 0) {
          console.log(`No spending data for premium user ${userId}`);
          continue;
        }

        // Select a random category (weighted towards top spenders)
        const selectedCategory = selectRandomCategory(categorySpending);

        if (!selectedCategory) {
          continue;
        }

        insights.push({
          userId,
          fcmToken: userData.fcmToken,
          language: userData.language || 'fr',
          selectedCategory,
        });
      }

      console.log(
        `📊 Premium users: ${premiumCount}, Non-premium: ${nonPremiumCount}`,
      );
      console.log(`📤 Sending insights to ${insights.length} premium users`);

      // Send notifications in batches to avoid rate limits
      let successCount = 0;
      let failureCount = 0;

      for (const insight of insights) {
        const success = await sendCategoryInsightNotification(insight);
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(
        `✅ Category insights job completed: ${successCount} sent, ${failureCount} failed`,
      );

      return {
        success: true,
        premiumUsers: premiumCount,
        notificationsSent: successCount,
        notificationsFailed: failureCount,
      };
    } catch (error) {
      console.error('Error in category insights job:', error);
      throw error;
    }
  });

/**
 * Manually trigger category insight for a specific user (for testing)
 */
export const sendCategoryInsightToUser = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    // Require authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated',
      );
    }

    const userId = data.userId || context.auth.uid;

    // Check if user is premium
    const isPremium = await isPremiumUser(userId);
    if (!isPremium) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User must have an active premium subscription',
      );
    }

    // Get user data
    const userDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    const userData = userDoc.data();

    if (!userData?.fcmToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User does not have FCM token',
      );
    }

    // Calculate category spending
    const categorySpending = await calculateCategorySpending(userId);

    if (categorySpending.length === 0) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No spending data available',
      );
    }

    // Select a random category
    const selectedCategory = selectRandomCategory(categorySpending);

    if (!selectedCategory) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Could not select category',
      );
    }

    const insight: UserInsight = {
      userId,
      fcmToken: userData.fcmToken,
      language: userData.language || 'fr',
      selectedCategory,
    };

    const success = await sendCategoryInsightNotification(insight);

    return {
      success,
      category: selectedCategory.category,
      amount: selectedCategory.amount,
      itemCount: selectedCategory.itemCount,
    };
  });
