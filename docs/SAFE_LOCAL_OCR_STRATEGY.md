# Safe Local OCR Strategy

**Date:** December 13, 2025  
**Purpose:** Comprehensive guide on safely using local OCR before falling back to Gemini

---

## Overview

This document describes how we safely use local OCR as a **first attempt** while ensuring we don't misread receipts, then fall back to Gemini AI when necessary.

### Strategy Flow

```
┌─────────────────────┐
│ 1. Local OCR        │ ← Fast, Free, Offline
│    (Tesseract/      │
│     PaddleOCR)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Extract Data     │ ← Rule-based extraction
│    (Shop templates, │
│     regex patterns) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. VALIDATE Results │ ← 🔐 CRITICAL SAFETY LAYER
│    ✓ Math check     │
│    ✓ Price check    │
│    ✓ Quality check  │
│    ✓ Field check    │
└──────────┬──────────┘
           │
           ├─── Pass ──────► ✅ Use Local Result (Save $$)
           │
           └─── Fail ──────► ⚠️  Fallback to Gemini (Accuracy)
```

---

## 🔐 Multi-Layer Validation Strategy

### Layer 1: Critical Fields Check

Ensures all essential receipt data is present:

| Field | Required? | Validation |
|-------|-----------|------------|
| **Store Name** | ✅ Yes | Length ≥ 2 characters |
| **Total** | ✅ Yes | Value > 0 |
| **Items** | ✅ Yes | At least 1 item |
| **Date** | 🟡 Optional | Valid date format |

**If ANY required field is missing → Fallback to Gemini**

---

### Layer 2: Math Validation (CRITICAL) 🧮

The **most important** check to prevent misreading:

```typescript
calculatedTotal = sum(item.price × item.quantity)
tolerance = max(1, total × 0.01)  // 1% tolerance for rounding

if (|calculatedTotal - total| <= tolerance):
  ✅ Math matches - safe to trust
else:
  ❌ Math error - OCR likely misread numbers
```

**Examples:**

✅ **PASS:**
- Items: $10 + $20 + $30 = $60
- Receipt Total: $60
- Difference: $0 ✓

❌ **FAIL (OCR misread "5" as "8"):**
- Items: $10 + $20 + $80 = $110
- Receipt Total: $60  
- Difference: $50 ✗ → **Use Gemini**

---

### Layer 3: Price Reasonableness Check

Detects common OCR mistakes in numbers:

| Issue | Detection | Example |
|-------|-----------|---------|
| **Negative prices** | `price <= 0` | `-15.00` ❌ |
| **Ridiculously high** | `price > 1,000,000` | `12,345,678` ❌ |
| **Too many decimals** | `decimals > 2` | `15.3456` ❌ |
| **Zero price** | `price == 0` | `0.00` ❌ |

**Common OCR Errors:**
- "5.00" → "S.OO" (letters instead of numbers)
- "15" → "1S" or "IS"
- "0" → "O" (letter O)
- Decimal point "." → comma ","

**If ANY item has unreasonable price → Fallback to Gemini**

---

### Layer 4: OCR Text Quality Assessment

Analyzes the raw OCR text to detect poor quality scans:

```typescript
qualityScore = 1.0

// 1. Special character ratio
specialCharRatio = (special_chars / total_chars)
if (specialCharRatio > 0.3):
  qualityScore -= 0.3  // Too much noise

// 2. Repeated characters (OCR artifacts)
if (has "AAAAA" or "11111"):
  qualityScore -= 0.2

// 3. Word length distribution
avgWordLength = average(word_lengths)
if (avgWordLength < 2 or avgWordLength > 15):
  qualityScore -= 0.2  // Abnormal

// 4. Contains numbers (receipts have prices)
if (no_numbers_found):
  qualityScore -= 0.3

// 5. Contains currency symbols
if (has "$" or "€" or "CDF"):
  qualityScore += 0.1
```

**Quality Threshold:**
- Quality ≥ 0.7 → Good scan, can trust
- Quality < 0.7 → Poor scan → **Fallback to Gemini**

---

### Layer 5: Overall Confidence Scoring

Combines all validation metrics into a final confidence score:

```typescript
confidence = base_ocr_confidence

// Bonuses for valid data
if (hasStoreName)      confidence += 0.05
if (hasTotal)          confidence += 0.05
if (hasItems)          confidence += 0.05
if (hasDate)           confidence += 0.02
if (mathMatches)       confidence += 0.10  // CRITICAL
if (pricesReasonable)  confidence += 0.05

// Penalty for poor text quality
confidence *= textQuality

// Decision threshold
if (confidence >= 0.80 && mathMatches && textQuality >= 0.7):
  ✅ Use Local Result
else:
  ⚠️ Use Gemini
```

---

## Decision Matrix

| Confidence | Math Match? | Text Quality | Decision |
|------------|-------------|--------------|----------|
| **≥ 0.80** | ✅ Yes | ≥ 0.7 | ✅ **USE LOCAL** |
| **≥ 0.80** | ❌ No | ≥ 0.7 | ⚠️ Use Gemini |
| **≥ 0.80** | ✅ Yes | < 0.7 | ⚠️ Use Gemini |
| **< 0.80** | ✅ Yes | ≥ 0.7 | ⚠️ Use Gemini |
| **< 0.80** | ❌ No | < 0.7 | ⚠️ Use Gemini |

**Note:** Math match is **MANDATORY** - even high confidence is rejected if math doesn't match.

---

## Real-World Examples

### ✅ Example 1: Local OCR Success

**OCR Output:**
```
SHOPRITE KINSHASA
Ave. Libération
Kinshasa, DRC

Coca Cola 1.5L    x2    $6.00
Pain Complet      x1    $2.50
Lait Nido 400g    x1    $8.50

TOTAL:                  $17.00
```

**Validation:**
- ✅ Store name: "SHOPRITE KINSHASA"
- ✅ Total: $17.00
- ✅ Items: 3 items
- ✅ Math: ($6 + $2.50 + $8.50 = $17.00) ✓
- ✅ Prices reasonable: All between $2.50-$8.50
- ✅ Text quality: 0.85 (good)

**Confidence:** 0.92  
**Decision:** ✅ **USE LOCAL RESULT** → Saved Gemini API call!

---

### ❌ Example 2: OCR Misread - Math Failed

**OCR Output:**
```
CARREFOUR GOMBE
Kinshasa

Riz 5kg           x1    $1S.00  ← OCR misread "15" as "1S"
Huile 1L          x2    $8.OO   ← OCR misread "8.00" as "8.OO"
Savon             x3    $4.50

TOTAL:                  $31.50
```

**Validation:**
- ✅ Store name: "CARREFOUR GOMBE"
- ✅ Total: $31.50
- ✅ Items: 3 items
- ❌ Math: Can't calculate (prices invalid)
- ❌ Prices: "1S.00" is not a number, "8.OO" is not a number
- 🟡 Text quality: 0.68 (letters mixed with numbers)

**Confidence:** 0.45  
**Decision:** ⚠️ **USE GEMINI** → Corrects OCR errors

**Gemini Result:**
```json
{
  "items": [
    {"name": "Riz 5kg", "price": 15.00, "qty": 1},  ← Corrected
    {"name": "Huile 1L", "price": 8.00, "qty": 2},  ← Corrected
    {"name": "Savon", "price": 4.50, "qty": 3}
  ],
  "total": 31.50
}
```

✅ Math: (15 + 16 + 13.50 = 44.50) ❌ Wait, that's wrong!

Actually Gemini would return:
```json
{
  "items": [
    {"name": "Riz 5kg", "price": 15.00, "qty": 1},
    {"name": "Huile 1L", "price": 8.00, "qty": 2},
    {"name": "Savon", "price": 4.50, "qty": 3}
  ],
  "total": 44.50  ← Gemini corrects the total too
}
```

---

### ⚠️ Example 3: Poor Quality Scan

**OCR Output:**
```
C@RR3F0UR   G0MB3  ← Poor quality, many misreads
K!NSH@S@

R!z  Sk9        xI     $!5.DD
Hu!l3  IL       x2     $B.DD
S@v0n           x3     $$4.SD

T0T@L:                 $3I.5D
```

**Validation:**
- 🟡 Store name: "C@RR3F0UR G0MB3" (2+ chars but garbled)
- 🟡 Total: $3I.5D (contains letters)
- ✅ Items: 3 items
- ❌ Math: Can't calculate (prices invalid)
- ❌ Prices: All invalid (letters in numbers)
- ❌ Text quality: 0.35 (excessive special chars, letters in numbers)

**Confidence:** 0.25  
**Decision:** ⚠️ **USE GEMINI** → Handles poor quality images better

---

## Implementation Details

### TypeScript (React Native)

Located in: `src/shared/services/ai/hybridReceiptProcessor.ts`

```typescript
async processReceipt(imageBase64: string, userId: string) {
  // 1. Try local OCR first
  const localResult = await this.processLocally(imageBase64);
  
  // 2. VALIDATE thoroughly
  const validation = this.validateLocalResult(localResult);
  
  // 3. Decision logic
  const shouldUseLocal = 
    localResult.success && 
    validation.isValid && 
    validation.confidence >= 0.80 &&  // High confidence
    validation.metrics.mathMatches && // Math MUST match
    validation.metrics.textQuality >= 0.7; // Good OCR quality
  
  if (shouldUseLocal) {
    console.log('✅ Local OCR validated - using local result');
    return createReceipt(localResult);
  }
  
  // 4. Fallback to Gemini
  console.log('⚠️ Local OCR failed validation - using Gemini');
  return await geminiService.parseReceipt(imageBase64, userId);
}
```

### Python (Receipt Processor)

Located in: `receipt_processor/main.py`

Returns raw OCR text for validation:

```python
def _normalize_output(self, data, method, confidence, raw_text=""):
    return {
        "success": True,
        "merchant": data.get("merchant", "Unknown"),
        "items": data.get("items", []),
        "total": data.get("total", 0.0),
        "confidence": confidence,
        "rawText": raw_text,  # ← For quality assessment
        # ...
    }
```

---

## Cost Savings Analysis

### Scenario: 1,000 receipts/month

| Receipt Type | % of Total | Local Success | Gemini Needed | Cost |
|-------------|-----------|---------------|---------------|------|
| **Clear receipts** | 60% | ✅ 95% | 5% | $0.03 |
| **Medium quality** | 30% | ✅ 70% | 30% | $0.09 |
| **Poor quality** | 10% | ❌ 10% | 90% | $0.09 |

**Total:**
- Local OCR success: ~700 receipts (70%)
- Gemini fallback: ~300 receipts (30%)
- **Cost savings: 70% reduction** vs. using Gemini for all

---

## Safety Guarantees

### 1. **Math Mismatch = Always Gemini**
No matter how high the confidence, if math doesn't match, we use Gemini.

### 2. **Unreasonable Prices = Always Gemini**
If any price is negative, zero, or ridiculously high, we use Gemini.

### 3. **Missing Critical Fields = Always Gemini**
Store name, total, or items missing → Gemini.

### 4. **Poor OCR Quality = Always Gemini**
If text quality score < 0.7, we use Gemini.

### 5. **Low Confidence = Always Gemini**
Even if other checks pass, confidence < 0.80 → Gemini.

---

## Machine Learning Feedback Loop

When Gemini corrects a local OCR result, we learn from it:

```typescript
async learnFromGeminiCorrection(
  localResult: LocalProcessingResult,
  geminiResult: ReceiptScanResult,
  imageBase64: string
) {
  // Send learning data to Python processor
  await pythonProcessor.learnFromCorrection({
    ocrText: localResult.rawText,
    geminiResult: {
      merchant: geminiResult.receipt.storeName,
      items: geminiResult.receipt.items,
      total: geminiResult.receipt.total
    },
    localConfidence: localResult.confidence
  });
}
```

**Benefits:**
- Local OCR improves over time
- Better shop template matching
- Improved product name recognition
- Higher success rate → More cost savings

---

## Monitoring & Alerts

### Metrics to Track

1. **Local OCR Success Rate** (target: >70%)
   ```
   local_success_rate = (local_used / total_scans) × 100
   ```

2. **Validation Pass Rate**
   ```
   validation_pass_rate = (passed_validation / ocr_attempts) × 100
   ```

3. **Math Mismatch Rate** (should be <5%)
   ```
   math_error_rate = (math_failed / ocr_attempts) × 100
   ```

4. **Average Text Quality** (target: >0.7)
   ```
   avg_quality = mean(text_quality_scores)
   ```

### Alerts

- ⚠️ Alert if local success rate drops below 50%
- ⚠️ Alert if math mismatch rate exceeds 10%
- ⚠️ Alert if average text quality < 0.6

---

## Testing Checklist

Before deploying local OCR:

- [ ] Test with 50+ clear receipts → Expect 95%+ success
- [ ] Test with 20+ blurry receipts → Should fallback to Gemini
- [ ] Test with receipts with OCR errors → Validate math catches errors
- [ ] Test with zero/negative prices → Should reject
- [ ] Test with missing store names → Should fallback
- [ ] Test with receipts in poor lighting → Quality check catches it
- [ ] Test learning loop → Confirm it improves over time

---

## Conclusion

This multi-layer validation strategy ensures that:

1. ✅ **We use local OCR when safe** (70% of cases) → Save money
2. ✅ **We fallback to Gemini when needed** (30% of cases) → Ensure accuracy
3. ✅ **We never trust bad data** → Math and quality checks protect us
4. ✅ **We learn from mistakes** → System improves over time

**Key Principle:** When in doubt, use Gemini. It's better to spend a few cents than to save wrong data.

---

## Next Steps

1. Implement comprehensive logging for validation metrics
2. Add A/B testing to measure accuracy vs. Gemini-only approach
3. Build dashboard to monitor local OCR performance
4. Tune confidence thresholds based on real-world data
5. Add user feedback loop (allow users to report incorrect scans)

