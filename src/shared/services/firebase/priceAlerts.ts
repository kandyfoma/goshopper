// Price Alerts Service - Monitor items for price drops
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from './config';
import {authService} from './auth';

const ALERTS_COLLECTION = (userId: string) =>
  `artifacts/goshopperai/users/${userId}/priceAlerts`;

const PRICES_COLLECTION = `artifacts/goshopperai/prices`;

export interface PriceAlert {
  id: string;
  userId: string;
  productName: string;
  productNameNormalized: string;
  targetPrice: number;
  city?: string; // City for price filtering
  currentLowestPrice?: number;
  currentLowestStore?: string;
  currency: 'USD' | 'CDF';
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: Date;
  notificationSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceAlertInput {
  productName: string;
  targetPrice: number;
  city?: string;
  currency?: 'USD' | 'CDF';
}

class PriceAlertsService {
  /**
   * Normalize product name for matching
   */
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Create a new price alert
   */
  async createAlert(
    userId: string,
    input: PriceAlertInput,
  ): Promise<PriceAlert> {
    const normalized = this.normalizeProductName(input.productName);

    // Get user's city for filtering prices
    const userProfile = await authService.getUserProfile(userId);
    const userCity = userProfile?.defaultCity;
    const alertCity = input.city || userCity;

    // Check for existing alert on same product and city
    let existingQuery = firestore()
      .collection(ALERTS_COLLECTION(userId))
      .where('productNameNormalized', '==', normalized)
      .where('isActive', '==', true);

    if (alertCity) {
      existingQuery = existingQuery.where('city', '==', alertCity);
    }

    const existing = await existingQuery.get();

    if (!existing.empty) {
      // Update existing alert
      const existingDoc = existing.docs[0];
      await existingDoc.ref.update({
        targetPrice: input.targetPrice,
        isTriggered: false,
        notificationSent: false,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      return this.getAlert(userId, existingDoc.id) as Promise<PriceAlert>;
    }

    // Get current lowest price for this product
    const currentPrice = await this.getCurrentLowestPrice(normalized, userCity);

    const alertRef = firestore().collection(ALERTS_COLLECTION(userId)).doc();

    const alert: Omit<PriceAlert, 'createdAt' | 'updatedAt' | 'id'> = {
      userId,
      productName: input.productName,
      productNameNormalized: normalized,
      targetPrice: input.targetPrice,
      city: alertCity,
      currentLowestPrice: currentPrice?.price,
      currentLowestStore: currentPrice?.storeName,
      currency: input.currency || 'USD',
      isActive: true,
      isTriggered: currentPrice
        ? currentPrice.price <= input.targetPrice
        : false,
      notificationSent: false,
    };

    await alertRef.set({
      ...alert,
      id: alertRef.id,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return {
      ...alert,
      id: alertRef.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get current lowest price for a product
   */
  private async getCurrentLowestPrice(
    productNameNormalized: string,
    city?: string,
  ): Promise<{price: number; storeName: string} | null> {
    let query = firestore()
      .collection(PRICES_COLLECTION)
      .where('productNameNormalized', '==', productNameNormalized);

    if (city) {
      query = query.where('storeLocation', '==', city);
    }

    const pricesSnapshot = await query
      .orderBy('price', 'asc')
      .limit(1)
      .get();

    if (pricesSnapshot.empty) return null;

    const doc = pricesSnapshot.docs[0].data();
    return {
      price: doc.price,
      storeName: doc.storeName,
    };
  }

  /**
   * Get all alerts for a user
   */
  async getAlerts(userId: string, activeOnly = true): Promise<PriceAlert[]> {
    let query = firestore().collection(ALERTS_COLLECTION(userId)) as any;

    if (activeOnly) {
      query = query.where('isActive', '==', true);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    return snapshot.docs.map((doc: any) => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      triggeredAt: doc.data().triggeredAt?.toDate(),
    })) as PriceAlert[];
  }

  /**
   * Get a single alert
   */
  async getAlert(userId: string, alertId: string): Promise<PriceAlert | null> {
    const doc = await firestore()
      .collection(ALERTS_COLLECTION(userId))
      .doc(alertId)
      .get();

    if (!doc.exists) return null;

    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      triggeredAt: data.triggeredAt?.toDate(),
    } as PriceAlert;
  }

  /**
   * Get alerts for a specific product
   */
  async getAlertsForProduct(
    userId: string,
    productName: string,
  ): Promise<PriceAlert[]> {
    const normalized = this.normalizeProductName(productName);

    const snapshot = await firestore()
      .collection(ALERTS_COLLECTION(userId))
      .where('productNameNormalized', '==', normalized)
      .where('isActive', '==', true)
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      triggeredAt: doc.data().triggeredAt?.toDate(),
    })) as PriceAlert[];
  }

  /**
   * Update alert status
   */
  async updateAlert(
    userId: string,
    alertId: string,
    updates: Partial<Pick<PriceAlert, 'targetPrice' | 'isActive'>>,
  ): Promise<void> {
    await firestore()
      .collection(ALERTS_COLLECTION(userId))
      .doc(alertId)
      .update({
        ...updates,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Mark alert as triggered
   */
  async triggerAlert(userId: string, alertId: string): Promise<void> {
    await firestore()
      .collection(ALERTS_COLLECTION(userId))
      .doc(alertId)
      .update({
        isTriggered: true,
        triggeredAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Delete an alert
   */
  async deleteAlert(userId: string, alertId: string): Promise<void> {
    await firestore()
      .collection(ALERTS_COLLECTION(userId))
      .doc(alertId)
      .delete();
  }

  /**
   * Deactivate an alert (soft delete)
   */
  async deactivateAlert(userId: string, alertId: string): Promise<void> {
    await this.updateAlert(userId, alertId, {isActive: false});
  }

  /**
   * Subscribe to alert updates
   */
  subscribeToAlerts(
    userId: string,
    callback: (alerts: PriceAlert[]) => void,
  ): () => void {
    return firestore()
      .collection(ALERTS_COLLECTION(userId))
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          if (!snapshot) {
            callback([]);
            return;
          }
          const alerts = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
            triggeredAt: doc.data().triggeredAt?.toDate(),
          })) as PriceAlert[];

          callback(alerts);
        },
        error => {
          console.error('Error subscribing to alerts:', error);
          callback([]);
        },
      );
  }

  /**
   * Get triggered alerts (for notifications)
   */
  async getTriggeredAlerts(userId: string): Promise<PriceAlert[]> {
    const snapshot = await firestore()
      .collection(ALERTS_COLLECTION(userId))
      .where('isTriggered', '==', true)
      .where('notificationSent', '==', false)
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      triggeredAt: doc.data().triggeredAt?.toDate(),
    })) as PriceAlert[];
  }

  /**
   * Mark notification as sent
   */
  async markNotificationSent(userId: string, alertId: string): Promise<void> {
    await firestore()
      .collection(ALERTS_COLLECTION(userId))
      .doc(alertId)
      .update({
        notificationSent: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }
}

export const priceAlertsService = new PriceAlertsService();
