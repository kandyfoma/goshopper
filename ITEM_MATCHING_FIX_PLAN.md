# Item Matching & Display Issue - Analysis & Resolution

## Problem Report

### User Issue
**Reported Problem**: "I have 1 item sucre, from 1 shop it was 5 kg and the other shop it was 1 kg, on the city item it is showing this as a match, which is not because of the difference of the price."

**Additional Request**: "i want to details page to have the full origin item name from the receipt so that the user can properly compare all the details"

## Investigation Findings

### ✅ Code Analysis - System is Working Correctly!

After thorough investigation of the codebase, I found that the system IS ALREADY designed to keep items with different sizes separate:

1. **Size Extraction** (`functions/src/items/itemAggregation.ts:120-185`):
   - `extractSizeInfo()` function extracts size/weight from item names
   - Supports: kg, g, ml, l, cl, oz, lb, packs, sachets, multi-packs (6x330ml)
   - Examples: "5kg", "500g", "330ml", "1.5l", "6x500ml"

2. **Size Preservation** (`functions/src/items/itemAggregation.ts:327-330`):
   ```typescript
   // Append size info as suffix
   if (sizeInfo) {
     normalized = `${normalized}_${sizeInfo}`;
   }
   ```
   - "Sucre 5kg" → "sucre_5kg"
   - "Sucre 1kg" → "sucre_1kg"

3. **Canonical Name with Size** (`functions/src/items/itemAggregation.ts:785 & 805`):
   ```typescript
   // Returns canonical name WITH size suffix preserved
   return canonical.replace(/\s+/g, '') + sizeSuffix;
   ```

4. **Document IDs** (`functions/src/items/itemAggregation.ts:1192`):
   ```typescript
   // Uses normalized name (with size) as document ID
   const cityItemRef = db.collection(cityItemsPath).doc(itemNameNormalized);
   ```

### Root Cause - Possible Scenarios

Since the code is correct, the issue could be:

#### Scenario 1: OCR Not Extracting Sizes
**Cause**: If the OCR doesn't include size information in the item name, both items become "Sucre"

**Example**:
- Receipt shows: "Sucre 5kg"
- OCR extracts: "Sucre" (without size)
- Result: Both 5kg and 1kg versions match to same item

**Solution**: Verify OCR output includes size information

#### Scenario 2: Old Data Before Size Tracking
**Cause**: Items processed before size tracking feature was implemented are still in database

**Solution**: Re-process old receipts or run migration script

#### Scenario 3: Size Format Not Recognized
**Cause**: Size written in format not matched by `extractSizeInfo()` patterns

**Example**:
- "Sucre 5 Kg" (space before unit) ✅ Should work
- "Sucre (5kg)" (parentheses) ❌ Won't match
- "Sucre - 5kg" (dash) ❌ Won't match

**Solution**: Expand regex patterns or improve OCR preprocessing

## Recommended Actions

### Action 1: Verify Current Behavior ✅ PRIORITY

Let's check actual data to understand what's happening:

```typescript
// Firebase Console Query
// Check how "sucre" items are stored:
collection: artifacts/goshopper/cityItems/{city}/items
document IDs starting with: "sucre"

// Expected:
// - sucre_1kg
// - sucre_5kg
// - sucre (if no size info)

// If all are "sucre" without size suffix → OCR issue
// If they have size suffixes but matching anyway → Display/comparison issue
```

### Action 2: Add Original Name Display to Receipt Details ✅

This addresses the user's second request to show original receipt names:

**Backend** - Already storing it!
