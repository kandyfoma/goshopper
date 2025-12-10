# Features Specification

## Overview

This document provides detailed specifications for each feature in Invoice Intelligence, including acceptance criteria, edge cases, and implementation notes.

---

## Feature 1: Invoice Scanning

### Description
Users can capture photos of receipts/invoices and have them automatically parsed into structured data using AI.

### User Stories
- As a user, I want to take a photo of my receipt so that I don't have to manually enter the data.
- As a user, I want to review and edit the extracted data before saving.
- As a user, I want to pick an image from my gallery if I've already taken a photo.

### Acceptance Criteria

| ID | Criteria | Priority |
|----|----------|----------|
| SC-1 | Camera opens when user taps "Scan" button | Must |
| SC-2 | User can toggle flash on/off/auto | Should |
| SC-3 | User can select image from device gallery | Must |
| SC-4 | Image is sent to Gemini API for parsing | Must |
| SC-5 | Loading state shown during processing (2-5 sec) | Must |
| SC-6 | Extracted data shown on validation screen | Must |
| SC-7 | All fields (store, date, items, prices) are editable | Must |
| SC-8 | User can add new items manually | Must |
| SC-9 | User can delete items | Must |
| SC-10 | Total auto-calculates from item totals | Must |
| SC-11 | Invoice saved to Firestore on confirmation | Must |
| SC-12 | Success confirmation shown after save | Must |
| SC-13 | Trial scan count decremented (if not subscribed) | Must |
| SC-14 | Error shown if parsing fails with retry option | Must |

### Technical Notes
- Image resized to max 1024x1536 before API call
- Base64 encoding for Gemini API
- Timeout: 30 seconds for API call
- Retry logic: 2 additional attempts on failure

### Edge Cases
| Case | Handling |
|------|----------|
| Blurry image | Show "Image quality too low" error with tips |
| Receipt in different language | Gemini handles multi-language; normalize output |
| Handwritten receipt | Attempt parsing; lower confidence expected |
| Very long receipt | Support scrolling; no item limit |
| No items detected | Allow manual entry fallback |
| Offline | Block scan; show offline message |
| Trial exhausted | Show paywall before camera opens |

---

## Feature 2: Price Comparison

### Description
Users can compare prices of items across different stores using public price data uploaded by merchants.

### User Stories
- As a user, I want to search for an item to see prices at different stores.
- As a user, I want to see which store has the best price.
- As a user, I want to see my own purchase history for comparison.

### Acceptance Criteria

| ID | Criteria | Priority |
|----|----------|----------|
| PC-1 | List view shows all items with prices | Must |
| PC-2 | Search bar filters items by name | Must |
| PC-3 | Category filter chips available | Should |
| PC-4 | Each item shows best price prominently | Must |
| PC-5 | Price range (min-max) displayed | Should |
| PC-6 | Tapping item opens detail view | Must |
| PC-7 | Detail view shows all store prices | Must |
| PC-8 | Detail view shows user's purchase history | Should |
| PC-9 | Prices sorted by lowest first | Must |
| PC-10 | Store name and update date shown | Must |
| PC-11 | Pull-to-refresh updates data | Should |
| PC-12 | Offline mode shows cached data | Should |

### Technical Notes
- Firestore query with `where('itemNameNormalized', '==', normalized)`
- Real-time listener for price updates
- Local caching with Firestore persistence
- Item name normalization: lowercase, remove special chars

### Data Requirements
- Public price data must be available
- Minimum 3 stores for meaningful comparison
- Prices updated at least monthly

---

## Feature 3: Spending Reports (Dashboard)

### Description
Users can view summaries and visualizations of their spending based on scanned invoices.

### User Stories
- As a user, I want to see how much I spent this month.
- As a user, I want to see spending broken down by category.
- As a user, I want to see my estimated savings.
- As a user, I want to view my invoice history.

### Acceptance Criteria

| ID | Criteria | Priority |
|----|----------|----------|
| DR-1 | Monthly total spending displayed prominently | Must |
| DR-2 | Comparison to previous month (% change) | Should |
| DR-3 | Estimated savings amount shown | Should |
| DR-4 | Invoice count displayed | Must |
| DR-5 | Category breakdown pie chart | Must |
| DR-6 | Category list with amounts | Must |
| DR-7 | Recent invoices list (last 5) | Must |
| DR-8 | "See All" navigates to full invoice list | Must |
| DR-9 | Date range selector (this month, last month, custom) | Should |
| DR-10 | Invoice detail view accessible | Must |
| DR-11 | Delete invoice option | Should |

### Calculations

**Monthly Total:**
```
monthlyTotal = SUM(invoice.total) WHERE invoice.date IN currentMonth
```

**Estimated Savings:**
```
estimatedSavings = SUM(
  FOR each item in user invoices:
    (item.price - bestPublicPrice) * quantity
  IF item.price > bestPublicPrice
)
```

**Category Breakdown:**
```
categoryTotals = GROUP BY item.category, SUM(item.totalPrice)
```

### Technical Notes
- Queries limited to user's private invoices
- Calculations done client-side for small datasets
- Consider Cloud Functions for large datasets
- Charts rendered with react-native-chart-kit

---

## Feature 4: Subscription & Payments

### Description
Users start with a free trial (2 months) and can upgrade to paid access. Payment methods vary by location:
- **DRC Users**: Choice of Mobile Money (M-Pesa, Orange, Airtel, AfriMoney) or Visa/Card
- **International Users**: Visa/Card payment only (via Stripe)

### User Stories
- As a user, I want to try the app for free before paying.
- As a DRC user, I want to pay with my Mobile Money account.
- As an international user, I want to pay with my credit/debit card.
- As a user, I want to know how many free scans I have left.
- As a user, I want to manage my subscription.

### Acceptance Criteria

| ID | Criteria | Priority |
|----|----------|----------|
| SB-1 | New users get 2-month free trial | Must |
| SB-2 | Trial counter visible in UI | Must |
| SB-3 | Paywall appears when trial expires | Must |
| SB-4 | Basic plan option ($1.99) | Must |
| SB-5 | Standard plan option ($2.99) | Must |
| SB-6 | Premium plan option ($4.99) | Must |
| SB-7 | **DRC users see Mobile Money and Visa options** | Must |
| SB-8 | **International users see Visa option only** | Must |
| SB-9 | Mobile Money providers selectable (M-Pesa, Orange, Airtel, AfriMoney) | Must |
| SB-10 | Phone number input for Mobile Money | Must |
| SB-11 | Email input for card payment | Must |
| SB-12 | Payment initiated via Moko Afrika (Mobile Money) | Must |
| SB-13 | **Payment initiated via Stripe (Card)** | Must |
| SB-14 | Success screen after payment | Must |
| SB-15 | Subscription status updated in real-time | Must |
| SB-16 | Subscription end date visible | Must |
| SB-17 | Expired subscription blocks scans | Must |

### Payment Methods by Location

| User Location | Mobile Money | Visa/Card | Notes |
|--------------|--------------|-----------|-------|
| **DRC (+243)** | ✓ | ✓ | User can choose either payment method |
| **International** | ✗ | ✓ | Visa/Card is the only option |

### Business Rules

| Rule | Description |
|------|-------------|
| Trial Duration | 2 months (60 days), non-renewable |
| Location Detection | Based on phone number prefix (+243 = DRC) |
| Mobile Money Provider | Moko Afrika for DRC payments |
| Card Payment Provider | Stripe for Visa/Card payments |
| Subscription Duration | Monthly: 30 days |
| Currency | USD primary, CDF displayed for DRC |

### Payment Flow States
```
1. IDLE → User not in payment flow
2. SELECTING → User choosing plan
3. CHOOSING_METHOD → DRC user choosing Mobile Money or Card
4. ENTERING_DETAILS → Phone number (Mobile Money) or Email (Card)
5. PROCESSING → Payment request sent
6. AWAITING_CONFIRMATION → User confirming on phone (Mobile Money)
7. SUCCESS → Payment complete
8. FAILED → Payment failed
9. CANCELLED → User cancelled
```

---

## Feature 5: Two-Factor Authentication (2FA)

### Description
Users are verified during registration with location-based 2FA:
- **DRC Users (+243 phone)**: SMS verification to phone number
- **International Users**: Email verification

### User Stories
- As a DRC user, I want to verify my account with my phone number.
- As an international user, I want to verify my account with my email.
- As a user, I want my account to be secure with 2FA.

### Acceptance Criteria

| ID | Criteria | Priority |
|----|----------|----------|
| 2F-1 | Location detected from phone number prefix | Must |
| 2F-2 | DRC users receive SMS verification code | Must |
| 2F-3 | International users receive email verification code | Must |
| 2F-4 | 6-digit verification code generated | Must |
| 2F-5 | Code expires after 10 minutes | Must |
| 2F-6 | Code valid for single use | Must |
| 2F-7 | Maximum 3 verification attempts | Must |
| 2F-8 | Clear error messages for failed verification | Must |
| 2F-9 | Resend code option available | Should |
| 2F-10 | Verification status stored in user profile | Must |

### Verification Methods by Location

| User Location | Verification Method | Provider |
|--------------|---------------------|----------|
| **DRC (+243)** | SMS | Africa's Talking |
| **International** | Email | SendGrid |

### Verification Flow

```
1. User enters phone number or email
2. System detects location from phone prefix
3. IF +243 (DRC):
   - Send 6-digit code via SMS (Africa's Talking)
4. ELSE (International):
   - Send 6-digit code via Email (SendGrid)
5. User enters code
6. System verifies code
7. IF valid: Mark user as verified
8. IF invalid: Show error, allow retry (max 3)
```

### Technical Notes
- SMS Provider: Africa's Talking (supports DRC)
- Email Provider: SendGrid
- Code Format: 6-digit numeric
- Code Expiry: 10 minutes
- Max Attempts: 3 per session
- Rate Limiting: 1 code per minute

### Edge Cases
| Case | Handling |
|------|----------|
| Invalid phone format | Show format helper |
| SMS delivery failure | Allow retry after 60s |
| Email delivery failure | Check spam folder prompt |
| Max attempts exceeded | Lock out for 15 minutes |
| Code expired | Allow resend |

---

## Feature 6: Authentication

### Description
Users are authenticated anonymously to enable data persistence without requiring account creation.

### User Stories
- As a user, I want to use the app without creating an account.
- As a user, I want my data to persist across sessions.
- As a user, I want the option to upgrade to a full account later.

### Acceptance Criteria

| ID | Criteria | Priority |
|----|----------|----------|
| AU-1 | Anonymous sign-in happens automatically on first launch | Must |
| AU-2 | User ID persisted across app sessions | Must |
| AU-3 | Data associated with anonymous user | Must |
| AU-4 | Option to link email/password (in Settings) | Should |
| AU-5 | Sign out clears local data (with warning) | Should |

### Technical Notes
- Firebase Auth anonymous provider
- UID stored in secure storage
- Can link to email/password later
- If user deletes app, new anonymous account created (data lost)

### Data Migration
When upgrading from anonymous to email account:
1. Link credentials to existing UID
2. All data remains associated
3. No data migration needed

---

## Feature 6: Offline Support

### Description
Core features work offline with data syncing when connection is restored.

### User Stories
- As a user, I want to view my invoices when offline.
- As a user, I want to see cached price data when offline.
- As a user, I want to know when I'm offline.

### Acceptance Criteria

| ID | Criteria | Priority |
|----|----------|----------|
| OF-1 | Offline indicator shown when no connection | Must |
| OF-2 | Saved invoices viewable offline | Must |
| OF-3 | Cached price data viewable offline | Should |
| OF-4 | Scanning blocked offline (requires AI) | Must |
| OF-5 | Clear message explaining offline limitations | Must |
| OF-6 | Auto-sync when connection restored | Must |

### Technical Notes
- Firestore offline persistence enabled by default
- Network status checked before scan
- Graceful degradation messaging

---

## Feature 7: Multi-Language Support

### Description
App supports French (primary) and English for the DRC market.

### User Stories
- As a French-speaking user, I want the app in French.
- As an English-speaking user, I want the option to use English.

### Acceptance Criteria

| ID | Criteria | Priority |
|----|----------|----------|
| ML-1 | Default language is French | Must |
| ML-2 | Language selector in Settings | Should |
| ML-3 | All UI text translatable | Must |
| ML-4 | Receipt parsing works in both languages | Must |
| ML-5 | Currency formatting respects locale | Should |

### Supported Languages
| Code | Language | Status |
|------|----------|--------|
| `fr` | French | Primary |
| `en` | English | Secondary |

---

## Feature 8: Subscription Management

### Description
Users can choose from tiered subscription plans with different scan limits and features, with a generous free trial to try premium features before subscribing.

### User Stories
- As a new user, I want to try all features for free before subscribing.
- As a user, I want to see different pricing options.
- As a user, I want to know how many scans I have left.
- As a user, I want to upgrade/downgrade my plan.

### Acceptance Criteria

| ID | Criteria | Priority |
|----|----------|----------|
| SM-1 | New users get 2-month free trial with full access | Must |
| SM-2 | Trial users have unlimited scans during trial | Must |
| SM-3 | Trial expiration warning shown 7 days before end | Must |
| SM-4 | Usage counter shown in app | Must |
| SM-5 | Paywall shown when trial expires | Must |
| SM-6 | Three pricing tiers displayed | Must |
| SM-7 | Mobile Money payment integration | Must |
| SM-8 | Subscription status synced across devices | Must |
| SM-9 | Usage resets monthly | Must |
| SM-10 | Plan changes take effect immediately | Should |

### Free Trial Details

| Aspect | Details |
|--------|---------|
| **Duration** | 2 months from first scan |
| **Access Level** | Full premium features (unlimited scans) |
| **Expiration Warning** | 7 days before trial ends |
| **Post-Trial** | Must choose paid plan to continue |
| **Trial Extension** | One-time 1-month extension available |

### Pricing Tiers

| Plan | Price/Month | Scan Limit | Trial Access |
|------|-------------|------------|--------------|
| **Basic** | $1.99 (8,000 CDF) | 25 scans | 2 months free |
| **Standard** | $2.99 (12,000 CDF) | 100 scans | 2 months free |
| **Premium** | $4.99 (20,000 CDF) | Unlimited | 2 months free |

### Trial User Flow

```
1. User downloads app
2. Anonymous authentication (no account required)
3. First scan triggers 2-month trial start
4. Full access to all features during trial
5. At 1.5 months: "You're loving the premium features!" (soft prompt)
6. At 1.75 months: Trial expiration warning (7 days left)
7. At 2 months: Trial expired → Choose plan or extend trial
8. Payment → Continue with chosen plan
```

### Technical Notes
- Trial start timestamp stored in Firestore
- Trial duration: 60 days from first scan
- Trial extension: Additional 30 days (one-time)
- Monthly billing cycle
- Auto-renewal via Moko Afrika webhooks
- Usage tracking in Firestore
- Grace period for failed payments

### Edge Cases
| Case | Handling |
|------|----------|
| Payment fails | Show warning, allow retry, suspend after 3 days |
| User exceeds limit | Block scanning, show upgrade prompt |
| Plan downgrade | Apply at next billing cycle |
| Refund request | Manual review process |

---

## Feature Availability by Plan

| Feature | Basic | Standard | Premium | Notes |
|---------|-------|----------|---------|-------|
| **Core Scanning** | ✓ | ✓ | ✓ | |
| Invoice Scanning | ✓ | ✓ | ✓ | Camera/gallery capture |
| Validation/Editing | ✓ | ✓ | ✓ | Manual corrections |
| Private Invoice Storage | ✓ | ✓ | ✓ | Firestore persistence |
| **Authentication** | ✓ | ✓ | ✓ | |
| Anonymous Auth | ✓ | ✓ | ✓ | No account required |
| Trial Tracking | ✓ | ✓ | ✓ | 2-month free trial with full access |
| Paywall | ✓ | ✓ | ✓ | Upgrade prompts |
| Mobile Money Payment | ✓ | ✓ | ✓ | Moko Afrika integration |
| **Price Features** | ✓ | ✓ | ✓ | |
| Basic Price Comparison | ✓ | ✓ | ✓ | Store price lookup |
| **Analytics** |  | ✓ | ✓ | |
| Dashboard/Reports |  | ✓ | ✓ | Spending summaries |
| Category Breakdown |  | ✓ | ✓ | Spending by category |
| Price History Charts |  | ✓ | ✓ | Historical trends |
| **Advanced Features** |  |  | ✓ | |
| Price Alerts |  |  | ✓ | Price drop notifications |
| Shopping Lists |  |  | ✓ | Optimized shopping |
| Data Export |  |  | ✓ | CSV/PDF export |
| **Support** |  |  | ✓ | |
| Priority Support |  |  | ✓ | Faster response |
| **Offline & Localization** | ✓ | ✓ | ✓ | |
| Offline Viewing | ✓ | ✓ | ✓ | Cached data access |
| French Localization | ✓ | ✓ | ✓ | Primary language |

---

## Non-Functional Requirements

### Performance
| Metric | Target |
|--------|--------|
| App launch time | < 3 seconds |
| Scan processing | < 5 seconds |
| Screen navigation | < 300ms |
| API response (cached) | < 100ms |

### Security
- All data in transit encrypted (HTTPS)
- Firebase Security Rules enforced
- API keys restricted by app signature
- No PII stored beyond what user provides

### Accessibility
- Minimum touch target: 44x44 points
- Color contrast ratio: 4.5:1 minimum
- Screen reader compatible labels
- Support for system font scaling

### Device Support
| Platform | Minimum Version |
|----------|-----------------|
| Android | 8.0 (API 26) |
| iOS | 13.0 |
| Web | Modern browsers |

---

*Next: [Development Setup](../development/SETUP.md)*
