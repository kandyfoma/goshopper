/**
 * Notification Actions Service
 * Handles notification categories and actions (mark as read, etc.)
 */

import notifee, {
  AndroidImportance,
  AndroidCategory,
  EventType,
  Event,
} from '@notifee/react-native';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Action IDs
export const NOTIFICATION_ACTIONS = {
  MARK_AS_READ: 'mark_as_read',
  VIEW: 'view',
  DISMISS: 'dismiss',
} as const;

// Category IDs
export const NOTIFICATION_CATEGORIES = {
  GENERAL: 'general',
  SCAN: 'scan',
  PRICE_ALERT: 'price_alert',
  SUBSCRIPTION: 'subscription',
  PAYMENT: 'payment',
} as const;

// Channel IDs
export const NOTIFICATION_CHANNELS = {
  GENERAL: 'general',
  SCAN_COMPLETION: 'scan-completion',
  PRICE_ALERTS: 'price-alerts',
  SUBSCRIPTION: 'subscription',
  PAYMENT: 'payment',
} as const;

const READ_NOTIFICATIONS_KEY = '@goshopperai/read_notifications';

class NotificationActionsService {
  private initialized = false;

  /**
   * Initialize notification categories and channels
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create Android notification channels with actions
      if (Platform.OS === 'android') {
        await this.createAndroidChannels();
      }

      // Create iOS notification categories
      if (Platform.OS === 'ios') {
        await this.createIOSCategories();
      }

      // Set up foreground event handler
      this.setupForegroundHandler();

      this.initialized = true;
      console.log('[NotificationActions] Initialized');
    } catch (error) {
      console.error('[NotificationActions] Initialization error:', error);
    }
  }

  /**
   * Create Android notification channels
   */
  private async createAndroidChannels(): Promise<void> {
    const channels = [
      {
        id: NOTIFICATION_CHANNELS.GENERAL,
        name: 'Général',
        importance: AndroidImportance.DEFAULT,
        sound: 'default',
      },
      {
        id: NOTIFICATION_CHANNELS.SCAN_COMPLETION,
        name: 'Scans',
        description: 'Notifications de scan de reçus',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      },
      {
        id: NOTIFICATION_CHANNELS.PRICE_ALERTS,
        name: 'Alertes de prix',
        description: 'Alertes quand un prix change',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      },
      {
        id: NOTIFICATION_CHANNELS.SUBSCRIPTION,
        name: 'Abonnement',
        description: 'Notifications liées à votre abonnement',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      },
      {
        id: NOTIFICATION_CHANNELS.PAYMENT,
        name: 'Paiements',
        description: 'Confirmations de paiement',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      },
    ];

    for (const channel of channels) {
      await notifee.createChannel(channel);
    }
  }

  /**
   * Create iOS notification categories with actions
   */
  private async createIOSCategories(): Promise<void> {
    await notifee.setNotificationCategories([
      {
        id: NOTIFICATION_CATEGORIES.GENERAL,
        actions: [
          {
            id: NOTIFICATION_ACTIONS.MARK_AS_READ,
            title: 'Marquer comme lu',
          },
        ],
      },
      {
        id: NOTIFICATION_CATEGORIES.SCAN,
        actions: [
          {
            id: NOTIFICATION_ACTIONS.VIEW,
            title: 'Voir',
            foreground: true,
          },
          {
            id: NOTIFICATION_ACTIONS.MARK_AS_READ,
            title: 'Marquer comme lu',
          },
        ],
      },
      {
        id: NOTIFICATION_CATEGORIES.PRICE_ALERT,
        actions: [
          {
            id: NOTIFICATION_ACTIONS.VIEW,
            title: 'Voir le produit',
            foreground: true,
          },
          {
            id: NOTIFICATION_ACTIONS.MARK_AS_READ,
            title: 'Marquer comme lu',
          },
        ],
      },
      {
        id: NOTIFICATION_CATEGORIES.SUBSCRIPTION,
        actions: [
          {
            id: NOTIFICATION_ACTIONS.VIEW,
            title: 'Gérer',
            foreground: true,
          },
          {
            id: NOTIFICATION_ACTIONS.MARK_AS_READ,
            title: 'Marquer comme lu',
          },
        ],
      },
      {
        id: NOTIFICATION_CATEGORIES.PAYMENT,
        actions: [
          {
            id: NOTIFICATION_ACTIONS.MARK_AS_READ,
            title: 'Marquer comme lu',
          },
        ],
      },
    ]);
  }

  /**
   * Set up foreground notification event handler
   */
  private setupForegroundHandler(): void {
    notifee.onForegroundEvent(async ({type, detail}: Event) => {
      const {notification, pressAction} = detail;

      switch (type) {
        case EventType.ACTION_PRESS:
          if (pressAction?.id === NOTIFICATION_ACTIONS.MARK_AS_READ) {
            await this.markAsRead(notification?.id);
            // Cancel the notification after marking as read
            if (notification?.id) {
              await notifee.cancelNotification(notification.id);
            }
          }
          break;
        case EventType.PRESS:
          // User tapped the notification - mark as read
          await this.markAsRead(notification?.id);
          break;
        case EventType.DISMISSED:
          // User dismissed the notification
          console.log('[NotificationActions] Notification dismissed:', notification?.id);
          break;
      }
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId?: string): Promise<void> {
    if (!notificationId) return;

    try {
      const stored = await AsyncStorage.getItem(READ_NOTIFICATIONS_KEY);
      const readIds: string[] = stored ? JSON.parse(stored) : [];

      if (!readIds.includes(notificationId)) {
        readIds.push(notificationId);
        // Keep only last 100 read notifications
        const trimmed = readIds.slice(-100);
        await AsyncStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(trimmed));
      }

      console.log('[NotificationActions] Marked as read:', notificationId);
    } catch (error) {
      console.error('[NotificationActions] Failed to mark as read:', error);
    }
  }

  /**
   * Check if a notification has been read
   */
  async isRead(notificationId: string): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(READ_NOTIFICATIONS_KEY);
      const readIds: string[] = stored ? JSON.parse(stored) : [];
      return readIds.includes(notificationId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Display a notification with mark as read action
   */
  async displayNotification(options: {
    id?: string;
    title: string;
    body: string;
    channelId?: string;
    categoryId?: string;
    data?: Record<string, string>;
    largeIcon?: string;
  }): Promise<string | undefined> {
    const {
      id,
      title,
      body,
      channelId = NOTIFICATION_CHANNELS.GENERAL,
      categoryId = NOTIFICATION_CATEGORIES.GENERAL,
      data,
      largeIcon,
    } = options;

    const notificationId = id || `notif_${Date.now()}`;

    try {
      await notifee.displayNotification({
        id: notificationId,
        title,
        body,
        data,
        android: {
          channelId,
          smallIcon: 'notification_icon',
          ...(largeIcon && { largeIcon }),
          pressAction: {
            id: 'default',
          },
          actions: [
            {
              title: 'Marquer comme lu',
              pressAction: {
                id: NOTIFICATION_ACTIONS.MARK_AS_READ,
              },
            },
          ],
        },
        ios: {
          categoryId,
          sound: 'default',
        },
      });

      return notificationId;
    } catch (error) {
      console.error('[NotificationActions] Failed to display notification:', error);
      return undefined;
    }
  }

  /**
   * Display a scan completion notification
   */
  async displayScanNotification(options: {
    storeName: string;
    itemCount: number;
    total: number;
    currency: string;
    date?: string;
    receiptId?: string;
  }): Promise<string | undefined> {
    const {storeName, itemCount, total, currency, date, receiptId} = options;

    const formattedTotal = total.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    return this.displayNotification({
      id: receiptId ? `scan_${receiptId}` : undefined,
      title: `✅ ${storeName}`,
      body: `${itemCount} article${itemCount > 1 ? 's' : ''} • Total: ${formattedTotal} ${currency}`,
      channelId: NOTIFICATION_CHANNELS.SCAN_COMPLETION,
      categoryId: NOTIFICATION_CATEGORIES.SCAN,
      data: receiptId ? {receiptId, type: 'scan'} : undefined,
    });
  }

  /**
   * Display a price alert notification
   */
  async displayPriceAlertNotification(options: {
    productName: string;
    oldPrice: number;
    newPrice: number;
    currency: string;
    productId?: string;
  }): Promise<string | undefined> {
    const {productName, oldPrice, newPrice, currency, productId} = options;

    const priceDiff = oldPrice - newPrice;
    const percentDiff = Math.round((priceDiff / oldPrice) * 100);

    return this.displayNotification({
      id: productId ? `price_${productId}_${Date.now()}` : undefined,
      title: `📉 Baisse de prix!`,
      body: `${productName}: ${newPrice} ${currency} (-${percentDiff}%)`,
      channelId: NOTIFICATION_CHANNELS.PRICE_ALERTS,
      categoryId: NOTIFICATION_CATEGORIES.PRICE_ALERT,
      data: productId ? {productId, type: 'price_alert'} : undefined,
    });
  }

  /**
   * Display a payment notification
   */
  async displayPaymentNotification(options: {
    title: string;
    body: string;
    transactionId?: string;
  }): Promise<string | undefined> {
    const {title, body, transactionId} = options;

    return this.displayNotification({
      id: transactionId ? `payment_${transactionId}` : undefined,
      title,
      body,
      channelId: NOTIFICATION_CHANNELS.PAYMENT,
      categoryId: NOTIFICATION_CATEGORIES.PAYMENT,
      data: transactionId ? {transactionId, type: 'payment'} : undefined,
    });
  }

  /**
   * Display a subscription notification
   */
  async displaySubscriptionNotification(options: {
    title: string;
    body: string;
  }): Promise<string | undefined> {
    return this.displayNotification({
      title: options.title,
      body: options.body,
      channelId: NOTIFICATION_CHANNELS.SUBSCRIPTION,
      categoryId: NOTIFICATION_CATEGORIES.SUBSCRIPTION,
      data: {type: 'subscription'},
    });
  }

  /**
   * Display an error notification
   */
  async displayErrorNotification(options: {
    title?: string;
    body: string;
  }): Promise<string | undefined> {
    return this.displayNotification({
      title: options.title || '❌ Erreur',
      body: options.body,
      channelId: NOTIFICATION_CHANNELS.GENERAL,
      categoryId: NOTIFICATION_CATEGORIES.GENERAL,
    });
  }
}

export const notificationActionsService = new NotificationActionsService();
