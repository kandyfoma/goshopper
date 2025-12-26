# Category Insights Notifications for Premium Users

## Overview
Automated push notification system that sends personalized category spending insights to premium users every 3 days.

## Features

### Automatic Scheduling
- **Frequency**: Every 3 days
- **Time**: 10:00 AM Kinshasa time (Africa/Kinshasa timezone)
- **Target**: Premium users only (active paid subscriptions)
- **Data Period**: Last 30 days of spending

### Smart Category Selection
- **Excludes**: "Autres" category (generic/uncategorized items)
- **Weighted Selection**: Higher spending categories have higher probability
  - Top 3 categories: 3x more likely to be selected
  - Other categories: Standard probability
- **Randomization**: Different category each notification for variety

### Personalized Insights
Each notification includes:
- **Category name**: The spending category (e.g., Alimentation, Boissons)
- **Total amount**: How much spent in that category
- **Item count**: Number of items purchased
- **Average price**: Average price per item
- **Currency**: USD or CDF based on user's receipts

## Implementation

### Cloud Function: `sendCategoryInsights`
**Type**: Scheduled (Cloud Scheduler)  
**Schedule**: `0 10 */3 * *` (Every 3 days at 10:00 AM)  
**Region**: us-central1

**Process Flow:**
1. Fetch all users with FCM tokens
2. Check premium subscription status for each user
3. Calculate category spending (last 30 days)
4. Filter out "Autres" category
5. Select random weighted category
6. Generate localized notification content
7. Send push notification
8. Log notification to user's history

### Cloud Function: `sendCategoryInsightToUser`
**Type**: Callable HTTPS  
**Purpose**: Manual trigger for testing or on-demand insights

**Usage:**
```typescript
// From client app
const result = await firebase.functions()
  .httpsCallable('sendCategoryInsightToUser')();

// Or for specific user (admin only)
const result = await firebase.functions()
  .httpsCallable('sendCategoryInsightToUser')({ userId: 'user123' });
```

## Notification Examples

### French (Default)
```
Title: 💡 Analyse Alimentation
Body: Vous avez dépensé $125.50 en Alimentation (45 articles, moy. $2.79). Consultez Stats!
```

### English
```
Title: 💡 Alimentation Spending Insight
Body: You've spent $125.50 on Alimentation (45 items, avg $2.79). Track your habits in Stats!
```

### With CDF Currency
```
Title: 💡 Analyse Boissons
Body: Vous avez dépensé 15,000 FC en Boissons (12 articles, moy. 1,250 FC). Consultez Stats!
```

## Premium User Eligibility

A user is considered premium if:
- ✅ Has active subscription status
- ✅ Plan ID is not "free"
- ✅ Subscription expiry date is in the future
- ✅ Has valid FCM token for push notifications

## Category Filtering

**Excluded Categories:**
- "Autres" (uncategorized/generic items)

**Included Categories:**
- Alimentation (Food)
- Boissons (Beverages)
- Produits laitiers (Dairy)
- Viandes & Poissons (Meat & Fish)
- Fruits & Légumes (Fruits & Vegetables)
- Épicerie (Grocery)
- Hygiène (Hygiene)
- Ménage (Household)
- Bébé (Baby)

## Notification Data Payload

```json
{
  "type": "category_insight",
  "category": "Alimentation",
  "amount": "125.50",
  "currency": "USD",
  "itemCount": "45",
  "route": "Stats"
}
```

**Client Handling:**
- Tap notification → Navigate to Stats screen
- Shows category detail with full breakdown

## Analytics & Logging

Each notification execution logs:
- Total users with FCM tokens
- Premium vs non-premium user count
- Notifications sent successfully
- Notifications failed
- Categories selected per user

**Console Output Example:**
```
🔔 Starting category insights notification job...
Found 250 users with FCM tokens
📊 Premium users: 45, Non-premium: 205
📤 Sending insights to 45 premium users
✅ Sent category insight to user abc123: Alimentation
✅ Category insights job completed: 43 sent, 2 failed
```

## Testing

### Manual Trigger for Current User
```typescript
// From app (user triggers their own insight)
const sendInsight = firebase.functions()
  .httpsCallable('sendCategoryInsightToUser');

try {
  const result = await sendInsight();
  console.log('Insight sent:', result.data);
  // { success: true, category: 'Alimentation', amount: 125.50, itemCount: 45 }
} catch (error) {
  console.error('Failed:', error.message);
}
```

### Test Scheduler Locally
```bash
# Deploy function
cd functions
npx firebase deploy --only functions:sendCategoryInsights

# View logs
npx firebase functions:log --only sendCategoryInsights
```

## Performance Considerations

### Rate Limiting
- 100ms delay between each notification
- Prevents FCM rate limiting
- Batch processing for large user bases

### Data Queries
- Efficient Firestore queries (indexed fields)
- 30-day time window (reasonable data size)
- Category aggregation in memory (fast)

### Cost Optimization
- Only queries premium users (filtered early)
- No unnecessary data fetching
- Caches user subscription status
- Single FCM message per user

## Error Handling

### Graceful Failures
- Invalid FCM token → Skip user, log error
- No spending data → Skip user
- Network timeout → Retry on next scheduled run
- Missing subscription → Skip user

### Notification Delivery
- Failed notifications are logged but don't stop batch
- Each user processed independently
- Total success/failure counts reported

## Notification Channels

**Android:**
- Channel ID: `insights`
- Priority: Normal/Default
- Icon: `ic_notification`
- Color: #6366F1 (Indigo)

**iOS:**
- Sound: Default
- Badge: +1

## Notification History

Each sent notification is logged to Firestore:
```
artifacts/{APP_ID}/users/{userId}/notifications/{notificationId}
{
  type: 'category_insight',
  title: '💡 Analyse Alimentation',
  body: 'Vous avez dépensé $125.50...',
  category: 'Alimentation',
  amount: 125.50,
  currency: 'USD',
  itemCount: 45,
  read: false,
  createdAt: Timestamp
}
```

## Localization

**Supported Languages:**
- French (fr) - Default
- English (en)

**Language Detection:**
- Uses user's `language` field from profile
- Falls back to French if not specified

## Future Enhancements

**Potential Improvements:**
1. **Smart Timing**: Send at user's most active time
2. **Trend Analysis**: "You're spending 20% more on X this month"
3. **Comparison**: "Average user spends Y on this category"
4. **Recommendations**: "Try these alternatives to save money"
5. **Goal Tracking**: "You're 10% over your Alimentation budget"
6. **Seasonal Insights**: "Holiday spending is up 35%"
7. **Store Comparison**: "You save more at Store X for this category"
8. **Multi-category**: "Your top 3 spending categories this week"

## Monitoring

**Key Metrics to Track:**
- Notification delivery rate
- Open rate per category
- User engagement (Stats screen visits)
- Opt-out rate
- Category distribution (which categories are most notified)

**Recommended Dashboard:**
```typescript
// Analytics events to add
analyticsService.logEvent('category_insight_sent', {
  category: 'Alimentation',
  amount: 125.50,
  itemCount: 45
});

analyticsService.logEvent('category_insight_opened', {
  category: 'Alimentation',
  source: 'notification'
});
```

## Maintenance

### Adjusting Frequency
Edit schedule in `categoryInsightsNotifications.ts`:
```typescript
.pubsub.schedule('0 10 */3 * *') // Every 3 days
// Change to:
.pubsub.schedule('0 10 */7 * *') // Weekly
.pubsub.schedule('0 10 * * *')   // Daily
.pubsub.schedule('0 10 * * 1')   // Every Monday
```

### Adding Categories to Exclude
```typescript
.filter(([category]) => 
  category !== 'Autres' && 
  category !== 'Divers' // Add more here
)
```

### Changing Data Window
```typescript
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
// Change to:
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7); // Last week
```
