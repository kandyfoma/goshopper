/**
 * Cache Invalidation Service
 * 
 * Smart cache invalidation that automatically invalidates related caches
 * when data changes (e.g., new receipt added, item updated)
 */

import {cacheManager, CacheNamespace} from './CacheManager';

export enum InvalidationTrigger {
  RECEIPT_ADDED = 'receipt_added',
  RECEIPT_UPDATED = 'receipt_updated',
  RECEIPT_DELETED = 'receipt_deleted',
  SHOPPING_LIST_CHANGED = 'shopping_list_changed',
  ITEM_UPDATED = 'item_updated',
  USER_PROFILE_UPDATED = 'user_profile_updated',
  BUDGET_UPDATED = 'budget_updated',
  SUBSCRIPTION_CHANGED = 'subscription_changed',
  LOGOUT = 'logout',
}

// Map triggers to affected cache keys and namespaces
const INVALIDATION_MAP: Record<
  InvalidationTrigger,
  Array<{pattern?: RegExp; key?: string; namespace: CacheNamespace}>
> = {
  [InvalidationTrigger.RECEIPT_ADDED]: [
    {pattern: /^recent-receipts/, namespace: 'receipts'},
    {pattern: /^user-items-/, namespace: 'items'},
    {pattern: /^home-stats-/, namespace: 'home-data'},
    {pattern: /^monthly-spending-/, namespace: 'stats'},
    {pattern: /^category-stats-/, namespace: 'stats'},
  ],
  [InvalidationTrigger.RECEIPT_UPDATED]: [
    {pattern: /^receipt-/, namespace: 'receipts'},
    {pattern: /^recent-receipts/, namespace: 'receipts'},
    {pattern: /^user-items-/, namespace: 'items'},
    {pattern: /^home-stats-/, namespace: 'home-data'},
  ],
  [InvalidationTrigger.RECEIPT_DELETED]: [
    {pattern: /^receipt-/, namespace: 'receipts'},
    {pattern: /^recent-receipts/, namespace: 'receipts'},
    {pattern: /^user-items-/, namespace: 'items'},
    {pattern: /^home-stats-/, namespace: 'home-data'},
    {pattern: /^monthly-spending-/, namespace: 'stats'},
  ],
  [InvalidationTrigger.SHOPPING_LIST_CHANGED]: [
    {pattern: /^shopping-lists/, namespace: 'shopping-list'},
    {pattern: /^shopping-list-/, namespace: 'shopping-list'},
  ],
  [InvalidationTrigger.ITEM_UPDATED]: [
    {pattern: /^user-items-/, namespace: 'items'},
    {pattern: /^item-/, namespace: 'items'},
  ],
  [InvalidationTrigger.USER_PROFILE_UPDATED]: [
    {pattern: /^profile-/, namespace: 'user-prefs'},
  ],
  [InvalidationTrigger.BUDGET_UPDATED]: [
    {pattern: /^budget-/, namespace: 'home-data'},
    {pattern: /^home-stats-/, namespace: 'home-data'},
  ],
  [InvalidationTrigger.SUBSCRIPTION_CHANGED]: [
    {pattern: /^subscription-/, namespace: 'user-prefs'},
  ],
  [InvalidationTrigger.LOGOUT]: [
    // Clear all user-specific data
    {namespace: 'user-prefs'},
    {namespace: 'receipts'},
    {namespace: 'shopping-list'},
    {namespace: 'items'},
    {namespace: 'home-data'},
    {namespace: 'stats'},
    {namespace: 'history'},
  ],
};

class CacheInvalidationService {
  private listeners: Map<string, Set<() => void>> = new Map();

  /**
   * Invalidate caches based on trigger
   */
  async invalidate(
    trigger: InvalidationTrigger,
    metadata?: {
      userId?: string;
      receiptId?: string;
      itemId?: string;
    }
  ): Promise<void> {
    const invalidations = INVALIDATION_MAP[trigger];
    
    if (!invalidations) {
      console.warn('CacheInvalidation: Unknown trigger', trigger);
      return;
    }

    console.log(`🗑️ Cache invalidation triggered: ${trigger}`);

    for (const rule of invalidations) {
      if (rule.pattern) {
        // Pattern-based invalidation
        await this.invalidateByPattern(rule.pattern, rule.namespace, metadata);
      } else if (rule.key) {
        // Specific key invalidation
        await cacheManager.remove(rule.key, rule.namespace);
      } else {
        // Namespace-wide invalidation
        await cacheManager.clearNamespace(rule.namespace);
      }
    }

    // Notify listeners
    this.notifyListeners(trigger);
  }

  /**
   * Invalidate caches matching a pattern
   */
  private async invalidateByPattern(
    pattern: RegExp,
    namespace: CacheNamespace,
    metadata?: {
      userId?: string;
      receiptId?: string;
      itemId?: string;
    }
  ): Promise<void> {
    // We need to get all keys from AsyncStorage and check pattern
    // This is a limitation - we can't easily enumerate memory cache keys
    // For now, we'll clear specific known keys based on metadata
    
    if (metadata?.userId) {
      const userKeys = [
        `user-items-${metadata.userId}`,
        `home-stats-${metadata.userId}`,
        `profile-${metadata.userId}`,
        `monthly-spending-${metadata.userId}`,
        `category-stats-${metadata.userId}`,
      ];
      
      for (const key of userKeys) {
        if (pattern.test(key)) {
          await cacheManager.remove(key, namespace);
        }
      }
    }

    // Also clear common keys
    const commonKeys = [
      'recent-receipts',
      'shopping-lists',
      'receipts',
    ];

    for (const key of commonKeys) {
      if (pattern.test(key)) {
        await cacheManager.remove(key, namespace);
      }
    }
  }

  /**
   * Invalidate specific cache entry
   */
  async invalidateKey(key: string, namespace: CacheNamespace): Promise<void> {
    await cacheManager.remove(key, namespace);
    console.log(`🗑️ Invalidated cache: ${namespace}:${key}`);
  }

  /**
   * Invalidate all caches in a namespace
   */
  async invalidateNamespace(namespace: CacheNamespace): Promise<void> {
    await cacheManager.clearNamespace(namespace);
    console.log(`🗑️ Cleared cache namespace: ${namespace}`);
  }

  /**
   * Subscribe to invalidation events
   */
  subscribe(trigger: InvalidationTrigger, callback: () => void): () => void {
    if (!this.listeners.has(trigger)) {
      this.listeners.set(trigger, new Set());
    }
    
    this.listeners.get(trigger)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(trigger)?.delete(callback);
    };
  }

  /**
   * Notify listeners of invalidation
   */
  private notifyListeners(trigger: InvalidationTrigger): void {
    const listeners = this.listeners.get(trigger);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('CacheInvalidation: Listener error', error);
        }
      });
    }
  }

  /**
   * Clear all caches (e.g., on logout)
   */
  async clearAll(): Promise<void> {
    await this.invalidate(InvalidationTrigger.LOGOUT);
  }
}

export const cacheInvalidation = new CacheInvalidationService();
