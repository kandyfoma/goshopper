# Improvements Roadmap

## Overview

This document outlines planned improvements for Invoice Intelligence (Prix Tracker), organized by phase and priority.

---

## Phase 1.1 - Quick Wins (Month 1-2)

### 1. Price Alerts

**Description:** Notify users when items they care about drop in price.

**User Stories:**
- As a user, I want to set a price alert for sugar so I know when it's cheap
- As a user, I want to see all my active alerts in one place
- As a user, I want to be notified even when the app is closed

**Technical Implementation:**

```typescript
// Data Model
interface PriceAlert {
  alertId: string;
  userId: string;
  itemName: string;
  itemNameNormalized: string;
  targetPrice: number;
  currentBestPrice: number;
  currency: 'USD' | 'CDF';
  isActive: boolean;
  createdAt: Timestamp;
  lastTriggeredAt?: Timestamp;
}

// Firestore Path
// users/{userId}/priceAlerts/{alertId}
```

**Cloud Function for Alert Checking:**
```typescript
// Triggered when storePrices collection updates
exports.checkPriceAlerts = functions.firestore
  .document('storePrices/{priceId}')
  .onWrite(async (change, context) => {
    const newPrice = change.after.data();
    
    // Find all alerts for this item
    const alerts = await db.collectionGroup('priceAlerts')
      .where('itemNameNormalized', '==', newPrice.itemNameNormalized)
      .where('isActive', '==', true)
      .where('targetPrice', '>=', newPrice.price)
      .get();
    
    // Send push notifications
    for (const alert of alerts.docs) {
      await sendPushNotification(alert.data().userId, {
        title: '💰 Price Drop Alert!',
        body: `${newPrice.itemName} is now ${newPrice.price} ${newPrice.currency} at ${newPrice.storeName}`,
        data: { type: 'price_alert', itemId: newPrice.itemId }
      });
    }
  });
```

**UI Screens:**

```
┌────────────────────────┐
│ [←]    Price Alerts    │
├────────────────────────┤
│                        │
│ Active Alerts (3)      │
│ ┌────────────────────┐ │
│ │ 🔔 Sugar 1kg       │ │
│ │ Alert: < $1.50     │ │
│ │ Current: $1.75     │ │
│ │           [Delete] │ │
│ └────────────────────┘ │
│ ┌────────────────────┐ │
│ │ 🔔 Rice 5kg        │ │
│ │ Alert: < $8.00     │ │
│ │ Current: $8.50     │ │
│ │           [Delete] │ │
│ └────────────────────┘ │
│                        │
│   [+ Add New Alert]    │
│                        │
└────────────────────────┘

┌────────────────────────┐
│ [←]   Create Alert     │
├────────────────────────┤
│                        │
│ Item Name              │
│ [🔍 Search items...  ] │
│                        │
│ Selected: Sugar 1kg    │
│ Current best: $1.75    │
│                        │
│ Alert me when below:   │
│ [$] [1.50            ] │
│                        │
│                        │
│   [Create Alert ✓]     │
│                        │
└────────────────────────┘
```

**Acceptance Criteria:**

| ID | Criteria | Priority |
|----|----------|----------|
| PA-1 | User can create alert from item detail screen | Must |
| PA-2 | User can view all active alerts | Must |
| PA-3 | User can delete alerts | Must |
| PA-4 | Push notification sent when price drops | Must |
| PA-5 | Maximum 10 alerts per free user, unlimited for premium | Should |
| PA-6 | Alert auto-deactivates after triggering (optional re-enable) | Should |

---

### 2. Offline Queue Scanning

**Description:** Allow users to take photos of receipts offline, queue them, and process when connection returns.

**User Stories:**
- As a user in an area with poor connectivity, I want to scan receipts offline
- As a user, I want to see queued scans waiting to process
- As a user, I want queued scans to auto-process when I'm back online

**Technical Implementation:**

```typescript
// Offline Queue Data Model
interface QueuedScan {
  queueId: string;
  imageUri: string;         // Local file path
  imageBase64?: string;     // Cached for upload
  status: 'queued' | 'processing' | 'complete' | 'failed';
  createdAt: number;        // Unix timestamp
  processedAt?: number;
  errorMessage?: string;
  resultInvoiceId?: string;
}

// Storage: AsyncStorage or MMKV
const QUEUE_KEY = '@scan_queue';
```

**Queue Manager Service:**

```typescript
class OfflineScanQueue {
  private queue: QueuedScan[] = [];
  
  async addToQueue(imageUri: string): Promise<string> {
    const queueId = generateId();
    const base64 = await imageToBase64(imageUri);
    
    const scan: QueuedScan = {
      queueId,
      imageUri,
      imageBase64: base64,
      status: 'queued',
      createdAt: Date.now(),
    };
    
    this.queue.push(scan);
    await this.persistQueue();
    
    // Try to process if online
    this.processQueue();
    
    return queueId;
  }
  
  async processQueue(): Promise<void> {
    if (!await isOnline()) return;
    
    const pending = this.queue.filter(s => s.status === 'queued');
    
    for (const scan of pending) {
      scan.status = 'processing';
      await this.persistQueue();
      
      try {
        const result = await geminiClient.parseInvoice(scan.imageBase64);
        const invoiceId = await saveInvoice(result);
        
        scan.status = 'complete';
        scan.processedAt = Date.now();
        scan.resultInvoiceId = invoiceId;
      } catch (error) {
        scan.status = 'failed';
        scan.errorMessage = error.message;
      }
      
      await this.persistQueue();
    }
  }
  
  // Listen for network changes
  setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.processQueue();
      }
    });
  }
}
```

**UI Indicator:**

```
┌────────────────────────┐
│ [≡]  Prix Tracker  [⚙] │
├────────────────────────┤
│                        │
│ ⚠️ Offline Mode        │  <- Banner when offline
│ 2 scans queued         │
│                        │
├────────────────────────┤
│                        │
│   [📷 Scan Receipt]    │  <- Still works offline!
│                        │
│   "Photos will be      │
│   processed when       │
│   you're back online"  │
│                        │
└────────────────────────┘

┌────────────────────────┐
│ [←]   Scan Queue       │
├────────────────────────┤
│                        │
│ Pending (2)            │
│ ┌────────────────────┐ │
│ │ 📄 Receipt #1      │ │
│ │ ⏳ Queued 5 min ago │ │
│ │       [View] [🗑]  │ │
│ └────────────────────┘ │
│ ┌────────────────────┐ │
│ │ 📄 Receipt #2      │ │
│ │ ⏳ Queued 2 min ago │ │
│ │       [View] [🗑]  │ │
│ └────────────────────┘ │
│                        │
│ ────────────────────── │
│ Recently Processed (1) │
│ ┌────────────────────┐ │
│ │ ✅ Shoprite        │ │
│ │ $45.00 • 12 items  │ │
│ │         [View →]   │ │
│ └────────────────────┘ │
│                        │
└────────────────────────┘
```

**Acceptance Criteria:**

| ID | Criteria | Priority |
|----|----------|----------|
| OQ-1 | User can capture receipt photo while offline | Must |
| OQ-2 | Photo saved locally with queue status | Must |
| OQ-3 | Queue badge shows pending count | Must |
| OQ-4 | Auto-process when connection restored | Must |
| OQ-5 | User can view queue and delete pending items | Must |
| OQ-6 | Failed scans can be retried | Should |
| OQ-7 | Queue persists across app restarts | Must |

---

### 3. Push Notifications (FCM)

**Description:** Enable push notifications for alerts, reminders, and engagement.

**Notification Types:**

| Type | Trigger | Example |
|------|---------|---------|
| Price Alert | Price drops below target | "Sugar is now $1.20 at Shoprite!" |
| Weekly Summary | Every Sunday | "You spent $85 this week, saved $12" |
| Scan Reminder | No scan in 7 days | "Don't forget to track your spending!" |
| Queue Processed | Offline queue done | "3 receipts processed successfully" |
| Subscription | Trial ending, renewal | "Your trial ends in 2 days" |

**Technical Implementation:**

```typescript
// Firebase Cloud Messaging Setup
import messaging from '@react-native-firebase/messaging';

async function setupNotifications(): Promise<void> {
  // Request permission
  const authStatus = await messaging().requestPermission();
  const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED;
  
  if (enabled) {
    // Get FCM token
    const token = await messaging().getToken();
    
    // Save to user profile
    await firestore()
      .collection('users')
      .doc(userId)
      .update({ fcmToken: token });
  }
  
  // Handle foreground messages
  messaging().onMessage(async remoteMessage => {
    showLocalNotification(remoteMessage);
  });
  
  // Handle background/quit messages
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background message:', remoteMessage);
  });
}
```

**User Preferences:**

```
┌────────────────────────┐
│ [←]   Notifications    │
├────────────────────────┤
│                        │
│ Price Alerts           │
│ Get notified when      │
│ prices drop       [✓]  │
│                        │
│ ────────────────────── │
│                        │
│ Weekly Summary         │
│ Spending report on     │
│ Sundays           [✓]  │
│                        │
│ ────────────────────── │
│                        │
│ Scan Reminders         │
│ Remind to track        │
│ purchases         [ ]  │
│                        │
│ ────────────────────── │
│                        │
│ Deals & Promotions     │
│ Special offers from    │
│ stores            [✓]  │
│                        │
└────────────────────────┘
```

---

### 4. Savings Tracker & Gamification

**Description:** Show users how much they've saved and reward engagement with achievements.

**Savings Calculation:**

```typescript
interface SavingsReport {
  totalSavings: number;
  savingsThisMonth: number;
  savingsThisWeek: number;
  itemsSaved: SavedItem[];
}

interface SavedItem {
  itemName: string;
  paidPrice: number;
  bestPrice: number;
  savings: number;
  storeName: string;
  date: Timestamp;
}

async function calculateSavings(userId: string, period: 'week' | 'month' | 'all'): Promise<SavingsReport> {
  const invoices = await getUserInvoices(userId, period);
  let totalSavings = 0;
  const itemsSaved: SavedItem[] = [];
  
  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const bestPrice = await getBestPrice(item.itemNameNormalized);
      
      if (bestPrice && item.unitPrice > bestPrice.price) {
        const savings = (item.unitPrice - bestPrice.price) * item.quantity;
        totalSavings += savings;
        
        itemsSaved.push({
          itemName: item.name,
          paidPrice: item.unitPrice,
          bestPrice: bestPrice.price,
          savings,
          storeName: bestPrice.storeName,
          date: invoice.date,
        });
      }
    }
  }
  
  return { totalSavings, itemsSaved, /* ... */ };
}
```

**Achievements System:**

```typescript
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: AchievementRequirement;
  unlockedAt?: Timestamp;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_scan',
    title: 'First Scan',
    description: 'Scanned your first receipt',
    icon: '📷',
    requirement: { type: 'scan_count', value: 1 }
  },
  {
    id: 'scan_streak_7',
    title: 'Week Warrior',
    description: 'Scanned receipts 7 days in a row',
    icon: '🔥',
    requirement: { type: 'scan_streak', value: 7 }
  },
  {
    id: 'saved_10',
    title: 'Saver Starter',
    description: 'Saved $10 using price comparisons',
    icon: '💰',
    requirement: { type: 'total_savings', value: 10 }
  },
  {
    id: 'saved_100',
    title: 'Super Saver',
    description: 'Saved $100 total',
    icon: '🏆',
    requirement: { type: 'total_savings', value: 100 }
  },
  {
    id: 'invoices_50',
    title: 'Dedicated Tracker',
    description: 'Tracked 50 invoices',
    icon: '📊',
    requirement: { type: 'invoice_count', value: 50 }
  },
  {
    id: 'categories_all',
    title: 'Diverse Shopper',
    description: 'Purchased from all categories',
    icon: '🌈',
    requirement: { type: 'category_count', value: 10 }
  },
];
```

**UI Screens:**

```
┌────────────────────────┐
│ [←]   Your Savings     │
├────────────────────────┤
│                        │
│      💰 $127.50        │
│    Total Saved         │
│                        │
│ ┌────────┬───────────┐ │
│ │ This   │ This      │ │
│ │ Week   │ Month     │ │
│ │ $12.30 │ $45.80    │ │
│ └────────┴───────────┘ │
│                        │
│ Recent Savings         │
│ ┌────────────────────┐ │
│ │ Rice 5kg      -$2  │ │
│ │ Paid $10, best $8  │ │
│ │ Better at: Carrefour│ │
│ └────────────────────┘ │
│ ┌────────────────────┐ │
│ │ Cooking Oil  -$1.5 │ │
│ │ Paid $6, best $4.5 │ │
│ │ Better at: Metro   │ │
│ └────────────────────┘ │
│                        │
│ 💡 Tip: Shop at Metro  │
│ for cooking supplies   │
│ to save more!          │
│                        │
└────────────────────────┘

┌────────────────────────┐
│ [←]   Achievements     │
├────────────────────────┤
│                        │
│ Unlocked (4/10)        │
│                        │
│ ┌────┐ ┌────┐ ┌────┐  │
│ │ 📷 │ │ 💰 │ │ 📊 │  │
│ │ ✓  │ │ ✓  │ │ ✓  │  │
│ └────┘ └────┘ └────┘  │
│ First   Saver  10      │
│ Scan    $10    Invoices│
│                        │
│ ┌────┐ ┌────┐ ┌────┐  │
│ │ 🔥 │ │ 🏆 │ │ 🌈 │  │
│ │ ✓  │ │ 🔒 │ │ 🔒 │  │
│ └────┘ └────┘ └────┘  │
│ 7 Day  Super  Diverse  │
│ Streak Saver  Shopper  │
│                        │
│ ────────────────────── │
│ Next Achievement:      │
│ 🏆 Super Saver         │
│ Save $100 total        │
│ Progress: $127/$100 ✓  │
│                        │
└────────────────────────┘
```

---

### 3. Usage Monitoring and Cost Management

**Description:** Implement usage tracking, limits, and cost optimizations to ensure business profitability.

**User Stories:**
- As a business owner, I want to track user scan volumes to understand usage patterns
- As a business owner, I want to prevent excessive AI costs from heavy users
- As a user, I want clear visibility of my remaining scans

**Technical Implementation:**

```typescript
// Usage Tracking Service
interface UsageMetrics {
  userId: string;
  month: string; // YYYY-MM
  scans: number;
  aiCost: number;
  lastScan: Timestamp;
}

export const trackScan = async (userId: string, aiCost: number) => {
  const month = new Date().toISOString().slice(0, 7);
  const docRef = db.collection('usage_metrics').doc(`${userId}_${month}`);
  
  await docRef.set({
    userId,
    month,
    scans: FieldValue.increment(1),
    aiCost: FieldValue.increment(aiCost),
    lastScan: FieldValue.serverTimestamp()
  }, { merge: true });
};
```

**Dashboard for Monitoring:**

```typescript
// Admin dashboard to monitor costs
export const getMonthlyUsageReport = async () => {
  const month = new Date().toISOString().slice(0, 7);
  
  const snapshot = await db.collection('usage_metrics')
    .where('month', '==', month)
    .get();
  
  let totalScans = 0;
  let totalCost = 0;
  let activeUsers = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    totalScans += data.scans;
    totalCost += data.aiCost;
    activeUsers++;
  });
  
  return { totalScans, totalCost, activeUsers };
};
```

**Usage Limit Enforcement:**

```typescript
// Check limits before allowing scan
export const canUserScan = async (userId: string): Promise<boolean> => {
  const subscription = await getUserSubscription(userId);
  if (subscription.plan === 'premium') return true;
  
  const currentUsage = await getCurrentMonthUsage(userId);
  const limits = { basic: 25, standard: 100 };
  
  return currentUsage < limits[subscription.plan];
};
```

**Cost Optimization Features:**

1. **Model Selection Based on Complexity**
```typescript
const selectAIModel = (receiptComplexity: 'simple' | 'complex') => {
  return receiptComplexity === 'simple' 
    ? 'gemini-2.5-flash-lite' // Cheaper for basic receipts
    : 'gemini-2.5-flash';    // Full model for complex receipts
};
```

2. **Price Caching**
```typescript
// Cache price comparisons for 24 hours
const PRICE_CACHE_DURATION = 24 * 60 * 60 * 1000;

export const getCachedPriceComparison = async (itemName: string) => {
  const cacheKey = `price_${normalizeItemName(itemName)}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < PRICE_CACHE_DURATION) {
      return data;
    }
  }
  
  const freshData = await fetchPriceData(itemName);
  await AsyncStorage.setItem(cacheKey, JSON.stringify({
    data: freshData,
    timestamp: Date.now()
  }));
  
  return freshData;
};
```

**UI Updates:**

**Trial User:**
```
┌────────────────────────┐
│ [←]   Account          │
├────────────────────────┤
│                        │
│ 🎉 Free Trial          │
│ 45 days remaining      │
│                        │
│ Unlimited scans        │
│ All premium features   │
│                        │
│ Trial ends: Jan 15     │
│                        │
│   [Choose Plan]        │
│   [Extend Trial +1M]   │
│                        │
└────────────────────────┘
```

**Paid User:**
```
┌────────────────────────┐
│ [←]   Account          │
├────────────────────────┤
│                        │
│ Plan: Standard         │
│ $2.99/month            │
│                        │
│ Usage This Month       │
│ ████████░░░░░░ 75/100  │
│ 75 scans used          │
│                        │
│ Next reset: Jan 15     │
│                        │
│   [Upgrade Plan]       │
│   [View Details]       │
│                        │
└────────────────────────┘
```

**Acceptance Criteria:**

| ID | Criteria | Priority |
|----|----------|----------|
| UM-1 | Usage counter displayed in account screen | Must |
| UM-2 | Scan blocked when limit reached | Must |
| UM-3 | Clear upgrade prompts shown | Must |
| UM-4 | Monthly usage resets on schedule | Must |
| UM-5 | 2-month free trial with unlimited access | Must |
| UM-6 | Trial expiration warnings (7 days before) | Must |
| UM-7 | One-time trial extension (1 month) available | Should |
| UM-8 | Admin dashboard for cost monitoring | Should |
| UM-9 | Cost optimizations reduce expenses by 20% | Should |

---

## Phase 1.2 - Enhanced Features (Month 3-4)

### 5. Shopping List Optimizer

**Description:** Users create a shopping list, app suggests optimal stores to minimize total cost.

**User Flow:**

```
┌────────────────────────┐
│ [←]  Shopping List     │
├────────────────────────┤
│                        │
│ My List (5 items)      │
│                        │
│ ☐ Sugar 1kg            │
│ ☐ Rice 5kg             │
│ ☐ Cooking Oil 1L       │
│ ☐ Milk 1L              │
│ ☐ Bread                │
│                        │
│   [+ Add Item]         │
│                        │
│ ────────────────────── │
│                        │
│   [🔍 Find Best Prices]│
│                        │
└────────────────────────┘

          ↓ (After optimization)

┌────────────────────────┐
│ [←]  Optimized Plan    │
├────────────────────────┤
│                        │
│ 💡 Best Strategy:      │
│ Visit 2 stores         │
│ Total: $32.50          │
│ You save: $8.20        │
│                        │
│ ━━━━━━━━━━━━━━━━━━━━━ │
│ 🏪 Shoprite            │
│ 3 items • $18.00       │
│ ┌────────────────────┐ │
│ │ Sugar 1kg    $1.50 │ │
│ │ Rice 5kg     $8.00 │ │
│ │ Milk 1L      $2.50 │ │
│ └────────────────────┘ │
│                        │
│ ━━━━━━━━━━━━━━━━━━━━━ │
│ 🏪 Carrefour           │
│ 2 items • $6.50        │
│ ┌────────────────────┐ │
│ │ Cooking Oil  $4.00 │ │
│ │ Bread        $2.50 │ │
│ └────────────────────┘ │
│                        │
│ ━━━━━━━━━━━━━━━━━━━━━ │
│ Alternative: Single    │
│ store at Metro: $35.20 │
│                        │
│   [Share List 📤]      │
│                        │
└────────────────────────┘
```

**Optimization Algorithm:**

```typescript
interface ShoppingItem {
  name: string;
  nameNormalized: string;
  quantity: number;
}

interface StoreOption {
  storeId: string;
  storeName: string;
  items: { item: ShoppingItem; price: number }[];
  total: number;
}

interface OptimizationResult {
  strategy: 'single_store' | 'multi_store';
  stores: StoreOption[];
  totalCost: number;
  savings: number;
  singleStoreBest: StoreOption; // Best single store fallback
}

async function optimizeShoppingList(items: ShoppingItem[]): Promise<OptimizationResult> {
  // 1. Get all prices for all items
  const priceMatrix: Map<string, Map<string, number>> = new Map();
  
  for (const item of items) {
    const prices = await getItemPrices(item.nameNormalized);
    priceMatrix.set(item.nameNormalized, prices);
  }
  
  // 2. Find all unique stores
  const stores = getUniqueStores(priceMatrix);
  
  // 3. Calculate single-store totals
  const singleStoreOptions: StoreOption[] = stores.map(store => ({
    storeId: store.id,
    storeName: store.name,
    items: items.map(item => ({
      item,
      price: priceMatrix.get(item.nameNormalized)?.get(store.id) || Infinity
    })),
    total: calculateTotal(items, priceMatrix, store.id)
  })).filter(o => o.total < Infinity)
    .sort((a, b) => a.total - b.total);
  
  // 4. Find optimal multi-store combination
  const multiStoreResult = findOptimalCombination(items, priceMatrix, stores);
  
  // 5. Compare and return best strategy
  const singleStoreBest = singleStoreOptions[0];
  
  if (multiStoreResult.total < singleStoreBest.total * 0.9) {
    // Multi-store is at least 10% cheaper
    return {
      strategy: 'multi_store',
      stores: multiStoreResult.stores,
      totalCost: multiStoreResult.total,
      savings: singleStoreBest.total - multiStoreResult.total,
      singleStoreBest
    };
  }
  
  return {
    strategy: 'single_store',
    stores: [singleStoreBest],
    totalCost: singleStoreBest.total,
    savings: 0,
    singleStoreBest
  };
}
```

---

### 6. Natural Language Queries

**Description:** Let users ask questions about their spending in natural language.

**Examples:**
- "How much did I spend on food last month?"
- "What's my most expensive purchase this year?"
- "Show me all receipts from Shoprite"
- "Compare my spending this month vs last month"

**Technical Implementation:**

```typescript
// Use Gemini for query understanding
const QUERY_PROMPT = `
You are a helpful assistant that converts natural language questions about spending into structured queries.

User's question: "{question}"

Convert this to a JSON query:
{
  "type": "spending_summary" | "item_search" | "store_filter" | "comparison" | "top_items",
  "timeRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } | null,
  "category": "string" | null,
  "store": "string" | null,
  "limit": number | null,
  "compareWith": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } | null
}
`;

async function processNaturalQuery(question: string): Promise<QueryResult> {
  // 1. Parse question with Gemini
  const structuredQuery = await geminiClient.query(QUERY_PROMPT, question);
  
  // 2. Execute Firestore query
  const data = await executeQuery(structuredQuery);
  
  // 3. Format response
  return formatResponse(structuredQuery.type, data);
}
```

**UI:**

```
┌────────────────────────┐
│ [←]    Ask Prix        │
├────────────────────────┤
│                        │
│ 💬 Ask me anything     │
│    about your spending │
│                        │
│ ┌────────────────────┐ │
│ │ How much did I     │ │
│ │ spend on food?     │ │
│ └────────────────────┘ │
│              [Ask →]   │
│                        │
│ ────────────────────── │
│                        │
│ 🤖 This month you      │
│ spent $245.80 on food  │
│ across 12 invoices.    │
│                        │
│ Top items:             │
│ • Rice: $45.00         │
│ • Meat: $38.50         │
│ • Vegetables: $32.00   │
│                        │
│ ────────────────────── │
│                        │
│ Suggestions:           │
│ ┌──────────────────┐   │
│ │ Compare to last  │   │
│ │ month            │   │
│ └──────────────────┘   │
│ ┌──────────────────┐   │
│ │ Show food        │   │
│ │ receipts         │   │
│ └──────────────────┘   │
│                        │
└────────────────────────┘
```

---

### 7. Merchant Analytics Dashboard

**Description:** Provide merchants with insights about their pricing competitiveness.

**Features:**
- Price position vs competitors
- Most viewed items
- Price update reminders
- Customer traffic estimates

**Dashboard Screens:**

```
┌─────────────────────────────────────────────────────┐
│  MERCHANT PORTAL - Analytics Dashboard              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Welcome, Shoprite Kinshasa                         │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Your Items  │  │ Price Rank  │  │ Views Today │ │
│  │    156      │  │   #2/15     │  │    1,234    │ │
│  │             │  │  in market  │  │   +12%      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                     │
│  Price Competitiveness                              │
│  ┌───────────────────────────────────────────────┐ │
│  │ ✅ 89 items - Best price in market            │ │
│  │ ⚠️ 45 items - Within 10% of best              │ │
│  │ ❌ 22 items - More than 10% above best        │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Items Needing Attention           [View All →]    │
│  ┌───────────────────────────────────────────────┐ │
│  │ Sugar 1kg     Your: $1.80   Best: $1.50  -17% │ │
│  │ Rice 5kg      Your: $9.00   Best: $8.00  -11% │ │
│  │ Cooking Oil   Your: $5.00   Best: $4.00  -20% │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Update Prices]  [View Full Report]  [Settings]   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Phase 2.0 - Advanced Features (Month 5-6)

### 8. Crowd-Sourced Prices

**Description:** Allow users to optionally contribute their scanned prices to the public database (anonymized).

**Privacy Controls:**

```
┌────────────────────────┐
│ [←]   Privacy          │
├────────────────────────┤
│                        │
│ Help Others Save       │
│                        │
│ Share your prices      │
│ anonymously to help    │
│ the community find     │
│ better deals.          │
│                        │
│ ────────────────────── │
│                        │
│ Share Prices      [✓]  │
│                        │
│ What's shared:         │
│ ✓ Item names           │
│ ✓ Prices               │
│ ✓ Store name           │
│ ✓ Date                 │
│                        │
│ Never shared:          │
│ ✗ Your identity        │
│ ✗ Your location        │
│ ✗ Your purchase history│
│                        │
│ ────────────────────── │
│                        │
│ Your Contribution:     │
│ 📊 127 prices shared   │
│ 👥 Helped 45 users     │
│                        │
│ 🏅 Community Hero!     │
│                        │
└────────────────────────┘
```

**Technical Flow:**

```typescript
// When saving an invoice (if user opted in)
async function saveInvoiceWithContribution(
  invoice: Invoice,
  contributeToPublic: boolean
): Promise<void> {
  // 1. Always save to private collection
  await savePrivateInvoice(invoice);
  
  // 2. Optionally contribute to public (anonymized)
  if (contributeToPublic) {
    for (const item of invoice.items) {
      await db.collection('storePrices').add({
        itemName: item.name,
        itemNameNormalized: normalize(item.name),
        price: item.unitPrice,
        currency: invoice.currency,
        storeId: invoice.storeId,
        storeName: invoice.storeName,
        date: invoice.date,
        source: 'community',  // vs 'merchant'
        // NO user ID or personal info
      });
    }
    
    // Track contribution (for gamification)
    await incrementUserContribution(userId, invoice.items.length);
  }
}
```

---

### 9. Budget Goals & Forecasts

**Description:** Let users set spending budgets and predict future spending.

**Features:**
- Monthly budget by category
- Spending forecasts
- Budget alerts
- Trend analysis

**UI:**

```
┌────────────────────────┐
│ [←]    Budgets         │
├────────────────────────┤
│                        │
│ December 2025          │
│                        │
│ Total Budget: $500     │
│ Spent: $285 (57%)      │
│ ████████░░░░░░ 57%     │
│                        │
│ Days left: 28          │
│ Forecast: $520 ⚠️      │
│                        │
│ ────────────────────── │
│                        │
│ By Category            │
│                        │
│ 🍎 Food         $150   │
│ ████████████░░ $128    │
│ 85% used               │
│                        │
│ 🏠 Household    $100   │
│ ██████░░░░░░░░ $45     │
│ 45% used               │
│                        │
│ 🚗 Transport    $80    │
│ ████████░░░░░░ $52     │
│ 65% used               │
│                        │
│   [Edit Budgets]       │
│                        │
└────────────────────────┘

┌────────────────────────┐
│ [←]  Set Budget        │
├────────────────────────┤
│                        │
│ Monthly Budget         │
│                        │
│ Total: [$500         ] │
│                        │
│ ────────────────────── │
│                        │
│ Category Limits        │
│ (Optional)             │
│                        │
│ 🍎 Food                │
│    [$150             ] │
│                        │
│ 🏠 Household           │
│    [$100             ] │
│                        │
│ 🚗 Transport           │
│    [$80              ] │
│                        │
│ ➕ Add Category        │
│                        │
│ ────────────────────── │
│                        │
│ Alert me at:           │
│ ○ 50%  ● 80%  ○ 100%   │
│                        │
│   [Save Budget ✓]      │
│                        │
└────────────────────────┘
```

---

### 10. USSD/SMS Fallback (Feature Phones)

**Description:** Basic features accessible via USSD for users without smartphones.

**USSD Flow:**

```
*123*456# → Prix Tracker Menu

1. Check Price
2. My Spending
3. Best Deals Today
0. Exit

→ Press 1

Enter item name:
→ sugar

Sugar 1kg prices:
1. Shoprite: $1.50 ✓
2. Carrefour: $1.75
3. Metro: $1.80

Best price at Shoprite!

1. Set Alert
2. Back to Menu
0. Exit
```

**SMS Integration:**

```
SMS to: PRIX (7749)

"price sugar" 
→ "Sugar 1kg: Shoprite $1.50 (best), Carrefour $1.75, Metro $1.80"

"spent"
→ "This month: $285. Food $128, Transport $52, Other $105"

"alert sugar 1.20"
→ "Alert set! We'll SMS you when Sugar drops below $1.20"
```

---

## Priority Summary

| Phase | Feature | Impact | Effort | Status |
|-------|---------|--------|--------|--------|
| **1.1** | Price Alerts | High | Low | Planned |
| **1.1** | Offline Queue | High | Medium | Planned |
| **1.1** | Push Notifications | High | Low | Planned |
| **1.1** | Savings Gamification | Medium | Low | Planned |
| **1.2** | Shopping List Optimizer | High | Medium | Planned |
| **1.2** | Natural Language Queries | Medium | Medium | Planned |
| **1.2** | Merchant Analytics | High | Medium | Planned |
| **2.0** | Crowd-Sourced Prices | High | High | Planned |
| **2.0** | Budget Goals | Medium | Medium | Planned |
| **2.0** | USSD/SMS Fallback | Medium | High | Planned |

---

## Success Metrics

| Metric | Current | Phase 1.1 Target | Phase 2.0 Target |
|--------|---------|------------------|------------------|
| DAU | - | 1,000 | 10,000 |
| Retention (D7) | - | 30% | 45% |
| Scans/User/Week | - | 3 | 5 |
| Conversion Rate | - | 5% | 8% |
| NPS | - | 40 | 60 |

---

*See also: [Features Specification](./FEATURES.md) | [User Flows](./USER_FLOWS.md)*
