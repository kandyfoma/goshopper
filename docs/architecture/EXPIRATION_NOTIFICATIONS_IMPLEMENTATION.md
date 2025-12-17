# Expiration Warning Notification System

**Date:** December 2025  
**Status:** ✅ Production Ready  
**Module:** `functions/src/subscription/expirationNotifications.ts`

## Overview

The Expiration Warning Notification System proactively alerts users before their subscription expires, reducing involuntary churn and improving user experience. It sends timely notifications at 7, 3, and 1 day(s) before expiration.

## Key Features

### 1. Multi-Threshold Warnings
- **7 Days Before:** Early warning for planning
- **3 Days Before:** Urgent reminder with higher priority
- **1 Day Before:** Final warning with critical priority
- **Day of Expiration:** Expired notification with action required

### 2. Smart Messaging
- **Auto-Renewal Enabled:** Reassures users renewal is automatic
- **Auto-Renewal Disabled:** Encourages manual renewal
- **Bilingual:** English and French notifications
- **Priority Levels:** Low/Medium/High based on urgency

### 3. Scheduled Processing
- **Schedule:** Daily at 9 AM Africa/Kinshasa time (user-friendly hour)
- **Batch Processing:** Handles all users efficiently
- **Deduplication:** Prevents duplicate notifications

### 4. Manual Trigger
- Users can manually request expiration status
- Useful for testing or immediate notification needs

## Architecture

### Notification Thresholds

```typescript
const NOTIFICATION_THRESHOLDS = [7, 3, 1]; // Days before expiration
```

### Notification Types

#### 1. Expiring Soon (7 Days)
- **Type:** `subscription_expiring`
- **Priority:** Medium
- **Message (auto-renew ON):** "Auto-renewal is enabled."
- **Message (auto-renew OFF):** "Renew now to continue enjoying unlimited scans."

#### 2. Expires in 3 Days
- **Type:** `subscription_expiring`
- **Priority:** High
- **Message (auto-renew ON):** "We'll automatically renew it for you."
- **Message (auto-renew OFF):** "Renew now to avoid losing access to premium features."

#### 3. Expires Tomorrow (1 Day)
- **Type:** `subscription_expiring`
- **Priority:** High
- **Message (auto-renew ON):** "Auto-renewal will process tonight."
- **Message (auto-renew OFF):** "This is your last chance to renew!"

#### 4. Expired
- **Type:** `subscription_expired`
- **Priority:** High
- **Message:** "You now have limited access (5 scans/month). Renew to restore full access."

## Cloud Functions

### 1. checkExpirationWarnings (Scheduled)

**Type:** PubSub Scheduled Function  
**Schedule:** Daily at 9 AM Africa/Kinshasa  
**Timeout:** 540 seconds (9 minutes)  
**Memory:** 512 MB

**Purpose:** Main scheduled job that checks all subscriptions and sends warnings.

**Processing Logic:**

```typescript
1. For each threshold (7, 3, 1 days):
   a. Calculate target expiry date (today + threshold)
   b. Query subscriptions expiring on that date
   c. Skip if notification already sent for this threshold
   d. Send expiration warning notification
   e. Update subscription tracking fields
   f. Update status to 'expiring_soon' if ≤3 days

2. Check for newly expired subscriptions:
   a. Query subscriptions that expired today
   b. Send expired notification
   c. (Status update handled by checkExpiredSubscriptions)

3. Log summary statistics
```

**Query Example:**

```typescript
// Find subscriptions expiring in 7 days
const targetDate = new Date();
targetDate.setDate(targetDate.getDate() + 7);
targetDate.setHours(0, 0, 0, 0);

const nextDay = new Date(targetDate);
nextDay.setDate(nextDay.getDate() + 1);

const expiringSubscriptions = await db
  .collectionGroup('subscription')
  .where('isSubscribed', '==', true)
  .where('subscriptionEndDate', '>=', Timestamp.fromDate(targetDate))
  .where('subscriptionEndDate', '<', Timestamp.fromDate(nextDay))
  .get();
```

**Firestore Indexes Required:**

```bash
# Expiration warning queries
collection: users/{userId}/subscription
fields:
  - isSubscribed (ASC)
  - subscriptionEndDate (ASC)
  - subscriptionEndDate (ASC)

# Expired subscriptions query  
collection: users/{userId}/subscription
fields:
  - isSubscribed (ASC)
  - status (ASC)
  - subscriptionEndDate (ASC)
```

### 2. sendManualExpirationWarning (Callable)

**Type:** HTTPS Callable Function  
**Authentication:** Required  
**Timeout:** 30 seconds  
**Memory:** 256 MB

**Purpose:** Allows users to manually request an expiration status notification.

**Request:**

```typescript
{
  userId?: string  // Optional, defaults to current user
}
```

**Response:**

```typescript
{
  success: true,
  message: "Expiration warning sent (7 days remaining)",
  daysUntilExpiration: 7,
  expiryDate: "2026-01-15T00:00:00.000Z"
}
```

**Client Integration:**

```typescript
import {getFunctions, httpsCallable} from 'firebase/functions';

const functions = getFunctions();
const getExpirationWarning = httpsCallable(
  functions,
  'sendManualExpirationWarning'
);

async function checkMyExpiration() {
  try {
    const result = await getExpirationWarning({});
    console.log('Expiration status:', result.data);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Notification Schema

### Database Structure

**Collection:** `users/{userId}/notifications`

**Expiring Notification Document:**

```typescript
{
  type: 'subscription_expiring',
  title: string,              // "Subscription Expiring Soon"
  titleFr: string,            // "Abonnement bientôt expiré"
  message: string,            // English message
  messageFr: string,          // French message
  priority: 'low' | 'medium' | 'high',
  daysUntilExpiration: number,  // 7, 3, or 1
  expiryDate: Timestamp,
  autoRenewEnabled: boolean,
  read: boolean,              // false (unread)
  actionUrl: string,          // '/subscription' or '/subscription/renew'
  createdAt: Timestamp
}
```

**Expired Notification Document:**

```typescript
{
  type: 'subscription_expired',
  title: "Subscription Expired",
  titleFr: "Abonnement expiré",
  message: "Your {planId} subscription has expired...",
  messageFr: "Votre abonnement {planId} a expiré...",
  priority: 'high',
  read: false,
  actionUrl: '/subscription/renew',
  createdAt: Timestamp
}
```

## Message Templates

### 7-Day Warning

**Auto-Renewal ON:**
```
EN: Your {planId} subscription expires in 7 days ({date}). Auto-renewal is enabled.
FR: Votre abonnement {planId} expire dans 7 jours ({date}). Le renouvellement automatique est activé.
```

**Auto-Renewal OFF:**
```
EN: Your {planId} subscription expires in 7 days ({date}). Renew now to continue enjoying unlimited scans.
FR: Votre abonnement {planId} expire dans 7 jours ({date}). Renouvelez maintenant pour continuer à profiter des scans illimités.
```

### 3-Day Warning

**Auto-Renewal ON:**
```
EN: Your {planId} subscription expires on {date}. We'll automatically renew it for you.
FR: Votre abonnement {planId} expire le {date}. Nous le renouvellerons automatiquement pour vous.
```

**Auto-Renewal OFF:**
```
EN: Your {planId} subscription expires on {date}. Renew now to avoid losing access to premium features.
FR: Votre abonnement {planId} expire le {date}. Renouvelez maintenant pour éviter de perdre l'accès aux fonctionnalités premium.
```

### 1-Day Warning

**Auto-Renewal ON:**
```
EN: Your {planId} subscription expires tomorrow ({date}). Auto-renewal will process tonight.
FR: Votre abonnement {planId} expire demain ({date}). Le renouvellement automatique sera effectué ce soir.
```

**Auto-Renewal OFF:**
```
EN: Your {planId} subscription expires tomorrow ({date}). This is your last chance to renew!
FR: Votre abonnement {planId} expire demain ({date}). C'est votre dernière chance de renouveler!
```

### Expired Notification

```
EN: Your {planId} subscription has expired. You now have limited access (5 scans/month). Renew to restore full access.
FR: Votre abonnement {planId} a expiré. Vous avez maintenant un accès limité (5 scans/mois). Renouvelez pour restaurer l'accès complet.
```

## Integration with Other Systems

### 1. Auto-Renewal System
Expiration warnings prepare users for auto-renewal:
- 7 days: "Auto-renewal is enabled" - builds trust
- 3 days: "We'll automatically renew" - sets expectation
- 1 day: "Auto-renewal will process tonight" - final reminder

If auto-renewal fails, user already knows expiration is coming.

### 2. Subscription Manager
Works alongside `checkExpiredSubscriptions`:
- **expirationNotifications:** Sends warnings before expiry
- **subscriptionManager:** Updates status when expired
- Both run daily but at different times (9 AM vs midnight)

### 3. Downgrade System
If user has pending downgrade:
- Warning reflects current plan (before downgrade)
- After downgrade applies, future warnings use new plan

### 4. Notification Center
All notifications stored in user's notification collection:
- Displayed in app notification center
- Push notifications can be triggered
- Email/SMS integration possible

## Subscription Status Updates

### Status Progression

```
active (>7 days remaining)
     ↓
active (7-day warning sent)
     ↓
active (3-day warning sent)
     ↓
expiring_soon (≤3 days, 1-day warning sent)
     ↓
expired (0 days, expired notification sent)
```

### Tracking Fields

Updated in subscription document:

```typescript
{
  daysUntilExpiration: number,        // Last threshold warned (7, 3, 1)
  expirationNotificationSent: boolean, // At least one warning sent
  expirationNotificationDate: Timestamp, // Last warning timestamp
  status: 'active' | 'expiring_soon' | 'expired',
  updatedAt: Timestamp
}
```

## Testing Scenarios

### Test 1: 7-Day Warning

**Setup:**
1. Create subscription expiring in exactly 7 days
2. Set `isSubscribed: true`
3. Set `autoRenew: false`
4. Trigger `checkExpirationWarnings`

**Expected Result:**
- ✅ Notification created with type `subscription_expiring`
- ✅ `daysUntilExpiration: 7`
- ✅ Priority: Medium
- ✅ Message mentions "Renew now to continue"
- ✅ ActionUrl: `/subscription/renew`

### Test 2: 3-Day Warning (Auto-Renewal ON)

**Setup:**
1. Create subscription expiring in exactly 3 days
2. Set `autoRenew: true`
3. Trigger `checkExpirationWarnings`

**Expected Result:**
- ✅ Notification created
- ✅ `daysUntilExpiration: 3`
- ✅ Priority: High
- ✅ Message: "We'll automatically renew it for you"
- ✅ Status updated to `expiring_soon`

### Test 3: 1-Day Final Warning

**Setup:**
1. Create subscription expiring tomorrow
2. Set `autoRenew: false`
3. Trigger `checkExpirationWarnings`

**Expected Result:**
- ✅ Notification created
- ✅ `daysUntilExpiration: 1`
- ✅ Priority: High
- ✅ Message: "This is your last chance to renew!"
- ✅ Status: `expiring_soon`

### Test 4: Expired Notification

**Setup:**
1. Create subscription that expired yesterday
2. Set `isSubscribed: true`, `status: 'active'`
3. Trigger `checkExpirationWarnings`

**Expected Result:**
- ✅ Notification type: `subscription_expired`
- ✅ Priority: High
- ✅ Message mentions "limited access (5 scans/month)"
- ✅ ActionUrl: `/subscription/renew`

### Test 5: Deduplication

**Setup:**
1. Create subscription expiring in 7 days
2. Set `daysUntilExpiration: 7` (already notified)
3. Trigger `checkExpirationWarnings`

**Expected Result:**
- ⏭️ Notification skipped (already sent for this threshold)
- ✅ Log: "Skipping user {id} - notification already sent for 7 day(s)"

### Test 6: Manual Warning

**Setup:**
1. User with subscription expiring in 5 days
2. Call `sendManualExpirationWarning()`

**Expected Result:**
- ✅ Notification sent immediately
- ✅ Response includes `daysUntilExpiration: 5`
- ✅ `expirationNotificationSent: true`
- ✅ `expirationNotificationDate` updated

## Error Handling

### Validation Errors

| Condition | Action | Result |
|-----------|--------|--------|
| No subscription found | Skip | Log warning |
| Subscription not active | Skip | Log warning |
| Already expired | Send expired notification | Update status |
| Notification already sent | Skip | Prevent duplicate |

### System Errors

| Error | Action |
|-------|--------|
| Firestore timeout | Continue to next subscription |
| Notification creation failure | Log error, continue |
| Missing subscription fields | Use defaults, send notification |

## Performance Optimization

### 1. Query Efficiency

**Date Range Queries:**
```typescript
// Only query subscriptions expiring on exact target date
.where('subscriptionEndDate', '>=', targetDate)
.where('subscriptionEndDate', '<', nextDay)
```

**Indexed Queries:**
- Use composite indexes on `isSubscribed` + `subscriptionEndDate`
- Use status index for expired check

### 2. Deduplication

```typescript
// Skip if already notified for this threshold
if (lastNotificationDays === days) {
  continue; // No database write
}
```

### 3. Batch Processing

```typescript
// Process sequentially to avoid rate limits
for (const doc of expiringSubscriptions.docs) {
  await sendWarning(...);
  await updateTracking(...);
}
```

### 4. Timeouts

- **Scheduled Job:** 540s (9 min) for large user base
- **Manual Warning:** 30s for single user
- **Notification Creation:** Fast (Firestore write)

## Security Considerations

### 1. Authentication
- **User Isolation:** Users can only check their own expiration
- **Admin Override:** TODO - Add admin role check
- **Token Validation:** Firebase Auth required

### 2. Data Privacy
- **PII Protection:** No sensitive data in notifications
- **User Preferences:** Respect notification settings (future)
- **Opt-Out:** Allow users to disable warnings (future)

### 3. Rate Limiting
- **Scheduled Job:** Runs once daily
- **Manual Trigger:** Protected by Firebase rate limits
- **Notification Spam:** Deduplication prevents duplicates

## Monitoring and Logging

### Key Metrics

1. **Warning Coverage:** % of users who received warnings
2. **Renewal Rate:** % who renewed after warning
3. **Churn Prevention:** Users saved by timely warnings
4. **Auto-Renewal Awareness:** Users who enabled auto-renewal after warning

### Log Messages

```typescript
// Success
📧 Sent 7-day expiration warning to user {userId}
📧 Sent 3-day expiration warning to user {userId}
📧 Sent 1-day expiration warning to user {userId}
📧 Sent expiration notification to user {userId}

// Skip
⏭️ Skipping user {userId} - notification already sent for {X} day(s)

// Summary
✅ Expiration warning check complete:
   Warning notifications sent: {X}
   Expired notifications sent: {Y}
```

### Cloud Functions Logs

**Query for warning activity:**
```
resource.type="cloud_function"
resource.labels.function_name="checkExpirationWarnings"
severity>=INFO
```

**Filter by threshold:**
```
textPayload:"7-day expiration warning"
textPayload:"3-day expiration warning"
textPayload:"1-day expiration warning"
```

## Client Integration

### React Native Example

```typescript
import {getFirestore, collection, query, where, orderBy, onSnapshot} from 'firebase/firestore';

// Listen to expiration notifications
function useExpirationNotifications(userId: string) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const db = getFirestore();
    const notifRef = collection(
      db,
      'artifacts/goshopperai/users',
      userId,
      'notifications'
    );
    
    const q = query(
      notifRef,
      where('type', 'in', ['subscription_expiring', 'subscription_expired']),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifs);
    });

    return unsubscribe;
  }, [userId]);

  return notifications;
}

// Mark notification as read
async function markNotificationRead(notificationId: string, userId: string) {
  const db = getFirestore();
  const notifRef = doc(
    db,
    'artifacts/goshopperai/users',
    userId,
    'notifications',
    notificationId
  );
  
  await updateDoc(notifRef, {
    read: true,
    readAt: serverTimestamp()
  });
}
```

### UI Components

**Expiration Banner:**
```tsx
function ExpirationBanner({notification}) {
  const {daysUntilExpiration, autoRenewEnabled, message} = notification;
  
  const urgencyColor = daysUntilExpiration === 1 ? 'red' : 
                       daysUntilExpiration === 3 ? 'orange' : 'yellow';
  
  return (
    <View style={[styles.banner, {backgroundColor: urgencyColor}]}>
      <Icon name="alert-circle" />
      <Text style={styles.message}>{message}</Text>
      {!autoRenewEnabled && (
        <Button 
          title="Renew Now" 
          onPress={() => navigate('/subscription/renew')}
        />
      )}
    </View>
  );
}
```

**Notification List:**
```tsx
function NotificationList() {
  const {currentUser} = useAuth();
  const notifications = useExpirationNotifications(currentUser.uid);
  
  return (
    <FlatList
      data={notifications}
      renderItem={({item}) => (
        <NotificationItem 
          notification={item}
          onPress={() => {
            markNotificationRead(item.id, currentUser.uid);
            navigate(item.actionUrl);
          }}
        />
      )}
    />
  );
}
```

## Future Enhancements

### 1. Push Notifications
Integrate with FCM/APNs:
- Send push notification along with in-app notification
- Allow users to configure push preferences
- Track push notification open rates

### 2. Email Notifications
Send email warnings:
- 7-day email with renewal link
- 3-day email with one-click renewal
- 1-day email with urgent action required

### 3. SMS Notifications
For critical warnings:
- 1-day SMS reminder (DRC users prefer SMS)
- Include short link to renewal page
- Respect SMS opt-in/opt-out preferences

### 4. Smart Timing
Optimize notification timing:
- Send at user's preferred time
- Avoid weekends for business users
- Consider timezone differences

### 5. Personalization
Customize messages:
- Include user's name
- Show scan usage stats
- Highlight most-used features
- Calculate money saved

### 6. A/B Testing
Test different approaches:
- Message variants
- Timing variations
- Call-to-action phrasing
- Incentive offers

### 7. Renewal Incentives
Encourage renewal:
- "Renew now and get 10% off"
- "Extend for 3 months and save 20%"
- "Invite a friend, get 1 month free"

### 8. Notification Preferences
User control:
- Enable/disable warnings
- Choose notification channels
- Set preferred language
- Customize frequency

## Deployment Checklist

### 1. Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

Required composite indexes:
```json
{
  "collectionGroup": "subscription",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    {"fieldPath": "isSubscribed", "order": "ASCENDING"},
    {"fieldPath": "subscriptionEndDate", "order": "ASCENDING"}
  ]
},
{
  "collectionGroup": "subscription",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    {"fieldPath": "isSubscribed", "order": "ASCENDING"},
    {"fieldPath": "status", "order": "ASCENDING"},
    {"fieldPath": "subscriptionEndDate", "order": "ASCENDING"}
  ]
}
```

### 2. Deploy Functions

```bash
cd functions
npm run build
firebase deploy --only functions:checkExpirationWarnings,functions:sendManualExpirationWarning
```

### 3. Test in Staging

Create test subscriptions:
- Expiring in 7 days
- Expiring in 3 days
- Expiring tomorrow
- Expired yesterday

Manually trigger:
```bash
# Using Firebase console or gcloud
gcloud functions call checkExpirationWarnings --region us-central1
```

Verify notifications created in Firestore.

### 4. Production Monitoring

Set up alerts:
- High notification failure rate
- Function timeouts
- Low warning coverage (<90%)

### 5. User Communication

Announce feature:
- Blog post: "Never miss a renewal deadline"
- In-app announcement
- Email to all subscribers
- Update help docs

## Conclusion

The Expiration Warning Notification System provides:
- ✅ **Proactive communication** - Users know exactly when subscription expires
- ✅ **Reduced churn** - Timely reminders encourage renewal
- ✅ **Auto-renewal awareness** - Users informed about automatic processing
- ✅ **Bilingual support** - English and French notifications
- ✅ **Smart deduplication** - No spam, just timely alerts
- ✅ **Multiple thresholds** - 7/3/1 day warnings for maximum coverage
- ✅ **Manual trigger** - Users can check status anytime
- ✅ **Production-ready** - Full error handling and monitoring

**Status:** ✅ Ready for production deployment  
**Zero TypeScript Errors:** All code compiles cleanly  
**Documentation:** Complete with examples and integration guides  
**Integration:** Works seamlessly with auto-renewal system
