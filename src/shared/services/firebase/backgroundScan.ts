/**
 * Background Scan Service - Handles server-side receipt processing
 * Works with FCM push notifications that arrive even when phone is locked
 */

import functions from '@react-native-firebase/functions';
import storage from '@react-native-firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {pushNotificationService} from './pushNotifications';
import {Alert} from 'react-native';

// Constants
const PENDING_SCANS_KEY = '@goshopperai/pending_scans';
const REGION = 'europe-west1';

export interface PendingScan {
  id: string;
  storagePath: string;
  city?: string;
  status: 'uploading' | 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  receiptId?: string;
  createdAt: string;
  localImageUri?: string; // Keep local reference for retry
}

class BackgroundScanService {
  /**
   * Upload image to Cloud Storage and trigger background processing
   * @param imageBase64 Base64 encoded image data
   * @param city User's current city
   * @returns PendingScan object
   */
  async uploadAndProcessInBackground(
    imageBase64: string,
    userId: string,
    city?: string,
    localImageUri?: string,
  ): Promise<PendingScan> {
    // Create unique filename
    const timestamp = Date.now();
    const filename = `receipt_${timestamp}.jpg`;
    const storagePath = `users/${userId}/pending_receipts/${filename}`;

    console.log('📤 Uploading receipt image for background processing...');

    // Save locally first for recovery
    const pendingScan: PendingScan = {
      id: `local_${timestamp}`,
      storagePath,
      city,
      status: 'uploading',
      createdAt: new Date().toISOString(),
      localImageUri,
    };

    await this.savePendingScanLocally(pendingScan);

    try {
      // Upload image to Cloud Storage
      const reference = storage().ref(storagePath);
      await reference.putString(imageBase64, 'base64', {
        contentType: 'image/jpeg',
      });

      console.log('✅ Image uploaded to Cloud Storage');

      // Get FCM token for push notifications
      const fcmToken = await pushNotificationService.getToken();

      // Call Cloud Function to start background processing
      const createPendingScan = functions()
        .region(REGION)
        .httpsCallable('createPendingScan');

      const result = await createPendingScan({
        storagePath,
        city,
        fcmToken,
      });

      const data = result.data as {
        success: boolean;
        pendingScanId: string;
        message: string;
      };

      if (!data.success) {
        throw new Error(data.message || 'Failed to create pending scan');
      }

      // Update local pending scan with server ID
      const updatedScan: PendingScan = {
        ...pendingScan,
        id: data.pendingScanId,
        status: 'pending',
      };

      await this.updatePendingScanLocally(pendingScan.id, updatedScan);

      console.log(`✅ Scan queued for background processing: ${data.pendingScanId}`);
      return updatedScan;

    } catch (error: any) {
      console.error('❌ Error starting background scan:', error);

      // Update local status
      const failedScan: PendingScan = {
        ...pendingScan,
        status: 'failed',
        error: error.message,
      };
      await this.updatePendingScanLocally(pendingScan.id, failedScan);

      throw error;
    }
  }

  /**
   * Check status of a pending scan from the server
   */
  async checkPendingScanStatus(pendingScanId: string): Promise<{
    found: boolean;
    status?: string;
    receiptId?: string;
    error?: string;
    retryCount?: number;
  }> {
    try {
      const getPendingScanStatus = functions()
        .region(REGION)
        .httpsCallable('getPendingScanStatus');

      const result = await getPendingScanStatus({pendingScanId});
      return result.data as any;
    } catch (error: any) {
      console.error('Error checking pending scan status:', error);
      return {found: false};
    }
  }

  /**
   * Get all pending scans for the current user from the server
   */
  async getUserPendingScans(): Promise<PendingScan[]> {
    try {
      const getUserPendingScans = functions()
        .region(REGION)
        .httpsCallable('getUserPendingScans');

      const result = await getUserPendingScans({});
      const data = result.data as {pendingScans: PendingScan[]};
      return data.pendingScans || [];
    } catch (error: any) {
      console.error('Error getting user pending scans:', error);
      return [];
    }
  }

  /**
   * Cancel a pending scan
   */
  async cancelPendingScan(pendingScanId: string): Promise<boolean> {
    try {
      const cancelPendingScan = functions()
        .region(REGION)
        .httpsCallable('cancelPendingScan');

      const result = await cancelPendingScan({pendingScanId});
      const data = result.data as {success: boolean};

      if (data.success) {
        // Remove from local storage
        await this.removePendingScanLocally(pendingScanId);
      }

      return data.success;
    } catch (error: any) {
      console.error('Error cancelling pending scan:', error);
      return false;
    }
  }

  /**
   * Get locally stored pending scans
   */
  async getLocalPendingScans(): Promise<PendingScan[]> {
    try {
      const stored = await AsyncStorage.getItem(PENDING_SCANS_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error getting local pending scans:', error);
      return [];
    }
  }

  /**
   * Save a pending scan to local storage
   */
  private async savePendingScanLocally(scan: PendingScan): Promise<void> {
    try {
      const scans = await this.getLocalPendingScans();
      scans.push(scan);
      await AsyncStorage.setItem(PENDING_SCANS_KEY, JSON.stringify(scans));
    } catch (error) {
      console.error('Error saving pending scan locally:', error);
    }
  }

  /**
   * Update a pending scan in local storage
   */
  private async updatePendingScanLocally(
    scanId: string,
    updates: Partial<PendingScan>,
  ): Promise<void> {
    try {
      const scans = await this.getLocalPendingScans();
      const index = scans.findIndex(s => s.id === scanId);
      
      if (index >= 0) {
        scans[index] = {...scans[index], ...updates};
      } else if (updates.id && updates.id !== scanId) {
        // Replace with new ID
        const oldIndex = scans.findIndex(s => s.id === scanId);
        if (oldIndex >= 0) {
          scans[oldIndex] = {...scans[oldIndex], ...updates};
        }
      }

      await AsyncStorage.setItem(PENDING_SCANS_KEY, JSON.stringify(scans));
    } catch (error) {
      console.error('Error updating pending scan locally:', error);
    }
  }

  /**
   * Remove a pending scan from local storage
   */
  async removePendingScanLocally(scanId: string): Promise<void> {
    try {
      const scans = await this.getLocalPendingScans();
      const filtered = scans.filter(s => s.id !== scanId);
      await AsyncStorage.setItem(PENDING_SCANS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing pending scan locally:', error);
    }
  }

  /**
   * Mark a pending scan as completed
   */
  async markScanCompleted(pendingScanId: string, receiptId: string): Promise<void> {
    await this.updatePendingScanLocally(pendingScanId, {
      status: 'completed',
      receiptId,
    });

    // Clean up completed scans after a delay
    setTimeout(() => {
      this.removePendingScanLocally(pendingScanId);
    }, 5000);
  }

  /**
   * Mark a pending scan as failed
   */
  async markScanFailed(pendingScanId: string, error: string): Promise<void> {
    await this.updatePendingScanLocally(pendingScanId, {
      status: 'failed',
      error,
    });
  }

  /**
   * Sync local pending scans with server
   * Call this when app comes back to foreground
   */
  async syncWithServer(): Promise<{
    completed: PendingScan[];
    failed: PendingScan[];
    pending: PendingScan[];
  }> {
    const localScans = await this.getLocalPendingScans();
    const completed: PendingScan[] = [];
    const failed: PendingScan[] = [];
    const pending: PendingScan[] = [];

    // Auto-cleanup: Remove old failed scans (older than 24 hours)
    const OLD_SCAN_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    for (const scan of localScans) {
      const scanAge = now - new Date(scan.createdAt).getTime();
      
      // Auto-remove old failed scans
      if (scan.status === 'failed' && scanAge > OLD_SCAN_THRESHOLD) {
        await this.removePendingScanLocally(scan.id);
        continue;
      }
      
      // Skip scans that are already marked as completed or failed locally
      if (scan.status === 'completed') {
        completed.push(scan);
        // Clean up completed scans
        await this.removePendingScanLocally(scan.id);
        continue;
      }
      
      if (scan.status === 'failed') {
        failed.push(scan);
        // Clean up failed scans after reporting
        await this.removePendingScanLocally(scan.id);
        continue;
      }

      // For scans still uploading, keep them as pending (don't mark as failed)
      if (scan.id.startsWith('local_') && scan.status === 'uploading') {
        pending.push(scan);
        continue;
      }

      // Check server status for scans that have a server ID
      if (!scan.id.startsWith('local_')) {
        const serverStatus = await this.checkPendingScanStatus(scan.id);

        if (!serverStatus.found) {
          // Don't mark as failed immediately - might still be propagating
          // Only fail if scan is very old (more than 5 minutes)
          if (scanAge > 5 * 60 * 1000) {
            failed.push({...scan, error: 'Scan not found on server'});
            await this.removePendingScanLocally(scan.id);
          } else {
            pending.push(scan);
          }
          continue;
        }

        switch (serverStatus.status) {
          case 'completed':
            completed.push({
              ...scan,
              status: 'completed',
              receiptId: serverStatus.receiptId,
            });
            await this.removePendingScanLocally(scan.id);
            break;
          case 'failed':
            failed.push({
              ...scan,
              status: 'failed',
              error: serverStatus.error || 'Processing failed',
            });
            await this.removePendingScanLocally(scan.id);
            break;
          case 'pending':
          case 'processing':
            pending.push({
              ...scan,
              status: serverStatus.status as any,
            });
            break;
        }
      } else {
        // Local scans without server ID stay pending
        pending.push(scan);
      }
    }

    return {completed, failed, pending};
  }

  /**
   * Clear all failed scans from local storage
   */
  async clearFailedScans(): Promise<number> {
    const scans = await this.getLocalPendingScans();
    const filtered = scans.filter(s => s.status !== 'failed');
    const removedCount = scans.length - filtered.length;
    await AsyncStorage.setItem(PENDING_SCANS_KEY, JSON.stringify(filtered));
    console.log(`🗑️ Cleared ${removedCount} failed scans`);
    return removedCount;
  }

  /**
   * Clear all pending scans from local storage (for troubleshooting)
   */
  async clearAllPendingScans(): Promise<void> {
    await AsyncStorage.removeItem(PENDING_SCANS_KEY);
    console.log('🗑️ Cleared all pending scans');
  }

  /**
   * Handle incoming FCM notification for scan results
   * Call this from your notification handler
   */
  async handleScanNotification(data: Record<string, string>): Promise<void> {
    const {type, pendingScanId, receiptId, error} = data;

    if (!pendingScanId) return;

    if (type === 'scan_complete') {
      await this.markScanCompleted(pendingScanId, receiptId);
      console.log(`✅ Scan ${pendingScanId} completed with receipt ${receiptId}`);
    } else if (type === 'scan_failed') {
      await this.markScanFailed(pendingScanId, error || 'Unknown error');
      console.log(`❌ Scan ${pendingScanId} failed: ${error}`);
    }
  }
}

export const backgroundScanService = new BackgroundScanService();
