// Notifications Screen - View and manage push notifications
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import {useAuth} from '@/shared/contexts';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {formatDistanceToNow} from 'date-fns';
import {fr} from 'date-fns/locale';
import {safeToDate} from '@/shared/utils/helpers';
import {APP_ID} from '@/shared/services/firebase/config';

interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  type?: 'price_alert' | 'receipt' | 'achievement' | 'general';
  data?: any;
}

export function NotificationsScreen() {
  const navigation = useNavigation();
  const {user} = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // Fetch notifications from Firestore
    const unsubscribe = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(user.uid)
      .collection('notifications')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot(
        snapshot => {
          const notifs: Notification[] = snapshot.docs
            .filter(doc => doc.exists && doc.data())
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              timestamp: safeToDate(doc.data()!.timestamp) || new Date(),
            })) as Notification[];
          setNotifications(notifs);
          setLoading(false);
        },
        error => {
          console.error('Error fetching notifications:', error);
          setLoading(false);
        },
      );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleDeleteAll = () => {
    Alert.alert(
      'Supprimer toutes les notifications',
      'Êtes-vous sûr de vouloir supprimer toutes les notifications ?',
      [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user?.uid) return;

              const batch = firestore().batch();
              const notifRef = firestore()
                .collection('artifacts')
                .doc(APP_ID)
                .collection('users')
                .doc(user.uid)
                .collection('notifications');

              // Delete all notifications in batches
              const snapshot = await notifRef.get();
              snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
              });

              await batch.commit();
              setNotifications([]);
            } catch (error) {
              console.error('Error deleting notifications:', error);
              Alert.alert('Erreur', 'Impossible de supprimer les notifications');
            }
          },
        },
      ],
    );
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      if (!user?.uid) return;

      await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(user.uid)
        .collection('notifications')
        .doc(notificationId)
        .update({read: true});
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'price_alert') {
      (navigation as any).push('PriceAlerts');
    } else if (notification.type === 'receipt' && notification.data?.receiptId) {
      (navigation as any).push('ReceiptDetail', {
        receiptId: notification.data.receiptId,
      });
    } else if (notification.type === 'achievement') {
      (navigation as any).push('Achievements');
    }
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'price_alert':
        return 'bell';
      case 'receipt':
        return 'receipt';
      case 'achievement':
        return 'trophy';
      default:
        return 'message';
    }
  };

  const getNotificationColor = (type?: string) => {
    switch (type) {
      case 'price_alert':
        return Colors.card.crimson;
      case 'receipt':
        return Colors.card.blue;
      case 'achievement':
        return Colors.card.yellow;
      default:
        return Colors.card.cosmos;
    }
  };

  const renderNotification = ({item}: {item: Notification}) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}>
      <View
        style={[
          styles.iconContainer,
          {backgroundColor: getNotificationColor(item.type)},
        ]}>
        <Icon
          name={getNotificationIcon(item.type)}
          size="sm"
          color={Colors.white}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.title, !item.read && styles.unreadTitle]}>
          {item.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.timestamp}>
          {formatDistanceToNow(item.timestamp, {
            addSuffix: true,
            locale: fr,
          })}
        </Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="bell" size="lg" color={Colors.text.tertiary} />
      </View>
      <Text style={styles.emptyTitle}>Aucune notification</Text>
      <Text style={styles.emptySubtitle}>
        Vous n'avez pas encore reçu de notifications
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size="md" color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity
            style={styles.deleteAllButton}
            onPress={handleDeleteAll}>
            <Text style={styles.deleteAllText}>Tout supprimer</Text>
          </TouchableOpacity>
        )}
        {notifications.length === 0 && <View style={styles.headerSpacer} />}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  deleteAllButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  deleteAllText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.status.error,
  },
  headerSpacer: {
    width: 80,
  },
  listContent: {
    padding: Spacing.md,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  unreadCard: {
    backgroundColor: Colors.background.secondary,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  notificationContent: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  unreadTitle: {
    fontWeight: Typography.fontWeight.bold,
  },
  body: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.xs,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
