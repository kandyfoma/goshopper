/**
 * Network-Aware Cache Utilities
 * 
 * Smart caching that adapts to network conditions:
 * - Online: Fetch fresh data and cache it
 * - Offline: Return cached data even if stale
 * - Poor connection: Use cached data with background refresh
 */

import NetInfo from '@react-native-community/netinfo';
import {cacheManager, CacheNamespace, CachePriority} from './CacheManager';

export interface NetworkAwareFetchOptions<T> {
  cacheKey: string;
  namespace: CacheNamespace;
  ttl: number;
  priority?: CachePriority;
  fetchFn: () => Promise<T>;
  onStaleData?: (data: T) => void; // Callback when returning stale data
  forceRefresh?: boolean; // Skip cache and fetch fresh data
}

export interface CacheResult<T> {
  data: T | null;
  fromCache: boolean;
  isStale: boolean;
  error?: Error;
}

class NetworkAwareCacheService {
  private isOnline: boolean = true;
  private connectionType: string = 'unknown';
  
  constructor() {
    // Monitor network status
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      this.connectionType = state.type;
    });
    
    // Initialize network state
    NetInfo.fetch().then(state => {
      this.isOnline = state.isConnected ?? false;
      this.connectionType = state.type;
    });
  }

  /**
   * Check if device is online
   */
  async isConnected(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  /**
   * Check if connection is poor (cellular data)
   */
  isPoorConnection(): boolean {
    return this.connectionType === 'cellular' || this.connectionType === 'other';
  }

  /**
   * Fetch data with network-aware caching strategy
   * 
   * Strategy:
   * - Online + Good connection: Fetch fresh data
   * - Online + Poor connection: Return cache first, refresh in background
   * - Offline: Return cache (even if stale)
   */
  async fetchWithCache<T>(options: NetworkAwareFetchOptions<T>): Promise<CacheResult<T>> {
    const {
      cacheKey,
      namespace,
      ttl,
      priority = CachePriority.NORMAL,
      fetchFn,
      onStaleData,
      forceRefresh = false,
    } = options;

    try {
      // Check network status
      const online = await this.isConnected();
      const poorConnection = this.isPoorConnection();

      // Try to get from cache first
      const cachedData = await cacheManager.get<T>(cacheKey, namespace);

      // OFFLINE: Return cached data (even if stale)
      if (!online) {
        if (cachedData) {
          return {
            data: cachedData,
            fromCache: true,
            isStale: true, // Assume stale when offline
          };
        }
        return {
          data: null,
          fromCache: false,
          isStale: false,
          error: new Error('No cached data available offline'),
        };
      }

      // FORCE REFRESH: Skip cache and fetch fresh
      if (forceRefresh) {
        try {
          const freshData = await fetchFn();
          await cacheManager.set(cacheKey, freshData, {
            namespace,
            ttl,
            priority,
          });
          return {
            data: freshData,
            fromCache: false,
            isStale: false,
          };
        } catch (error) {
          // If fetch fails, fall back to cache
          if (cachedData) {
            onStaleData?.(cachedData);
            return {
              data: cachedData,
              fromCache: true,
              isStale: true,
              error: error as Error,
            };
          }
          throw error;
        }
      }

      // POOR CONNECTION: Return cache first, refresh in background
      if (poorConnection && cachedData) {
        // Return cached data immediately
        const result = {
          data: cachedData,
          fromCache: true,
          isStale: false,
        };

        // Refresh in background (don't await)
        this.refreshInBackground(cacheKey, namespace, ttl, priority, fetchFn);

        return result;
      }

      // GOOD CONNECTION: Check cache validity
      const hasFreshCache = await cacheManager.has(cacheKey, namespace);
      
      if (hasFreshCache && cachedData && !forceRefresh) {
        return {
          data: cachedData,
          fromCache: true,
          isStale: false,
        };
      }

      // Fetch fresh data
      try {
        const freshData = await fetchFn();
        await cacheManager.set(cacheKey, freshData, {
          namespace,
          ttl,
          priority,
        });
        return {
          data: freshData,
          fromCache: false,
          isStale: false,
        };
      } catch (error) {
        // If fetch fails but we have cache, return it
        if (cachedData) {
          onStaleData?.(cachedData);
          return {
            data: cachedData,
            fromCache: true,
            isStale: true,
            error: error as Error,
          };
        }
        throw error;
      }
    } catch (error) {
      console.error('NetworkAwareCache: Error fetching data', error);
      return {
        data: null,
        fromCache: false,
        isStale: false,
        error: error as Error,
      };
    }
  }

  /**
   * Refresh cache in background (fire and forget)
   */
  private async refreshInBackground<T>(
    cacheKey: string,
    namespace: CacheNamespace,
    ttl: number,
    priority: CachePriority,
    fetchFn: () => Promise<T>
  ): Promise<void> {
    try {
      const freshData = await fetchFn();
      await cacheManager.set(cacheKey, freshData, {
        namespace,
        ttl,
        priority,
      });
    } catch (error) {
      // Silent failure for background refresh
      console.log('Background refresh failed:', error);
    }
  }

  /**
   * Stale-While-Revalidate pattern
   * Returns cached data immediately, then fetches fresh data and updates cache
   */
  async staleWhileRevalidate<T>(
    options: NetworkAwareFetchOptions<T> & {
      onFreshData?: (data: T) => void;
    }
  ): Promise<T | null> {
    const {cacheKey, namespace, ttl, priority = CachePriority.NORMAL, fetchFn, onFreshData} = options;

    // Return cached data immediately
    const cachedData = await cacheManager.get<T>(cacheKey, namespace);
    
    // Fetch fresh data in background
    const online = await this.isConnected();
    if (online) {
      fetchFn()
        .then(async freshData => {
          await cacheManager.set(cacheKey, freshData, {
            namespace,
            ttl,
            priority,
          });
          onFreshData?.(freshData);
        })
        .catch(error => {
          console.log('Background revalidation failed:', error);
        });
    }

    return cachedData;
  }

  /**
   * Prefetch data and store in cache (for preloading)
   */
  async prefetch<T>(
    cacheKey: string,
    namespace: CacheNamespace,
    ttl: number,
    fetchFn: () => Promise<T>,
    priority: CachePriority = CachePriority.LOW
  ): Promise<void> {
    try {
      const online = await this.isConnected();
      if (!online) return; // Skip prefetch when offline

      const data = await fetchFn();
      await cacheManager.set(cacheKey, data, {
        namespace,
        ttl,
        priority,
      });
    } catch (error) {
      console.log('Prefetch failed:', error);
    }
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): { online: boolean; connectionType: string } {
    return {
      online: this.isOnline,
      connectionType: this.connectionType,
    };
  }
}

export const networkAwareCache = new NetworkAwareCacheService();
