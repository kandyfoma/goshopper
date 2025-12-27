/**
 * Offline Mode Service
 * 
 * Manages offline scanning functionality for Premium users.
 * Handles:
 * - Subscription-based feature gating
 * - Network status monitoring
 * - Receipt queuing when offline
 * - Automatic sync when back online
 * - Image caching for offline scans
 */

import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import {Receipt, Subscription} from '@/shared/types';
import {offlineQueueService, QueuedReceipt} from './firebase/offlineQueue';
import {receiptStorageService} from './firebase/receiptStorage';
import {hasFeatureAccess} from '@/shared/utils/featureAccess';

// Storage keys
const OFFLINE_IMAGES_DIR = `${RNFS.CachesDirectoryPath}/offline_scans`;
const OFFLINE_MODE_ENABLED_KEY = '@goshopperai/offline_mode_enabled';
const LAST_SYNC_STATUS_KEY = '@goshopperai/last_sync_status';

export interface OfflineScanResult {
  success: boolean;
  queued?: boolean;
  queuedReceipt?: QueuedReceipt;
  savedReceiptId?: string;
  error?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  hasOfflineAccess: boolean;
}

type SyncStatusCallback = (status: SyncStatus) => void;

class OfflineModeService {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private hasOfflineAccess: boolean = false;
  private lastSyncTime: Date | null = null;
  private listeners: Set<SyncStatusCallback> = new Set();
  private networkUnsubscribe: (() => void) | null = null;
  private currentSubscription: Subscription | null = null;

  /**
   * Initialize the offline mode service
   */
  async initialize(): Promise<void> {
    // Ensure offline images directory exists
    try {
      const exists = await RNFS.exists(OFFLINE_IMAGES_DIR);
      if (!exists) {
        await RNFS.mkdir(OFFLINE_IMAGES_DIR);
      }
    } catch (error) {
      console.warn('Failed to create offline images directory:', error);
    }

    // Load last sync status
    await this.loadLastSyncStatus();

    // Check initial network state
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected === true && state.isInternetReachable === true;

    // Subscribe to network changes
    this.networkUnsubscribe = NetInfo.addEventListener(this.handleNetworkChange);

    // Initialize the offline queue service
    offlineQueueService.init();

    console.log('[OfflineMode] Initialized, online:', this.isOnline);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    offlineQueueService.cleanup();
    this.listeners.clear();
  }

  /**
   * Update subscription status - call this when subscription changes
   */
  updateSubscription(subscription: Subscription | null): void {
    this.currentSubscription = subscription;
    this.hasOfflineAccess = hasFeatureAccess('offlineMode', subscription);
    this.notifyListeners();
  }

  /**
   * Check if user has offline mode access
   */
  canUseOfflineMode(): boolean {
    return this.hasOfflineAccess;
  }

  /**
   * Check if device is currently online
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Handle network status changes
   */
  private handleNetworkChange = async (state: NetInfoState): Promise<void> => {
    const wasOffline = !this.isOnline;
    this.isOnline = state.isConnected === true && state.isInternetReachable === true;

    console.log('[OfflineMode] Network changed, online:', this.isOnline);

    // Came back online - process pending queue
    if (wasOffline && this.isOnline && this.hasOfflineAccess) {
      console.log('[OfflineMode] Back online, processing pending scans...');
      await this.syncPendingScans();
    }

    this.notifyListeners();
  };

  /**
   * Save a receipt - handles both online and offline scenarios
   * @param receipt The receipt data to save
   * @param imageUri Local image URI (if any)
   * @param userId User ID
   * @returns Result indicating success/queued status
   */
  async saveReceipt(
    receipt: Receipt,
    imageUri: string | null,
    userId: string,
  ): Promise<OfflineScanResult> {
    // Check if online
    if (this.isOnline) {
      // Online - save directly
      try {
        const savedReceiptId = await receiptStorageService.saveReceipt(receipt, userId);
        return {
          success: true,
          queued: false,
          savedReceiptId,
        };
      } catch (error: any) {
        // If save fails and user has offline access, queue it
        if (this.hasOfflineAccess && error.message?.includes('network')) {
          return this.queueReceiptForLater(receipt, imageUri, userId);
        }
        return {
          success: false,
          error: error.message || 'Échec de la sauvegarde',
        };
      }
    }

    // Offline - check if user has offline access
    if (!this.hasOfflineAccess) {
      return {
        success: false,
        error: 'Mode hors ligne non disponible. Mettez à niveau vers Standard ou Premium pour scanner sans connexion.',
      };
    }

    // Queue for later
    return this.queueReceiptForLater(receipt, imageUri, userId);
  }

  /**
   * Queue a receipt for later sync
   */
  private async queueReceiptForLater(
    receipt: Receipt,
    imageUri: string | null,
    userId: string,
  ): Promise<OfflineScanResult> {
    try {
      // Cache image locally if provided
      let cachedImageUri: string | null = null;
      if (imageUri) {
        cachedImageUri = await this.cacheImageLocally(imageUri, receipt.id);
      }

      // Queue the receipt
      const queuedReceipt = await offlineQueueService.queueReceipt(
        receipt,
        cachedImageUri ? [cachedImageUri] : [],
        userId,
      );

      console.log('[OfflineMode] Receipt queued:', queuedReceipt.id);

      this.notifyListeners();

      return {
        success: true,
        queued: true,
        queuedReceipt,
      };
    } catch (error: any) {
      console.error('[OfflineMode] Failed to queue receipt:', error);
      return {
        success: false,
        error: error.message || 'Échec de la mise en file d\'attente',
      };
    }
  }

  /**
   * Cache image locally for offline use
   */
  private async cacheImageLocally(imageUri: string, receiptId: string): Promise<string> {
    try {
      const extension = imageUri.split('.').pop() || 'jpg';
      const filename = `${receiptId}_${Date.now()}.${extension}`;
      const destPath = `${OFFLINE_IMAGES_DIR}/${filename}`;

      // Copy the image to cache
      await RNFS.copyFile(imageUri, destPath);

      return destPath;
    } catch (error) {
      console.error('[OfflineMode] Failed to cache image:', error);
      // Return original URI if caching fails
      return imageUri;
    }
  }

  /**
   * Sync all pending scans to the server
   */
  async syncPendingScans(): Promise<{processed: number; failed: number}> {
    if (this.isSyncing) {
      return {processed: 0, failed: 0};
    }

    if (!this.isOnline) {
      return {processed: 0, failed: 0};
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const result = await offlineQueueService.processQueue();

      // Update last sync time
      this.lastSyncTime = new Date();
      await this.saveLastSyncStatus();

      // Clean up cached images for processed receipts
      await this.cleanupCachedImages();

      console.log('[OfflineMode] Sync complete:', result);

      return result;
    } catch (error) {
      console.error('[OfflineMode] Sync failed:', error);
      return {processed: 0, failed: 0};
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Get count of pending scans
   */
  async getPendingCount(): Promise<number> {
    return offlineQueueService.getQueueCount();
  }

  /**
   * Get all pending receipts
   */
  async getPendingReceipts(): Promise<QueuedReceipt[]> {
    return offlineQueueService.getQueue();
  }

  /**
   * Retry a specific failed receipt
   */
  async retryReceipt(receiptId: string): Promise<boolean> {
    return offlineQueueService.retryItem(receiptId);
  }

  /**
   * Remove a receipt from the queue
   */
  async removeFromQueue(receiptId: string): Promise<void> {
    await offlineQueueService.removeFromQueue(receiptId);
    this.notifyListeners();
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const pendingCount = await this.getPendingCount();

    return {
      isOnline: this.isOnline,
      pendingCount,
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing,
      hasOfflineAccess: this.hasOfflineAccess,
    };
  }

  /**
   * Subscribe to sync status updates
   */
  subscribe(callback: SyncStatusCallback): () => void {
    this.listeners.add(callback);

    // Send current status immediately
    this.getSyncStatus().then(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private async notifyListeners(): Promise<void> {
    const status = await this.getSyncStatus();
    this.listeners.forEach(callback => callback(status));
  }

  /**
   * Save last sync status to storage
   */
  private async saveLastSyncStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        LAST_SYNC_STATUS_KEY,
        JSON.stringify({
          lastSyncTime: this.lastSyncTime?.toISOString(),
        }),
      );
    } catch (error) {
      console.warn('[OfflineMode] Failed to save sync status:', error);
    }
  }

  /**
   * Load last sync status from storage
   */
  private async loadLastSyncStatus(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(LAST_SYNC_STATUS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.lastSyncTime = parsed.lastSyncTime ? new Date(parsed.lastSyncTime) : null;
      }
    } catch (error) {
      console.warn('[OfflineMode] Failed to load sync status:', error);
    }
  }

  /**
   * Clean up cached images that have been synced
   */
  private async cleanupCachedImages(): Promise<void> {
    try {
      const files = await RNFS.readDir(OFFLINE_IMAGES_DIR);
      const queue = await offlineQueueService.getQueue();
      const pendingImageIds = new Set(
        queue.flatMap(item => item.imageUris.map(uri => uri.split('/').pop())),
      );

      // Delete files not in the pending queue
      for (const file of files) {
        if (!pendingImageIds.has(file.name)) {
          await RNFS.unlink(file.path);
        }
      }
    } catch (error) {
      console.warn('[OfflineMode] Failed to cleanup cached images:', error);
    }
  }

  /**
   * Clear all offline data (for logout/account deletion)
   */
  async clearAllOfflineData(): Promise<void> {
    try {
      await offlineQueueService.clearQueue();
      
      // Delete all cached images
      const exists = await RNFS.exists(OFFLINE_IMAGES_DIR);
      if (exists) {
        const files = await RNFS.readDir(OFFLINE_IMAGES_DIR);
        for (const file of files) {
          await RNFS.unlink(file.path);
        }
      }

      await AsyncStorage.removeItem(LAST_SYNC_STATUS_KEY);
      await AsyncStorage.removeItem(OFFLINE_MODE_ENABLED_KEY);

      this.lastSyncTime = null;
      this.notifyListeners();
    } catch (error) {
      console.error('[OfflineMode] Failed to clear offline data:', error);
    }
  }
}

export const offlineModeService = new OfflineModeService();
