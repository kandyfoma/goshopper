# Bilingual Search System

## Overview
The bilingual search system uses a **hybrid approach** to enable users to search for items in either French or English, automatically matching items regardless of the language used in the search query.

## Hybrid Architecture

### Three-Tier Translation System

1. **Static Dictionary (Instant - 0ms)**
   - 150+ pre-defined French-English translations
   - Covers common grocery and household items
   - Zero latency, works offline
   - Handles ~90% of typical searches

2. **Cache Layer (Fast - <10ms)**
   - AsyncStorage persistent cache (30-day TTL)
   - In-memory session cache
   - Stores API translations for reuse
   - Grows smarter over time

3. **API Fallback (2 seconds timeout)**
   - MyMemory Translation API (free tier)
   - 5,000 requests/day, no API key needed
   - Kicks in for unknown terms
   - Automatically caches results

### How It Works

**Search Flow:**
```
User types "bread"
    ↓
1. Check static dictionary → Found "pain" ✓ (instant)
    ↓
2. Return results immediately

User types "manioc"  
    ↓
1. Check static dictionary → Not found
    ↓
2. Check cache (AsyncStorage) → Not found
    ↓
3. Call MyMemory API → Returns "cassava"
    ↓
4. Cache result for future searches
    ↓
5. Return results with translation
```

**Performance:**
- **Common items**: Instant (0ms latency)
- **Cached items**: Very fast (<10ms)
- **New items**: 200-500ms first time, then cached

**Offline Support:**
- Static dictionary always works offline
- Cached translations work offline
- API fallback gracefully fails if no internet
- **Bread & Bakery**: pain/bread, croissant, gâteau/cake, biscuit/cookie
- **Dairy Products**: lait/milk, fromage/cheese, beurre/butter, yaourt/yogurt
- **Meat & Fish**: viande/meat, poulet/chicken, bœuf/beef, poisson/fish
- **Fruits**: pomme/apple, banane/banana, orange, fraise/strawberry
- **Vegetables**: tomate/tomato, pomme de terre/potato, carotte/carrot
- **Beverages**: eau/water, jus/juice, café/coffee, thé/tea
- **Pantry Items**: riz/rice, pâtes/pasta, farine/flour, sucre/sugar
- **Household Products**: savon/soap, dentifrice/toothpaste, détergent/detergent
- **Baby Products**: couche/diaper, biberon/bottle, lingette/wipe

### Search Examples

**Searching in French:**
- Type "pain" → Finds both "Pain", "Bread", "Baguette"
- Type "lait" → Finds both "Lait", "Milk"
- Type "pomme" → Finds both "Pomme", "Apple", "Pomme de terre", "Potato"

**Searching in English:**
- Type "bread" → Finds both "Bread", "Pain", "Baguette"
- Type "milk" → Finds both "Milk", "Lait"
- Type "apple" → Finds both "Apple", "Pomme"

### Features

1. **Accent-Insensitive**: Searches work with or without accents
   - "café" and "cafe" both work
   - "pâte" and "pate" both work

2. **Partial Matching**: Matches partial words and phrases
   - "pom" matches "pomme", "apple", "pomme de terre"
   - "tom" matches "tomate", "tomato"

3. **Word-by-Word Matching**: Searches multi-word items intelligently
   - "pomme terre" matches "pomme de terre" and "potato"
   - "petit pois" matches "peas" and "petits pois"

4. **Fuzzy Matching**: Allows small typos (still active for all languages)
   - "tomatoe" matches "tomate" and "tomato"
   - "chiken" matches "poulet" and "chicken"

## Implementation

### Files Modified/Created
1. **src/shared/services/translation.ts** - Hybrid translation service with API integration
2. **src/features/items/screens/ItemsScreen.tsx** - Async search with translation
3. **src/features/items/screens/CityItemsScreen.tsx** - Async search with translation
4. **src/features/stats/screens/CategoryDetailScreen.tsx** - Async search with translation
5. **src/app/App.tsx** - Background pre-translation initialization

### Key Features

#### 1. Background Pre-Translation
On app startup, common terms are pre-translated and cached:
```typescript
const commonTerms = [
  'pain', 'bread', 'lait', 'milk', 'eau', 'water',
  'riz', 'rice', 'viande', 'meat', 'poisson', 'fish'
];
await translationService.preTranslateCommonTerms(commonTerms);
```

#### 2. Smart Caching
- **AsyncStorage**: Persistent cache (survives app restarts)
- **In-Memory**: Fast session cache (cleared on app close)
- **30-Day TTL**: Cached translations expire after 30 days
- **Automatic Updates**: Old cache entries are refreshed as needed

#### 3. API Integration
- **Provider**: MyMemory Translation API
- **Free Tier**: 5,000 requests/day (no API key required)
- **Timeout**: 2 seconds (fails gracefully)
- **Rate Limiting**: Automatic caching prevents excessive API calls

#### 4. Graceful Degradation
If API fails (network error, rate limit, timeout):
- Falls back to static dictionary
- Uses fuzzy matching for close matches
- Search still works, just with reduced translation coverage

### How to Use

The translation service is automatically integrated. Users search normally:

```typescript
// Search happens automatically when user types
filterItems(); // This now uses hybrid translation
```

### API Usage & Limits

**MyMemory Free Tier:**
- ✅ 5,000 API calls per day
- ✅ No registration required
- ✅ No API key needed
- ⚠️ Rate limited (handled gracefully)

**Typical Usage:**
- Most searches hit cache (no API call)
- Only new/unknown terms trigger API
- Expected: <50 API calls per day per user
- With 100 active users: ~5,000 calls/day (within limit)

### Cache Management

```typescript
// Clear cache (debugging or settings)
await translationService.clearTranslationCache();

// Pre-translate custom terms
await translationService.preTranslateCommonTerms(['custom', 'terms']);
```

### Adding New Translations

To add new translations, edit `src/shared/services/translation.ts` and add entries to the `TRANSLATION_MAP`:

```typescript
{
  fr: ['nouveau', 'nouveaux'],
  en: ['new']
}
```

The system automatically builds bidirectional lookup maps for fast searching.

## Technical Details

### Performance Characteristics
- **Static dictionary**: 0ms latency
- **Session cache**: <1ms latency  
- **AsyncStorage cache**: 5-10ms latency
- **API call**: 200-500ms latency (first time only)
- **Overall search**: Typically <50ms for most queries

### Search Priority
1. **Static dictionary match** - Instant, predefined translations
2. **Session cache** - Already translated this session
3. **AsyncStorage cache** - Translated in previous session
4. **API translation** - Unknown term, call MyMemory API
5. **Cache result** - Store for future use
6. **Fuzzy matching** - Close matches even without translation

### API Error Handling
```typescript
try {
  const translation = await fetchFromAPI(term, 'fr', 'en');
  // Cache and use translation
} catch (error) {
  // Silent fail - search continues with static dictionary
  // No user-facing error
}
```

### Memory Management
- **Session cache**: Cleared on app close (~1-5KB)
- **AsyncStorage**: Persists between sessions (~10-50KB)
- **Automatic cleanup**: Expired entries removed (30 days)
- **No memory leaks**: Bounded cache size

### Limitations
- API has 5,000 requests/day limit (shared across all users)
- First search for unknown term requires internet
- 2-second API timeout (fails fast if slow)
- Translation quality depends on MyMemory API
- Brand names and local terms may not translate well

## Monitoring & Analytics

**Recommended tracking:**
- API call success rate
- Cache hit ratio
- Average search latency
- Failed translations

**Add to analytics:**
```typescript
analyticsService.logCustomEvent('translation_cache_hit', {
  term: searchTerm,
  source: 'static' | 'cache' | 'api'
});
```

## Future Enhancements
- **Smart pre-caching**: Analyze user search patterns
- **Community translations**: Users suggest translations
- **Offline ML translation**: On-device model for complete offline support
- **Multi-language support**: Add Lingala, Swahili, Spanish
- **Translation analytics**: Track most searched terms
- **Synonym expansion**: "soda" → "boisson gazeuse", "pop", "soft drink"
