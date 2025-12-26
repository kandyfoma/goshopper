// Services barrel export
export {analyticsService} from './analytics';
export {duplicateDetectionService} from './duplicateDetection';
export {hapticService} from './hapticService';
export {inAppReviewService} from './inAppReviewService';
export {shareService} from './shareService';
export {quickActionsService} from './quickActionsService';
export {dynamicTypeService} from './dynamicTypeService';
export {spotlightSearchService} from './spotlightSearchService';
export {offlineService} from './offlineService';
export {widgetDataService} from './widgetDataService';
export {ocrCorrectionService} from './ocrCorrectionService';
export {translationService} from './translation';

// Caching services
export {cacheManager, CacheTTL, CachePriority} from './caching';
export {cacheAnalytics} from './caching/CacheAnalytics';
export type {CacheConfig, CacheStats, CacheNamespace} from './caching';
export type {CacheHealthReport} from './caching/CacheAnalytics';
