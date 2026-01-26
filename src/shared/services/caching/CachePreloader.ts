/**
 * Cache Preloader
 * 
 * Preloads critical data into cache on app startup for better performance
 */

import {cacheManager, CacheTTL, CachePriority} from './CacheManager';
import firestore from '@react-native-firebase/firestore';
import {cityItemsRefreshService} from '@/features/items/services/cityItemsRefreshService';

// Correct base path for GoShopper user data
const USER_BASE_PATH = 'artifacts/goshopper/users';

class CachePreloader {
  private isPreloading = false;
  private preloadComplete = false;

  /**
   * Preload critical user data on app startup
   */
  async preloadCriticalData(userId: string): Promise<void> {
    if (this.isPreloading || this.preloadComplete) {
      return;
    }

    this.isPreloading = true;

    try {
      // Get user profile first to extract defaultCity
      const userDoc = await firestore()
        .collection(USER_BASE_PATH)
        .doc(userId)
        .get();

      const userData = userDoc.data();
      const defaultCity = userData?.defaultCity || userData?.city;

      await Promise.all([
        this.preloadUserProfile(userId),
        this.preloadRecentReceipts(userId),
        this.preloadShoppingLists(userId),
        this.preloadSubscription(userId),
        // Preload city items if user has a default city
        defaultCity ? this.preloadCityItems(defaultCity) : Promise.resolve(),
      ]);

      this.preloadComplete = true;
    } catch (error) {
      console.error('❌ Cache preload failed:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preload user profile data
   */
  private async preloadUserProfile(userId: string): Promise<void> {
    try {
      const userDoc = await firestore()
        .collection(USER_BASE_PATH)
        .doc(userId)
        .get();
      
      if (userDoc.exists) {
        await cacheManager.set(
          `profile-${userId}`,
          userDoc.data(),
          {
            namespace: 'user-prefs',
            ttl: CacheTTL.DAY,
            priority: CachePriority.CRITICAL,
          }
        );
      }
    } catch (error) {
      console.error('Failed to preload user profile:', error);
    }
  }

  /**
   * Preload recent receipts (last 30 days)
   */
  private async preloadRecentReceipts(userId: string): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const receiptsSnapshot = await firestore()
        .collection(USER_BASE_PATH)
        .doc(userId)
        .collection('receipts')
        .where('createdAt', '>=', thirtyDaysAgo)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const receipts = receiptsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      await cacheManager.set(
        'recent-receipts',
        receipts,
        {
          namespace: 'receipts',
          ttl: CacheTTL.HOUR * 6, // 6 hours
          priority: CachePriority.HIGH,
        }
      );

    } catch (error) {
      console.error('Failed to preload receipts:', error);
    }
  }

  /**
   * Preload shopping lists
   */
  private async preloadShoppingLists(userId: string): Promise<void> {
    try {
      const listsSnapshot = await firestore()
        .collection(USER_BASE_PATH)
        .doc(userId)
        .collection('shoppingLists')
        .orderBy('updatedAt', 'desc')
        .limit(10)
        .get();

      const lists = listsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      await cacheManager.set(
        'shopping-lists',
        lists,
        {
          namespace: 'shopping-list',
          ttl: CacheTTL.HOUR * 12, // 12 hours
          priority: CachePriority.HIGH,
        }
      );

    } catch (error) {
      console.error('Failed to preload shopping lists:', error);
    }
  }

  /**
   * Preload subscription data
   */
  private async preloadSubscription(userId: string): Promise<void> {
    try {
      // Try the new subscriptions path first
      let subscriptionDoc = await firestore()
        .collection('artifacts/goshopper/subscriptions')
        .doc(userId)
        .get();

      // Fallback to the user's subscription subcollection
      if (!subscriptionDoc.exists) {
        subscriptionDoc = await firestore()
          .collection(USER_BASE_PATH)
          .doc(userId)
          .collection('subscription')
          .doc(userId)
          .get();
      }

      if (subscriptionDoc.exists) {
        await cacheManager.set(
          `subscription-${userId}`,
          subscriptionDoc.data(),
          {
            namespace: 'user-prefs',
            ttl: CacheTTL.HOUR * 2, // 2 hours
            priority: CachePriority.CRITICAL,
          }
        );
      }
    } catch (error) {
      console.error('Failed to preload subscription:', error);
    }
  }

  /**
   * Preload city items (community prices)
   */
  private async preloadCityItems(city: string): Promise<void> {
    try {
      await cityItemsRefreshService.preloadCityItems(city);
    } catch (error) {
      console.error('Failed to preload city items:', error);
    }
  }

  /**
   * Reset preload state (e.g., on user logout)
   */
  reset(): void {
    this.preloadComplete = false;
    this.isPreloading = false;
    // Stop all auto-refresh timers
    cityItemsRefreshService.stopAllAutoRefresh();
  }

  /**
   * Force refresh cached data
   */
  async refresh(userId: string): Promise<void> {
    this.preloadComplete = false;
    await this.preloadCriticalData(userId);
  }
}

export const cachePreloader = new CachePreloader();
