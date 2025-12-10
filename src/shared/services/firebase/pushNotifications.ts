// Push Notifications Service - FCM Integration
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import functions from '@react-native-firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import {Platform, PermissionsAndroid} from 'react-native';
import {APP_ID} from './config';

const FCM_TOKEN_KEY = '@goshopperai/fcm_token';
const NOTIFICATION_PREFS_KEY = '@goshopperai/notification_prefs';

const USERS_COLLECTION = (userId: string) =>
  `apps/${APP_ID}/users/${userId}`;

export interface NotificationPreferences {
  priceAlerts: boolean;
  weeklySummary: boolean;
  newFeatures: boolean;
  promotions: boolean;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  receivedAt: Date;
  read: boolean;
}

type NotificationCallback = (notification: PushNotification) => void;

class PushNotificationService {
  private listeners: NotificationCallback[] = [];
  private unsubscribeHandlers: (() => void)[] = [];

  /**
   * Initialize push notifications
   */
  async init(): Promise<void> {
    // Request permission
    const hasPermission = await this.requestPermission();
    
    if (!hasPermission) {
      console.log('[PushNotifications] Permission not granted');
      return;
    }
    
    // Get and save FCM token
    await this.registerToken();
    
    // Set up message handlers
    this.setupMessageHandlers();
    
    console.log('[PushNotifications] Initialized');
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    this.unsubscribeHandlers.forEach(unsub => unsub());
    this.unsubscribeHandlers = [];
    this.listeners = [];
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
      }
      
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      return enabled;
    } catch (error) {
      console.error('[PushNotifications] Permission error:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async isEnabled(): Promise<boolean> {
    const authStatus = await messaging().hasPermission();
    return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
           authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  }

  /**
   * Register FCM token
   */
  async registerToken(userId?: string): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      
      if (token) {
        await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
        
        // Save token to Firestore if userId provided
        if (userId) {
          await this.saveTokenToFirestore(userId, token);
        }
        
        console.log('[PushNotifications] Token registered');
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('[PushNotifications] Token registration error:', error);
      return null;
    }
  }

  /**
   * Save FCM token to Firestore for the user
   */
  async saveTokenToFirestore(userId: string, token: string): Promise<void> {
    try {
      await firestore()
        .doc(USERS_COLLECTION(userId))
        .set({
          fcmToken: token,
          fcmTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
          platform: Platform.OS,
        }, {merge: true});
    } catch (error) {
      console.error('[PushNotifications] Save token error:', error);
    }
  }

  /**
   * Delete FCM token (for logout)
   */
  async deleteToken(userId?: string): Promise<void> {
    try {
      await messaging().deleteToken();
      await AsyncStorage.removeItem(FCM_TOKEN_KEY);
      
      if (userId) {
        await firestore()
          .doc(USERS_COLLECTION(userId))
          .update({
            fcmToken: firestore.FieldValue.delete(),
            fcmTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
          });
      }
      
      console.log('[PushNotifications] Token deleted');
    } catch (error) {
      console.error('[PushNotifications] Delete token error:', error);
    }
  }

  /**
   * Set up message handlers
   */
  private setupMessageHandlers(): void {
    // Foreground messages
    const unsubForeground = messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[PushNotifications] Foreground message:', remoteMessage);
      await this.handleNotification(remoteMessage);
    });
    this.unsubscribeHandlers.push(unsubForeground);
    
    // Background/Quit message opened
    messaging().onNotificationOpenedApp((remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[PushNotifications] Notification opened:', remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });
    
    // Check if app was opened from notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
        if (remoteMessage) {
          console.log('[PushNotifications] Initial notification:', remoteMessage);
          this.handleNotificationOpen(remoteMessage);
        }
      });
    
    // Token refresh
    const unsubToken = messaging().onTokenRefresh((token: string) => {
      console.log('[PushNotifications] Token refreshed');
      AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    });
    this.unsubscribeHandlers.push(unsubToken);
  }

  /**
   * Handle incoming notification
   */
  private async handleNotification(
    message: FirebaseMessagingTypes.RemoteMessage,
  ): Promise<void> {
    const notification: PushNotification = {
      id: message.messageId || `notif_${Date.now()}`,
      title: message.notification?.title || 'GoShopperAI',
      body: message.notification?.body || '',
      data: message.data as Record<string, string>,
      receivedAt: new Date(),
      read: false,
    };
    
    // Save to local storage
    await this.saveNotification(notification);
    
    // Notify listeners
    this.listeners.forEach(callback => callback(notification));
  }

  /**
   * Handle notification open (user tapped)
   */
  private handleNotificationOpen(
    message: FirebaseMessagingTypes.RemoteMessage,
  ): void {
    // Handle navigation based on data
    const data = message.data;
    
    if (data) {
      switch (data.type) {
        case 'price_alert':
          // Navigate to price alerts screen
          console.log('[PushNotifications] Navigate to price alerts');
          break;
        case 'weekly_summary':
          // Navigate to stats screen
          console.log('[PushNotifications] Navigate to stats');
          break;
        case 'receipt':
          // Navigate to receipt detail
          console.log('[PushNotifications] Navigate to receipt:', data.receiptId);
          break;
        default:
          // Navigate to home
          console.log('[PushNotifications] Navigate to home');
      }
    }
  }

  /**
   * Save notification to local storage
   */
  private async saveNotification(notification: PushNotification): Promise<void> {
    try {
      const key = '@goshopperai/notifications';
      const data = await AsyncStorage.getItem(key);
      const notifications = data ? JSON.parse(data) : [];
      
      // Add new notification at the beginning
      notifications.unshift(notification);
      
      // Keep only last 50 notifications
      const trimmed = notifications.slice(0, 50);
      
      await AsyncStorage.setItem(key, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[PushNotifications] Save notification error:', error);
    }
  }

  /**
   * Get all saved notifications
   */
  async getNotifications(): Promise<PushNotification[]> {
    try {
      const key = '@goshopperai/notifications';
      const data = await AsyncStorage.getItem(key);
      
      if (!data) return [];
      
      return JSON.parse(data).map((n: PushNotification) => ({
        ...n,
        receivedAt: new Date(n.receivedAt),
      }));
    } catch (error) {
      console.error('[PushNotifications] Get notifications error:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const key = '@goshopperai/notifications';
      const data = await AsyncStorage.getItem(key);
      
      if (!data) return;
      
      const notifications = JSON.parse(data);
      const updated = notifications.map((n: PushNotification) =>
        n.id === notificationId ? {...n, read: true} : n,
      );
      
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('[PushNotifications] Mark as read error:', error);
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    const notifications = await this.getNotifications();
    return notifications.filter(n => !n.read).length;
  }

  /**
   * Clear all notifications
   */
  async clearNotifications(): Promise<void> {
    await AsyncStorage.removeItem('@goshopperai/notifications');
  }

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
      
      if (!data) {
        return {
          priceAlerts: true,
          weeklySummary: true,
          newFeatures: true,
          promotions: false,
        };
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.error('[PushNotifications] Get preferences error:', error);
      return {
        priceAlerts: true,
        weeklySummary: true,
        newFeatures: true,
        promotions: false,
      };
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    try {
      const current = await this.getPreferences();
      const updated = {...current, ...prefs};
      await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[PushNotifications] Update preferences error:', error);
    }
  }

  /**
   * Subscribe to incoming notifications
   */
  subscribe(callback: NotificationCallback): () => void {
    this.listeners.push(callback);
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Get FCM token
   */
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(FCM_TOKEN_KEY);
  }

  /**
   * Trigger achievement notification
   */
  async triggerAchievementNotification(achievementTitle: string, language: string = 'fr'): Promise<void> {
    try {
      await functions().httpsCallable('sendAchievementNotification')({
        achievementId: achievementTitle.toLowerCase().replace(/\s+/g, '_'),
        achievementTitle,
        language,
      });
    } catch (error) {
      console.error('[PushNotifications] Achievement notification error:', error);
    }
  }

  /**
   * Trigger sync complete notification
   */
  async triggerSyncCompleteNotification(syncedCount: number, language: string = 'fr'): Promise<void> {
    try {
      await functions().httpsCallable('sendSyncCompleteNotification')({
        syncedCount,
        language,
      });
    } catch (error) {
      console.error('[PushNotifications] Sync notification error:', error);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
