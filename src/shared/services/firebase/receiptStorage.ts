// Receipt Storage Service - Handles saving receipts and shop organization
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import {Receipt} from '@/shared/types';
import {APP_ID, COLLECTIONS} from './config';
import {authService} from './auth';
import {convertCurrency} from '@/shared/utils/helpers';
import {
  findBestMatch,
  normalizeForComparison,
  matchCommonPattern,
  FuzzyMatchResult,
} from '@/shared/utils/fuzzyMatch';
import {savingsTrackerService} from './savingsTracker';
import {widgetDataService} from '../widgetDataService';
import {cacheInvalidation, InvalidationTrigger} from '../caching';

const RECEIPTS_COLLECTION = (userId: string) =>
  `artifacts/${APP_ID}/users/${userId}/receipts`;

const SHOPS_COLLECTION = (userId: string) =>
  `artifacts/${APP_ID}/users/${userId}/shops`;

const PUBLIC_STORES_COLLECTION = COLLECTIONS.stores;

export interface Shop {
  id: string;
  name: string;
  nameNormalized: string;
  address?: string;
  phone?: string;
  receiptCount: number;
  totalSpent: number;
  currency: 'USD' | 'CDF';
  lastVisit: Date;
  createdAt: Date;
  updatedAt: Date;
}

class ReceiptStorageService {
  /**
   * Detect city from store name by matching against public stores
   */
  async detectCityFromStore(storeName: string): Promise<string | null> {
    try {
      if (!storeName || typeof storeName !== 'string') {
        console.warn('detectCityFromStore: Invalid storeName provided');
        return null;
      }

      const normalizedStoreName = this.normalizeStoreName(storeName);
      if (!normalizedStoreName) {
        return null;
      }

      // Validate collection path
      if (!PUBLIC_STORES_COLLECTION) {
        console.warn(
          'detectCityFromStore: PUBLIC_STORES_COLLECTION is not defined',
        );
        return null;
      }

      const storesSnapshot = await firestore()
        .collection(PUBLIC_STORES_COLLECTION)
        .where('nameNormalized', '==', normalizedStoreName)
        .limit(1)
        .get();

      if (!storesSnapshot.empty) {
        const storeData = storesSnapshot.docs[0].data();
        return storeData.city || null;
      }

      // If no exact match, try fuzzy matching
      const fuzzyMatch = await this.fuzzyMatchStore(storeName);
      if (fuzzyMatch) {
        console.log(`🏪 Fuzzy matched store "${storeName}" to "${fuzzyMatch.originalName}" (score: ${fuzzyMatch.score.toFixed(2)})`);
        // Get city from the matched store
        const matchedStoreSnapshot = await firestore()
          .collection(PUBLIC_STORES_COLLECTION)
          .where('nameNormalized', '==', fuzzyMatch.match)
          .limit(1)
          .get();
        
        if (!matchedStoreSnapshot.empty) {
          return matchedStoreSnapshot.docs[0].data().city || null;
        }
      }

      return null;
    } catch (error) {
      console.error('Error detecting city from store:', error);
      return null;
    }
  }

  /**
   * Fuzzy match a store name against existing stores in the system
   * @param storeName The store name to match
   * @param userId Optional user ID to also check user's shops
   * @returns Best match result or null
   */
  async fuzzyMatchStore(
    storeName: string,
    userId?: string,
  ): Promise<FuzzyMatchResult | null> {
    try {
      if (!storeName || storeName.length < 2) return null;

      // First, check against common patterns (fastest)
      const patternMatch = matchCommonPattern(storeName);
      if (patternMatch) {
        console.log(`🏪 Pattern matched "${storeName}" to "${patternMatch}"`);
        return {
          match: patternMatch,
          originalName: patternMatch.charAt(0).toUpperCase() + patternMatch.slice(1),
          score: 0.9,
          isExactMatch: false,
        };
      }

      // Get all public stores for fuzzy matching
      const publicStoresSnapshot = await firestore()
        .collection(PUBLIC_STORES_COLLECTION)
        .limit(100) // Limit to prevent too much data
        .get();

      const candidates: Array<{normalized: string; original: string}> = [];

      publicStoresSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.nameNormalized && data.name) {
          candidates.push({
            normalized: data.nameNormalized,
            original: data.name,
          });
        }
      });

      // Also check user's shops if userId provided
      if (userId) {
        const userShopsSnapshot = await firestore()
          .collection(SHOPS_COLLECTION(userId))
          .limit(50)
          .get();

        userShopsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.nameNormalized && data.name) {
            candidates.push({
              normalized: data.nameNormalized,
              original: data.name,
            });
          }
        });
      }

      // Find best match with 70% threshold
      const match = findBestMatch(storeName, candidates, 0.7);
      
      if (match) {
        console.log(`🏪 Fuzzy matched "${storeName}" to "${match.originalName}" (score: ${match.score.toFixed(2)})`);
      }

      return match;
    } catch (error) {
      console.error('Error fuzzy matching store:', error);
      return null;
    }
  }

  /**
   * Correct store name using fuzzy matching
   * Returns the corrected name or original if no good match found
   */
  async correctStoreName(
    storeName: string,
    userId?: string,
  ): Promise<{name: string; normalized: string; wasCorrect: boolean}> {
    const normalizedOriginal = this.normalizeStoreName(storeName);
    
    // Try fuzzy matching
    const match = await this.fuzzyMatchStore(storeName, userId);
    
    if (match && match.score >= 0.75) {
      // Use the matched store name
      return {
        name: match.originalName,
        normalized: match.match,
        wasCorrect: !match.isExactMatch,
      };
    }

    // Return original if no good match
    return {
      name: storeName,
      normalized: normalizedOriginal,
      wasCorrect: false,
    };
  }

  /**
   * Update receipt with city
   */
  async updateReceiptCity(
    receiptId: string,
    userId: string,
    city: string,
  ): Promise<void> {
    const receiptRef = firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .doc(receiptId);

    await receiptRef.update({
      city,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }
  /**
   * Save a receipt and update/create the associated shop
   * Receipt is saved first (critical), shop update happens in background (non-critical)
   */
  async saveReceipt(receipt: Receipt, userId: string): Promise<string> {
    // Fuzzy match and correct store name before saving
    try {
      const correctedStore = await this.correctStoreName(receipt.storeName, userId);
      if (correctedStore.wasCorrect) {
        console.log(`🏪 Store name corrected: "${receipt.storeName}" → "${correctedStore.name}"`);
        receipt.storeName = correctedStore.name;
        receipt.storeNameNormalized = correctedStore.normalized;
      }
    } catch (error) {
      console.warn('Store name correction failed, using original:', error);
    }

    // Ensure both USD and CDF amounts are set
    if (receipt.currency === 'USD' && !receipt.totalCDF) {
      receipt.totalUSD = receipt.total;
      receipt.totalCDF = convertCurrency(receipt.total, 'USD', 'CDF');
    } else if (receipt.currency === 'CDF' && !receipt.totalUSD) {
      receipt.totalCDF = receipt.total;
      receipt.totalUSD = convertCurrency(receipt.total, 'CDF', 'USD');
    }

    // Save receipt FIRST (most important) - no batch to prevent data loss
    const receiptRef = firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .doc(receipt.id);

    try {
      // Log receipt data for debugging
      console.log('Saving receipt:', {
        id: receipt.id,
        userId,
        hasCreatedAt: !!receipt.createdAt,
        createdAtType: typeof receipt.createdAt,
        createdAtValue: receipt.createdAt,
        dateType: typeof receipt.date,
        dateValue: receipt.date,
      });

      // Validate and fix receipt date
      let validDate: Date;
      if (receipt.date instanceof Date && !isNaN(receipt.date.getTime())) {
        validDate = receipt.date;
      } else if (typeof receipt.date === 'string' && receipt.date && receipt.date !== 'null') {
        const parsedDate = new Date(receipt.date);
        validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
      } else {
        console.warn('Invalid receipt date, using current date:', receipt.date);
        validDate = new Date();
      }

      // Filter out undefined values to prevent Firestore errors
      const cleanedReceipt = this.removeUndefinedFields({
        ...receipt,
        date: firestore.Timestamp.fromDate(validDate),
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        scannedAt: firestore.FieldValue.serverTimestamp(),
      });

      await receiptRef.set(cleanedReceipt);

      // Invalidate related caches
      cacheInvalidation.invalidate(InvalidationTrigger.RECEIPT_ADDED, {
        userId,
        receiptId: receipt.id,
      }).catch(err => {
        console.log('Cache invalidation error (non-critical):', err);
      });

      // Update shop in background (non-blocking, non-critical)
      // If this fails, receipt is still saved
      this.updateShopFromReceipt(receipt, userId, null).catch(error => {
        console.warn('Failed to update shop stats (non-critical):', error.message || error);
        // Don't throw - shop update is not critical
      });

      return receipt.id;
    } catch (error) {
      console.error('Failed to save receipt:', error);

      // Try one more time with a new ID (in case of ID conflict)
      const newReceiptRef = firestore()
        .collection(RECEIPTS_COLLECTION(userId))
        .doc();

      // Validate and fix receipt date for retry
      let validRetryDate: Date;
      if (receipt.date instanceof Date && !isNaN(receipt.date.getTime())) {
        validRetryDate = receipt.date;
      } else if (typeof receipt.date === 'string' && receipt.date && receipt.date !== 'null') {
        const parsedDate = new Date(receipt.date);
        validRetryDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
      } else {
        validRetryDate = new Date();
      }

      const cleanedRetryReceipt = this.removeUndefinedFields({
        ...receipt,
        id: newReceiptRef.id,
        date: firestore.Timestamp.fromDate(validRetryDate),
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        scannedAt: firestore.FieldValue.serverTimestamp(),
      });

      await newReceiptRef.set(cleanedRetryReceipt);

      return newReceiptRef.id;
    }
  }

  /**
   * Update or create a shop based on receipt data
   * Shop is automatically detected from receipt - user doesn't create manually
   * Can be called with or without batch for flexible error handling
   */
  private async updateShopFromReceipt(
    receipt: Receipt,
    userId: string,
    batch: FirebaseFirestoreTypes.WriteBatch | null,
  ): Promise<void> {
    const shopId =
      receipt.storeNameNormalized || this.normalizeStoreName(receipt.storeName);

    const shopRef = firestore()
      .collection(SHOPS_COLLECTION(userId))
      .doc(shopId);

    const shopDoc = await shopRef.get();

    if (batch) {
      // Use batch if provided (legacy support)
      // Ensure date is a Date object
      const receiptDate = receipt.date instanceof Date ? receipt.date : new Date(receipt.date);
      
      if (shopDoc.exists) {
        // Update existing shop
        batch.update(shopRef, {
          receiptCount: firestore.FieldValue.increment(1),
          totalSpent: firestore.FieldValue.increment(receipt.total),
          lastVisit: firestore.Timestamp.fromDate(receiptDate),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          // Update address/phone if not set
          ...(receipt.storeAddress && !shopDoc.data()?.address
            ? {address: receipt.storeAddress}
            : {}),
          ...(receipt.storePhone && !shopDoc.data()?.phone
            ? {phone: receipt.storePhone}
            : {}),
        });
      } else {
        // Create new shop - automatically from receipt data
        const newShop: Omit<Shop, 'createdAt' | 'updatedAt'> = {
          id: shopId,
          name: receipt.storeName,
          nameNormalized: shopId,
          address: receipt.storeAddress,
          phone: receipt.storePhone,
          receiptCount: 1,
          totalSpent: receipt.total,
          currency: receipt.currency,
          lastVisit: receiptDate,
        };

        batch.set(shopRef, {
          ...newShop,
          lastVisit: firestore.Timestamp.fromDate(receiptDate),
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      // Direct update (no batch) - safer for background operations
      if (shopDoc.exists) {
        // Ensure date is a Date object
        const receiptDate = receipt.date instanceof Date ? receipt.date : new Date(receipt.date);
        
        await shopRef.update({
          receiptCount: firestore.FieldValue.increment(1),
          totalSpent: firestore.FieldValue.increment(receipt.total),
          lastVisit: firestore.Timestamp.fromDate(receiptDate),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          ...(receipt.storeAddress && !shopDoc.data()?.address
            ? {address: receipt.storeAddress}
            : {}),
          ...(receipt.storePhone && !shopDoc.data()?.phone
            ? {phone: receipt.storePhone}
            : {}),
        });
      } else {
        // Ensure date is a Date object
        const receiptDate = receipt.date instanceof Date ? receipt.date : new Date(receipt.date);
        
        const newShop: Omit<Shop, 'createdAt' | 'updatedAt'> = {
          id: shopId,
          name: receipt.storeName,
          nameNormalized: shopId,
          address: receipt.storeAddress,
          phone: receipt.storePhone,
          receiptCount: 1,
          totalSpent: receipt.total,
          currency: receipt.currency,
          lastVisit: receiptDate,
        };

        await shopRef.set({
          ...newShop,
          lastVisit: firestore.Timestamp.fromDate(receiptDate),
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  /**
   * Get all receipts for a user
   */
  async getReceipts(userId: string): Promise<Receipt[]> {
    const snapshot = await firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .orderBy('date', 'desc')
      .get();

    return snapshot.docs.map(doc => this.docToReceipt(doc));
  }

  /**
   * Get receipts by shop
   */
  async getReceiptsByShop(userId: string, shopId: string): Promise<Receipt[]> {
    const snapshot = await firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .where('storeNameNormalized', '==', shopId)
      .orderBy('date', 'desc')
      .get();

    return snapshot.docs.map(doc => this.docToReceipt(doc));
  }

  /**
   * Get all shops for a user
   */
  async getShops(userId: string): Promise<Shop[]> {
    const snapshot = await firestore()
      .collection(SHOPS_COLLECTION(userId))
      .orderBy('lastVisit', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      lastVisit: this.safeToDate(doc.data().lastVisit),
      createdAt: this.safeToDate(doc.data().createdAt),
      updatedAt: this.safeToDate(doc.data().updatedAt),
    })) as Shop[];
  }

  /**
   * Get a single receipt
   */
  async getReceipt(userId: string, receiptId: string): Promise<Receipt | null> {
    const doc = await firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .doc(receiptId)
      .get();

    if (!doc.exists) {
      return null;
    }
    return this.docToReceipt(doc);
  }

  /**
   * Delete a receipt and clean up all related data
   * - Deletes receipt document
   * - Updates shop stats (decrements count/total)
   * - Deletes shop if it's the only receipt
   * - Removes receipt images from storage
   * - Updates aggregated items (removes prices from this receipt)
   */
  async deleteReceipt(userId: string, receiptId: string): Promise<void> {
    const receipt = await this.getReceipt(userId, receiptId);
    if (!receipt) {
      return;
    }

    console.log('🗑️ Deleting receipt:', receiptId);

    const batch = firestore().batch();

    // 1. Delete receipt document
    const receiptRef = firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .doc(receiptId);
    batch.delete(receiptRef);
    console.log('🗑️ Marked receipt for deletion');

    // 2. Update or delete shop
    const shopId = receipt.storeNameNormalized;
    if (shopId) {
      const shopRef = firestore()
        .collection(SHOPS_COLLECTION(userId))
        .doc(shopId);

      const shopDoc = await shopRef.get();
      if (shopDoc.exists) {
        const currentCount = shopDoc.data()?.receiptCount || 1;
        const newCount = currentCount - 1;

        if (newCount <= 0) {
          // This is the only receipt from this shop - delete the shop
          batch.delete(shopRef);
          console.log('🗑️ Deleting shop (no more receipts):', shopId);
        } else {
          // Update shop stats
          batch.update(shopRef, {
            receiptCount: firestore.FieldValue.increment(-1),
            totalSpent: firestore.FieldValue.increment(-receipt.total),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
          console.log('🗑️ Updated shop stats:', shopId, 'new count:', newCount);
        }
      }
    }

    // Commit batch operations
    await batch.commit();
    console.log('🗑️ Batch committed');

    // 3. Delete receipt images from storage (non-blocking)
    this.deleteReceiptImages(userId, receiptId, receipt).catch(error => {
      console.warn('🗑️ Failed to delete receipt images (non-critical):', error.message);
    });

    // 4. Update aggregated items - remove prices from this receipt (non-blocking)
    this.updateAggregatedItemsAfterDelete(userId, receiptId, receipt).catch(error => {
      console.warn('🗑️ Failed to update aggregated items (non-critical):', error.message);
    });

    // 5. Clear all caches to ensure fresh data
    try {
      console.log('🗑️ Clearing caches after receipt deletion...');
      await savingsTrackerService.clearStatsCache(userId);
      await widgetDataService.clearAllWidgetData();
      console.log('🗑️ Caches cleared');
    } catch (cacheError) {
      console.warn('🗑️ Failed to clear caches (non-critical):', cacheError);
    }

    console.log('🗑️ Receipt deletion complete');
  }

  /**
   * Delete all receipts for a user
   * Deletes all receipt documents and their associated data
   */
  async deleteAllReceipts(userId: string): Promise<number> {
    try {
      console.log('🗑️ Starting bulk deletion of all receipts...');

      // Get all receipts
      const receiptsSnapshot = await firestore()
        .collection(RECEIPTS_COLLECTION(userId))
        .get();

      if (receiptsSnapshot.empty) {
        console.log('🗑️ No receipts to delete');
        return 0;
      }

      const totalReceipts = receiptsSnapshot.size;
      console.log(`🗑️ Found ${totalReceipts} receipts to delete`);

      // Delete in batches (Firestore batch limit is 500 operations)
      const batchSize = 100;
      let deletedCount = 0;

      for (let i = 0; i < receiptsSnapshot.docs.length; i += batchSize) {
        const batch = firestore().batch();
        const batchDocs = receiptsSnapshot.docs.slice(i, i + batchSize);

        for (const doc of batchDocs) {
          batch.delete(doc.ref);
        }

        await batch.commit();
        deletedCount += batchDocs.length;
        console.log(`🗑️ Deleted ${deletedCount}/${totalReceipts} receipts`);
      }

      // Delete all shops (they'll be recreated when new receipts are added)
      const shopsSnapshot = await firestore()
        .collection(SHOPS_COLLECTION(userId))
        .get();

      if (!shopsSnapshot.empty) {
        const shopBatch = firestore().batch();
        shopsSnapshot.docs.forEach(doc => shopBatch.delete(doc.ref));
        await shopBatch.commit();
        console.log(`🗑️ Deleted ${shopsSnapshot.size} shops`);
      }

      // Clear all caches to ensure fresh data
      try {
        console.log('🗑️ Clearing caches after bulk receipt deletion...');
        await savingsTrackerService.clearStatsCache(userId);
        await widgetDataService.clearAllWidgetData();
        console.log('🗑️ Caches cleared');
      } catch (cacheError) {
        console.warn('🗑️ Failed to clear caches (non-critical):', cacheError);
      }

      console.log('🗑️ All receipts deleted successfully');
      return deletedCount;
    } catch (error) {
      console.error('Error deleting all receipts:', error);
      throw error;
    }
  }

  /**
   * Delete receipt images from storage
   */
  private async deleteReceiptImages(
    userId: string,
    receiptId: string,
    receipt: Receipt
  ): Promise<void> {
    try {
      const imagesToDelete: string[] = [];
      
      // Add single image URL
      if (receipt.imageUrl) {
        imagesToDelete.push(receipt.imageUrl);
      }
      
      // Add multiple image URLs
      if (receipt.imageUrls && receipt.imageUrls.length > 0) {
        imagesToDelete.push(...receipt.imageUrls);
      }
      
      // Add thumbnail URL
      if (receipt.thumbnailUrl) {
        imagesToDelete.push(receipt.thumbnailUrl);
      }

      // Delete all images
      for (const imageUrl of imagesToDelete) {
        try {
          const ref = storage().refFromURL(imageUrl);
          await ref.delete();
          console.log('🗑️ Deleted image:', imageUrl);
        } catch (error: any) {
          // Ignore errors for individual images (might already be deleted)
          if (error.code !== 'storage/object-not-found') {
            console.warn('🗑️ Could not delete image:', imageUrl, error.message);
          }
        }
      }
    } catch (error) {
      console.error('🗑️ Error deleting receipt images:', error);
    }
  }

  /**
   * Update aggregated items after receipt deletion
   * Removes price entries from this receipt and recalculates item stats
   */
  private async updateAggregatedItemsAfterDelete(
    userId: string,
    receiptId: string,
    receipt: Receipt
  ): Promise<void> {
    try {
      const itemsRef = firestore()
        .collection(`artifacts/${APP_ID}/users/${userId}/items`);

      const itemsSnapshot = await itemsRef.get();

      if (itemsSnapshot.empty) {
        console.log('🗑️ No aggregated items to update');
        return;
      }

      const batch = firestore().batch();
      let itemsUpdated = 0;

      for (const itemDoc of itemsSnapshot.docs) {
        const itemData = itemDoc.data();
        const prices = itemData.prices || [];

        // Filter out prices from this receipt
        const updatedPrices = prices.filter(
          (price: any) => price.receiptId !== receiptId
        );

        if (updatedPrices.length !== prices.length) {
          if (updatedPrices.length === 0) {
            // No prices left - delete the item
            batch.delete(itemDoc.ref);
            itemsUpdated++;
            console.log('🗑️ Deleting item (no more prices):', itemDoc.id);
          } else {
            // Recalculate statistics
            const priceValues = updatedPrices.map((p: any) => p.price);
            const minPrice = Math.min(...priceValues);
            const maxPrice = Math.max(...priceValues);
            const avgPrice =
              priceValues.reduce((sum: number, p: number) => sum + p, 0) /
              priceValues.length;
            const storeCount = new Set(
              updatedPrices.map((p: any) => p.storeName)
            ).size;
            const lastPurchaseDate = updatedPrices[0]?.date || new Date();

            batch.update(itemDoc.ref, {
              prices: updatedPrices,
              minPrice,
              maxPrice,
              avgPrice,
              storeCount,
              totalPurchases: updatedPrices.length,
              lastPurchaseDate,
              updatedAt: firestore.FieldValue.serverTimestamp(),
            });
            itemsUpdated++;
            console.log('🗑️ Updated item stats:', itemDoc.id);
          }
        }
      }

      if (itemsUpdated > 0) {
        await batch.commit();
        console.log('🗑️ Updated', itemsUpdated, 'aggregated items');
      }
    } catch (error) {
      console.error('🗑️ Error updating aggregated items:', error);
    }
  }

  /**
   * Upload receipt images to storage
   */
  async uploadReceiptImages(
    userId: string,
    receiptId: string,
    imageUris: string[],
  ): Promise<string[]> {
    const uploadPromises = imageUris.map(async (uri, index) => {
      const path = `artifacts/${APP_ID}/users/${userId}/receipts/${receiptId}/image_${index}.jpg`;
      const ref = storage().ref(path);

      await ref.putFile(uri);
      return ref.getDownloadURL();
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Convert Firestore doc to Receipt
   */
  private docToReceipt(doc: FirebaseFirestoreTypes.DocumentSnapshot): Receipt {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      date: this.safeToDate(data.date),
      purchaseDate: this.safeToDate(data.date),
      createdAt: this.safeToDate(data.createdAt),
      updatedAt: this.safeToDate(data.updatedAt),
      scannedAt: this.safeToDate(data.scannedAt),
    } as Receipt;
  }

  /**
   * Normalize store name for ID
   */
  private normalizeStoreName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Remove undefined fields to prevent Firestore errors
   */
  private removeUndefinedFields(obj: any): any {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value as any).toDate) {
          // Recursively clean nested objects, but skip Date objects and Firestore objects
          cleaned[key] = this.removeUndefinedFields(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }

  /**
   * Safely convert various date/timestamp formats to Date
   */
  private safeToDate(value: any): Date {
    if (!value) {
      return new Date();
    }

    // Firestore Timestamp with toDate method
    if (value.toDate && typeof value.toDate === 'function') {
      try {
        return value.toDate();
      } catch (error) {
        console.warn('Failed to convert Firestore timestamp:', error);
        return new Date();
      }
    }

    // Serialized Firestore timestamp (from Cloud Functions response)
    if (value._type === 'timestamp' || value._seconds !== undefined) {
      try {
        const seconds = value._seconds || value.seconds || 0;
        const nanoseconds = value._nanoseconds || value.nanoseconds || 0;
        return new Date(seconds * 1000 + nanoseconds / 1000000);
      } catch (error) {
        console.warn('Failed to convert serialized timestamp:', error);
        return new Date();
      }
    }

    // Firestore Timestamp-like object with seconds/nanoseconds
    if (typeof value.seconds === 'number') {
      try {
        return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
      } catch (error) {
        return new Date();
      }
    }

    // Already a Date object
    if (value instanceof Date) {
      return value;
    }

    // String or number
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Fallback - don't warn for expected formats
    return new Date();
  }
}

export const receiptStorageService = new ReceiptStorageService();
