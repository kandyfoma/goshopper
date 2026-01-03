# Data Retention Policy - GoShopper AI

## Overview

GoShopper AI implements a tiered data retention policy based on subscription plans. Data is automatically cleaned up on the 1st of every month to ensure compliance with storage limits and provide better value at each subscription tier.

## Retention Periods by Subscription

| Plan | Retention Period | Scan Limit/Month | Price |
|------|-----------------|------------------|-------|
| **Free Trial** | 1 month | 10 scans | Free |
| **Basic** | 1 month | 20 scans | $1.99/month |
| **Standard** | 2 months | 50 scans | $2.99/month |
| **Premium** | 3 months | 200 scans | $4.99/month |
| **Freemium** | 1 month | Limited | Free |

## What Data is Retained

### Receipts 📋
- All scanned receipts (images + parsed data)
- Purchase date, store name, items, prices
- Total amounts, currency information
- Receipt metadata and processing status

### Items 🏷️
- Aggregated product prices across stores
- Price history and statistics
- Store availability information
- Min/max/average pricing data

### Shopping Lists 🛒
- Custom shopping lists created by users
- List items, quantities, and notes
- Price optimization suggestions

### Notifications 🔔
- Price alerts and notifications
- Budget warnings
- System notifications

### Price Alerts 💰
- User-configured price drop alerts
- Target prices and conditions
- Alert history and triggers

### Budgets 💵
- Monthly budget configurations
- Budget tracking history
- Spending category allocations

## Data Cleanup Process

### Automatic Cleanup Schedule
- **Frequency**: Monthly (1st of each month)
- **Time**: 2:00 AM UTC
- **Method**: Automated Cloud Function

### Cleanup Logic

```typescript
function getRetentionMonths(planId: string): number {
  switch (planId) {
    case 'basic':
    case 'free':
    case 'freemium':
      return 1; // 1 month retention
    case 'standard':
      return 2; // 2 months retention
    case 'premium':
      return 3; // 3 months retention
    default:
      return 1; // Default: 1 month
  }
}
```

### What Happens During Cleanup

1. **User Identification**: System checks each user's subscription plan
2. **Cutoff Calculation**: Determines retention date based on plan (1-3 months ago)
3. **Receipt Deletion**: Removes receipts older than retention period
4. **Item Updates**: Updates aggregated item data, removing old prices
5. **Shop Stats**: Recalculates shop statistics after receipt removal
6. **List Cleanup**: Removes old shopping lists
7. **Notification Cleanup**: Deletes old notifications and alerts
8. **Budget Cleanup**: Archives outdated budget records

### Example Timeline

**Premium User (3-month retention)**
- January 1st: Data from September 30th and earlier is deleted
- February 1st: Data from October 31st and earlier is deleted
- March 1st: Data from November 30th and earlier is deleted

**Standard User (2-month retention)**
- January 1st: Data from October 31st and earlier is deleted
- February 1st: Data from November 30th and earlier is deleted

**Basic User (1-month retention)**
- January 1st: Data from November 30th and earlier is deleted
- February 1st: Data from December 31st and earlier is deleted

## Data Protection

### What is NOT Deleted
- User profile information
- Current subscription details
- Active payment methods
- User preferences and settings
- Recent data within retention period

### Upgrade Benefits
When you upgrade your subscription:
- ✅ Existing data is preserved
- ✅ New retention period applies from upgrade date
- ✅ No immediate data loss upon upgrade
- ✅ Previous data remains until next cleanup cycle

### Downgrade Impact
When you downgrade your subscription:
- ⚠️ Shorter retention period takes effect immediately
- ⚠️ Older data will be removed on next cleanup cycle
- ⚠️ Export your data before downgrading if needed
- ⚠️ Cannot recover data after cleanup

## Data Export

### Before Downgrading or Canceling
We recommend exporting your data if you:
- Plan to downgrade to a plan with shorter retention
- Are canceling your subscription
- Want a backup of your purchase history

### Export Features (Premium Only)
- CSV export of all receipts
- JSON export with full details
- Price history reports
- Spending analytics export

## Technical Implementation

### Cloud Function: `cleanupOldUserData`

**Schedule**: `0 2 1 * *` (2 AM UTC on 1st of each month)

**Process Flow**:
```
1. Load all users
2. For each user:
   a. Get subscription plan
   b. Calculate retention cutoff date
   c. Delete old receipts
   d. Update aggregated items
   e. Recalculate shop stats
   f. Clean other collections
3. Log cleanup summary
```

**Performance**:
- Batched deletions (500 operations per batch)
- Parallel processing where possible
- Error handling per user (continues on failure)
- Comprehensive logging for audit trail

### Monitoring

Cleanup metrics logged:
- Users processed
- Receipts deleted
- Items updated
- Shopping lists deleted
- Notifications deleted
- Price alerts deleted
- Budgets deleted

## Compliance

### GDPR Compliance
- ✅ Automatic data deletion
- ✅ Configurable retention periods
- ✅ User data minimization
- ✅ Transparent retention policy

### User Rights
- Right to data portability (export)
- Right to deletion (cancel subscription)
- Right to access (view all data)
- Right to rectification (edit data)

## FAQs

### Q: Can I recover deleted data?
**A**: No, once data is deleted during cleanup, it cannot be recovered. Export your data before downgrading if you need a backup.

### Q: What happens if I upgrade mid-month?
**A**: Your new retention period starts immediately. Old data within the new period is preserved.

### Q: Is there a grace period before deletion?
**A**: No grace period. Data older than retention period is deleted on the 1st of each month at 2 AM UTC.

### Q: Can I request longer retention?
**A**: Retention periods are fixed per plan. Upgrade to Premium for maximum 3-month retention.

### Q: What if I'm between subscriptions?
**A**: If unsubscribed, you default to 1-month retention (same as Basic plan).

### Q: Does the cleanup affect performance?
**A**: No. Cleanup runs during off-peak hours (2 AM UTC) and is optimized for minimal impact.

### Q: Will I be notified before data deletion?
**A**: We send an email notification 7 days before the monthly cleanup if you have data approaching the retention limit.

## Contact Support

For questions about data retention:
- Email: support@goshopper.ai
- In-app: Settings → Help & Support
- Website: https://goshopper.ai/support

---

**Last Updated**: January 3, 2026  
**Version**: 1.0  
**Effective Date**: January 1, 2026
