/**
 * @format
 * 
 * PUSH NOTIFICATIONS - BACKGROUND DELIVERY SETUP
 * ================================================
 * This file configures notifications to work even when the app is CLOSED/KILLED.
 * 
 * Key Components:
 * 1. messaging().setBackgroundMessageHandler() - Handles FCM messages when app is closed
 * 2. notifee.onBackgroundEvent() - Handles notification interactions when app is closed
 * 3. iOS: UIBackgroundModes in Info.plist enables background notification delivery
 * 4. Android: POST_NOTIFICATIONS permission in AndroidManifest.xml
 * 
 * How it works:
 * - When the app is CLOSED: Firebase Cloud Messaging wakes up the background handler
 * - The handler displays the notification using notifee
 * - User can tap the notification to open the app
 * - All notification data is saved locally for when the app reopens
 * 
 * Testing:
 * - Send test notification from Firebase Console with the app completely closed
 * - Notification should appear on the device
 * - Tapping it should open the app
 */

// CRITICAL: This must be at the very top before any other imports
import 'react-native-gesture-handler';

import {AppRegistry, LogBox} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, {EventType, AndroidImportance} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Suppress known React Native Firebase warning
// This is a harmless warning from React Native Firebase with React Native 0.73+
// The Firebase SDK properly implements removeListeners internally
LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
]);
import App from './App';
import {name as appName} from './app.json';

const READ_NOTIFICATIONS_KEY = '@goshopperai/read_notifications';

// Helper to mark notification as read
const markNotificationAsRead = async (notificationId) => {
  if (!notificationId) return;
  try {
    const stored = await AsyncStorage.getItem(READ_NOTIFICATIONS_KEY);
    const readIds = stored ? JSON.parse(stored) : [];
    if (!readIds.includes(notificationId)) {
      readIds.push(notificationId);
      const trimmed = readIds.slice(-100);
      await AsyncStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(trimmed));
    }
    console.log('[Background] Marked as read:', notificationId);
  } catch (error) {
    console.error('[Background] Failed to mark as read:', error);
  }
};

// ========================================
// FIREBASE MESSAGING BACKGROUND HANDLER
// ========================================
// This is CRITICAL for receiving notifications when the app is closed/killed
// Must be registered BEFORE AppRegistry.registerComponent
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[Background] Message received when app closed:', remoteMessage);

  try {
    // Extract notification data
    const title = remoteMessage.notification?.title || 'GoShopper';
    const body = remoteMessage.notification?.body || '';
    const data = remoteMessage.data || {};
    const messageId = remoteMessage.messageId || `notif_${Date.now()}`;

    // Determine which channel to use
    let channelId = 'general';
    if (data.channelId) {
      channelId = data.channelId;
    } else if (data.type === 'scan_complete') {
      channelId = 'receipts';
    } else if (data.type === 'price_alert') {
      channelId = 'price_alerts';
    }

    // Create channel if it doesn't exist
    const channelConfigs = {
      general: {
        id: 'general',
        name: 'Général',
        importance: AndroidImportance.DEFAULT,
      },
      receipts: {
        id: 'receipts',
        name: 'Reçus et Scans',
        importance: AndroidImportance.HIGH,
      },
      price_alerts: {
        id: 'price_alerts',
        name: 'Alertes de Prix',
        importance: AndroidImportance.HIGH,
      },
      achievements: {
        id: 'achievements',
        name: 'Accomplissements',
        importance: AndroidImportance.DEFAULT,
      },
    };

    const channelConfig = channelConfigs[channelId] || channelConfigs.general;
    await notifee.createChannel(channelConfig);

    // Display notification using notifee
    await notifee.displayNotification({
      id: messageId,
      title,
      body,
      data,
      android: {
        channelId: channelConfig.id,
        importance: channelConfig.importance,
        pressAction: {
          id: 'default',
        },
        smallIcon: 'ic_notification',
        color: '#FDB913',
        showTimestamp: true,
        actions: [
          {
            title: 'Marquer comme lu',
            pressAction: {id: 'mark_as_read'},
          },
        ],
      },
      ios: {
        sound: 'default',
        categoryId: 'default',
      },
    });

    // Save notification to local storage for in-app display
    try {
      const key = '@goshopperai/notifications';
      const stored = await AsyncStorage.getItem(key);
      const notifications = stored ? JSON.parse(stored) : [];

      notifications.unshift({
        id: messageId,
        title,
        body,
        data,
        receivedAt: new Date().toISOString(),
        read: false,
      });

      // Keep only last 50 notifications
      const trimmed = notifications.slice(0, 50);
      await AsyncStorage.setItem(key, JSON.stringify(trimmed));
    } catch (storageError) {
      console.error('[Background] Failed to save notification:', storageError);
    }

    console.log('[Background] Notification displayed successfully');
  } catch (error) {
    console.error('[Background] Failed to handle background message:', error);
  }
});

// Register background event handler for notifee
// This is required to handle notification events when the app is in background/killed state
notifee.onBackgroundEvent(async ({type, detail}) => {
  console.log('Background notification event:', type, detail);
  const {notification, pressAction} = detail;

  switch (type) {
    case EventType.DISMISSED:
      console.log('User dismissed notification', notification?.id);
      break;
    case EventType.PRESS:
      console.log('User pressed notification', notification?.id);
      // Mark as read when user taps the notification
      await markNotificationAsRead(notification?.id);
      break;
    case EventType.ACTION_PRESS:
      console.log('User pressed action:', pressAction?.id);
      // Handle mark as read action
      if (pressAction?.id === 'mark_as_read') {
        await markNotificationAsRead(notification?.id);
        // Cancel the notification after marking as read
        if (notification?.id) {
          await notifee.cancelNotification(notification.id);
        }
      }
      break;
    default:
      break;
  }
});

AppRegistry.registerComponent(appName, () => App);
