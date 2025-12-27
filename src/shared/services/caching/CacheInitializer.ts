/**
 * Cache Initialization
 * 
 * Sets up cache monitoring and periodic cleanup
 */

import {cacheManager} from './CacheManager';
import {cacheAnalytics} from './CacheAnalytics';

class CacheInitializer {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize cache system
   */
  async initialize(): Promise<void> {
    // Start cache analytics monitoring (every 30 minutes)
    if (__DEV__) {
      cacheAnalytics.startMonitoring(30);
      
      // Log initial performance in dev mode
      setTimeout(() => {
        cacheAnalytics.logPerformance();
      }, 5000);
    }

    // Start periodic cleanup (every 6 hours)
    this.startPeriodicCleanup(6 * 60 * 60 * 1000);

    // Run initial cleanup of expired entries
    await cacheManager.cleanupExpired();

    // Preload critical data
    await this.preloadCriticalData();

    console.log('Cache: Initialization complete');
  }

  /**
   * Start periodic cleanup of expired cache entries
   */
  private startPeriodicCleanup(intervalMs: number): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await cacheManager.cleanupExpired();
        if (cleaned > 0) {
          console.log(`Cache: Periodic cleanup removed ${cleaned} expired entries`);
        }
      } catch (error) {
        console.error('Cache: Error during periodic cleanup', error);
      }
    }, intervalMs);
  }

  /**
   * Preload critical data into memory cache on app start
   */
  private async preloadCriticalData(): Promise<void> {
    try {
      // Preload user preferences
      await cacheManager.preload([
        { key: 'onboarding', namespace: 'user-prefs' },
        { key: 'theme', namespace: 'user-prefs' },
      ]);

      // Preload recent receipts (top 10)
      await cacheManager.preload([
        { key: 'receipts', namespace: 'receipts' },
      ]);

      // Preload settings
      await cacheManager.preload([
        { key: 'global', namespace: 'settings' },
      ]);
    } catch (error) {
      console.error('Cache: Error preloading critical data', error);
    }
  }

  /**
   * Shutdown cache system
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    cacheAnalytics.stopMonitoring();
    
    console.log('Cache: Shutdown complete');
  }

  /**
   * Force cleanup now
   */
  async forceCleanup(): Promise<number> {
    return cacheManager.cleanupExpired();
  }

  /**
   * Clear all cache (useful for logout or troubleshooting)
   */
  async clearAll(): Promise<void> {
    await cacheManager.clearAll();
    console.log('Cache: All cache cleared');
  }
}

export const cacheInitializer = new CacheInitializer();
