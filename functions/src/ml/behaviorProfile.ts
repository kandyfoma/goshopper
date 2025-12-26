/**
 * ML Feature Calculation Functions
 * Calculates user behavior features for machine learning recommendations
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();

/**
 * Calculate and update user behavior profile
 * Triggered when receipts or purchases are added
 */
export const updateUserBehaviorProfile = functions
  .region('europe-west1')
  .pubsub.schedule('0 3 * * *') // Daily at 3 AM UTC
  .timeZone('UTC')
  .onRun(async context => {
    console.log('🤖 Starting ML feature calculation for all users...');

    try {
      const usersSnapshot = await db
        .collection(`artifacts/${config.app.id}/users`)
        .get();

      console.log(`👥 Processing ${usersSnapshot.size} users...`);

      let usersProcessed = 0;
      let errors = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        try {
          await calculateUserFeatures(userId);
          usersProcessed++;
        } catch (error) {
          console.error(`❌ Error processing user ${userId}:`, error);
          errors++;
        }
      }

      console.log('✅ ML feature calculation completed!');
      console.log(`📊 Summary: ${usersProcessed} successful, ${errors} errors`);

      return {
        success: true,
        usersProcessed,
        errors,
      };
    } catch (error) {
      console.error('💥 Fatal error in ML feature calculation:', error);
      throw error;
    }
  });

/**
 * Calculate ML features for a single user
 */
async function calculateUserFeatures(userId: string): Promise<void> {
  const receiptsPath = `artifacts/${config.app.id}/users/${userId}/receipts`;
  const profilePath = `artifacts/${config.app.id}/users/${userId}`;

  // Get all receipts (last 6 months for better accuracy)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const receiptsSnapshot = await db
    .collection(receiptsPath)
    .where('date', '>=', admin.firestore.Timestamp.fromDate(sixMonthsAgo))
    .get();

  if (receiptsSnapshot.empty) {
    console.log(`  No receipts for user ${userId}, skipping...`);
    return;
  }

  // Calculate shopping patterns
  const receipts = receiptsSnapshot.docs.map(doc => doc.data());
  
  const totalReceipts = receipts.length;
  const totalSpent = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
  const totalItems = receipts.reduce((sum, r) => sum + (r.items?.length || 0), 0);

  const averageBasketSize = totalReceipts > 0 ? totalItems / totalReceipts : 0;
  const averageSpendPerTrip = totalReceipts > 0 ? totalSpent / totalReceipts : 0;

  // Calculate shopping frequency
  const daysRange = Math.max(
    1,
    Math.floor(
      (Date.now() - sixMonthsAgo.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
  const tripsPerMonth = (totalReceipts / daysRange) * 30;

  let shoppingFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  if (tripsPerMonth >= 25) shoppingFrequency = 'daily';
  else if (tripsPerMonth >= 8) shoppingFrequency = 'weekly';
  else if (tripsPerMonth >= 3) shoppingFrequency = 'biweekly';
  else shoppingFrequency = 'monthly';

  // Analyze preferred shopping days
  const daysCounts: Record<number, number> = {};
  receipts.forEach(r => {
    const date = r.date?.toDate();
    if (date) {
      const day = date.getDay();
      daysCounts[day] = (daysCounts[day] || 0) + 1;
    }
  });
  const preferredShoppingDays = Object.entries(daysCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day]) => parseInt(day));

  // Analyze preferred shopping time
  const timesCounts: Record<string, number> = {};
  receipts.forEach(r => {
    const date = r.date?.toDate();
    if (date) {
      const hour = date.getHours();
      let timeOfDay: string;
      if (hour >= 5 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
      else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
      else timeOfDay = 'night';
      timesCounts[timeOfDay] = (timesCounts[timeOfDay] || 0) + 1;
    }
  });
  const preferredShoppingTime = Object.entries(timesCounts).sort(
    ([, a], [, b]) => b - a,
  )[0]?.[0] as 'morning' | 'afternoon' | 'evening' | 'night' | undefined;

  // Calculate category preferences
  const categoryStats: Record<
    string,
    {count: number; spent: number; lastDate: Date | null}
  > = {};
  receipts.forEach(r => {
    const date = r.date?.toDate() || null;
    (r.items || []).forEach((item: any) => {
      const category = item.category || 'Autres';
      if (!categoryStats[category]) {
        categoryStats[category] = {count: 0, spent: 0, lastDate: null};
      }
      categoryStats[category].count += 1;
      categoryStats[category].spent +=
        (item.unitPrice || 0) * (item.quantity || 1);
      if (date && (!categoryStats[category].lastDate || date > categoryStats[category].lastDate)) {
        categoryStats[category].lastDate = date;
      }
    });
  });

  const topCategories = Object.entries(categoryStats)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([category, stats]) => ({
      category,
      purchaseCount: stats.count,
      totalSpent: stats.spent,
      averagePrice: stats.count > 0 ? stats.spent / stats.count : 0,
      lastPurchaseDate: stats.lastDate,
      interestScore: Math.min(100, (stats.count / totalReceipts) * 100 + (stats.spent / totalSpent) * 50),
    }));

  // Calculate brand affinities
  const brandStats: Record<string, {count: number; lastDate: Date | null}> = {};
  receipts.forEach(r => {
    const date = r.date?.toDate() || null;
    (r.items || []).forEach((item: any) => {
      const brand = item.brand || 'Unknown';
      if (!brandStats[brand]) {
        brandStats[brand] = {count: 0, lastDate: null};
      }
      brandStats[brand].count += 1;
      if (date && (!brandStats[brand].lastDate || date > brandStats[brand].lastDate)) {
        brandStats[brand].lastDate = date;
      }
    });
  });

  const brandAffinities = Object.entries(brandStats)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([brand, stats]) => ({
      brand,
      purchaseCount: stats.count,
      loyaltyScore: Math.min(100, (stats.count / totalReceipts) * 100),
      lastPurchaseDate: stats.lastDate,
    }));

  // Calculate price consciousness
  const prices = receipts.flatMap(r =>
    (r.items || []).map((item: any) => item.unitPrice || 0),
  );
  const averagePrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  let priceConsciousness: 'budget' | 'moderate' | 'premium';
  if (averagePrice < 10) priceConsciousness = 'budget';
  else if (averagePrice < 50) priceConsciousness = 'moderate';
  else priceConsciousness = 'premium';

  // Get preferred stores
  const storeStats: Record<string, number> = {};
  receipts.forEach(r => {
    const store = r.storeName || 'Unknown';
    storeStats[store] = (storeStats[store] || 0) + 1;
  });
  const preferredStores = Object.entries(storeStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([store]) => store);

  // Calculate engagement scores
  const now = Date.now();
  const lastReceipt = receipts[0]?.date?.toDate();
  const daysSinceLastActive = lastReceipt
    ? Math.floor((now - lastReceipt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const weeklyActiveScore = Math.max(0, 100 - daysSinceLastActive * 5);
  const monthlyActiveScore = Math.max(0, 100 - daysSinceLastActive * 2);

  // Calculate churn risk (simple heuristic for now)
  const churnRiskScore = daysSinceLastActive > 30 ? 80 : daysSinceLastActive > 14 ? 50 : 20;

  // Calculate data quality score
  const dataQualityScore = Math.min(
    100,
    (totalReceipts / 10) * 30 + // More receipts = better
    (topCategories.length / 5) * 20 + // Category diversity
    (brandAffinities.length / 10) * 20 + // Brand data
    (preferredStores.length / 3) * 30, // Store data
  );

  // Update user profile with calculated features
  const profileRef = db.doc(profilePath);
  await profileRef.update({
    behaviorProfile: {
      averageBasketSize,
      averageSpendPerTrip,
      shoppingFrequency,
      preferredShoppingDays,
      preferredShoppingTime,
      topCategories,
      brandAffinities,
      priceConsciousness,
      preferredStores,
      lastActiveDate: lastReceipt || new Date(),
      weeklyActiveScore,
      monthlyActiveScore,
      churnRiskScore,
      lastProfileUpdate: admin.firestore.FieldValue.serverTimestamp(),
      profileVersion: 1,
      dataQualityScore,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`  ✅ Updated ML features for user ${userId}`);
}

/**
 * Manually trigger ML feature calculation for a single user
 */
export const calculateUserMLFeatures = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = data.userId || context.auth.uid;

    try {
      await calculateUserFeatures(userId);

      return {
        success: true,
        message: 'ML features calculated successfully',
      };
    } catch (error) {
      console.error('Calculate ML features error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to calculate ML features',
      );
    }
  });
