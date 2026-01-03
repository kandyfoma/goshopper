// Export cache manager and utilities
export {
  cacheManager,
  CacheTTL,
  CachePriority,
  type CacheConfig,
  type CacheStats,
  type CacheNamespace,
} from './CacheManager';

export {cacheAnalytics, type CacheHealthReport} from './CacheAnalytics';
export {cacheInitializer} from './CacheInitializer';
export {cachePreloader} from './CachePreloader';
export {networkAwareCache, type NetworkAwareFetchOptions, type CacheResult} from './NetworkAwareCache';
export {cacheInvalidation, InvalidationTrigger} from './CacheInvalidation';
