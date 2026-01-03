/**
 * Unified Cache Manager
 * 
 * Two-tier caching system with memory and persistent storage
 * Features:
 * - Memory cache (Tier 1) for fast access
 * - AsyncStorage cache (Tier 2) for persistence
 * - TTL (Time-to-Live) support
 * - LRU eviction for memory cache
 * - Cache statistics and monitoring
 * - Smart invalidation strategies
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache configuration
export interface CacheConfig {
  maxMemoryCacheSize?: number; // Max items in memory cache (default: 100)
  maxMemoryCacheBytes?: number; // Max memory size in bytes (default: 10MB)
  defaultTTL?: number; // Default TTL in milliseconds (default: 1 hour)
  enableCompression?: boolean; // Future: compress large objects
  enableAnalytics?: boolean; // Track cache performance
}

// Cache entry metadata
interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt: number;
  size: number; // Approximate size in bytes
}

// Cache statistics
export interface CacheStats {
  memoryHits: number;
  memoryMisses: number;
  diskHits: number;
  diskMisses: number;
  memorySize: number;
  memoryEntries: number;
  evictions: number;
  errors: number;
}

// Cache priority levels
export enum CachePriority {
  CRITICAL = 'critical', // Never auto-evict
  HIGH = 'high',         // Evict last
  NORMAL = 'normal',     // Default
  LOW = 'low',           // Evict first
}

// Cache namespace for organizing data
export type CacheNamespace = 
  | 'user-prefs'
  | 'receipts'
  | 'shopping-list'
  | 'settings'
  | 'security'
  | 'widgets'
  | 'offline-queue'
  | 'stats'
  | 'shops'
  | 'items'
  | 'home-data'
  | 'history'
  | 'temp';

const DEFAULT_CONFIG: Required<CacheConfig> = {
  maxMemoryCacheSize: 500, // Balanced for mobile devices
  maxMemoryCacheBytes: 50 * 1024 * 1024, // 50MB to avoid memory pressure
  defaultTTL: 60 * 60 * 1000, // 1 hour default TTL
  enableCompression: false,
  enableAnalytics: true,
};

class CacheManager {
  private config: Required<CacheConfig>;
  private memoryCache: Map<string, CacheEntry<any>>;
  private priorityMap: Map<string, CachePriority>;
  private stats: CacheStats;
  private storagePrefix = '@cache:';

  constructor(config: CacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryCache = new Map();
    this.priorityMap = new Map();
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      diskHits: 0,
      diskMisses: 0,
      memorySize: 0,
      memoryEntries: 0,
      evictions: 0,
      errors: 0,
    };
  }

  /**
   * Get data from cache (memory first, then disk)
   */
  async get<T>(
    key: string,
    namespace: CacheNamespace = 'temp'
  ): Promise<T | null> {
    const fullKey = this.buildKey(namespace, key);

    try {
      // Try memory cache first (Tier 1)
      const memoryEntry = this.memoryCache.get(fullKey);
      if (memoryEntry) {
        // Check if expired
        if (Date.now() > memoryEntry.expiresAt) {
          this.memoryCache.delete(fullKey);
          this.updateMemorySize();
        } else {
          // Update access metadata
          memoryEntry.accessCount++;
          memoryEntry.lastAccessedAt = Date.now();
          this.stats.memoryHits++;
          return memoryEntry.value as T;
        }
      }

      this.stats.memoryMisses++;

      // Try persistent cache (Tier 2)
      const diskData = await AsyncStorage.getItem(fullKey);
      if (diskData) {
        const entry: CacheEntry<T> = JSON.parse(diskData);
        
        // Check if expired
        if (Date.now() > entry.expiresAt) {
          await AsyncStorage.removeItem(fullKey);
          this.stats.diskMisses++;
          return null;
        }

        this.stats.diskHits++;

        // Promote to memory cache (hot data)
        this.setMemoryCache(fullKey, entry.value, entry.expiresAt - Date.now());

        return entry.value;
      }

      this.stats.diskMisses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Error getting key', fullKey, error);
      return null;
    }
  }

  /**
   * Set data in both memory and persistent cache
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      namespace?: CacheNamespace;
      ttl?: number; // TTL in milliseconds
      priority?: CachePriority;
      memoryOnly?: boolean; // Don't persist to disk
    } = {}
  ): Promise<boolean> {
    const {
      namespace = 'temp',
      ttl = this.config.defaultTTL,
      priority = CachePriority.NORMAL,
      memoryOnly = false,
    } = options;

    const fullKey = this.buildKey(namespace, key);

    try {
      const expiresAt = Date.now() + ttl;

      // Set in memory cache
      this.setMemoryCache(fullKey, value, ttl, priority);

      // Set in persistent cache (unless memory-only)
      if (!memoryOnly) {
        const entry: CacheEntry<T> = {
          key: fullKey,
          value,
          createdAt: Date.now(),
          expiresAt,
          accessCount: 0,
          lastAccessedAt: Date.now(),
          size: this.estimateSize(value),
        };

        await AsyncStorage.setItem(fullKey, JSON.stringify(entry));
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Error setting key', fullKey, error);
      return false;
    }
  }

  /**
   * Remove data from cache
   */
  async remove(key: string, namespace: CacheNamespace = 'temp'): Promise<void> {
    const fullKey = this.buildKey(namespace, key);

    try {
      // Remove from memory
      this.memoryCache.delete(fullKey);
      this.priorityMap.delete(fullKey);
      this.updateMemorySize();

      // Remove from disk
      await AsyncStorage.removeItem(fullKey);
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Error removing key', fullKey, error);
    }
  }

  /**
   * Clear all cache in a namespace
   */
  async clearNamespace(namespace: CacheNamespace): Promise<void> {
    try {
      const prefix = this.buildKey(namespace, '');
      
      // Clear from memory
      const memoryKeys = Array.from(this.memoryCache.keys());
      for (const key of memoryKeys) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
          this.priorityMap.delete(key);
        }
      }
      this.updateMemorySize();

      // Clear from disk
      const allKeys = await AsyncStorage.getAllKeys();
      const namespacedKeys = allKeys.filter(k => k.startsWith(prefix));
      if (namespacedKeys.length > 0) {
        await AsyncStorage.multiRemove(namespacedKeys);
      }
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Error clearing namespace', namespace, error);
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      this.priorityMap.clear();
      this.updateMemorySize();

      // Clear all disk cache with our prefix
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(k => k.startsWith(this.storagePrefix));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Error clearing all cache', error);
    }
  }

  /**
   * Check if key exists and is not expired
   */
  async has(key: string, namespace: CacheNamespace = 'temp'): Promise<boolean> {
    const fullKey = this.buildKey(namespace, key);

    // Check memory cache
    const memoryEntry = this.memoryCache.get(fullKey);
    if (memoryEntry && Date.now() <= memoryEntry.expiresAt) {
      return true;
    }

    // Check disk cache
    try {
      const diskData = await AsyncStorage.getItem(fullKey);
      if (diskData) {
        const entry: CacheEntry<any> = JSON.parse(diskData);
        return Date.now() <= entry.expiresAt;
      }
    } catch (error) {
      this.stats.errors++;
    }

    return false;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      diskHits: 0,
      diskMisses: 0,
      memorySize: this.stats.memorySize,
      memoryEntries: this.stats.memoryEntries,
      evictions: 0,
      errors: 0,
    };
  }

  /**
   * Get hit rate percentage
   */
  getHitRate(): { memory: number; disk: number; overall: number } {
    const totalMemory = this.stats.memoryHits + this.stats.memoryMisses;
    const totalDisk = this.stats.diskHits + this.stats.diskMisses;
    const totalOverall = totalMemory + totalDisk;

    return {
      memory: totalMemory > 0 ? (this.stats.memoryHits / totalMemory) * 100 : 0,
      disk: totalDisk > 0 ? (this.stats.diskHits / totalDisk) * 100 : 0,
      overall: totalOverall > 0 
        ? ((this.stats.memoryHits + this.stats.diskHits) / totalOverall) * 100 
        : 0,
    };
  }

  /**
   * Set data in memory cache with LRU eviction
   */
  private setMemoryCache<T>(
    key: string,
    value: T,
    ttl: number,
    priority: CachePriority = CachePriority.NORMAL
  ): void {
    const size = this.estimateSize(value);
    const expiresAt = Date.now() + ttl;

    // Check if we need to evict entries
    if (
      this.memoryCache.size >= this.config.maxMemoryCacheSize ||
      this.stats.memorySize + size > this.config.maxMemoryCacheBytes
    ) {
      this.evictLRU(priority);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt,
      accessCount: 1,
      lastAccessedAt: Date.now(),
      size,
    };

    this.memoryCache.set(key, entry);
    this.priorityMap.set(key, priority);
    this.updateMemorySize();
  }

  /**
   * Evict least recently used entries (respecting priority)
   */
  private evictLRU(priorityThreshold: CachePriority): void {
    const entries = Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({
        key,
        entry,
        priority: this.priorityMap.get(key) || CachePriority.NORMAL,
      }))
      .filter(item => {
        // Never evict CRITICAL items
        if (item.priority === CachePriority.CRITICAL) return false;
        
        // Evict based on priority threshold
        const priorityOrder = [CachePriority.LOW, CachePriority.NORMAL, CachePriority.HIGH];
        const itemIndex = priorityOrder.indexOf(item.priority);
        const thresholdIndex = priorityOrder.indexOf(priorityThreshold);
        
        return itemIndex <= thresholdIndex;
      })
      .sort((a, b) => {
        // Sort by priority first (lower priority evicted first)
        const priorityOrder = [CachePriority.LOW, CachePriority.NORMAL, CachePriority.HIGH];
        const aPriority = priorityOrder.indexOf(a.priority);
        const bPriority = priorityOrder.indexOf(b.priority);
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // Then by last accessed (older evicted first)
        return a.entry.lastAccessedAt - b.entry.lastAccessedAt;
      });

    // Evict 20% of eligible entries
    const toEvict = Math.max(1, Math.ceil(entries.length * 0.2));
    
    for (let i = 0; i < toEvict && entries[i]; i++) {
      this.memoryCache.delete(entries[i].key);
      this.priorityMap.delete(entries[i].key);
      this.stats.evictions++;
    }

    this.updateMemorySize();
  }

  /**
   * Update memory size statistics
   */
  private updateMemorySize(): void {
    let totalSize = 0;
    this.memoryCache.forEach(entry => {
      totalSize += entry.size;
    });
    this.stats.memorySize = totalSize;
    this.stats.memoryEntries = this.memoryCache.size;
  }

  /**
   * Estimate object size in bytes
   */
  private estimateSize(obj: any): number {
    try {
      return JSON.stringify(obj).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default 1KB if can't stringify
    }
  }

  /**
   * Build full cache key with namespace
   */
  private buildKey(namespace: CacheNamespace, key: string): string {
    return `${this.storagePrefix}${namespace}:${key}`;
  }

  /**
   * Clean up expired entries (run periodically)
   */
  async cleanupExpired(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    try {
      // Clean memory cache
      const memoryKeys = Array.from(this.memoryCache.keys());
      for (const key of memoryKeys) {
        const entry = this.memoryCache.get(key);
        if (entry && now > entry.expiresAt) {
          this.memoryCache.delete(key);
          this.priorityMap.delete(key);
          cleaned++;
        }
      }
      this.updateMemorySize();

      // Clean disk cache
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(k => k.startsWith(this.storagePrefix));
      
      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const entry: CacheEntry<any> = JSON.parse(data);
          if (now > entry.expiresAt) {
            await AsyncStorage.removeItem(key);
            cleaned++;
          }
        }
      }
    } catch (error) {
      this.stats.errors++;
      console.error('CacheManager: Error cleaning expired entries', error);
    }

    return cleaned;
  }

  /**
   * Preload critical data into memory cache
   */
  async preload(keys: Array<{ key: string; namespace: CacheNamespace }>): Promise<void> {
    for (const { key, namespace } of keys) {
      await this.get(key, namespace);
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// TTL presets for convenience
export const CacheTTL = {
  MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  HOUR: 60 * 60 * 1000,
  TWO_HOURS: 2 * 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  TWELVE_HOURS: 12 * 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  INFINITE: Number.MAX_SAFE_INTEGER,
};
