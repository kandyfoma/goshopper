// Receipt Storage Service - Handles saving receipts and shop organization
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import {Receipt} from '@/shared/types';
import {APP_ID, COLLECTIONS} from './config';
import {authService} from './auth';

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

      return null;
    } catch (error) {
      console.error('Error detecting city from store:', error);
      return null;
    }
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
    // Save receipt FIRST (most important) - no batch to prevent data loss
    const receiptRef = firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .doc(receipt.id);

    try {
      await receiptRef.set({
        ...receipt,
        date: firestore.Timestamp.fromDate(receipt.date),
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        scannedAt: firestore.FieldValue.serverTimestamp(),
      });

      // Update shop in background (non-blocking, non-critical)
      // If this fails, receipt is still saved
      this.updateShopFromReceipt(receipt, userId, null).catch(error => {
        console.error('Failed to update shop stats (non-critical):', error);
        // Don't throw - shop update is not critical
      });

      return receipt.id;
    } catch (error) {
      console.error('Failed to save receipt:', error);

      // Try one more time with a new ID (in case of ID conflict)
      const newReceiptRef = firestore()
        .collection(RECEIPTS_COLLECTION(userId))
        .doc();

      await newReceiptRef.set({
        ...receipt,
        id: newReceiptRef.id,
        date: firestore.Timestamp.fromDate(receipt.date),
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        scannedAt: firestore.FieldValue.serverTimestamp(),
      });

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
      if (shopDoc.exists) {
        // Update existing shop
        batch.update(shopRef, {
          receiptCount: firestore.FieldValue.increment(1),
          totalSpent: firestore.FieldValue.increment(receipt.total),
          lastVisit: firestore.Timestamp.fromDate(receipt.date),
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
          lastVisit: receipt.date,
        };

        batch.set(shopRef, {
          ...newShop,
          lastVisit: firestore.Timestamp.fromDate(receipt.date),
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      // Direct update (no batch) - safer for background operations
      if (shopDoc.exists) {
        await shopRef.update({
          receiptCount: firestore.FieldValue.increment(1),
          totalSpent: firestore.FieldValue.increment(receipt.total),
          lastVisit: firestore.Timestamp.fromDate(receipt.date),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          ...(receipt.storeAddress && !shopDoc.data()?.address
            ? {address: receipt.storeAddress}
            : {}),
          ...(receipt.storePhone && !shopDoc.data()?.phone
            ? {phone: receipt.storePhone}
            : {}),
        });
      } else {
        const newShop: Omit<Shop, 'createdAt' | 'updatedAt'> = {
          id: shopId,
          name: receipt.storeName,
          nameNormalized: shopId,
          address: receipt.storeAddress,
          phone: receipt.storePhone,
          receiptCount: 1,
          totalSpent: receipt.total,
          currency: receipt.currency,
          lastVisit: receipt.date,
        };

        await shopRef.set({
          ...newShop,
          lastVisit: firestore.Timestamp.fromDate(receipt.date),
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
      lastVisit: doc.data().lastVisit?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
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
   * Delete a receipt and update shop stats
   */
  async deleteReceipt(userId: string, receiptId: string): Promise<void> {
    const receipt = await this.getReceipt(userId, receiptId);
    if (!receipt) {
      return;
    }

    const batch = firestore().batch();

    // Delete receipt
    const receiptRef = firestore()
      .collection(RECEIPTS_COLLECTION(userId))
      .doc(receiptId);
    batch.delete(receiptRef);

    // Update shop stats
    const shopId = receipt.storeNameNormalized;
    if (shopId) {
      const shopRef = firestore()
        .collection(SHOPS_COLLECTION(userId))
        .doc(shopId);

      const shopDoc = await shopRef.get();
      if (shopDoc.exists) {
        const newCount = (shopDoc.data()?.receiptCount || 1) - 1;

        if (newCount <= 0) {
          // Delete shop if no more receipts
          batch.delete(shopRef);
        } else {
          batch.update(shopRef, {
            receiptCount: firestore.FieldValue.increment(-1),
            totalSpent: firestore.FieldValue.increment(-receipt.total),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();
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
      const path = `apps/${APP_ID}/users/${userId}/receipts/${receiptId}/image_${index}.jpg`;
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
      date: data.date?.toDate() || new Date(),
      purchaseDate: data.date?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      scannedAt: data.scannedAt?.toDate() || new Date(),
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
}

export const receiptStorageService = new ReceiptStorageService();
