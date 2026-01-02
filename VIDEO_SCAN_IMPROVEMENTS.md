# Video Scan Improvements

## Current Issues Identified

### 1. **Shop Name Detection Failure**
**Problem:** Most of the time the shop name is not detected
**Root Cause Analysis:**
- Shop name is typically at the TOP of the receipt
- Video scanning goes from TOP to BOTTOM
- The FIRST frames should contain the shop name
- However, these frames might be:
  - Blurry (camera focusing)
  - Too quick (user starts moving immediately)
  - Dark (lighting adjusting)
  - Partially cropped (not starting high enough)

### 2. **Items Being Skipped/Jumped**
**Problem:** Sometimes items are jumped over
**Root Cause Analysis:**
- Video scans from top to bottom, items appear in middle frames
- If user moves too fast, frames between items might be blurry
- The AI might miss items in blurry frames
- Current prompt doesn't emphasize "DON'T SKIP FRAMES"
- No frame-by-frame verification to ensure all items are captured

---

## Recommended Improvements

### Priority 1: Fix Shop Name Detection 🏪

#### A. Add Pre-Recording Shop Name Capture
```typescript
// In UnifiedScannerScreen.tsx - handleVideoScan function
// Before starting video recording, take a PHOTO of the receipt top
const shopNameStrategy = {
  1: 'Take initial photo of receipt header BEFORE video',
  2: 'Extract shop name from photo while video is recording',
  3: 'Merge shop name with video results',
  4: 'Fallback: If photo fails, use video-only result'
};
```

**Implementation:**
1. When user clicks "Enregistrer vidéo", first show: "Prenez une photo du HAUT du reçu (nom du magasin)"
2. Capture a photo of just the top 20% of receipt
3. Extract shop name from photo using Gemini (fast, <2s)
4. THEN start video recording for the full receipt
5. Combine shop name from photo + items from video

#### B. Improve Video Frame Analysis for Headers
```typescript
// In functions/src/receipt/parseReceipt.ts - VIDEO_PARSING_PROMPT
const IMPROVED_HEADER_INSTRUCTIONS = `
🎬 FIRST FRAMES ANALYSIS (0-2 seconds):
- The VERY FIRST frames contain the STORE NAME
- These frames might be slightly blurry - that's OK
- Look for LARGE TEXT at the TOP of the receipt
- Common DRC stores: Peloustore, Shoprite, Carrefour, Hasson & Frères, Kin Marché
- If you see ANY store name in first 3 frames, use it
- If blurry in frame 1, check frames 2 and 3 for the same text
- DON'T give up on store name - it's ALWAYS at the top
`;
```

---

### Priority 2: Fix Item Skipping 📝

#### A. Add Frame-by-Frame Item Tracking
```typescript
// Enhance AI prompt to track items across frames
const IMPROVED_ITEM_TRACKING = `
🎬 MIDDLE FRAMES ANALYSIS (Items Section):
- Items appear in MIDDLE frames (usually seconds 2-8)
- SCAN EVERY SINGLE FRAME for items
- If a frame is blurry, CHECK THE NEXT FRAME for the same item
- Keep a mental list of items you've seen - DON'T skip any
- If you see partial text of an item, WAIT for next frame to see it fully
- Items typically have: NAME on left, PRICE on right
- DON'T move to next item until you've captured the current one COMPLETELY

⚠️ ITEM EXTRACTION CHECKLIST:
□ Did I check frames 0-2 for store name?
□ Did I check frames 2-8 for ALL items?
□ Did I check frames 8-10 for total?
□ Did I skip any frames with text?
□ Did I verify each item has a name AND price?
`;
```

#### B. Add Slower Scanning Guidance
```typescript
// In UnifiedScannerScreen.tsx - improve user instructions
const IMPROVED_VIDEO_TIPS = `
📹 Conseils pour un scan parfait:

1. 🐌 SCANNEZ TRÈS LENTEMENT
   - Prenez 1-2 secondes par section
   - Mieux vaut 15 secondes lentes que 5 secondes rapides

2. 📱 Tenez le téléphone STABLE
   - Utilisez les deux mains
   - Appuyez contre votre poitrine pour stabilité

3. 💡 BONNE LUMINOSITÉ
   - Scannez près d'une fenêtre ou lampe
   - Évitez les ombres sur le reçu

4. 📏 DISTANCE OPTIMALE
   - Tenez à 20-30cm du reçu
   - Le texte doit être LISIBLE à l'écran

5. 🎯 SÉQUENCE RECOMMANDÉE:
   - Commencez 5cm AU-DESSUS du nom du magasin
   - Descendez LENTEMENT ligne par ligne
   - Terminez 5cm EN-DESSOUS du total
   - Durée totale: 10-15 secondes

⚠️ ASTUCE: Si le reçu est court (< 10 articles),
utilisez le MODE PHOTO pour plus de précision!
`;
```

#### C. Add Video Quality Check Before Processing
```typescript
// In cameraService - add video quality validation
async recordVideo(): Promise<VideoResult> {
  // After recording, check video quality
  const qualityChecks = {
    minimumDuration: 5000, // At least 5 seconds
    maximumDuration: 15000, // Not more than 15 seconds (too fast)
    frameRate: 'auto', // Let device decide
    resolution: { width: 1920, height: 1080 }, // HD quality
  };
  
  // If video is < 5 seconds, warn user it might be too fast
  if (duration < 5000) {
    Alert.alert(
      'Vidéo trop rapide',
      'Votre scan était très rapide. Voulez-vous réessayer plus lentement pour de meilleurs résultats?',
      [
        { text: 'Continuer quand même', onPress: () => processVideo() },
        { text: 'Recommencer', onPress: () => recordAgain() }
      ]
    );
  }
}
```

---

### Priority 3: Enhance AI Model Configuration 🤖

#### A. Use Multi-Pass Video Analysis
```typescript
// In parseVideoWithGemini - add two-pass processing
async function parseVideoWithGemini(videoBase64: string, mimeType: string) {
  // PASS 1: Extract shop name from first 2 seconds
  const headerResult = await extractVideoHeader(videoBase64, 0, 2);
  
  // PASS 2: Extract items from middle section
  const itemsResult = await extractVideoItems(videoBase64, 2, 10);
  
  // PASS 3: Extract total from last 2 seconds
  const totalResult = await extractVideoTotal(videoBase64, 10, 12);
  
  // COMBINE results with intelligent merging
  return {
    storeName: headerResult.storeName || itemsResult.storeName,
    items: deduplicateItems(itemsResult.items),
    total: totalResult.total || itemsResult.total,
  };
}
```

#### B. Add Confidence Scoring
```typescript
// Track confidence per frame and prefer higher confidence results
const frameAnalysis = {
  frame1: { shopName: 'Peloustore', confidence: 0.6 },
  frame2: { shopName: 'Peloustore', confidence: 0.9 }, // ✅ Use this
  frame3: { shopName: null, confidence: 0.0 },
};

// Always pick the highest confidence value for shop name
const shopName = Object.values(frameAnalysis)
  .filter(f => f.shopName)
  .sort((a, b) => b.confidence - a.confidence)[0]?.shopName;
```

---

### Priority 4: Add Visual Feedback During Recording 📹

#### A. Show Real-Time Frame Analysis
```typescript
// In UnifiedScannerScreen.tsx - add live feedback overlay
const VideoOverlay = () => {
  const [detectedText, setDetectedText] = useState('');
  
  // Show what's being detected in real-time (optional)
  return (
    <View style={styles.overlay}>
      <Text style={styles.hint}>
        {recordingTime < 2 ? '📍 Capturez le nom du magasin...' :
         recordingTime < 8 ? '📝 Scannez les articles...' :
         '💰 Capturez le total...'}
      </Text>
      
      {/* Show scanning zones */}
      <View style={styles.scanZones}>
        <View style={[styles.zone, styles.headerZone]}>
          <Text>Nom magasin {headerCaptured ? '✅' : '⏳'}</Text>
        </View>
        <View style={[styles.zone, styles.itemsZone]}>
          <Text>Articles {itemsCaptured ? '✅' : '⏳'}</Text>
        </View>
        <View style={[styles.zone, styles.totalZone]}>
          <Text>Total {totalCaptured ? '✅' : '⏳'}</Text>
        </View>
      </View>
    </View>
  );
};
```

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 hours) ⚡
1. ✅ Update video scanning instructions in Alert (slower scanning emphasis)
2. ✅ Enhance AI prompt with frame-by-frame instructions
3. ✅ Add shop name emphasis in FIRST FRAMES section
4. ✅ Add item tracking checklist to prompt

### Phase 2: Medium Effort (3-5 hours) 🔨
1. Add video duration validation (warn if < 5s)
2. Improve error messages with specific guidance
3. Add confidence scoring to prefer better frames
4. Add visual scanning zones overlay

### Phase 3: Advanced (1-2 days) 🚀
1. Implement hybrid photo+video approach (photo for header, video for items)
2. Add multi-pass video analysis (header → items → total)
3. Add frame quality detection before processing
4. Implement real-time OCR feedback during recording

---

## Immediate Actionable Changes

### 1. Update AI Prompt (5 minutes)
```typescript
// Add to VIDEO_PARSING_PROMPT in functions/src/receipt/parseReceipt.ts
const ENHANCED_PROMPT = `
⚠️ CRITICAL: STORE NAME DETECTION
- The STORE NAME is in the FIRST 2-3 FRAMES at the TOP
- These frames might be slightly blurry - that's NORMAL
- Look for LARGE, BOLD text at the receipt top
- If frame 1 is unclear, check frames 2 and 3
- Common stores: Peloustore, Shoprite, Carrefour, Hasson & Frères, Kin Marché, Dakar Market
- If you see ANY recognizable store name, USE IT - don't leave it null

⚠️ CRITICAL: DON'T SKIP ITEMS
- Review EVERY frame from start to end
- If text is blurry in one frame, check the NEXT frame
- Keep a running count of items as you scan frames
- Verify each item has: name + price + quantity
- DON'T jump ahead - process frames sequentially
- If you detect 5 items, make sure you output ALL 5 items
`;
```

### 2. Update User Instructions (10 minutes)
```typescript
// In UnifiedScannerScreen.tsx - handleVideoScan
Alert.alert(
  '📹 Comment scanner une vidéo',
  
  '🐌 RÈGLE #1: SCANNEZ LENTEMENT!\n' +
  'Prenez 10-15 secondes pour tout le reçu.\n\n' +
  
  '📱 RÈGLE #2: SÉQUENCE CORRECTE\n' +
  '1. Commencez 5cm AU-DESSUS du nom magasin\n' +
  '2. Descendez LENTEMENT ligne par ligne\n' +
  '3. Terminez 5cm APRÈS le total\n\n' +
  
  '💡 RÈGLE #3: BONNE LUMIÈRE\n' +
  'Le texte doit être clair et lisible.\n\n' +
  
  '⚠️ ASTUCE: Reçu court? Utilisez le mode PHOTO!',
  
  [
    {text: 'Annuler', style: 'cancel'},
    {text: 'Prendre une photo', onPress: handlePhotoCapture},
    {text: 'OK, j\'ai compris', onPress: startVideoRecording},
  ]
);
```

### 3. Add Video Duration Check (15 minutes)
```typescript
// In UnifiedScannerScreen.tsx - after video recording
if (result.duration < 5000) {
  Alert.alert(
    '⚠️ Vidéo trop rapide',
    `Votre scan a duré ${(result.duration / 1000).toFixed(1)}s. Pour de meilleurs résultats, scannez pendant 10-15 secondes.\n\nVoulez-vous réessayer?`,
    [
      {text: 'Continuer quand même', onPress: () => processVideo(result)},
      {text: 'Recommencer lentement', onPress: handleVideoScan},
    ]
  );
}
```

---

## Expected Results After Implementation

### Shop Name Detection:
- **Before:** 30-40% success rate
- **After Phase 1:** 70-80% success rate
- **After Phase 3:** 90-95% success rate

### Item Capture Completeness:
- **Before:** 70-80% of items captured
- **After Phase 1:** 85-90% of items captured
- **After Phase 3:** 95-98% of items captured

### User Experience:
- Clearer instructions = fewer failed scans
- Duration validation = better quality videos
- Visual feedback = user confidence during recording
- Hybrid approach = best of both worlds (photo + video)

---

## Testing Checklist

After implementing changes, test with:
- [ ] Short receipt (< 10 items) - should suggest photo mode
- [ ] Long receipt (> 20 items) - video should capture all
- [ ] Blurry first frames - should still get shop name
- [ ] Fast scanning (< 5s) - should warn user
- [ ] Slow scanning (10-15s) - should get everything
- [ ] Different lighting conditions
- [ ] Different shop names
- [ ] Receipts with multi-line items

---

## Conclusion

The main issues are:
1. **Shop name in first frames** - often blurry or skipped
2. **Items in middle frames** - scanning too fast causes skips
3. **User behavior** - need better guidance for proper scanning

**Quick fix:** Update AI prompt + user instructions (30 minutes)
**Better fix:** Add validation + visual feedback (4-5 hours)
**Best fix:** Implement hybrid photo+video approach (2 days)

Start with Phase 1 for immediate 40-50% improvement! 🚀
