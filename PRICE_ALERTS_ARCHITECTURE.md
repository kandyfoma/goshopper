# Price Alerts Architecture for Premium Users

## Overview
A comprehensive system to notify premium users about price drops on items they're interested in, integrated with the existing cityItems data structure.

## Data Structure

### 1. User Watch List (User-Item Relationship)
**Collection**: `artifacts/{appId}/users/{userId}/watchedItems`

```typescript
interface WatchedItem {
  id: string;                    // Document ID = cityItem normalized name
  userId: string;                // User ID
  itemName: string;              // Display name (e.g., "Sprite 330ml")
  itemNameNormalized: string;    // Normalized name matching cityItem ID
  city: string;                  // City for price tracking
  
  // Alert Settings
  alertType: 'any_drop' | 'threshold' | 'percentage';
  targetPrice?: number;          // For 'threshold' type
  percentageDrop?: number;       // For 'percentage' type (e.g., 10 for 10%)
  
  // Current State
  baselinePrice: number;         // Price when user started watching
  lastNotifiedPrice: number;     // Last price that triggered notification
  currentPrice: number;          // Current lowest price
  currentStore: string;          // Store with current lowest price
  
  // Notification History
  notificationCount: number;     // Number of notifications sent
  lastNotificationSent: Date;    // Last notification timestamp
  cooldownUntil?: Date;          // Don't notify again until this time
  
  // Metadata
  isActive: boolean;             // User can pause/resume alerts
  createdAt: Date;
  updatedAt: Date;
}
```

**Example Document**:
```json
{
  "id": "sprite330ml",
  "userId": "user123",
  "itemName": "Sprite 330ml",
  "itemNameNormalized": "sprite330ml",
  "city": "Kinshasa",
  "alertType": "percentage",
  "percentageDrop": 10,
  "baselinePrice": 2.50,
  "lastNotifiedPrice": 2.50,
  "currentPrice": 2.25,
  "currentStore": "Kin Marché",
  "notificationCount": 1,
  "lastNotificationSent": "2025-12-27T10:30:00Z",
  "cooldownUntil": "2025-12-28T10:30:00Z",
  "isActive": true,
  "createdAt": "2025-12-20T08:00:00Z",
  "updatedAt": "2025-12-27T10:30:00Z"
}
```

### 2. Notification Cooldown Settings
- **24-hour cooldown**: Prevent spam notifications for same item
- **Max notifications per day**: Limit to 5 price drop notifications per user per day
- **Quiet hours**: No notifications between 10 PM - 7 AM

### 3. Premium Feature Check
```typescript
// Check if user has premium subscription
const hasPremium = subscription?.tier === 'premium' || subscription?.tier === 'gold';
```

## Implementation

### Step 1: Firebase Functions - Price Drop Monitor

**File**: `functions/src/alerts/watchedItemsMonitor.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Monitor cityItems for price changes
 * Triggered when cityItem is updated
 */
export const monitorCityItemPrices = functions
  .region('europe-west1')
  .firestore
  .document('artifacts/{appId}/cityItems/{city}/items/{itemId}')
  .onUpdate(async (change, context) => {
    const {appId, city, itemId} = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    // Check if minPrice changed
    const oldMinPrice = beforeData.minPrice;
    const newMinPrice = afterData.minPrice;
    
    if (!newMinPrice || newMinPrice >= oldMinPrice) {
      // No price drop, exit early
      return null;
    }
    
    const priceDrop = oldMinPrice - newMinPrice;
    const priceDropPercentage = (priceDrop / oldMinPrice) * 100;
    
    console.log(`💰 Price drop detected for ${itemId} in ${city}: ${oldMinPrice} → ${newMinPrice} (-${priceDropPercentage.toFixed(1)}%)`);
    
    try {
      // Find all users watching this item in this city
      const watchedItemsSnapshot = await db
        .collectionGroup('watchedItems')
        .where('itemNameNormalized', '==', itemId)
        .where('city', '==', city)
        .where('isActive', '==', true)
        .get();
      
      if (watchedItemsSnapshot.empty) {
        console.log('No users watching this item');
        return null;
      }
      
      const notifications: Array<{
        userId: string;
        watchedItemId: string;
        itemName: string;
        oldPrice: number;
        newPrice: number;
        storeName: string;
        dropPercentage: number;
      }> = [];
      
      const batch = db.batch();
      const now = new Date();
      
      for (const doc of watchedItemsSnapshot.docs) {
        const watchedItem = doc.data();
        const userId = watchedItem.userId;
        
        // Check premium status
        const userDoc = await db.doc(`artifacts/${appId}/users/${userId}`).get();
        const userData = userDoc.data();
        const subscription = userData?.subscription;
        const hasPremium = subscription?.tier === 'premium' || subscription?.tier === 'gold';
        
        if (!hasPremium) {
          console.log(`User ${userId} is not premium, skipping notification`);
          continue;
        }
        
        // Check cooldown
        if (watchedItem.cooldownUntil && watchedItem.cooldownUntil.toDate() > now) {
          console.log(`User ${userId} in cooldown period, skipping`);
          continue;
        }
        
        // Check notification limit (max 5 per day)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const notificationsToday = await db
          .collection(`artifacts/${appId}/users/${userId}/notifications`)
          .where('type', '==', 'price_drop')
          .where('timestamp', '>=', todayStart)
          .count()
          .get();
        
        if (notificationsToday.data().count >= 5) {
          console.log(`User ${userId} reached daily notification limit`);
          continue;
        }
        
        // Check quiet hours (10 PM - 7 AM)
        const hour = now.getHours();
        if (hour >= 22 || hour < 7) {
          console.log(`Quiet hours, will retry later`);
          continue;
        }
        
        // Check if alert conditions are met
        let shouldNotify = false;
        
        switch (watchedItem.alertType) {
          case 'any_drop':
            shouldNotify = newMinPrice < watchedItem.lastNotifiedPrice;
            break;
          case 'threshold':
            shouldNotify = newMinPrice <= watchedItem.targetPrice;
            break;
          case 'percentage':
            const dropFromBaseline = ((watchedItem.baselinePrice - newMinPrice) / watchedItem.baselinePrice) * 100;
            shouldNotify = dropFromBaseline >= watchedItem.percentageDrop;
            break;
        }
        
        if (!shouldNotify) {
          // Update current price but don't notify
          batch.update(doc.ref, {
            currentPrice: newMinPrice,
            currentStore: afterData.stores?.[0]?.name || 'Unknown',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          continue;
        }
        
        // Add to notification queue
        notifications.push({
          userId,
          watchedItemId: doc.id,
          itemName: watchedItem.itemName,
          oldPrice: watchedItem.lastNotifiedPrice,
          newPrice: newMinPrice,
          storeName: afterData.stores?.[0]?.name || 'Unknown',
          dropPercentage: priceDropPercentage,
        });
        
        // Update watchedItem
        batch.update(doc.ref, {
          currentPrice: newMinPrice,
          currentStore: afterData.stores?.[0]?.name || 'Unknown',
          lastNotifiedPrice: newMinPrice,
          notificationCount: admin.firestore.FieldValue.increment(1),
          lastNotificationSent: admin.firestore.FieldValue.serverTimestamp(),
          cooldownUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      
      await batch.commit();
      
      // Send notifications
      if (notifications.length > 0) {
        await sendPriceDropNotifications(appId, notifications);
      }
      
      console.log(`✅ Processed ${watchedItemsSnapshot.size} watchers, sent ${notifications.length} notifications`);
      return null;
      
    } catch (error) {
      console.error('Error monitoring price:', error);
      return null;
    }
  });

/**
 * Send price drop notifications
 */
async function sendPriceDropNotifications(
  appId: string,
  notifications: Array<{
    userId: string;
    watchedItemId: string;
    itemName: string;
    oldPrice: number;
    newPrice: number;
    storeName: string;
    dropPercentage: number;
  }>
): Promise<void> {
  for (const notif of notifications) {
    try {
      const userDoc = await db.doc(`artifacts/${appId}/users/${notif.userId}`).get();
      const fcmToken = userDoc.data()?.fcmToken;
      
      if (!fcmToken) {
        console.log(`No FCM token for user ${notif.userId}`);
        continue;
      }
      
      const priceSavings = notif.oldPrice - notif.newPrice;
      const title = '💰 Baisse de prix!';
      const body = `${notif.itemName} : ${notif.oldPrice.toFixed(2)}$ → ${notif.newPrice.toFixed(2)}$ (-${notif.dropPercentage.toFixed(0)}%) chez ${notif.storeName}`;
      
      // Send push notification
      await admin.messaging().send({
        token: fcmToken,
        notification: {title, body},
        data: {
          type: 'price_drop',
          itemId: notif.watchedItemId,
          itemName: notif.itemName,
          oldPrice: notif.oldPrice.toString(),
          newPrice: notif.newPrice.toString(),
          storeName: notif.storeName,
          savings: priceSavings.toFixed(2),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'price_drops',
            icon: 'ic_notification',
            color: '#10b981',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
              alert: {title, body},
            },
          },
        },
      });
      
      // Save notification to Firestore
      await db.collection(`artifacts/${appId}/users/${notif.userId}/notifications`).add({
        title,
        body,
        type: 'price_drop',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        data: {
          itemId: notif.watchedItemId,
          itemName: notif.itemName,
          oldPrice: notif.oldPrice,
          newPrice: notif.newPrice,
          storeName: notif.storeName,
          savings: priceSavings,
          dropPercentage: notif.dropPercentage,
        },
      });
      
      console.log(`📱 Notification sent to user ${notif.userId} for ${notif.itemName}`);
      
    } catch (error) {
      console.error(`Failed to send notification to ${notif.userId}:`, error);
    }
  }
}
```

### Step 2: Client Service - Watched Items

**File**: `src/shared/services/firebase/watchedItems.ts`

```typescript
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from './config';

const WATCHED_ITEMS_COLLECTION = (userId: string) =>
  `artifacts/${APP_ID}/users/${userId}/watchedItems`;

export interface WatchedItemInput {
  itemName: string;
  itemNameNormalized: string;
  city: string;
  alertType: 'any_drop' | 'threshold' | 'percentage';
  targetPrice?: number;
  percentageDrop?: number;
  currentPrice: number;
  currentStore: string;
}

export class WatchedItemsService {
  /**
   * Add item to watch list
   */
  async watchItem(userId: string, input: WatchedItemInput) {
    const docRef = firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .doc(input.itemNameNormalized);
    
    const existing = await docRef.get();
    
    if (existing.exists) {
      // Update existing
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
      // Create new
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
  }
  
  /**
   * Remove item from watch list
   */
  async unwatchItem(userId: string, itemNameNormalized: string) {
    await firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .doc(itemNameNormalized)
      .delete();
  }
  
  /**
   * Get all watched items
   */
  async getWatchedItems(userId: string) {
    const snapshot = await firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));
  }
  
  /**
   * Check if item is watched
   */
  async isWatching(userId: string, itemNameNormalized: string): Promise<boolean> {
    const doc = await firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .doc(itemNameNormalized)
      .get();
    
    return doc.exists && doc.data()?.isActive === true;
  }
  
  /**
   * Toggle item watch status
   */
  async toggleWatch(userId: string, itemNameNormalized: string, isActive: boolean) {
    await firestore()
      .collection(WATCHED_ITEMS_COLLECTION(userId))
      .doc(itemNameNormalized)
      .update({
        isActive,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }
}

export const watchedItemsService = new WatchedItemsService();
```

### Step 3: UI Component - Watch Button

Add this to CityItemsScreen or ItemDetailsScreen:

```typescript
import {watchedItemsService} from '@/shared/services/firebase/watchedItems';
import {useSubscription} from '@/shared/contexts';

function WatchItemButton({item, city}: {item: CityItem; city: string}) {
  const {subscription} = useSubscription();
  const {user} = useAuth();
  const [isWatching, setIsWatching] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  
  const hasPremium = subscription?.tier === 'premium' || subscription?.tier === 'gold';
  
  useEffect(() => {
    if (user?.uid) {
      watchedItemsService
        .isWatching(user.uid, item.nameNormalized)
        .then(setIsWatching);
    }
  }, [user?.uid, item.nameNormalized]);
  
  const handleWatch = async () => {
    if (!hasPremium) {
      // Show premium upgrade modal
      navigation.navigate('Subscription');
      return;
    }
    
    setShowAlertModal(true);
  };
  
  const handleSetAlert = async (alertType: string, value?: number) => {
    if (!user?.uid) return;
    
    await watchedItemsService.watchItem(user.uid, {
      itemName: item.name,
      itemNameNormalized: item.nameNormalized,
      city,
      alertType: alertType as any,
      targetPrice: alertType === 'threshold' ? value : undefined,
      percentageDrop: alertType === 'percentage' ? value : undefined,
      currentPrice: item.minPrice,
      currentStore: item.stores?.[0]?.name || 'Unknown',
    });
    
    setIsWatching(true);
    setShowAlertModal(false);
    showToast('Alerte de prix activée!', 'success');
  };
  
  return (
    <TouchableOpacity onPress={handleWatch}>
      <Icon 
        name={isWatching ? 'bell' : 'bell-off'} 
        color={isWatching ? Colors.primary : Colors.text.tertiary}
      />
    </TouchableOpacity>
  );
}
```

## Benefits

1. **Direct Integration**: Uses existing cityItems data structure
2. **Real-time**: Triggers immediately when prices update
3. **Premium Feature**: Natural upsell opportunity
4. **Smart Notifications**: Cooldown periods prevent spam
5. **Flexible Alerts**: Three alert types (any drop, threshold, percentage)
6. **Scalable**: Collection group queries for efficient monitoring

## Next Steps

1. Deploy Firebase Functions
2. Add WatchedItemsService to app
3. Add watch/unwatch buttons to item screens
4. Test with real price updates
5. Monitor notification delivery rates
6. Add analytics tracking for feature usage
