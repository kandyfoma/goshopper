# Subscription Expiration Flow

## Overview
This document describes how GoShopperAI handles subscription expiration and automatically moves users to the free (freemium) tier when their paid subscription or trial expires.

## Subscription States
- **trial**: User is in their 1-month free trial period
- **active**: User has an active paid subscription
- **freemium**: User has access to 3 scans per month (free tier)
- **cancelled**: User cancelled but still has time remaining in paid period
- **expired**: Temporary state before converting to freemium
- **grace**: Grace period after expiration (7 days)

## Expiration Handling

### 1. Cloud Function (Scheduled Daily)
**Function**: `checkExpiredSubscriptions` in `subscriptionManager.ts`
**Schedule**: Runs daily at midnight (Africa/Kinshasa timezone)

#### What it does:

1. **Expire Active Subscriptions**
   - Finds all subscriptions where `isSubscribed === true` and `subscriptionEndDate < now`
   - Updates the subscription:
     ```typescript
     {
       planId: 'freemium',
       status: 'freemium',
       isSubscribed: false,
       monthlyScansUsed: 0,
       currentBillingPeriodStart: <today>,
       currentBillingPeriodEnd: <today + 1 month>,
       subscriptionEndDate: <deleted>,
       updatedAt: <now>
     }
     ```

2. **Expire Trials**
   - Finds all subscriptions where `status === 'trial'` and `trialEndDate < now`
   - Updates the subscription to freemium (same as above)

3. **Apply Pending Downgrades**
   - Finds subscriptions with `pendingDowngradePlanId` where `pendingDowngradeEffectiveDate <= now`
   - Applies the downgrade and clears pending fields

4. **Reset Monthly Scans**
   - Finds subscriptions where `currentBillingPeriodEnd < now`
   - Resets `monthlyScansUsed` to 0 and sets new billing period

### 2. Client-Side (Real-Time)
**Service**: `SubscriptionService` in `subscription.ts`
**Function**: `checkAndAssignFreemium()`

#### What it does:
Called every time the app fetches subscription status to ensure immediate handling of expiration:

1. **Check Trial Active**
   - If trial is still active, return subscription as-is
   
2. **Check Active Paid Subscription**
   - If `isSubscribed === true` and `status === 'active'`:
     - Check if `subscriptionEndDate` has passed
     - If expired, immediately convert to freemium

3. **Handle Expired Status**
   - If `status === 'expired'`, convert to freemium immediately
   - This catches cases where Cloud Function hasn't run yet

4. **Handle Freemium Status**
   - Check if monthly reset is needed based on billing period
   - Reset scans if billing period has ended

5. **Handle Expired Trial**
   - If `status === 'trial'` and `trialEndDate` has passed
   - Convert to freemium immediately

#### Billing Period Calculation
Freemium users have a monthly billing period that resets based on their join date:
- Join date: January 15
- Billing periods: 15th of each month
- Edge case: If join date is 31st, uses last day of month (28/29/30/31)

## Freemium Tier Features
When a subscription expires, users are moved to the freemium tier which includes:
- **3 scans per month** (resets monthly based on join date)
- **1 shopping list maximum**
- **Basic features only** (no price alerts, no city items, etc.)
- **No export capabilities**
- **Limited item history**

## User Experience Flow

### Scenario 1: Paid Subscription Expires
1. User has Basic plan that expires on January 5, 2026
2. At midnight on January 5, Cloud Function runs:
   - Changes `status: 'freemium'` and `planId: 'freemium'`
   - Resets `monthlyScansUsed: 0`
   - Sets new billing period
3. Next time user opens app:
   - Client-side service confirms freemium status
   - User sees "Gratuit (3/month)" plan
   - Can scan 3 times this month

### Scenario 2: Trial Expires
1. User's 1-month trial ends on January 10, 2026
2. User opens app on January 11:
   - Client-side `checkAndAssignFreemium()` detects expired trial
   - Immediately converts to freemium
   - User can continue with 3 scans per month
3. At midnight, Cloud Function confirms and ensures consistency

### Scenario 3: User Between Expiration Events
1. User's subscription expires at 3 PM
2. User opens app at 4 PM (before midnight Cloud Function):
   - Client-side logic detects expiration
   - Immediately converts to freemium
   - User doesn't wait for Cloud Function

## Code Locations

### Cloud Functions
- **File**: `functions/src/subscription/subscriptionManager.ts`
- **Function**: `checkExpiredSubscriptions` (lines 1022-1163)
- **Schedule**: `0 0 * * *` (daily at midnight)

### Client Service
- **File**: `src/shared/services/firebase/subscription.ts`
- **Function**: `checkAndAssignFreemium()` (lines 64-132)
- **Function**: `getStatus()` (calls checkAndAssignFreemium)

### UI Components
- **File**: `src/shared/contexts/SubscriptionContext.tsx`
- **Logic**: Handles display of subscription status and scan limits

### Feature Access
- **File**: `src/shared/utils/featureAccess.ts`
- **Logic**: Determines what features are available based on plan

## Testing

### Manual Testing
1. **Test Subscription Expiration**:
   ```javascript
   // In Firebase Console, find user's subscription document
   // Set subscriptionEndDate to yesterday
   // Open app - should auto-convert to freemium
   ```

2. **Test Trial Expiration**:
   ```javascript
   // Set trialEndDate to yesterday
   // Open app - should auto-convert to freemium
   ```

3. **Test Monthly Reset**:
   ```javascript
   // Set currentBillingPeriodEnd to yesterday
   // Set monthlyScansUsed to 3
   // Open app - should reset to 0
   ```

### Cloud Function Testing
```bash
# Deploy the function
cd functions
npm run build
firebase deploy --only functions:checkExpiredSubscriptions

# Check logs
firebase functions:log --only checkExpiredSubscriptions
```

## Important Notes

1. **No Expired State Limbo**: Users are never stuck in 'expired' state - they're immediately moved to freemium
2. **Dual Protection**: Both Cloud Function AND client-side handle expiration for reliability
3. **Billing Period Consistency**: Freemium resets use join date, not subscription date
4. **No Data Loss**: When moving to freemium, scan history and receipts are preserved
5. **Immediate Effect**: Client-side detection means users get freemium access immediately, not after midnight

## Monitoring

### Key Metrics to Track
- Number of subscriptions expired daily
- Number of trials expired daily
- Freemium usage patterns
- Conversion rate from freemium to paid

### Log Messages to Watch
- `"Expiring subscription for user, moving to freemium plan"`
- `"Trial expired for user, moving to freemium plan"`
- `"📦 Trial expired, auto-assigning freemium tier"`
- `"📦 Paid subscription expired, auto-assigning freemium tier"`
- `"📅 Resetting freemium monthly usage"`

## Future Improvements
1. Add notification when moving to freemium (push/email)
2. Add win-back campaign after 7 days on freemium
3. Track freemium → paid conversion metrics
4. Add grace period for payment failures
5. Implement soft limits before hard cutoffs
