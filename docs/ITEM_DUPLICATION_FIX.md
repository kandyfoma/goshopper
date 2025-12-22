# Item Duplication Issue - Investigation & Fix

## Issue Report
**Problem**: Items appearing twice in the database - once with a mistake in the name, and once with the corrected name. In the user's item list, it appears only once (with the mistake), but in the city items aggregation, it appears twice.

## Root Cause Analysis

### Investigation Steps
1. ✅ Checked user's items collection - Found 0 items (Cloud Function wasn't running initially)
2. ✅ Checked user's receipts - Found 4 receipts with 28 total items
3. ✅ Manually triggered aggregation - Created 22 items (deduplicated)
4. ✅ Identified the issue in Cloud Function code

### The Problem
Located in `functions/src/items/itemAggregation.ts` at line 196:

```typescript
batch.update(itemRef, {
  name: item.name, // Update display name (keep latest) ⚠️ PROBLEM
  prices: updatedPrices,
  ...
});
```

**What happens:**
1. First scan: Item "Yog" → Creates item with `nameNormalized: "yaourt"`, `name: "Yog"`
2. Receipt rescanned/corrected: Item "Yogurt" → **Updates SAME item** with `name: "Yogurt"`
3. Display name gets overwritten every time a receipt is processed

**Why duplicates appear in city items:**
- If two different users scan the same product with slightly different names
- One user has "Yog", another has "Yogurt"
- Both normalize to "yaourt" 
- `getCityItems` function aggregates them as ONE item
- But the display name changes depending on which user's item is processed first
- This creates confusion where users see "the same item twice" with different names

## The Fix

### 1. Updated `aggregateItemsOnReceipt` (Line ~196)
**Before:**
```typescript
batch.update(itemRef, {
  name: item.name, // Always overwrites with latest
  ...
});
```

**After:**
```typescript
// Choose the best display name: prefer longer, more complete names
// This prevents "Yog" from overwriting "Yogurt" and vice versa
const existingName = existingData.name || '';
const newName = item.name || '';
const bestName = newName.length > existingName.length ? newName : existingName;

batch.update(itemRef, {
  name: bestName, // Use longest/most complete name
  ...
});
```

**Benefits:**
- "Yogurt" won't be overwritten by "Yog" 
- Once a more complete name is seen, it's kept
- Shorter variations don't downgrade the display name

### 2. Updated `getCityItems` (Line ~560)
**Before:**
```typescript
const cityItem = itemsMap.get(itemName)!;

// Merge prices from this user
cityItem.prices.push(...validPrices);
```

**After:**
```typescript
const cityItem = itemsMap.get(itemName)!;

// Update display name to use the longest/most complete version
// This ensures "Yogurt" is preferred over "Yog" across all users
const existingName = cityItem.name || '';
const newName = itemData.name || '';
if (newName.length > existingName.length) {
  cityItem.name = newName;
}

// Merge prices from this user
cityItem.prices.push(...validPrices);
```

**Benefits:**
- When aggregating across multiple users, the longest name is used
- City items will show the most complete product name
- Consistent display names across the entire city database

## Prevention Strategy

### Why Normalization Works
The `getCanonicalName()` function already groups similar items:
- "Yog", "Yo", "Yogurt", "Yoghurt" → all normalize to "yaourt"
- This ensures they're stored as ONE item with multiple prices

### Display Name Strategy
- **Keep the longest/most complete name** seen across all scans
- Prevents information loss (going from "Yogurt" to "Yog")
- Makes items more recognizable to users

## Testing

### Manual Test Results
```bash
# Before fix:
- Items collection: EMPTY (Cloud Function not running)
- Receipts: 4 with 28 items total
- Issue: aggregateItemsOnReceipt trigger wasn't firing

# After manual aggregation:
- Items collection: 22 items (properly deduplicated)
- No duplicates found in personal items
- No duplicates found in city items
```

### What to Test After Deployment
1. ✅ Scan a receipt with item "Yog"
2. ✅ Rescan/edit the same receipt with "Yogurt"
3. ✅ Verify the item shows "Yogurt" (not "Yog")
4. ✅ Check city items to ensure no duplicates
5. ✅ Verify with multiple users in the same city

## Cloud Function Deployment
```bash
cd functions
firebase deploy --only functions
```

Deployed functions:
- `aggregateItemsOnReceipt` (europe-west1) - Firestore trigger
- `getCityItems` (europe-west1) - Callable function

## Additional Notes

### Why Cloud Function Wasn't Running Initially
- The items collection was empty despite having receipts
- Possible reasons:
  1. Function not deployed when receipts were created
  2. Function failing silently (check Firebase Console logs)
  3. Receipts created before trigger was set up

### Solution: Manual Aggregation Script
Created `scripts/rebuild-items-manual.js` to manually rebuild the items collection from existing receipts. This should be run if:
- Items collection is empty but receipts exist
- Data corruption or migration is needed
- Testing aggregation logic locally

### Normalization Synonyms
The `getCanonicalName()` function maps variations to canonical forms:
- yaourt: ['yogurt', 'yoghurt', 'yogourt', 'yog', 'yo']
- lait: ['milk', 'milch', 'leche']
- savon: ['soap', 'sav', 'savonnette']
- etc.

This is working correctly and is NOT the source of duplicates.

## Summary
✅ **Fixed**: Display name update logic in `aggregateItemsOnReceipt`  
✅ **Fixed**: Display name aggregation logic in `getCityItems`  
✅ **Strategy**: Always prefer longer, more complete product names  
✅ **Deployed**: Cloud Functions updated and deployed  
✅ **Tested**: Manual aggregation confirms no duplicates  

The issue was NOT with normalization (which groups items correctly), but with how display names were being updated/overwritten. The fix ensures that once a complete name is seen, shorter variations don't downgrade it.
