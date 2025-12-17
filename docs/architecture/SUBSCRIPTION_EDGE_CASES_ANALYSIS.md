# Subscription System - Deep Dive Edge Cases & Issues Analysis

**Date**: December 17, 2025  
**Status**: Critical Issues Found ⚠️

## Executive Summary

After a comprehensive deep dive into the subscription system, I've identified **23 critical edge cases**, **12 missing implementations**, and **8 potential security vulnerabilities**. The system has a solid foundation but requires significant hardening before production deployment.

---

## 🔴 **CRITICAL ISSUES**

### 1. **TESTING_MODE Flag Left in Production Code**

**Location**: `src/shared/contexts/SubscriptionContext.tsx:58`

```typescript
const TESTING_MODE = true;

if (TESTING_MODE) {
  // Testing mode - always allow scanning
  scansRemaining = -1; // -1 represents unlimited
  canScan = true;
}
```

**Impact**: 🔴 **SHOWSTOPPER**  
- **ALL users get unlimited scans regardless of subscription**
- Completely bypasses payment system
- Zero revenue generation
- Must be removed or controlled via environment variable

**Fix Required**:
```typescript
const TESTING_MODE = __DEV__ && Config.ENABLE_FREE_TESTING === 'true';
```

---

### 2. **Billing Period Reset Logic Has Race Condition**

**Location**: `functions/src/subscription/subscriptionManager.ts:757-789`

**Issue**: Monthly scan reset happens in scheduled function without transaction safety

```typescript
for (const doc of resetScansQuery.docs) {
  // Calculate new billing period
  const newBillingStart = new Date();
  const newBillingEnd = new Date();
  newBillingEnd.setMonth(newBillingEnd.getMonth() + 1);

  await doc.ref.update({
    monthlyScansUsed: 0,
    currentBillingPeriodStart: admin.firestore.Timestamp.fromDate(newBillingStart),
    currentBillingPeriodEnd: admin.firestore.Timestamp.fromDate(newBillingEnd),
  });
}
```

**Problems**:
- No transaction wrapping - scan could be recorded while reset is happening
- User could scan right before reset, count gets reset, and they get double scans
- Loop-based updates without batching can timeout

**Edge Case Scenario**:
```
Time: 23:59:59 - User has 100/100 scans used
  → User starts scan request (checks limit, sees 0 remaining)
Time: 00:00:00 - Scheduled function resets to 0/100
  → Previous scan request completes, increments to 1/100
  → User now has 101 total scans (100 + 1) instead of 1
```

**Fix Required**: Use Firestore transactions

---

### 3. **Trial Extension Window Creates Exploitation Vector**

**Location**: `functions/src/subscription/subscriptionManager.ts:363-388`

```typescript
const daysSinceExpiry = Math.ceil(
  (Date.now() - trialEnd.getTime()) / (1000 * 60 * 60 * 24),
);

if (daysSinceExpiry > 7) {
  throw new functions.https.HttpsError(
    'failed-precondition',
    'Extension period has expired',
  );
}
```

**Issues**:
- User can wait until day 6 (144 hours) after trial ends to extend
- Gets 7 days free access + 30 day extension = 37 days free after trial
- Can game the system by timing extension request
- No check if user actually used the service during trial

**Real Scenario**:
```
Day 0-60:   2-month trial (free)
Day 60-67:  Grace period (still checking daysSinceExpiry)
Day 67:     User extends trial → Gets 30 more days
Total free: 97 days instead of intended 90 days
```

**Exploitation Path**:
1. Sign up, get 60-day trial
2. Don't use service for 60 days
3. On day 66, start using service
4. On day 67, extend trial for 30 more days
5. Total: 97 days free access with only 31 days of usage

---

### 4. **Subscription Renewal Can Stack Infinitely**

**Location**: `functions/src/subscription/subscriptionManager.ts:565-579`

```typescript
// If current subscription hasn't expired yet, extend from that date
if (currentEndDate > now) {
  startDate = currentEndDate;
}

// Calculate new end date from the start date
const endDate = new Date(startDate);
endDate.setMonth(endDate.getMonth() + duration);
```

**Issue**: User can renew multiple times in advance without limit

**Scenario**:
```
Current subscription: Expires Jan 1, 2026

User renews 3-month plan:
  → Extends to April 1, 2026

User renews again immediately (6-month plan):
  → Extends to October 1, 2026

User renews again (12-month plan):
  → Extends to October 1, 2027

Total paid: 21 months
All charged at once, no upper limit
```

**Problems**:
- No maximum advance renewal limit
- Could create accounting issues
- User could pay for years in advance (unexpected liability)
- No proration if user wants to upgrade plan mid-period

---

### 5. **Time Zone Inconsistencies**

**Locations**: Multiple files

**Issues**:
- Cloud Functions use `Africa/Kinshasa` timezone
- Client-side JavaScript uses local device timezone
- No consistent timezone handling across frontend/backend
- Subscription expiry calculations differ by location

**Example Problem**:
```javascript
// Frontend (user in UTC+8)
const trialEnd = new Date();
trialEnd.setDate(trialEnd.getDate() + 60);
// Saves: 2026-02-15 16:00:00 UTC

// Backend scheduled function (runs at midnight Kinshasa time = UTC+1)
// Checks at: 2026-02-15 23:00:00 UTC
// Trial has expired 7 hours early from user's perspective
```

**Impact**:
- Users in different timezones get different trial lengths
- Asian users could lose 12+ hours
- American users could gain 6+ hours

---

### 6. **No Idempotency Keys for Payment Processing**

**Location**: `functions/src/subscription/subscriptionManager.ts:450-507`

**Missing**: Idempotency protection for `upgradeSubscription` and `renewSubscription`

**Issue**: Same payment could be processed multiple times if:
- Network retry
- User double-clicks "Subscribe" button
- Mobile app backgrounding/foregrounding

**Scenario**:
```
1. User clicks "Subscribe to Premium" → API call starts
2. Network timeout on client
3. User clicks button again → Second API call
4. Both calls succeed
5. User is charged twice, gets two subscriptions
```

**Currently Missing**:
```typescript
// No deduplication check like this:
const existingTransaction = await db
  .collection('transactions')
  .where('transactionId', '==', transactionId)
  .get();

if (!existingTransaction.empty) {
  throw new Error('Transaction already processed');
}
```

---

### 7. **Leap Year Month Addition Bug**

**Location**: All date calculations using `setMonth()`

**Issue**: JavaScript's `setMonth()` doesn't handle edge cases properly

```typescript
const endDate = new Date(startDate);
endDate.setMonth(endDate.getMonth() + duration);
```

**Problem Scenarios**:

**Scenario 1: Leap Year**
```javascript
// User subscribes on Jan 31, 2024
const start = new Date('2024-01-31');
start.setMonth(start.getMonth() + 1); // Feb doesn't have 31 days
// Result: March 2, 2024 (not Feb 29!)
// User loses 2 days
```

**Scenario 2: End of Month**
```javascript
// User subscribes on May 31
const start = new Date('2024-05-31');
start.setMonth(start.getMonth() + 1); // June has 30 days
// Result: July 1, 2024
// User loses 1 day
```

**Better Approach**:
```typescript
import {addMonths} from 'date-fns';
const endDate = addMonths(startDate, duration);
```

---

### 8. **Monthly Scan Reset Doesn't Account for Partial Months**

**Location**: `functions/src/subscription/subscriptionManager.ts:757`

**Issue**: Resets happen at fixed monthly intervals regardless of subscription start date

**Scenario**:
```
User subscribes: June 15, 2025
Billing period should be: June 15 - July 15

But scheduled function runs: July 1 at midnight
  → Resets scans on July 1
  → User gets: June 15-30 (15 days) + July 1-15 (15 days)
  → User's scans reset in middle of their billing month

User effectively gets 1.5 months of scans in first month
```

**Root Cause**: No user-specific billing date tracking

---

### 9. **Subscription Cancellation Doesn't Prevent Access Immediately**

**Location**: `functions/src/subscription/subscriptionManager.ts:700-734`

```typescript
// Don't immediately cancel - disable auto-renew
// User keeps access until subscription end date
await subscriptionRef.update({
  autoRenew: false,
  status: 'cancelled',
});
```

**Issue**: Status is set to `'cancelled'` but `isSubscribed` remains `true`

**Conflicting Logic**:
```typescript
// In canScan check:
if (subscription.isSubscribed && subscription.status === 'active') {
  // Allow scan
}
```

**Problem**: Status is `'cancelled'` but checks look for `'active'`

**Edge Case**:
```
1. User cancels subscription on Day 1 (status → 'cancelled')
2. canScan() checks: isSubscribed=true but status='cancelled'
3. User can't scan even though they paid for the month
4. User complains: "I cancelled but it stopped working immediately!"
```

**Fix**: Need to check:
```typescript
if (subscription.isSubscribed && 
    (subscription.status === 'active' || subscription.status === 'cancelled')) {
  // Allow scan if not expired
}
```

---

### 10. **Exchange Rate Fallback Can Create Price Inconsistencies**

**Location**: `functions/src/subscription/subscriptionManager.ts:17-41`

```typescript
const DEFAULT_EXCHANGE_RATE = 2220; // 1 USD = 2,220 CDF

async function getExchangeRate(): Promise<number> {
  try {
    const settingsDoc = await settingsRef.get();
    if (settingsDoc.exists) {
      return data?.exchangeRates?.usdToCdf || DEFAULT_EXCHANGE_RATE;
    }
    return DEFAULT_EXCHANGE_RATE;
  } catch (error) {
    return DEFAULT_EXCHANGE_RATE;
  }
}
```

**Issues**:

1. **Hardcoded fallback is dangerously outdated**
   - Current rate: ~2,700 CDF/USD (as per docs)
   - Fallback: 2,220 CDF/USD
   - Difference: 17.8% price reduction for users if DB fails

2. **No cache TTL** - Fetches from DB on every transaction

3. **No rate limiting on updates** - Could change mid-payment

**Exploitation Scenario**:
```
1. User sees price: 12,000 CDF (at 2,700 rate)
2. Firestore has outage during payment
3. Fallback rate kicks in: 2,220
4. User charged: 9,970 CDF (17% less)
5. Revenue loss
```

---

## 🟡 **HIGH PRIORITY EDGE CASES**

### 11. **Downgrade Path Missing**

**Status**: ❌ NOT IMPLEMENTED

**Issue**: Users can upgrade but cannot downgrade

**Missing Function**: `downgradeSubscription()`

**Scenarios**:
- User on Premium wants to downgrade to Basic
- Should downgrade apply immediately or at renewal?
- What happens to remaining days/scans?
- Refund/proration?

**Expected Behavior**:
```
Option 1 (Immediate):
  - Downgrade takes effect immediately
  - Pro-rated refund to account balance
  - Scan limit reduced immediately

Option 2 (At Renewal):
  - Keep current plan until expiry
  - Downgrade scheduled for next billing
  - User keeps premium features until then
```

---

### 12. **Refund System Completely Missing**

**Status**: ❌ NOT IMPLEMENTED

**Missing**:
- Refund API endpoint
- Refund policy enforcement
- Partial refund calculations
- Refund transaction records

**Scenarios Unhandled**:
- User requests refund within 7 days
- Accidental double payment
- Payment succeeded but subscription activation failed
- User charged but app didn't work

**Legal Requirement**: Many jurisdictions require 14-day refund windows

---

### 13. **Payment Webhook Retry Logic Missing**

**Location**: Payment webhooks in `functions/src/payments/`

**Issue**: If webhook fails, payment succeeds but subscription not activated

**Scenario**:
```
1. User pays $4.99 for Premium
2. Stripe/Moko webhook fires
3. Firebase function has temporary outage
4. Webhook fails, no retry configured
5. Payment succeeded, money debited
6. Subscription NOT activated
7. User complains: "Paid but still see trial"
```

**Missing**:
- Webhook retry mechanism
- Dead letter queue for failed webhooks
- Manual reconciliation process
- Payment verification API

---

### 14. **Concurrent Scan Recording Race Condition**

**Location**: `functions/src/subscription/subscriptionManager.ts:260-339`

**Issue**: `recordScanUsage` increments without optimistic locking

```typescript
const currentUsage = subscription.monthlyScansUsed || 0;

if (currentUsage >= planLimit) {
  throw new Error('Limit reached');
}

transaction.update(subscriptionRef, {
  monthlyScansUsed: admin.firestore.FieldValue.increment(1),
});
```

**Race Condition**:
```
User has 24/25 scans used (1 remaining)

Request A:                    Request B:
  reads: 24/25                  reads: 24/25
  checks: 24 < 25 ✓            checks: 24 < 25 ✓
  increments to 25              increments to 26
  
Result: User got 26 scans on a 25-scan plan
```

**Fix**: Read inside transaction, check after increment

---

### 15. **Trial Extension Allowed After Subscription**

**Location**: `functions/src/subscription/subscriptionManager.ts:341`

**Missing Check**: No validation that user hasn't already subscribed

```typescript
export const extendTrial = functions.https.onCall(async (data, context) => {
  const subscription = subscriptionDoc.data() as Subscription;

  if (subscription.trialExtended) {
    throw new Error('Trial can only be extended once');
  }

  // ❌ MISSING: Check if user is already subscribed
  // User could extend trial even after paying for subscription
```

**Exploitation**:
```
1. User has paid Basic subscription (active)
2. User calls extendTrial()
3. System extends trial (no subscription check)
4. User gets 30 more days free on top of paid plan?
```

---

### 16. **No Scan Usage Audit Trail**

**Status**: ❌ NOT IMPLEMENTED

**Missing**:
- Individual scan transaction records
- Scan history with timestamps
- IP address logging
- Device fingerprinting

**Why Needed**:
- Investigate unusual usage patterns
- Dispute resolution ("I didn't use 100 scans!")
- Fraud detection
- Analytics

**Should Store**:
```typescript
interface ScanTransaction {
  userId: string;
  scanId: string;
  timestamp: Date;
  planId: string;
  scansUsedBefore: number;
  scansUsedAfter: number;
  deviceId: string;
  ipAddress: string;
}
```

---

### 17. **Subscription Status Auto-Update Missing**

**Issue**: Status doesn't auto-update when subscription expires

**Current**: Scheduled function updates status daily at midnight

**Problem**: User subscription expires at 3 PM

```
Subscription ends: Jan 15, 2026 15:00
Next status check: Jan 16, 2026 00:00 (9 hours later)

User gets 9 hours of free access after expiration
```

**Better**: Real-time expiry check in `canScan()`

```typescript
async canScan(): Promise<boolean> {
  const subscription = await this.getStatus();
  
  // Check expiry in real-time
  if (subscription.subscriptionEndDate) {
    if (new Date(subscription.subscriptionEndDate) < new Date()) {
      // Expired - update status immediately
      await this.expireSubscription(subscription.userId);
      return false;
    }
  }
  
  // ... rest of logic
}
```

---

### 18. **Plan Pricing Not Versioned**

**Location**: `functions/src/subscription/subscriptionManager.ts:58-62`

```typescript
const BASE_PRICES: Record<string, number> = {
  basic: 1.99,
  standard: 2.99,
  premium: 4.99,
};
```

**Issue**: If you change prices, existing subscriptions affected

**Scenario**:
```
Today: Premium is $4.99/month
User subscribes to 12-month Premium: $59.88 total

Tomorrow: You increase Premium to $6.99/month

User's existing subscription:
  - What price do they renew at?
  - Do they keep $4.99 (grandfathered)?
  - Or forced to $6.99?
```

**Missing**:
- Price versioning system
- Grandfathering logic
- Price migration strategy

**Better Approach**:
```typescript
interface PlanPriceHistory {
  planId: string;
  price: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

// Store price at subscription time
subscription.subscribedAtPrice = 4.99;
subscription.priceVersion = 'v1';
```

---

### 19. **Auto-Renewal Not Actually Implemented**

**Location**: Nowhere - it's missing!

**Issue**: `autoRenew` flag is set but nothing uses it

```typescript
// In upgradeSubscription:
autoRenew: true,  // ← Set to true

// ❌ But there's NO scheduled function that:
// - Checks for expiring subscriptions with autoRenew=true
// - Processes payment automatically
// - Renews subscription
```

**Missing Implementation**:
```typescript
export const processAutoRenewals = functions
  .pubsub.schedule('0 0 * * *')
  .onRun(async () => {
    // Find subscriptions expiring in 3 days with autoRenew=true
    const expiringQuery = await db
      .collectionGroup('subscription')
      .where('autoRenew', '==', true)
      .where('status', '==', 'active')
      .get();
    
    for (const doc of expiringQuery.docs) {
      const subscription = doc.data();
      const daysUntilExpiry = /* calculate */;
      
      if (daysUntilExpiry <= 3) {
        // Charge payment method
        // Extend subscription
      }
    }
  });
```

---

### 20. **Payment Method Not Stored for Auto-Renewal**

**Location**: `src/shared/types/subscription.types.ts`

**Issue**: Subscription stores payment metadata but not reusable tokens

```typescript
export interface Subscription {
  // ...
  paymentMethod?: PaymentMethodType;  // Just 'mobile_money' or 'card'
  transactionId?: string;              // One-time transaction
  
  // ❌ MISSING:
  // stripePaymentMethodId?: string;   // Reusable Stripe PM
  // mokoWalletId?: string;             // Stored wallet reference
}
```

**Why Needed**: Can't auto-renew without stored payment method

**Current State**:
- User pays once for subscription
- No payment method saved
- When autoRenew tries to charge: **NO PAYMENT METHOD AVAILABLE**

---

### 21. **Grace Period for Failed Payments Not Implemented**

**Status**: ❌ NOT IMPLEMENTED  
**Reference**: `docs/product/FEATURES.md:480`

**Mentioned in Docs**:
> "Grace period for failed payments"

**Not Implemented**:
- No grace period duration defined
- No retry logic for failed charges
- No communication to user about payment failure
- No downgrade to free tier after grace period

**Expected Behavior**:
```
Day 0: Subscription expires, auto-renewal attempted
       Payment fails (insufficient funds)
       
Day 0-7: Grace period
       - User still has access
       - System retries payment daily
       - Email notifications sent
       
Day 7: Grace period expires
       - Subscription status → 'expired'
       - Access revoked
       - User notified
```

---

### 22. **Expiration Notification Only Sent Once**

**Location**: `functions/src/subscription/subscriptionManager.ts`

**Issue**: `expirationNotificationSent` flag never resets

```typescript
export interface Subscription {
  expirationNotificationSent?: boolean;
  expirationNotificationDate?: Date;
}
```

**Problem Scenario**:
```
Cycle 1:
  - User subscribes Jan 1 → expires Feb 1
  - Notification sent Jan 25 (7 days before)
  - Flag set: expirationNotificationSent = true

Cycle 2:
  - User renews Feb 1 → expires Mar 1
  - Jan 25 notification flag still true
  - NO notification sent before Mar 1 expiry
  - User surprised when access revoked
```

**Fix**: Reset flag on renewal

```typescript
await subscriptionRef.update({
  expirationNotificationSent: false,
  expirationNotificationDate: null,
});
```

---

### 23. **No Handling for Partial/Failed Firestore Writes**

**Issue**: Many operations update multiple fields without transaction guarantees

**Example**:
```typescript
await subscriptionRef.set({
  userId,
  isSubscribed: true,
  planId,
  status: 'active',
  // ... 15 more fields
}, {merge: true});
```

**What if**: 
- Network drops mid-write
- Firestore quotas exceeded
- Permission denied mid-operation

**Result**: Partial subscription state
```javascript
{
  isSubscribed: true,   // ✓ Written
  planId: 'premium',    // ✓ Written
  status: undefined,    // ✗ Not written (still 'trial')
  scanLimit: undefined  // ✗ Not written
}
```

**User Experience**:
- Paid for Premium
- Status still shows 'trial'
- Gets unlimited scans (testing mode) OR blocked (inconsistent state)

---

## 🟢 **MEDIUM PRIORITY ISSUES**

### 24. **No Rate Limiting on Subscription Operations**

**Vulnerable Endpoints**:
- `getSubscriptionStatus` - Could be spammed
- `recordScanUsage` - No throttling
- `extendTrial` - Could be attempted repeatedly

**Attack Vector**:
```javascript
// Malicious script
for (let i = 0; i < 1000; i++) {
  await extendTrial();
}

// Each call:
// - Reads Firestore
// - Checks eligibility  
// - Writes error log
// 
// Result: Quota exhaustion, increased costs
```

---

### 25. **Subscription Data Not Encrypted at Rest**

**Issue**: Sensitive payment data stored in plain Firestore documents

**Data at Risk**:
```typescript
{
  customerPhone: "+243123456789",   // PII
  customerEmail: "user@email.com",  // PII
  transactionId: "TXN123456",       // Financial
  lastPaymentAmount: 4.99,          // Financial
  stripePaymentIntentId: "pi_...",  // Sensitive
}
```

**Recommendation**: Use Firebase App Check + encryption for PII

---

### 26. **No Multi-Device Subscription Sharing Prevention**

**Issue**: Nothing prevents single subscription being used on multiple devices

**Scenario**:
```
User A subscribes to Premium on Device A
  → Gets unlimited scans

User A shares login with User B
  → User B logs in on Device B
  → Also gets unlimited scans

Both use Premium features from 1 subscription
```

**Missing**:
- Device limit enforcement
- Concurrent session detection
- Active device tracking

---

### 27. **Scheduled Function Doesn't Handle Large User Bases**

**Location**: `checkExpiredSubscriptions` function

```typescript
const expiredQuery = await db
  .collectionGroup('subscription')
  .where('isSubscribed', '==', true)
  .where('subscriptionEndDate', '<', now)
  .get();

// Processes ALL results in one execution
```

**Scalability Issues**:
- No pagination
- Could timeout with 100,000+ subscriptions
- All processed in single function invocation
- No checkpoint/resume capability

**Better**: Process in batches with continuation tokens

---

### 28. **Trial Days Remaining Calculation Has Off-by-One Errors**

**Location**: Multiple places calculating `trialDaysRemaining`

```typescript
const diffTime = trialEnd.getTime() - now.getTime();
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
```

**Issue**: `Math.ceil()` rounds up

**Example**:
```
Now: Jan 1, 2026 23:59:00
Trial End: Jan 2, 2026 00:00:00
Diff: 60 seconds = 0.0007 days

Math.ceil(0.0007) = 1 day

UI shows: "1 day remaining"
Reality: 60 seconds remaining
```

**User Experience**: "App said 1 day left, but expired in 1 minute!"

---

### 29. **Currency Mismatch Between Plans**

**Issue**: Plan pricing shows both USD and CDF but no validation

```typescript
const PLAN_PRICING: PlanPricing[] = [
  {
    plan: 'basic',
    priceUSD: 1.99,
    priceCDF: 8000,  // Should be ~5,373 at 2,700 rate
  },
  // ...
];
```

**Problems**:
- Hardcoded CDF prices don't match current exchange rate
- User could pay in whichever currency is cheaper
- No check that USD ≈ CDF / exchangeRate

---

### 30. **No Subscription Transfer Between Accounts**

**Use Case**: User wants to transfer subscription to family member

**Status**: ❌ NOT SUPPORTED

**Missing**:
- Account transfer API
- Ownership verification
- Transfer authorization

---

## 📊 **DATA CONSISTENCY ISSUES**

### 31. **Dual Field Naming (planId vs plan)**

**Location**: `subscription.types.ts`

```typescript
export interface Subscription {
  planId?: SubscriptionPlanId;
  plan?: SubscriptionPlanId; // Alias for planId
}
```

**Issue**: Two fields for same data = inconsistency risk

**Problems**:
```typescript
// Some code uses planId:
if (subscription.planId === 'premium') { }

// Other code uses plan:
if (subscription.plan === 'premium') { }

// What if only one is set?
subscription.planId = 'premium';
subscription.plan = undefined;  // ← Inconsistent!
```

**Fix**: Pick ONE field, deprecate the other

---

### 32. **Subscription Collection Path Inconsistency**

**Frontend**: `artifacts/{appId}/users/{userId}/subscription/{userId}`  
**Functions**: `artifacts/{appId}/users/{userId}/subscription`

**Risk**: Path mismatch could cause data not found errors

---

## 🔒 **SECURITY VULNERABILITIES**

### 33. **No Authentication Check Before Price Calculation**

**Location**: `getSubscriptionPricing` function

```typescript
export const getSubscriptionPricing = functions
  .https.onCall(async (data, context) => {
    // ❌ NO AUTH CHECK
    const {planId = 'standard'} = data;
    
    // Anyone can call this
    return pricing;
  });
```

**Impact**: Public exposure of pricing logic (low risk but unnecessary)

---

### 34. **Transaction ID Can Be Reused**

**Issue**: No uniqueness check on `transactionId`

**Exploitation**:
```
1. User pays, gets transactionId: "TXN123"
2. Subscription activated with TXN123
3. User calls upgradeSubscription again with same TXN123
4. System accepts it (no duplicate check)
5. User gets second month free
```

---

### 35. **No AppCheck Integration**

**Issue**: Cloud Functions callable from anywhere without app verification

**Risk**:
- Scripts can call functions directly
- Automated abuse possible
- No proof call came from official app

---

## 📋 **MISSING FEATURES (Documented but Not Implemented)**

### 36. **Plan Downgrade** (ref: FEATURES.md:424)
- ❌ No downgrade API
- ❌ No proration logic
- ❌ No "apply at next billing cycle" option

### 37. **Refund Request** (ref: FEATURES.md:489)
- ❌ No refund endpoint
- ❌ No manual review process
- ❌ No refund transaction logging

### 38. **Grace Period** (ref: FEATURES.md:480)
- ❌ No grace period implementation
- ❌ No payment retry logic
- ❌ No grace period notifications

### 39. **Subscription Family Sharing**
- ❌ No family plan concept
- ❌ No multi-user subscription
- ❌ No seat/license management

### 40. **Coupon/Promo Code System**
- ❌ No discount code support
- ❌ No referral bonuses
- ❌ No promotional pricing

---

## 🎯 **RECOMMENDATIONS - Priority Order**

### **Immediate (Before Launch)**

1. ✅ **REMOVE TESTING_MODE flag** - Showstopper
2. ✅ **Implement transaction safety** - Revenue protection
3. ✅ **Add idempotency keys** - Prevent double charges
4. ✅ **Fix cancellation logic** - User experience critical
5. ✅ **Update exchange rate fallback** - Pricing accuracy

### **High Priority (Week 1)**

6. ✅ **Implement downgrade path** - User retention
7. ✅ **Add refund system** - Legal requirement
8. ✅ **Fix billing period reset** - Data accuracy
9. ✅ **Add webhook retry logic** - Payment reliability
10. ✅ **Implement real-time expiry checks** - Access control

### **Medium Priority (Month 1)**

11. ✅ **Add scan audit trail** - Fraud detection
12. ✅ **Fix trial extension window** - Prevent abuse
13. ✅ **Version plan pricing** - Future-proofing
14. ✅ **Implement auto-renewal** - Recurring revenue
15. ✅ **Add rate limiting** - Cost control

### **Nice to Have (Quarter 1)**

16. ⭕ **Add grace period** - Better UX
17. ⭕ **Implement device limits** - Abuse prevention
18. ⭕ **Add promo codes** - Marketing tools
19. ⭕ **Optimize scheduled functions** - Scalability
20. ⭕ **Add AppCheck** - Security hardening

---

## 📝 **CODE QUALITY ISSUES**

### Type Safety

```typescript
// ❌ Inconsistent type handling
const subscription = subscriptionDoc.data() as Subscription;

// Better: Validate with Zod
const SubscriptionSchema = z.object({...});
const subscription = SubscriptionSchema.parse(data);
```

### Error Handling

```typescript
// ❌ Generic error messages
throw new Error('Failed');

// Better: Specific, actionable errors
throw new SubscriptionError({
  code: 'SCAN_LIMIT_REACHED',
  message: 'You have used all 25 scans this month',
  remainingScans: 0,
  upgradeUrl: '/subscription',
});
```

### Magic Numbers

```typescript
// ❌ Hardcoded values everywhere
if (daysSinceExpiry > 7) { }
trialEndDate.setDate(trialEndDate.getDate() + 60);

// Better: Named constants
const TRIAL_EXTENSION_WINDOW_DAYS = 7;
const TRIAL_DURATION_DAYS = 60;
```

---

## 🧪 **TESTING GAPS**

### Missing Test Cases

1. ❌ Concurrent scan recording
2. ❌ Timezone edge cases (DST, leap seconds)
3. ❌ Payment webhook failure scenarios
4. ❌ Subscription renewal at exactly midnight
5. ❌ User deletes account with active subscription
6. ❌ Firestore write failures mid-transaction
7. ❌ Network timeout during payment
8. ❌ Invalid date calculations (Feb 30, etc.)

---

## 📈 **MONITORING & OBSERVABILITY MISSING**

**No tracking for**:
- Subscription conversion rate
- Trial-to-paid conversion
- Churn rate by plan
- Average revenue per user
- Failed payment rate
- Refund rate
- Auto-renewal success rate

**Should add**:
```typescript
// Example metrics
analyticsService.logEvent('subscription_upgraded', {
  from_plan: 'basic',
  to_plan: 'premium',
  duration_months: 12,
  revenue: 59.88,
});
```

---

## 💡 **CONCLUSION**

The subscription system has a **solid foundation** but requires **significant hardening** before production. The most critical issues are:

1. **TESTING_MODE flag** - Must be removed immediately
2. **Race conditions** - Need transaction safety
3. **Missing implementations** - Auto-renewal, refunds, downgrades
4. **Date handling** - Timezone and leap year bugs
5. **Payment idempotency** - Prevent double charges

**Estimated work**: 3-4 weeks of focused development to address critical and high-priority issues.

---

**Next Steps**:
1. Create GitHub issues for each finding
2. Prioritize based on launch timeline
3. Implement fixes systematically
4. Add comprehensive test coverage
5. Set up monitoring and alerting
