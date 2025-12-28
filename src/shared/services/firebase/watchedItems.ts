// Watched Items Service - Monitor items for price drops (Premium Feature)
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import {APP_ID} from './config';
import {safeToDate} from '@/shared/utils/helpers';

const WATCHED_ITEMS_COLLECTION = (userId: string) =>
  `artifacts/${APP_ID}/users/${userId}/watchedItems`;

export type AlertType = 'any_drop' | 'threshold' | 'percentage';

export interface WatchedItem {
  id: string;
  userId: string;
  itemName: string;
  itemNameNormalized: string;
  city: string;
  alertType: AlertType;
  targetPrice?: number;
  percentageDrop?: number;
  baselinePrice: number;
  lastNotifiedPrice: number;
  currentPrice: number;
  currentStore: string;
  notificationCount: number;
  lastNotificationSent?: Date;
  cooldownUntil?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchItemInput {
  itemName: string;
  itemNameNormalized: string;
  city: string;
  alertType: AlertType;
  targetPrice?: number;
  percentageDrop?: number;
  currentPrice: number;
  currentStore: string;
}

class WatchedItemsService {
  private functionsInstance = functions().httpsCallable;

  /**
   * Watch an item for price drops
   */
  async watchItem(userId: string, input: WatchItemInput): Promise<{success: boolean; id: string}> {
    try {
      // Try cloud function first (validates premium status)
      const watchItemFn = this.functionsInstance('watchItem');
      const result = await watchItemFn(input);
      return result.data as {success: boolean; id: string};
    } catch (error: any) {
      // Fallback to direct Firestore write
      console.log('Cloud function failed, using direct write:', error.message);
      
      const docRef = firestore()
        .collection(WATCHED_ITEMS_COLLECTION(userId))
        .doc(input.itemNameNormalized);

      const existing = await docRef.get();

      if (existing.exists) {
        await docRef.update({
          alertType: input.alertType,
          targetPrice: input.targetPrice || null,
          percentageDrop: input.percentageDrop || null,
          currentPrice: input.currentPrice,
          currentStore: input.currentStore,
          isActive: true,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await docRef.set({
          id: input.itemNameNormalized,
          userId,
          itemName: input.itemName,
          itemNameNormalized: input.itemNameNormalized,
          city: input.city,
          alertType: input.alertType,
          targetPrice: input.targetPrice || null,
          percentageDrop: input.percentageDrop || null,
          baselinePrice: input.currentPrice,
          lastNotifiedPrice: input.currentPrice,
          currentPrice: input.currentPrice,
          currentStore: input.currentStore,
          notificationCount: 0,
          isActive: true,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      return {success: true, id: input.itemNameNormalized};
    }
  }

  /**
   * Stop watching an item
   */
  async unwatchItem(userId: string, itemNameNormalized: string): Promise<void> {
    try {
      const unwatchItemFn = this.functionsInstance('unwatchItem');
      await unwatchItemFn({itemNameNormalized});
    } catch (error) {
      // Fallback to direct delete
      await firestore()
        .collection(WATCHED_ITEMS_COLLECTION(userId))
        .doc(itemNameNormalized)
        .delete();
    }
  }

  /**
   * Get all watched items for a user
   */
  async getWatchedItems(userId: string, activeOnly = true): Promise<WatchedItem[]> {
    let query = firestore().collection(WATCHED_ITEMS_COLLECTION(userId)) as any;

    if (activeOnly) {
      query = query.where('isActive', '==', true);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: safeToDate(data.createdAt) || new Date(),
        updatedAt: safeToDate(data.updatedAt) || new Date(),
        lastNotificationSent: data.lastNotificationSent
          ? safeToDate(data.lastNotificationSent)
          : undefined,
        cooldownUntil: data.cooldownUntil
          ? safeToDate(data.cooldownUntil)
          : undefined,
      } as WatchedItem;
    });
  }

  /**
   * Check if user is watching a specific item
   */
  async isWatching(
    userId: string,
    itemNameNormalized: string,
  ): Promise<boolean> {
    const doc = await firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .doc(itemNameNormalized)
      .get();

    return doc.exists && doc.data()?.isActive === true;
  }

  /**
   * Get a specific watched item
   */
  async getWatchedItem(
    userId: string,
    itemNameNormalized: string,
  ): Promise<WatchedItem | null> {
    const doc = await firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .doc(itemNameNormalized)
      .get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: safeToDate(data.createdAt) || new Date(),
      updatedAt: safeToDate(data.updatedAt) || new Date(),
      lastNotificationSent: data.lastNotificationSent
        ? safeToDate(data.lastNotificationSent)
        : undefined,
      cooldownUntil: data.cooldownUntil
        ? safeToDate(data.cooldownUntil)
        : undefined,
    } as WatchedItem;
  }

  /**
   * Toggle watch status (pause/resume)
   */
  async toggleWatchStatus(
    userId: string,
    itemNameNormalized: string,
    isActive: boolean,
  ): Promise<void> {
    try {
      const toggleFn = this.functionsInstance('toggleWatchStatus');
      await toggleFn({itemNameNormalized, isActive});
    } catch (error) {
      // Fallback to direct update
      await firestore()
        .collection(WATCHED_ITEMS_COLLECTION(userId))
        .doc(itemNameNormalized)
        .update({
          isActive,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
    }
  }

  /**
   * Update alert settings for a watched item
   */
  async updateAlertSettings(
    userId: string,
    itemNameNormalized: string,
    settings: {
      alertType: AlertType;
      targetPrice?: number;
      percentageDrop?: number;
    },
  ): Promise<void> {
    await firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .doc(itemNameNormalized)
      .update({
        alertType: settings.alertType,
        targetPrice: settings.targetPrice || null,
        percentageDrop: settings.percentageDrop || null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Subscribe to watched items changes
   */
  subscribeToWatchedItems(
    userId: string,
    callback: (items: WatchedItem[]) => void,
  ): () => void {
    return firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          const items = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: safeToDate(data.createdAt) || new Date(),
              updatedAt: safeToDate(data.updatedAt) || new Date(),
              lastNotificationSent: data.lastNotificationSent
                ? safeToDate(data.lastNotificationSent)
                : undefined,
              cooldownUntil: data.cooldownUntil
                ? safeToDate(data.cooldownUntil)
                : undefined,
            } as WatchedItem;
          });
          callback(items);
        },
        error => {
          console.error('Watch items subscription error:', error);
          callback([]);
        },
      );
  }

  /**
   * Get watched items count for a user
   */
  async getWatchedItemsCount(userId: string): Promise<number> {
    const snapshot = await firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .where('isActive', '==', true)
      .get();

    return snapshot.size;
  }
}

export const watchedItemsService = new WatchedItemsService();
