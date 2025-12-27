// Offline Queue Service - Store receipts when offline, sync when connected
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
import {receiptStorageService} from './receiptStorage';
import {pushNotificationService} from './pushNotifications';
import {Receipt} from '@/shared/types';

const OFFLINE_QUEUE_KEY = '@goshopperai/offline_queue';
const PENDING_IMAGES_KEY = '@goshopperai/pending_images';
const MAX_QUEUE_SIZE = 10; // Reasonable limit to prevent storage overflow
const MAX_QUEUE_AGE_DAYS = 7; // Remove items older than 7 days

export interface QueuedReceipt {
  id: string;
  receipt: Partial<Receipt>;
  imageUris: string[];
  userId: string;
  queuedAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  error?: string;
}

export interface QueuedImage {
  id: string;
  localUri: string;
  userId: string;
  queuedAt: Date;
  processed: boolean;
}

type QueueCallback = (queue: QueuedReceipt[]) => void;

class OfflineQueueService {
  private listeners: QueueCallback[] = [];
  private isProcessing = false;
  private networkUnsubscribe: (() => void) | null = null;

  /**
   * Initialize the offline queue service
   * Sets up network listener for auto-sync
   */
  init(): void {
    // Listen for network changes
    this.networkUnsubscribe = NetInfo.addEventListener(
      this.handleNetworkChange,
    );
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange = async (state: NetInfoState): Promise<void> => {
    if (state.isConnected && state.isInternetReachable) {
      await this.processQueue();
    }
  };

  /**
   * Check if device is online
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  }

  /**
   * Add a receipt to the offline queue
   * Enforces size limits and removes old items to prevent storage overflow
   */
  async queueReceipt(
    receipt: Partial<Receipt>,
    imageUris: string[],
    userId: string,
  ): Promise<QueuedReceipt> {
    let queue = await this.getQueue();

    // Remove old items (older than MAX_QUEUE_AGE_DAYS)
    const now = new Date();
    const initialLength = queue.length;
    queue = queue.filter(item => {
      const age = now.getTime() - new Date(item.queuedAt).getTime();
      const maxAge = MAX_QUEUE_AGE_DAYS * 24 * 60 * 60 * 1000;
      return age < maxAge;
    });

    if (initialLength > queue.length) {
      console.log(
        `[OfflineQueue] Removed ${initialLength - queue.length} old items from queue`,
      );
    }

    // Enforce size limit
    if (queue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest item
      queue.sort(
        (a, b) =>
          new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime(),
      );
      const removed = queue.shift();
      console.warn(
        `[OfflineQueue] Queue full (${MAX_QUEUE_SIZE} items). Removed oldest item:`,
        removed?.id,
      );

      // Note: In production, you might want to show a toast to the user
      // showToast('File d\'attente pleine. Le reçu le plus ancien a été supprimé.', 'warning');
    }

    const queuedReceipt: QueuedReceipt = {
      id: receipt.id || `queued_${Date.now()}`,
      receipt,
      imageUris,
      userId,
      queuedAt: new Date(),
      attempts: 0,
    };

    queue.push(queuedReceipt);
    await this.saveQueue(queue);
    this.notifyListeners(queue);

    // Try to process immediately if online
    if (await this.isOnline()) {
      this.processQueue();
    }

    return queuedReceipt;
  }

  /**
   * Queue an image for later processing
   */
  async queueImage(localUri: string, userId: string): Promise<QueuedImage> {
    const images = await this.getPendingImages();

    const queuedImage: QueuedImage = {
      id: `img_${Date.now()}`,
      localUri,
      userId,
      queuedAt: new Date(),
      processed: false,
    };

    images.push(queuedImage);
    await this.savePendingImages(images);

    return queuedImage;
  }

  /**
   * Get all items in the queue
   */
  async getQueue(): Promise<QueuedReceipt[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!data) {
        return [];
      }

      const queue = JSON.parse(data) as QueuedReceipt[];
      return queue.map(item => ({
        ...item,
        queuedAt: new Date(item.queuedAt),
        lastAttemptAt: item.lastAttemptAt
          ? new Date(item.lastAttemptAt)
          : undefined,
      }));
    } catch (error) {
      console.error('[OfflineQueue] Error reading queue:', error);
      return [];
    }
  }

  /**
   * Get pending images
   */
  async getPendingImages(): Promise<QueuedImage[]> {
    try {
      const data = await AsyncStorage.getItem(PENDING_IMAGES_KEY);
      if (!data) {
        return [];
      }

      return JSON.parse(data).map((item: QueuedImage) => ({
        ...item,
        queuedAt: new Date(item.queuedAt),
      }));
    } catch (error) {
      console.error('[OfflineQueue] Error reading pending images:', error);
      return [];
    }
  }

  /**
   * Get queue count
   */
  async getQueueCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Save the queue to storage
   */
  private async saveQueue(queue: QueuedReceipt[]): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('[OfflineQueue] Error saving queue:', error);
    }
  }

  /**
   * Save pending images
   */
  private async savePendingImages(images: QueuedImage[]): Promise<void> {
    try {
      await AsyncStorage.setItem(PENDING_IMAGES_KEY, JSON.stringify(images));
    } catch (error) {
      console.error('[OfflineQueue] Error saving pending images:', error);
    }
  }

  /**
   * Process the offline queue
   */
  async processQueue(): Promise<{processed: number; failed: number}> {
    if (this.isProcessing) {
      console.log('[OfflineQueue] Already processing...');
      return {processed: 0, failed: 0};
    }

    if (!(await this.isOnline())) {
      console.log('[OfflineQueue] Offline, skipping queue processing');
      return {processed: 0, failed: 0};
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;

    try {
      const queue = await this.getQueue();

      if (queue.length === 0) {
        return {processed: 0, failed: 0};
      }

      for (const item of queue) {
        try {
          // Upload images first if any
          let imageUrls: string[] = [];
          if (item.imageUris.length > 0) {
            imageUrls = await receiptStorageService.uploadReceiptImages(
              item.userId,
              item.id,
              item.imageUris,
            );
          }

          // Update receipt with image URLs
          const receiptWithImages: Receipt = {
            ...(item.receipt as Receipt),
            imageUrls,
            imageUrl: imageUrls[0],
            processingStatus: 'completed',
          };

          // Save to Firestore
          await receiptStorageService.saveReceipt(
            receiptWithImages,
            item.userId,
          );

          // Remove from queue
          await this.removeFromQueue(item.id);
          processed++;

          console.log(`[OfflineQueue] Processed: ${item.id}`);
        } catch (error: any) {
          console.error(`[OfflineQueue] Failed to process ${item.id}:`, error);

          // Update attempt count
          await this.updateQueueItem(item.id, {
            attempts: item.attempts + 1,
            lastAttemptAt: new Date(),
            error: error.message,
          });

          failed++;

          // Remove if too many attempts
          if (item.attempts >= 3) {
            await this.moveToFailedQueue(item);
            await this.removeFromQueue(item.id);
          }
        }
      }

      // Notify listeners
      const updatedQueue = await this.getQueue();
      this.notifyListeners(updatedQueue);

      // Send sync complete notification if items were processed
      if (processed > 0) {
        await pushNotificationService.triggerSyncCompleteNotification(
          processed,
          'fr', // Default to French, could be made configurable
        );
      }
    } finally {
      this.isProcessing = false;
    }

    return {processed, failed};
  }

  /**
   * Remove an item from the queue
   */
  async removeFromQueue(id: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(item => item.id !== id);
    await this.saveQueue(filtered);
    this.notifyListeners(filtered);
  }

  /**
   * Update a queue item
   */
  private async updateQueueItem(
    id: string,
    updates: Partial<QueuedReceipt>,
  ): Promise<void> {
    const queue = await this.getQueue();
    const index = queue.findIndex(item => item.id === id);

    if (index !== -1) {
      queue[index] = {...queue[index], ...updates};
      await this.saveQueue(queue);
    }
  }

  /**
   * Move failed item to separate storage
   */
  private async moveToFailedQueue(item: QueuedReceipt): Promise<void> {
    try {
      const failedKey = '@goshopperai/failed_queue';
      const data = await AsyncStorage.getItem(failedKey);
      const failed = data ? JSON.parse(data) : [];
      failed.push({...item, failedAt: new Date()});
      await AsyncStorage.setItem(failedKey, JSON.stringify(failed));

      console.log(`[OfflineQueue] Moved to failed queue: ${item.id}`);
    } catch (error) {
      console.error('[OfflineQueue] Error moving to failed queue:', error);
    }
  }

  /**
   * Clear the entire queue
   */
  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    this.notifyListeners([]);
  }

  /**
   * Subscribe to queue updates
   */
  subscribe(callback: QueueCallback): () => void {
    this.listeners.push(callback);

    // Send current state immediately
    this.getQueue().then(callback);

    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(queue: QueuedReceipt[]): void {
    this.listeners.forEach(callback => callback(queue));
  }

  /**
   * Retry a specific failed item
   */
  async retryItem(id: string): Promise<boolean> {
    const queue = await this.getQueue();
    const item = queue.find(i => i.id === id);

    if (!item) {
      return false;
    }

    // Reset attempts
    await this.updateQueueItem(id, {
      attempts: 0,
      error: undefined,
    });

    // Try to process
    if (await this.isOnline()) {
      await this.processQueue();
    }

    return true;
  }
}

export const offlineQueueService = new OfflineQueueService();
