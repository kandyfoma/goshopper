/**
 * Push Notification Service
 * Handles FCM token registration and notification handling
 */

import messaging, {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import {Platform, Alert, Linking} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {COLLECTIONS} from './firebase/config';

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('❌ Notification permission denied');
        return false;
      }
    }

    console.log('✅ Notification permission granted');
    return true;
  } catch (error) {
    console.error('Request notification permission error:', error);
    return false;
  }
}

/**
 * Get FCM token
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Check if device supports FCM
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    return token;
  } catch (error) {
    console.error('Get FCM token error:', error);
    return null;
  }
}

/**
 * Save FCM token to Firestore
 * Uses correct path: artifacts/goshopper/users/{userId}
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
  try {
    // Use the correct collection path that matches Cloud Functions
    const userRef = firestore().doc(COLLECTIONS.users(userId));

    await userRef.set({
      fcmToken: token,
      fcmTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
      notificationsEnabled: true,
      platform: Platform.OS,
      deviceInfo: {
        os: Platform.OS,
        version: Platform.Version,
      },
    }, { merge: true });

    console.log('✅ FCM token saved to Firestore at:', COLLECTIONS.users(userId));
  } catch (error) {
    console.error('Save FCM token error:', error);
  }
}

/**
 * Initialize push notifications
 */
export async function initializePushNotifications(userId: string): Promise<void> {
  try {
    // Request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return;
    }

    // Get FCM token
    const token = await getFCMToken();
    if (!token) {
      return;
    }

    // Save token to Firestore
    await saveFCMToken(userId, token);

    // Handle token refresh
    messaging().onTokenRefresh(async newToken => {
      await saveFCMToken(userId, newToken);
    });
  } catch (error) {
    console.error('Initialize push notifications error:', error);
  }
}

/**
 * Handle foreground notifications
 */
export function setupForegroundNotificationHandler(
  onNotification: (notification: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  const unsubscribe = messaging().onMessage(async remoteMessage => {
    console.log('📬 Foreground notification:', remoteMessage);

    // Update notification engagement metrics
    try {
      const userId = remoteMessage.data?.userId;
      if (userId && typeof userId === 'string') {
        await firestore()
          .doc(COLLECTIONS.users(userId))
          .update({
            pushNotificationsReceived: firestore.FieldValue.increment(1),
          });
      }
    } catch (error) {
      console.error('Update notification metrics error:', error);
    }

    // Show alert for foreground notifications
    Alert.alert(
      remoteMessage.notification?.title || 'Notification',
      remoteMessage.notification?.body || '',
      [
        {
          text: 'Dismiss',
          style: 'cancel',
          onPress: async () => {
            // Track dismissal
            const userId = remoteMessage.data?.userId;
            if (userId && typeof userId === 'string') {
              await firestore()
                .doc(COLLECTIONS.users(userId))
                .update({
                  pushNotificationDismissed: firestore.FieldValue.increment(1),
                });
            }
          },
        },
        {
          text: 'View',
          onPress: async () => {
            // Track open
            const userId = remoteMessage.data?.userId;
            if (userId && typeof userId === 'string') {
              await firestore()
                .doc(COLLECTIONS.users(userId))
                .update({
                  pushNotificationsOpened: firestore.FieldValue.increment(1),
                });
            }
            onNotification(remoteMessage);
          },
        },
      ],
    );
  });

  return unsubscribe;
}

/**
 * Handle background/quit state notification tap
 */
export function setupBackgroundNotificationHandler(
  onNotificationTap: (notification: FirebaseMessagingTypes.RemoteMessage) => void,
): void {
  // Background state
  messaging().onNotificationOpenedApp(async remoteMessage => {
    console.log('📬 Notification opened app (background):', remoteMessage);

    // Track notification opened
    const userId = remoteMessage.data?.userId;
    if (userId && typeof userId === 'string') {
      await firestore()
        .doc(COLLECTIONS.users(userId))
        .update({
          pushNotificationsOpened: firestore.FieldValue.increment(1),
        });
    }

    onNotificationTap(remoteMessage);
  });

  // Quit state (app was closed)
  messaging()
    .getInitialNotification()
    .then(async remoteMessage => {
      if (remoteMessage) {
        console.log('📬 Notification opened app (quit):', remoteMessage);

        // Track notification opened
        const userId = remoteMessage.data?.userId;
        if (userId && typeof userId === 'string') {
          await firestore()
            .doc(COLLECTIONS.users(userId))
            .update({
              pushNotificationsOpened: firestore.FieldValue.increment(1),
            });
        }

        onNotificationTap(remoteMessage);
      }
    });
}

/**
 * Handle notification actions based on type
 */
export function handleNotificationAction(
  notification: FirebaseMessagingTypes.RemoteMessage,
  navigation: any,
): void {
  const {data} = notification;

  if (!data) return;

  const notificationType = data.type;

  switch (notificationType) {
    case 'grace_period_reminder':
    case 'subscription_expiring':
    case 'trial_expiring':
    case 'plan_downgrade':
      navigation.navigate('Subscription');
      break;

    case 'scan_limit_80':
    case 'scan_limit_90':
    case 'scan_limit_reached':
      if (data.action === 'upgrade') {
        navigation.navigate('Subscription');
      } else {
        navigation.navigate('Home');
      }
      break;

    case 'payment_success':
    case 'payment_failed':
    case 'auto_renewal_success':
      navigation.navigate('Subscription');
      break;

    case 'price_alert':
      navigation.navigate('Items');
      break;

    case 'monthly_summary':
      // Navigate to stats if user has access
      navigation.navigate('Home');
      break;

    case 'feature_unlock':
      navigation.navigate('Home');
      break;

    case 'savings_tip':
      navigation.navigate('Home');
      break;

    case 'achievement':
      navigation.navigate('Profile');
      break;

    case 'sync_complete':
      navigation.navigate('Home');
      break;

    default:
      console.log('Unknown notification type:', notificationType);
      navigation.navigate('Home');
  }
}

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const authStatus = await messaging().hasPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    return enabled;
  } catch (error) {
    console.error('Check notification permission error:', error);
    return false;
  }
}

/**
 * Open device notification settings
 */
export async function openNotificationSettings(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  } catch (error) {
    console.error('Open notification settings error:', error);
  }
}

/**
 * Disable notifications for user
 */
export async function disableNotifications(userId: string): Promise<void> {
  try {
    await firestore()
      .doc(COLLECTIONS.users(userId))
      .update({
        notificationsEnabled: false,
        fcmToken: null,
      });

    console.log('✅ Notifications disabled');
  } catch (error) {
    console.error('Disable notifications error:', error);
  }
}
