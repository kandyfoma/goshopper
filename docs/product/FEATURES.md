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

| ID    | Criteria                                             | Priority |
| ----- | ---------------------------------------------------- | -------- |
| SC-1  | Camera opens when user taps "Scan" button            | Must     |
| SC-2  | User can toggle flash on/off/auto                    | Should   |
| SC-3  | User can select image from device gallery            | Must     |
| SC-4  | Image is sent to Gemini API for parsing              | Must     |
| SC-5  | Loading state shown during processing (2-5 sec)      | Must     |
| SC-6  | Extracted data shown on validation screen            | Must     |
| SC-7  | All fields (store, date, items, prices) are editable | Must     |
| SC-8  | User can add new items manually                      | Must     |
| SC-9  | User can delete items                                | Must     |
| SC-10 | Total auto-calculates from item totals               | Must     |
| SC-11 | Invoice saved to Firestore on confirmation           | Must     |
| SC-12 | Success confirmation shown after save                | Must     |
| SC-13 | Trial scan count decremented (if not subscribed)     | Must     |
| SC-14 | Error shown if parsing fails with retry option       | Must     |

### Technical Notes

- Image resized to max 1024x1536 before API call
- Base64 encoding for Gemini API
- Timeout: 30 seconds for API call
- Retry logic: 2 additional attempts on failure

### Edge Cases

| Case                          | Handling                                        |
| ----------------------------- | ----------------------------------------------- |
| Blurry image                  | Show "Image quality too low" error with tips    |
| Receipt in different language | Gemini handles multi-language; normalize output |
| Handwritten receipt           | Attempt parsing; lower confidence expected      |
| Very long receipt             | Support scrolling; no item limit                |
| No items detected             | Allow manual entry fallback                     |
| Offline                       | Block scan; show offline message                |
| Trial exhausted               | Show paywall before camera opens                |

---

## Feature 2: Price Comparison

### Description

Users can compare prices of items across different stores using public price data uploaded by merchants.

### User Stories

- As a user, I want to search for an item to see prices at different stores.
- As a user, I want to see which store has the best price.
- As a user, I want to see my own purchase history for comparison.

### Acceptance Criteria

| ID    | Criteria                                  | Priority |
| ----- | ----------------------------------------- | -------- |
| PC-1  | List view shows all items with prices     | Must     |
| PC-2  | Search bar filters items by name          | Must     |
| PC-3  | Category filter chips available           | Should   |
| PC-4  | Each item shows best price prominently    | Must     |
| PC-5  | Price range (min-max) displayed           | Should   |
| PC-6  | Tapping item opens detail view            | Must     |
| PC-7  | Detail view shows all store prices        | Must     |
| PC-8  | Detail view shows user's purchase history | Should   |
| PC-9  | Prices sorted by lowest first             | Must     |
| PC-10 | Store name and update date shown          | Must     |
| PC-11 | Pull-to-refresh updates data              | Should   |
| PC-12 | Offline mode shows cached data            | Should   |

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

| ID    | Criteria                                             | Priority |
| ----- | ---------------------------------------------------- | -------- |
| DR-1  | Monthly total spending displayed prominently         | Must     |
| DR-2  | Comparison to previous month (% change)              | Should   |
| DR-3  | Estimated savings amount shown                       | Should   |
| DR-4  | Invoice count displayed                              | Must     |
| DR-5  | Category breakdown pie chart                         | Must     |
| DR-6  | Category list with amounts                           | Must     |
| DR-7  | Recent invoices list (last 5)                        | Must     |
| DR-8  | "See All" navigates to full invoice list             | Must     |
| DR-9  | Date range selector (this month, last month, custom) | Should   |
| DR-10 | Invoice detail view accessible                       | Must     |
| DR-11 | Delete invoice option                                | Should   |

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

| ID    | Criteria                                                              | Priority |
| ----- | --------------------------------------------------------------------- | -------- |
| SB-1  | New users get 2-month free trial                                      | Must     |
| SB-2  | Trial counter visible in UI                                           | Must     |
| SB-3  | Paywall appears when trial expires                                    | Must     |
| SB-4  | Basic plan option ($1.99)                                             | Must     |
| SB-5  | Standard plan option ($2.99)                                          | Must     |
| SB-6  | Premium plan option ($4.99)                                           | Must     |
| SB-7  | **DRC users see Mobile Money and Visa options**                       | Must     |
| SB-8  | **International users see Visa option only**                          | Must     |
| SB-9  | Mobile Money providers selectable (M-Pesa, Orange, Airtel, AfriMoney) | Must     |
| SB-10 | Phone number input for Mobile Money                                   | Must     |
| SB-11 | Email input for card payment                                          | Must     |
| SB-12 | Payment initiated via Moko Afrika (Mobile Money)                      | Must     |
| SB-13 | **Payment initiated via Stripe (Card)**                               | Must     |
| SB-14 | Success screen after payment                                          | Must     |
| SB-15 | Subscription status updated in real-time                              | Must     |
| SB-16 | Subscription end date visible                                         | Must     |
| SB-17 | Expired subscription blocks scans                                     | Must     |

### Payment Methods by Location

| User Location     | Mobile Money | Visa/Card | Notes                                 |
| ----------------- | ------------ | --------- | ------------------------------------- |
| **DRC (+243)**    | ✓            | ✓         | User can choose either payment method |
| **International** | ✗            | ✓         | Visa/Card is the only option          |

### Business Rules

| Rule                  | Description                               |
| --------------------- | ----------------------------------------- |
| Trial Duration        | 2 months (60 days), non-renewable         |
| Location Detection    | Based on phone number prefix (+243 = DRC) |
| Mobile Money Provider | Moko Afrika for DRC payments              |
| Card Payment Provider | Stripe for Visa/Card payments             |
| Subscription Duration | Monthly: 30 days                          |
| Currency              | USD primary, CDF displayed for DRC        |

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

| ID    | Criteria                                            | Priority |
| ----- | --------------------------------------------------- | -------- |
| 2F-1  | Location detected from phone number prefix          | Must     |
| 2F-2  | DRC users receive SMS verification code             | Must     |
| 2F-3  | International users receive email verification code | Must     |
| 2F-4  | 6-digit verification code generated                 | Must     |
| 2F-5  | Code expires after 10 minutes                       | Must     |
| 2F-6  | Code valid for single use                           | Must     |
| 2F-7  | Maximum 3 verification attempts                     | Must     |
| 2F-8  | Clear error messages for failed verification        | Must     |
| 2F-9  | Resend code option available                        | Should   |
| 2F-10 | Verification status stored in user profile          | Must     |

### Verification Methods by Location

| User Location     | Verification Method | Provider         |
| ----------------- | ------------------- | ---------------- |
| **DRC (+243)**    | SMS                 | Africa's Talking |
| **International** | Email               | SendGrid         |

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

| Case                   | Handling                 |
| ---------------------- | ------------------------ |
| Invalid phone format   | Show format helper       |
| SMS delivery failure   | Allow retry after 60s    |
| Email delivery failure | Check spam folder prompt |
| Max attempts exceeded  | Lock out for 15 minutes  |
| Code expired           | Allow resend             |

---

## Feature 6: Authentication

### Description

Users are authenticated anonymously to enable data persistence without requiring account creation.

### User Stories

- As a user, I want to use the app without creating an account.
- As a user, I want my data to persist across sessions.
- As a user, I want the option to upgrade to a full account later.

### Acceptance Criteria

| ID   | Criteria                                                | Priority |
| ---- | ------------------------------------------------------- | -------- |
| AU-1 | Anonymous sign-in happens automatically on first launch | Must     |
| AU-2 | User ID persisted across app sessions                   | Must     |
| AU-3 | Data associated with anonymous user                     | Must     |
| AU-4 | Option to link email/password (in Settings)             | Should   |
| AU-5 | Sign out clears local data (with warning)               | Should   |

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

| ID   | Criteria                                     | Priority |
| ---- | -------------------------------------------- | -------- |
| OF-1 | Offline indicator shown when no connection   | Must     |
| OF-2 | Saved invoices viewable offline              | Must     |
| OF-3 | Cached price data viewable offline           | Should   |
| OF-4 | Scanning blocked offline (requires AI)       | Must     |
| OF-5 | Clear message explaining offline limitations | Must     |
| OF-6 | Auto-sync when connection restored           | Must     |

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

| ID   | Criteria                                | Priority |
| ---- | --------------------------------------- | -------- |
| ML-1 | Default language is French              | Must     |
| ML-2 | Language selector in Settings           | Should   |
| ML-3 | All UI text translatable                | Must     |
| ML-4 | Receipt parsing works in both languages | Must     |
| ML-5 | Currency formatting respects locale     | Should   |

### Supported Languages

| Code | Language | Status    |
| ---- | -------- | --------- |
| `fr` | French   | Primary   |
| `en` | English  | Secondary |

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

| ID    | Criteria                                          | Priority |
| ----- | ------------------------------------------------- | -------- |
| SM-1  | New users get 2-month free trial with full access | Must     |
| SM-2  | Trial users have 50 scans during trial     | Must     |
| SM-3  | Trial expiration warning shown 7 days before end  | Must     |
| SM-4  | Usage counter shown in app                        | Must     |
| SM-5  | Paywall shown when trial expires                  | Must     |
| SM-6  | Three pricing tiers displayed                     | Must     |
| SM-7  | Mobile Money payment integration                  | Must     |
| SM-8  | Subscription status synced across devices         | Must     |
| SM-9  | Usage resets monthly                              | Must     |
| SM-10 | Plan changes take effect immediately              | Should   |

### Free Trial Details

| Aspect                 | Details                                 |
| ---------------------- | --------------------------------------- |
| **Duration**           | 2 months from first scan                |
| **Access Level**       | Full premium features (limited scans)   |
| **Scan Limit**         | 50 scans total during trial             |
| **Expiration Warning** | 7 days before trial ends                |
| **Post-Trial**         | Must choose paid plan to continue       |
| **Trial Extension**    | One-time 1-month extension available    |

### Pricing Tiers

| Plan         | Price/Month        | Scan Limit | Trial Access  |
| ------------ | ------------------ | ---------- | ------------- |
| **Basic**    | $1.99 (8,000 CDF)  | 25 scans   | 50 scans free |
| **Standard** | $2.99 (12,000 CDF) | 100 scans  | 50 scans free |
| **Premium**  | $4.99 (20,000 CDF) | Unlimited  | 50 scans free |

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

| Case               | Handling                                        |
| ------------------ | ----------------------------------------------- |
| Payment fails      | Show warning, allow retry, suspend after 3 days |
| User exceeds limit | Block scanning, show upgrade prompt             |
| Plan downgrade     | Apply at next billing cycle                     |
| Refund request     | Manual review process                           |

---

## Feature Availability by Plan

| Feature                    | Basic | Standard | Premium | Notes                               |
| -------------------------- | ----- | -------- | ------- | ----------------------------------- |
| **Core Scanning**          | ✓     | ✓        | ✓       |                                     |
| Invoice Scanning           | ✓     | ✓        | ✓       | Camera/gallery capture              |
| Validation/Editing         | ✓     | ✓        | ✓       | Manual corrections                  |
| Private Invoice Storage    | ✓     | ✓        | ✓       | Firestore persistence               |
| **Authentication**         | ✓     | ✓        | ✓       |                                     |
| Anonymous Auth             | ✓     | ✓        | ✓       | No account required                 |
| Trial Tracking             | ✓     | ✓        | ✓       | 2-month free trial with full access |
| Paywall                    | ✓     | ✓        | ✓       | Upgrade prompts                     |
| Mobile Money Payment       | ✓     | ✓        | ✓       | Moko Afrika integration             |
| **Price Features**         | ✓     | ✓        | ✓       |                                     |
| Basic Price Comparison     | ✓     | ✓        | ✓       | Store price lookup                  |
| **Analytics**              |       | ✓        | ✓       |                                     |
| Dashboard/Reports          |       | ✓        | ✓       | Spending summaries                  |
| Category Breakdown         |       | ✓        | ✓       | Spending by category                |
| Price History Charts       |       | ✓        | ✓       | Historical trends                   |
| **Advanced Features**      |       |          | ✓       |                                     |
| Price Alerts               |       |          | ✓       | Price drop notifications            |
| Shopping Lists             |       |          | ✓       | Optimized shopping                  |
| Data Export                |       |          | ✓       | CSV/PDF export                      |
| **Support**                |       |          | ✓       |                                     |
| Priority Support           |       |          | ✓       | Faster response                     |
| **Offline & Localization** | ✓     | ✓        | ✓       |                                     |
| Offline Viewing            | ✓     | ✓        | ✓       | Cached data access                  |
| French Localization        | ✓     | ✓        | ✓       | Primary language                    |

---

## Feature 9: Long Receipt / Multi-Photo Capture

### Description

Users can capture very long receipts that don't fit in a single photo by taking multiple overlapping photos. The system automatically merges them into a single receipt.

### User Stories

- As a user, I want to scan long receipts that don't fit in one photo.
- As a user, I want to take multiple photos and have them merged automatically.
- As a user, I want to review and retake individual photos before processing.

### Acceptance Criteria

| ID    | Criteria                                                  | Priority |
| ----- | --------------------------------------------------------- | -------- |
| LR-1  | "Long Receipt" button available on home screen            | Must     |
| LR-2  | User can capture up to 5 photos per receipt               | Must     |
| LR-3  | Photo thumbnails shown with add/remove/retake options     | Must     |
| LR-4  | Overlap guidance shown for better merging                 | Should   |
| LR-5  | All photos processed as single receipt (counts as 1 scan) | Must     |
| LR-6  | Store info taken from first photo                         | Must     |
| LR-7  | All items merged from all photos                          | Must     |
| LR-8  | Totals taken from last photo                              | Must     |
| LR-9  | Processing progress shown for each photo                  | Must     |
| LR-10 | Error handling for individual photo failures              | Must     |

### Technical Implementation

**Frontend:**

- `MultiPhotoScannerScreen` with photo management
- Up to 5 photos per receipt
- Visual thumbnails with status indicators
- Single API call with image array

**Backend:**

- `parseReceiptV2` Cloud Function accepts image arrays
- Parallel processing of all images
- Smart merging: header from first, items from all, totals from last
- Deduplication of overlapping items

### User Flow

```
Home Screen → Long Receipt Button → Multi-Photo Scanner
    ↓
Take Photo 1 (header) → Take Photo 2 (middle) → Take Photo 3 (bottom)
    ↓
Review Thumbnails → Add/Remove/Retake Photos → Process All
    ↓
AI Merges All Photos → Single Receipt Created → Receipt Detail
```

### Edge Cases

| Case                | Handling                                  |
| ------------------- | ----------------------------------------- |
| Photos out of order | AI sorts by content (header→items→totals) |
| Missing overlap     | Attempt merge; warn if confidence low     |
| Different lighting  | Process individually; merge results       |
| Only 1 photo        | Falls back to single-photo processing     |
| Network timeout     | Retry logic for individual photos         |

---

## Feature 10: Shop Categorization & Organization

### Description

Shops are automatically created and organized from scanned receipts. Users can view receipts grouped by store with spending analytics per shop.

### User Stories

- As a user, I want to see all my receipts organized by store.
- As a user, I want to know how much I've spent at each store.
- As a user, I want to see when I last visited each store.

### Acceptance Criteria

| ID   | Criteria                                                   | Priority |
| ---- | ---------------------------------------------------------- | -------- |
| SC-1 | Shop automatically created when receipt scanned            | Must     |
| SC-2 | Shop name extracted from receipt header by AI              | Must     |
| SC-3 | Known stores normalized (Shoprite, Carrefour, etc.)        | Must     |
| SC-4 | Shop stats updated: receipt count, total spent, last visit | Must     |
| SC-5 | Shop list view shows all shops with key metrics            | Must     |
| SC-6 | Receipts filterable by shop                                | Must     |
| SC-7 | Shop detail view shows all receipts for that shop          | Should   |
| SC-8 | Shop deletion removes all associated receipts              | Should   |

### Data Structure

**Shop Document:**

```typescript
{
  id: string;              // Normalized shop name
  name: string;            // Original shop name
  nameNormalized: string;  // For matching
  address?: string;
  phone?: string;
  receiptCount: number;
  totalSpent: number;
  currency: 'USD' | 'CDF';
  lastVisit: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Receipt Organization:**

- Receipts stored in `users/{userId}/receipts/` collection
- Each receipt has `storeNameNormalized` field
- Shops stored in `users/{userId}/shops/` collection
- Automatic shop creation/update on receipt save

### Known Store Mappings

| Detected Name           | Normalized ID | Display Name    |
| ----------------------- | ------------- | --------------- |
| Shoprite, shoprite      | shoprite      | Shoprite        |
| Carrefour, carrefour    | carrefour     | Carrefour       |
| Peloustore, pelou store | peloustore    | Peloustore      |
| Hasson & Frères, hasson | hasson_freres | Hasson & Frères |

### Technical Notes

- Shop creation happens in `receiptStorageService.saveReceipt()`
- Real-time updates via Firestore listeners
- Shop deletion cascades to receipts (with confirmation)
- Shop names normalized for consistent matching

---

## Feature 11: User Profile & Settings Management

### Description

Users can manage their profile settings including language preferences, notification settings, and account preferences. Settings are persisted to Firestore and cached locally.

### User Stories

- As a user, I want to change my language preferences.
- As a user, I want to control notification settings.
- As a user, I want to manage my account preferences.

### Acceptance Criteria

| ID   | Criteria                                            | Priority |
| ---- | --------------------------------------------------- | -------- |
| UP-1 | User profile created automatically on first scan    | Must     |
| UP-2 | Profile settings persisted to Firestore             | Must     |
| UP-3 | Local caching for offline access                    | Must     |
| UP-4 | Language preference: French/Lingala/Swahili/English | Must     |
| UP-5 | Notification toggle for price alerts                | Must     |
| UP-6 | Currency preference: USD/CDF                        | Must     |
| UP-7 | Profile data synced across devices                  | Must     |
| UP-8 | Settings screen with all preferences                | Must     |

### Profile Data Structure

```typescript
interface UserProfile {
  userId: string;
  displayName?: string;
  phoneNumber?: string;
  preferredLanguage: 'fr' | 'ln' | 'sw' | 'en';
  preferredCurrency: 'USD' | 'CDF';
  notificationsEnabled: boolean;
  priceAlertsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Settings Available

| Setting       | Options                           | Default | Persistence |
| ------------- | --------------------------------- | ------- | ----------- |
| Language      | French, Lingala, Swahili, English | French  | Firestore   |
| Currency      | USD, CDF                          | USD     | Firestore   |
| Notifications | On/Off                            | On      | Firestore   |
| Price Alerts  | On/Off                            | On      | Firestore   |

### Technical Implementation

**UserContext:**

- Manages profile state with Firestore real-time listeners
- AsyncStorage caching for offline access
- Automatic profile creation for new users
- Convenience methods for common updates

**Settings Screen:**

- Real-time updates to profile
- Immediate UI feedback
- Error handling for failed updates

---

## Feature 12: First-Time User Onboarding

### Description

New users see a welcoming onboarding flow that explains the app's features and guides them through their first scan.

### User Stories

- As a new user, I want to understand what the app does.
- As a new user, I want to see the app's key features.
- As a new user, I want guidance for my first scan.

### Acceptance Criteria

| ID   | Criteria                                          | Priority |
| ---- | ------------------------------------------------- | -------- |
| ON-1 | Welcome screen shown only on first launch         | Must     |
| ON-2 | 4-slide onboarding with key features              | Must     |
| ON-3 | Bilingual content (French + Lingala)              | Must     |
| ON-4 | Visual slides with large emojis                   | Must     |
| ON-5 | Swipe navigation between slides                   | Must     |
| ON-6 | Skip option available                             | Should   |
| ON-7 | Onboarding completion marked in storage           | Must     |
| ON-8 | Direct navigation to home screen after completion | Must     |

### Onboarding Slides

| Slide | Title (French) | Title (Lingala) | Content                           |
| ----- | -------------- | --------------- | --------------------------------- |
| 1     | Bienvenue!     | Boyei malamu!   | Welcome message with app overview |
| 2     | Photographiez  | Zwa foto        | How to scan receipts              |
| 3     | Analyse IA     | Analyse ya AI   | AI processing explanation         |
| 4     | Économisez     | Bombi mbongo    | Savings and price comparison      |

### Technical Implementation

**WelcomeScreen:**

- 4 slides with swipe navigation
- Dot indicators for progress
- Large 100px emojis for visual appeal
- French primary, Lingala secondary text
- AsyncStorage flag for completion tracking

**Navigation Logic:**

- Check `onboarding_complete` flag on app launch
- Show Welcome screen for new users
- Skip to Main screen for returning users

---

## Feature 13: Enhanced UI/UX for Target Users

### Description

The app's interface is optimized for Congolese housewives with larger touch targets, bilingual support, and simplified navigation.

### User Stories

- As a Congolese housewife, I want large, easy-to-tap buttons.
- As a user, I want the app in French and Lingala.
- As a user, I want clear visual guidance for each action.

### Acceptance Criteria

| ID   | Criteria                                     | Priority |
| ---- | -------------------------------------------- | -------- |
| UX-1 | Minimum touch target: 60x60 points           | Must     |
| UX-2 | Large scan button (72px icon) on home screen | Must     |
| UX-3 | Bilingual labels: French + Lingala           | Must     |
| UX-4 | Visual step-by-step guides                   | Must     |
| UX-5 | High contrast colors for readability         | Must     |
| UX-6 | Friendly, welcoming color scheme             | Must     |
| UX-7 | Large emoji icons for visual clarity         | Must     |
| UX-8 | Simplified navigation with clear CTAs        | Must     |

### UI Improvements Implemented

**Home Screen:**

- Giant SCANNER button with "Zwa foto" (Lingala)
- Time-based greeting in French + Lingala
- 3-step visual guide with emojis
- Large quick action cards

**Profile Screen:**

- Friendly avatar with family emoji
- Large stat cards with emoji indicators
- Bilingual action buttons
- Gamification badges

**Scanner:**

- Multi-photo support for long receipts
- Visual progress indicators
- Clear error messages in local languages

**Settings:**

- Large toggle switches
- Bilingual labels
- Profile persistence

### Design Principles

| Principle               | Implementation                            |
| ----------------------- | ----------------------------------------- |
| **Large Touch Targets** | 60px minimum, 72px for primary actions    |
| **Visual Hierarchy**    | Emojis guide attention, clear typography  |
| **Bilingual Support**   | French primary, Lingala for key terms     |
| **Simplified Flow**     | 3-step guides, minimal text               |
| **Cultural Relevance**  | DRC flag, local currency, familiar stores |

---

## Feature 14: Price Alerts (Phase 1.1)

### Description

Users can set target prices for items they frequently purchase and receive notifications when prices drop to or below their target.

### User Stories

- As a user, I want to set a price alert for an item so I know when it's on sale.
- As a user, I want to see all my active price alerts in one place.
- As a user, I want to be notified when a price drops to my target.
- As a user, I want to delete or modify my alerts easily.

### Acceptance Criteria

| ID    | Criteria                                              | Priority |
| ----- | ----------------------------------------------------- | -------- |
| PA-1  | User can create a price alert from any product        | Must     |
| PA-2  | Alert form includes product name, target price        | Must     |
| PA-3  | List of all user's alerts accessible from nav         | Must     |
| PA-4  | Active alerts show current lowest price               | Should   |
| PA-5  | Triggered alerts highlighted with "Deal Found!" badge | Must     |
| PA-6  | User can toggle alerts active/inactive                | Should   |
| PA-7  | User can delete alerts via swipe or button            | Must     |
| PA-8  | Push notification sent when alert triggers            | Must     |
| PA-9  | Notification includes store name and current price    | Must     |
| PA-10 | Alerts checked when new prices recorded               | Must     |
| PA-11 | Daily scheduled check for all active alerts           | Should   |

### Technical Notes

- Firestore collection: `apps/{appId}/users/{userId}/priceAlerts`
- Cloud Function triggers on new price data writes
- Scheduled Cloud Function runs daily at 9:00 AM
- FCM push notifications for alert triggers
- Price matching uses normalized product names

### Data Model

```typescript
interface PriceAlert {
  id: string;
  userId: string;
  productName: string;
  productNameNormalized: string;
  targetPrice: number;
  currency: string;
  currentLowestPrice?: number;
  currentLowestStore?: string;
  isActive: boolean;
  isTriggered: boolean;
  notificationSent: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  triggeredAt?: Timestamp;
}
```

---

## Feature 15: Offline Queue & Sync (Phase 1.1)

### Description

Users can scan receipts while offline. Scans are queued locally and automatically synchronized when network connectivity is restored.

### User Stories

- As a user, I want to scan receipts even when I have no internet.
- As a user, I want my offline scans to automatically upload when I'm back online.
- As a user, I want to see how many scans are waiting to sync.

### Acceptance Criteria

| ID   | Criteria                                         | Priority |
| ---- | ------------------------------------------------ | -------- |
| OQ-1 | Offline scans stored locally in AsyncStorage     | Must     |
| OQ-2 | Network status monitored continuously            | Must     |
| OQ-3 | Pending receipts count shown in UI               | Should   |
| OQ-4 | Auto-sync triggered when online                  | Must     |
| OQ-5 | Manual sync button available                     | Should   |
| OQ-6 | Sync status indicator (syncing, synced, error)   | Should   |
| OQ-7 | Failed syncs retried up to 3 times               | Must     |
| OQ-8 | Partial sync supported (some succeed, some fail) | Should   |

### Technical Notes

- Uses `@react-native-community/netinfo` for connectivity monitoring
- Local storage via AsyncStorage with key `@goshopper_offline_queue`
- Queue processed FIFO (First In, First Out)
- Exponential backoff for retry logic

### Data Model

```typescript
interface QueuedReceipt {
  id: string;
  images: string[]; // Base64 encoded
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'complete';
  error?: string;
}
```

---

## Feature 16: Push Notifications (Phase 1.1)

### Description

Users receive push notifications for price alerts, savings tips, and app updates. Supports both foreground and background notification handling.

### User Stories

- As a user, I want to receive alerts when prices drop.
- As a user, I want to control which notifications I receive.
- As a user, I want notifications to open the relevant screen in the app.

### Acceptance Criteria

| ID    | Criteria                                      | Priority |
| ----- | --------------------------------------------- | -------- |
| PN-1  | FCM permission requested on onboarding        | Must     |
| PN-2  | FCM token stored in user profile              | Must     |
| PN-3  | Foreground notifications display in-app       | Must     |
| PN-4  | Background notifications show in system tray  | Must     |
| PN-5  | Tap notification opens relevant screen        | Must     |
| PN-6  | Topic subscription for price-alerts           | Must     |
| PN-7  | Topic subscription for savings-tips           | Should   |
| PN-8  | Notification history stored locally           | Should   |
| PN-9  | Settings to enable/disable notification types | Should   |
| PN-10 | Token refresh handled automatically           | Must     |

### Technical Notes

- Uses `@react-native-firebase/messaging`
- FCM topics: `price-alerts`, `savings-tips`
- Notification channels configured for Android
- Deep linking for notification actions

### Notification Types

| Type            | Trigger                  | Content                                                             | Status         |
| --------------- | ------------------------ | ------------------------------------------------------------------- | -------------- |
| price_alert     | Price drops below target | "🔔 Alerte Prix! {product} est maintenant à ${price} chez {store}!" | ✅ Implemented |
| savings_tip     | Weekly on Saturday       | AI-generated savings suggestion                                     | ✅ Implemented |
| sync_complete   | Offline queue processed  | "{count} receipt(s) synced successfully!"                           | ✅ Implemented |
| achievement     | Achievement unlocked     | "🏆 Congratulations! You unlocked: {achievement}!"                  | ✅ Implemented |
| admin_broadcast | Admin sends manually     | Custom message from admin                                           | ✅ Implemented |

---

## Feature 17: Savings Gamification & Achievements (Phase 1.1)

### Description

Users earn achievements and track progress through gamification elements that encourage consistent app usage and smart shopping habits.

### User Stories

- As a user, I want to see my savings progress visually.
- As a user, I want to earn badges for my achievements.
- As a user, I want to maintain streaks for daily activity.
- As a user, I want to level up as I save more money.

### Acceptance Criteria

| ID    | Criteria                                  | Priority |
| ----- | ----------------------------------------- | -------- |
| SG-1  | Achievements screen accessible from home  | Must     |
| SG-2  | 12+ achievements available at launch      | Must     |
| SG-3  | Achievement progress shown visually       | Must     |
| SG-4  | Unlocked achievements display unlock date | Should   |
| SG-5  | Total savings amount tracked              | Must     |
| SG-6  | Daily streak counter maintained           | Should   |
| SG-7  | Level progression based on total savings  | Should   |
| SG-8  | Weekly savings summary shown              | Should   |
| SG-9  | Achievement notification when unlocked    | Should   |
| SG-10 | Statistics header with key metrics        | Must     |

### Achievements List

| ID             | Name                 | Description             | Target        |
| -------------- | -------------------- | ----------------------- | ------------- |
| first_scan     | Premier Pas          | First receipt scanned   | 1 scan        |
| savings_hunter | Chasseur d'Économies | First $10 saved         | $10           |
| budget_master  | Maître du Budget     | Track 30 receipts       | 30 receipts   |
| shop_explorer  | Explorateur          | Shop at 5+ stores       | 5 stores      |
| category_pro   | Expert Catégories    | Use 10+ categories      | 10 categories |
| streak_starter | Régularité           | 7-day scan streak       | 7 days        |
| streak_master  | Habitué              | 30-day scan streak      | 30 days       |
| big_saver      | Grand Économe        | Save $100 total         | $100          |
| price_watcher  | Surveillant Prix     | Set 5 price alerts      | 5 alerts      |
| deal_finder    | Dénicheur            | Find 3 triggered alerts | 3 triggers    |
| early_adopter  | Pionnier             | Use app in first month  | -             |
| multi_photo    | Pro Scanner          | Use multi-photo scan    | 1 use         |

### Level Progression

| Level | Name     | Required Savings |
| ----- | -------- | ---------------- |
| 1     | Débutant | $0               |
| 2     | Économe  | $25              |
| 3     | Chasseur | $100             |
| 4     | Expert   | $250             |
| 5     | Maître   | $500             |
| 6     | Légende  | $1000            |

---

## Feature 18: Smart Shopping List (Phase 1.2)

### Description

Users can create shopping lists that automatically suggest the best stores to shop at based on their purchase history and current prices.

### User Stories

- As a user, I want to create shopping lists for my purchases.
- As a user, I want the app to suggest where to buy items cheapest.
- As a user, I want to check off items as I shop.
- As a user, I want to quickly add items from previous receipts.

### Acceptance Criteria

| ID    | Criteria                                  | Priority |
| ----- | ----------------------------------------- | -------- |
| SL-1  | Create multiple shopping lists            | Must     |
| SL-2  | Add items with name and optional quantity | Must     |
| SL-3  | Check/uncheck items in list               | Must     |
| SL-4  | Delete items via swipe                    | Must     |
| SL-5  | Delete entire lists                       | Must     |
| SL-6  | "Optimize" button finds best store(s)     | Must     |
| SL-7  | Show potential savings from optimization  | Should   |
| SL-8  | Suggest items from receipt history        | Should   |
| SL-9  | Show estimated price per item             | Should   |
| SL-10 | Group items by recommended store          | Should   |

### Technical Notes

- Firestore collection: `apps/{appId}/users/{userId}/shoppingLists`
- Optimization uses price data from all stores
- Suggestions based on frequency of purchases

### Data Model

```typescript
interface ShoppingList {
  id: string;
  userId: string;
  name: string;
  items: ShoppingListItem[];
  isComplete: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  estimatedPrice?: number;
  bestStore?: string;
  isChecked: boolean;
}

interface OptimizationResult {
  totalEstimated: number;
  potentialSavings: number;
  recommendedStore: string;
  storeBreakdown: {store: string; items: string[]; total: number}[];
}
```

---

## Feature 19: Natural Language Spending Queries (Phase 1.2)

### Description

Users can ask questions about their spending in natural language (French/Lingala) and receive AI-powered insights and analysis.

### User Stories

- As a user, I want to ask "How much did I spend on food this month?"
- As a user, I want to ask "Which store is cheapest for rice?"
- As a user, I want conversational interactions in my language.

### Acceptance Criteria

| ID    | Criteria                                | Priority |
| ----- | --------------------------------------- | -------- |
| NL-1  | Chat interface for queries              | Must     |
| NL-2  | French language support                 | Must     |
| NL-3  | Lingala language support                | Should   |
| NL-4  | Quick suggestion chips                  | Should   |
| NL-5  | Query history maintained in session     | Should   |
| NL-6  | Responses include data where applicable | Must     |
| NL-7  | Follow-up questions suggested           | Should   |
| NL-8  | Loading state during AI processing      | Must     |
| NL-9  | Error handling for failed queries       | Must     |
| NL-10 | Context includes user's spending data   | Must     |

### Query Examples

| Query                                 | Response Type      |
| ------------------------------------- | ------------------ |
| "Combien j'ai dépensé ce mois?"       | spending_summary   |
| "Où est-ce que je dépense le plus?"   | category_breakdown |
| "Quel magasin est le moins cher?"     | store_comparison   |
| "Combien coûte le riz chez Shoprite?" | item_search        |
| "Suis-je dans mon budget?"            | budget_analysis    |

### Technical Notes

- Cloud Function: `processNLQuery`
- Uses Gemini AI for query processing
- User spending context gathered from Firestore
- Responses include structured data + natural language

### AI Prompt Context

```
User's spending context includes:
- This month's total and receipts count
- Last month comparison
- Category breakdown (top categories)
- Store breakdown (top 5 stores)
- Recent items sample (last 10)
```

---

### Performance

| Metric                | Target      |
| --------------------- | ----------- |
| App launch time       | < 3 seconds |
| Scan processing       | < 5 seconds |
| Screen navigation     | < 300ms     |
| API response (cached) | < 100ms     |

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
| -------- | --------------- |
| Android  | 8.0 (API 26)    |
| iOS      | 13.0            |
| Web      | Modern browsers |

---

_Next: [Development Setup](../development/SETUP.md)_
