/**
 * @format
 */

// CRITICAL: This must be at the very top before any other imports
import 'react-native-gesture-handler';

import {AppRegistry, LogBox} from 'react-native';
import notifee, {EventType} from '@notifee/react-native';
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
