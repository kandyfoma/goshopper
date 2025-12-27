// User Behavior Tracking Service
// Tracks user actions for ML/AI recommendations and analytics
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from './config';
import {
  UserBehaviorProfile,
  CategoryPreference,
  BrandAffinity,
  UserEngagementMetrics,
} from '@/shared/types/user.types';

/**
 * Track user item view (for collaborative filtering)
 */
export async function trackItemView(
  userId: string,
  itemId: string,
  itemName: string,
  category?: string,
): Promise<void> {
  try {
    const timestamp = new Date();
    
    // Store in recent views (keep last 50)
    const viewRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('itemViews')
      .doc(itemId);

    await viewRef.set({
      itemId,
      itemName,
      category,
      viewCount: firestore.FieldValue.increment(1),
      lastViewedAt: timestamp,
      firstViewedAt: timestamp,
    }, {merge: true});

    // Update engagement metrics
    await updateEngagementMetrics(userId, {
      itemViewsCount: firestore.FieldValue.increment(1),
    });
  } catch (error) {
    console.error('Error tracking item view:', error);
  }
}

/**
 * Track recommendation shown to user
 */
export async function trackRecommendationShown(
  userId: string,
  recommendationId: string,
  recommendationType: 'price_alert' | 'bundle' | 'seasonal' | 'personalized',
  itemIds: string[],
): Promise<void> {
  try {
    const timestamp = new Date();
    
    await firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('recommendations')
      .doc(recommendationId)
      .set({
        type: recommendationType,
        itemIds,
        shownAt: timestamp,
        status: 'shown',
      });

    // Update engagement metrics
    await updateEngagementMetrics(userId, {
      recommendationsShown: firestore.FieldValue.increment(1),
    });
  } catch (error) {
    console.error('Error tracking recommendation shown:', error);
  }
}

/**
 * Track recommendation click
 */
export async function trackRecommendationClick(
  userId: string,
  recommendationId: string,
): Promise<void> {
  try {
    await firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('recommendations')
      .doc(recommendationId)
      .update({
        clickedAt: new Date(),
        status: 'clicked',
      });

    // Update engagement metrics
    await updateEngagementMetrics(userId, {
      recommendationsClicked: firestore.FieldValue.increment(1),
    });

    // Recalculate click rate
    await recalculateRecommendationMetrics(userId);
  } catch (error) {
    console.error('Error tracking recommendation click:', error);
  }
}

/**
 * Track recommendation conversion (user purchased recommended item)
 */
export async function trackRecommendationConversion(
  userId: string,
  recommendationId: string,
  itemId: string,
): Promise<void> {
  try {
    await firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('recommendations')
      .doc(recommendationId)
      .update({
        convertedAt: new Date(),
        status: 'converted',
        convertedItemId: itemId,
      });

    // Recalculate conversion rate
    await recalculateRecommendationMetrics(userId);
  } catch (error) {
    console.error('Error tracking recommendation conversion:', error);
  }
}

/**
 * Track recommendation dismissal
 */
export async function trackRecommendationDismissal(
  userId: string,
  recommendationId: string,
): Promise<void> {
  try {
    await firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('recommendations')
      .doc(recommendationId)
      .update({
        dismissedAt: new Date(),
        status: 'dismissed',
      });

    // Add to dismissed list in preferences
    const profileRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId);

    await profileRef.update({
      'recommendationPreferences.dismissedRecommendations': firestore.FieldValue.arrayUnion(recommendationId),
    });
  } catch (error) {
    console.error('Error tracking recommendation dismissal:', error);
  }
}

/**
 * Track push notification engagement
 */
export async function trackNotificationEngagement(
  userId: string,
  notificationId: string,
  action: 'opened' | 'dismissed',
): Promise<void> {
  try {
    const updates: any = {};
    
    if (action === 'opened') {
      updates.pushNotificationsOpened = firestore.FieldValue.increment(1);
    } else {
      updates.pushNotificationDismissed = firestore.FieldValue.increment(1);
    }

    await updateEngagementMetrics(userId, updates);

    // Recalculate notification open rate
    await recalculateNotificationMetrics(userId);
  } catch (error) {
    console.error('Error tracking notification engagement:', error);
  }
}

/**
 * Update user engagement metrics
 */
async function updateEngagementMetrics(
  userId: string,
  updates: Record<string, any>,
): Promise<void> {
  const profileRef = firestore()
    .collection('artifacts')
    .doc(APP_ID)
    .collection('users')
    .doc(userId);

  const metricsUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    metricsUpdates[`engagementMetrics.${key}`] = value;
  }

  await profileRef.set({
    ...metricsUpdates,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

/**
 * Recalculate recommendation engagement rates
 */
async function recalculateRecommendationMetrics(userId: string): Promise<void> {
  try {
    const profileRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId);

    const profileDoc = await profileRef.get();
    const metrics = profileDoc.data()?.engagementMetrics;

    if (!metrics) return;

    const shown = metrics.recommendationsShown || 0;
    const clicked = metrics.recommendationsClicked || 0;
    const converted = metrics.recommendationConversionRate ? clicked * metrics.recommendationConversionRate : 0;

    const clickRate = shown > 0 ? clicked / shown : 0;
    const conversionRate = clicked > 0 ? converted / clicked : 0;

    await profileRef.update({
      'engagementMetrics.recommendationClickRate': clickRate,
      'engagementMetrics.recommendationConversionRate': conversionRate,
    });
  } catch (error) {
    console.error('Error recalculating recommendation metrics:', error);
  }
}

/**
 * Recalculate notification engagement rates
 */
async function recalculateNotificationMetrics(userId: string): Promise<void> {
  try {
    const profileRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId);

    const profileDoc = await profileRef.get();
    const metrics = profileDoc.data()?.engagementMetrics;

    if (!metrics) return;

    const received = metrics.pushNotificationsReceived || 0;
    const opened = metrics.pushNotificationsOpened || 0;

    const openRate = received > 0 ? opened / received : 0;

    await profileRef.update({
      'engagementMetrics.notificationOpenRate': openRate,
    });
  } catch (error) {
    console.error('Error recalculating notification metrics:', error);
  }
}

/**
 * Update shopping patterns after a receipt is scanned
 */
export async function updateShoppingPatterns(
  userId: string,
  receiptData: {
    total: number;
    itemCount: number;
    storeName: string;
    categories: string[];
    date: Date;
  },
): Promise<void> {
  try {
    const {total, itemCount, storeName, categories, date} = receiptData;
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    const profileRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId);

    // Update shopping pattern metrics
    await profileRef.update({
      'behaviorProfile.lastActiveDate': date,
      'behaviorProfile.lastProfileUpdate': firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Track preferred shopping day
    const dayTrackingRef = profileRef.collection('shoppingDays').doc(dayOfWeek.toString());
    await dayTrackingRef.set({
      dayOfWeek,
      count: firestore.FieldValue.increment(1),
      lastShoppingDate: date,
    }, {merge: true});

    // Track preferred time of day
    const timeTrackingRef = profileRef.collection('shoppingTimes').doc(timeOfDay);
    await timeTrackingRef.set({
      timeOfDay,
      count: firestore.FieldValue.increment(1),
      lastShoppingDate: date,
    }, {merge: true});

  } catch (error) {
    console.warn('Error updating shopping patterns (non-critical):', error instanceof Error ? error.message : error);
  }
}

/**
 * Track user session (for calculating engagement)
 */
export async function trackUserSession(
  userId: string,
  sessionDuration: number, // in seconds
): Promise<void> {
  try {
    await updateEngagementMetrics(userId, {
      totalSessions: firestore.FieldValue.increment(1),
      lastSessionDate: new Date(),
    });

    // Update average session duration
    const profileRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId);

    const profileDoc = await profileRef.get();
    const metrics = profileDoc.data()?.engagementMetrics;
    
    if (metrics) {
      const totalSessions = (metrics.totalSessions || 0) + 1;
      const currentAvg = metrics.averageSessionDuration || 0;
      const newAvg = ((currentAvg * (totalSessions - 1)) + sessionDuration) / totalSessions;

      await profileRef.set({
        engagementMetrics: {
          ...metrics,
          averageSessionDuration: newAvg,
        },
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    }
  } catch (error) {
    console.error('Error tracking user session:', error);
  }
}

/**
 * Initialize default behavior profile for new users
 */
export async function initializeBehaviorProfile(userId: string): Promise<void> {
  try {
    const profileRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId);

    await profileRef.update({
      behaviorProfile: {
        profileVersion: 1,
        lastProfileUpdate: firestore.FieldValue.serverTimestamp(),
        dataQualityScore: 0, // Will improve as we collect more data
      },
      recommendationPreferences: {
        enablePersonalizedRecommendations: true,
        enablePriceAlertRecommendations: true,
        enableBundleRecommendations: true,
        enableSeasonalRecommendations: true,
        recommendationStyle: 'balanced',
        maxRecommendationsPerDay: 5,
      },
      engagementMetrics: {
        totalSessions: 0,
        scansCount: 0,
        itemViewsCount: 0,
        alertsCreatedCount: 0,
        shoppingListsCreatedCount: 0,
        daysActive: 0,
        consecutiveDaysActive: 0,
      },
    });
  } catch (error) {
    console.error('Error initializing behavior profile:', error);
  }
}

export const userBehaviorService = {
  trackItemView,
  trackRecommendationShown,
  trackRecommendationClick,
  trackRecommendationConversion,
  trackRecommendationDismissal,
  trackNotificationEngagement,
  updateShoppingPatterns,
  trackUserSession,
  initializeBehaviorProfile,
};
