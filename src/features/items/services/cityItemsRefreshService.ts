// City Items Background Refresh Service
// Automatically refreshes city items data in the background to keep cache fresh
import {firebase} from '@react-native-firebase/functions';
import {cacheManager, CacheTTL} from '@/shared/services/caching';
import {analyticsService} from '@/shared/services/analytics';

interface CityItemData {
  id: string;
  name: string;
  category?: string;
  searchKeywords?: string[];
  prices: {
    storeName: string;
    originalName?: string;
    price: number;
    currency: 'USD' | 'CDF';
    date: Date | any;
    userId: string;
  }[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  currency: 'USD' | 'CDF';
  userCount: number;
  lastPurchaseDate: Date;
  createdAt?: Date;
}

interface RefreshOptions {
  city: string;
  silent?: boolean; // If true, won't throw errors to UI
  forceRefresh?: boolean; // If true, bypasses cache completely
}

interface RefreshResult {
  success: boolean;
  itemCount: number;
  cached: boolean;
  error?: string;
}

class CityItemsRefreshService {
  private activeRefreshes: Set<string> = new Set();
  private refreshTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private listeners: Map<string, Set<(items: CityItemData[]) => void>> = new Map();
  
  // Configuration
  private readonly REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_THRESHOLD = 3 * 60 * 1000; // 3 minutes - data considered stale after this

  /**
   * Start automatic background refresh for a city
   * This will refresh the cache periodically without user intervention
   */
  startAutoRefresh(city: string): void {
    if (!city) {
      console.log('⚠️ [CityItemsRefresh] Cannot start auto-refresh: no city provided');
      return;
    }

    // Stop existing timer if any
    this.stopAutoRefresh(city);

    console.log(`🔄 [CityItemsRefresh] Starting auto-refresh for city: ${city}`);
    
    // Initial refresh
    this.silentRefresh(city);

    // Set up periodic refresh
    const timer = setInterval(() => {
      this.silentRefresh(city);
    }, this.REFRESH_INTERVAL);

    this.refreshTimers.set(city, timer);
  }

  /**
   * Stop automatic background refresh for a city
   */
  stopAutoRefresh(city: string): void {
    const timer = this.refreshTimers.get(city);
    if (timer) {
      clearInterval(timer);
      this.refreshTimers.delete(city);
      console.log(`⏹️ [CityItemsRefresh] Stopped auto-refresh for city: ${city}`);
    }
  }

  /**
   * Stop all active auto-refresh timers
   */
  stopAllAutoRefresh(): void {
    this.refreshTimers.forEach((timer, city) => {
      clearInterval(timer);
      console.log(`⏹️ [CityItemsRefresh] Stopped auto-refresh for city: ${city}`);
    });
    this.refreshTimers.clear();
  }

  /**
   * Subscribe to city items updates
   * Listener will be called whenever data is refreshed
   */
  subscribe(city: string, callback: (items: CityItemData[]) => void): () => void {
    if (!this.listeners.has(city)) {
      this.listeners.set(city, new Set());
    }
    
    this.listeners.get(city)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const cityListeners = this.listeners.get(city);
      if (cityListeners) {
        cityListeners.delete(callback);
        if (cityListeners.size === 0) {
          this.listeners.delete(city);
        }
      }
    };
  }

  /**
   * Notify all listeners of updated data
   */
  private notifyListeners(city: string, items: CityItemData[]): void {
    const cityListeners = this.listeners.get(city);
    if (cityListeners) {
      cityListeners.forEach(callback => {
        try {
          callback(items);
        } catch (error) {
          console.error('⚠️ [CityItemsRefresh] Error in listener callback:', error);
        }
      });
    }
  }

  /**
   * Silently refresh city items in the background
   * Updates cache without disrupting UI
   */
  async silentRefresh(city: string): Promise<RefreshResult> {
    const refreshKey = `refresh-${city}`;
    
    // Prevent duplicate refreshes for the same city
    if (this.activeRefreshes.has(refreshKey)) {
      console.log(`⏳ [CityItemsRefresh] Refresh already in progress for: ${city}`);
      return {
        success: false,
        itemCount: 0,
        cached: false,
        error: 'Refresh already in progress',
      };
    }

    this.activeRefreshes.add(refreshKey);

    try {
      console.log(`🔄 [CityItemsRefresh] Silent refresh starting for city: ${city}`);
      
      const result = await this.fetchCityItems({
        city,
        silent: true,
        forceRefresh: true,
      });

      console.log(`✅ [CityItemsRefresh] Silent refresh completed: ${result.itemCount} items`);
      
      // Track refresh in analytics
      analyticsService.logCustomEvent('city_items_auto_refresh', {
        city,
        itemCount: result.itemCount,
        success: result.success,
      });

      return result;
    } catch (error) {
      console.error('⚠️ [CityItemsRefresh] Silent refresh error:', error);
      return {
        success: false,
        itemCount: 0,
        cached: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.activeRefreshes.delete(refreshKey);
    }
  }

  /**
   * Refresh city items while user is viewing the page
   * Shows subtle update without disrupting reading experience
   */
  async refreshWhileReading(city: string): Promise<RefreshResult> {
    console.log(`📖 [CityItemsRefresh] Refresh while reading: ${city}`);
    
    return this.fetchCityItems({
      city,
      silent: false,
      forceRefresh: false, // Use cache if recent
    });
  }

  /**
   * Check if cached data is stale and needs refresh
   */
  async isCacheStale(city: string): Promise<boolean> {
    const cacheKey = `city-items-${city}`;
    
    try {
      const metadata = await cacheManager.getMetadata(cacheKey, 'receipts');
      if (!metadata) {
        return true; // No cache = stale
      }

      const age = Date.now() - metadata.timestamp;
      return age > this.STALE_THRESHOLD;
    } catch (error) {
      console.log('⚠️ [CityItemsRefresh] Error checking cache age:', error);
      return true; // Assume stale on error
    }
  }

  /**
   * Preload city items into cache (warm cache)
   * Useful when app starts or user profile changes
   */
  async preloadCityItems(city: string): Promise<RefreshResult> {
    console.log(`🔥 [CityItemsRefresh] Preloading city items for: ${city}`);
    
    const cacheKey = `city-items-${city}`;
    
    // Check if cache exists and is fresh
    try {
      const cached = await cacheManager.get<CityItemData[]>(cacheKey, 'receipts');
      const isStale = await this.isCacheStale(city);
      
      if (cached && !isStale) {
        console.log(`✅ [CityItemsRefresh] Cache is fresh, no preload needed`);
        return {
          success: true,
          itemCount: cached.length,
          cached: true,
        };
      }
    } catch (error) {
      console.log('⚠️ [CityItemsRefresh] Error checking cache:', error);
    }

    // Cache is stale or missing, preload it
    return this.fetchCityItems({
      city,
      silent: true,
      forceRefresh: true,
    });
  }

  /**
   * Core function to fetch city items from server and update cache
   */
  private async fetchCityItems(options: RefreshOptions): Promise<RefreshResult> {
    const {city, silent = false, forceRefresh = false} = options;
    const cacheKey = `city-items-${city}`;

    try {
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cached = await cacheManager.get<CityItemData[]>(cacheKey, 'receipts');
        const isStale = await this.isCacheStale(city);
        
        if (cached && !isStale) {
          console.log(`💾 [CityItemsRefresh] Using fresh cache (${cached.length} items)`);
          return {
            success: true,
            itemCount: cached.length,
            cached: true,
          };
        }
      }

      // Fetch from server
      console.log(`📡 [CityItemsRefresh] Fetching from server: ${city}`);
      
      const functionsInstance = firebase.app().functions('europe-west1');
      const callFunction = functionsInstance.httpsCallable('getCityItems', {
        timeout: 30000,
      });

      const result = await callFunction({city});
      const data = result.data as {
        success: boolean;
        items: CityItemData[];
        city: string;
        message?: string;
      };

      if (data.success && data.items && data.items.length > 0) {
        const itemsArray = data.items.sort(
          (a: any, b: any) => b.prices.length - a.prices.length,
        );

        // Update cache
        await cacheManager.set(cacheKey, itemsArray, {
          namespace: 'receipts',
          ttl: CacheTTL.DAY,
        });

        console.log(`💾 [CityItemsRefresh] Cached ${itemsArray.length} items`);

        // Notify listeners
        this.notifyListeners(city, itemsArray);

        return {
          success: true,
          itemCount: itemsArray.length,
          cached: false,
        };
      } else {
        // Empty result - clear cache
        await cacheManager.remove(cacheKey, 'receipts');
        
        // Notify listeners with empty array
        this.notifyListeners(city, []);

        return {
          success: true,
          itemCount: 0,
          cached: false,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('⚠️ [CityItemsRefresh] Fetch error:', errorMessage);
      
      if (!silent) {
        throw error;
      }

      return {
        success: false,
        itemCount: 0,
        cached: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get cached items without triggering a refresh
   */
  async getCachedItems(city: string): Promise<CityItemData[] | null> {
    const cacheKey = `city-items-${city}`;
    
    try {
      return await cacheManager.get<CityItemData[]>(cacheKey, 'receipts');
    } catch (error) {
      console.log('⚠️ [CityItemsRefresh] Error getting cached items:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific city
   */
  async clearCache(city: string): Promise<void> {
    const cacheKey = `city-items-${city}`;
    
    try {
      await cacheManager.remove(cacheKey, 'receipts');
      console.log(`🗑️ [CityItemsRefresh] Cleared cache for: ${city}`);
    } catch (error) {
      console.error('⚠️ [CityItemsRefresh] Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const cityItemsRefreshService = new CityItemsRefreshService();

// Export type for consumers
export type {CityItemData, RefreshResult};
