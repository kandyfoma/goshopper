# GoShopper App Performance Optimization Plan

## Current Performance Analysis

### 🔴 Critical Bottlenecks Identified

#### 1. **CityItemsScreen - Loading Thousands of Items**
**Problem:**
- Loads ALL city items at once via Cloud Function
- No pagination - single request for potentially 1000+ items
- FlatList renders all items without optimization props
- 30-second timeout for Cloud Function
- No incremental loading/infinite scroll

**Current Flow:**
```
User opens CityItems → Cloud Function loads ALL items → 
Wait 5-30s → Display all 1000+ items at once
```

**Impact:** 
- 5-30 second initial load time
- High memory usage (100MB+ for 1000 items)
- Poor UX - long waiting time
- Cloud Function can timeout

#### 2. **StatsScreen - Multiple Firestore Queries**
**Problem:**
- Loads ALL receipts from Firestore without limit
- Multiple sequential queries instead of parallel
- Filters in memory after fetching everything
- No pagination for historical data
- Heavy calculations on main thread

**Current Flow:**
```
User opens Stats → Get ALL receipts → Filter in memory → 
Calculate categories → Calculate trends → Render charts
```

**Impact:**
- 3-10 second load time for users with 100+ receipts
- Blocks UI thread during calculations
- High memory usage

#### 3. **FlatList Without Optimization Props**
**Problem:**
- Most FlatLists missing critical optimization props:
  - `initialNumToRender` - renders too many items initially
  - `maxToRenderPerBatch` - renders too many at once
  - `windowSize` - keeps too many items in memory
  - `getItemLayout` - can't skip measurements
  - `removeClippedSubviews` - keeps off-screen items

**Files Affected:**
- CityItemsScreen.tsx
- ShopsScreen.tsx  
- NotificationsScreen.tsx
- CategoryDetailScreen.tsx

#### 4. **No Incremental/Lazy Loading**
**Problem:**
- All screens load complete datasets upfront
- No "load more" or infinite scroll
- No skeleton screens during initial load

#### 5. **Heavy Synchronous Operations on Main Thread**
**Problem:**
- `simpleSearch` with fuzzy matching runs on main thread
- `levenshteinDistance` calculations block UI
- Category calculations in StatsScreen block rendering
- No debouncing on search inputs

#### 6. **Cache Configuration Too Aggressive**
**Current Settings:**
```typescript
maxMemoryCacheSize: 1000 items
maxMemoryCacheBytes: 100MB
defaultTTL: 7 days
```

**Problem:**
- Holds too much in memory (100MB)
- 7-day TTL keeps stale data
- No automatic cleanup of old entries

---

## 🎯 Optimization Strategy

### Phase 1: Quick Wins (1-2 hours) ⚡

#### A. Optimize FlatList Props (All Screens)
```typescript
// Add to ALL FlatLists
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  
  // ✅ Performance optimizations
  initialNumToRender={10}           // Only render 10 items initially
  maxToRenderPerBatch={10}          // Render 10 items per batch
  windowSize={5}                    // Keep 5 screens worth of items
  removeClippedSubviews={true}      // Remove off-screen items from hierarchy
  updateCellsBatchingPeriod={50}    // Batch updates every 50ms
  
  // ✅ If item height is fixed
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

#### B. Add Pagination to CityItemsScreen
```typescript
// Instead of loading ALL items at once
const ITEMS_PER_PAGE = 50;
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);

// Load items in batches
const loadMoreItems = () => {
  if (loading || !hasMore) return;
  
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const newItems = allItems.slice(start, end);
  
  setDisplayedItems([...displayedItems, ...newItems]);
  setPage(page + 1);
  
  if (newItems.length < ITEMS_PER_PAGE) {
    setHasMore(false);
  }
};

<FlatList
  data={displayedItems}
  onEndReached={loadMoreItems}
  onEndReachedThreshold={0.5}
  ListFooterComponent={hasMore ? <ActivityIndicator /> : null}
/>
```

#### C. Debounce Search Input
```typescript
import {useDebouncedValue} from '@/shared/hooks/useDebouncedValue';

// In component
const [searchInput, setSearchInput] = useState('');
const debouncedSearch = useDebouncedValue(searchInput, 300); // 300ms delay

useEffect(() => {
  if (debouncedSearch) {
    performSearch(debouncedSearch);
  }
}, [debouncedSearch]);
```

#### D. Memoize Heavy Computations
```typescript
// Memoize filtered/sorted items
const filteredItems = useMemo(() => {
  if (!searchQuery) return items;
  return items.filter(item => simpleSearch(item, searchQuery));
}, [items, searchQuery]);

const sortedItems = useMemo(() => {
  return [...filteredItems].sort((a, b) => {
    if (sortBy === 'price') return a.minPrice - b.minPrice;
    if (sortBy === 'popular') return b.prices.length - a.prices.length;
    return a.name.localeCompare(b.name);
  });
}, [filteredItems, sortBy]);
```

---

### Phase 2: Medium Effort (3-5 hours) 🔨

#### A. Implement Virtual Pagination for Cloud Functions
Update getCityItems Cloud Function:

```typescript
// functions/src/city/getCityItems.ts
export const getCityItems = functions
  .https.onCall(async (data, context) => {
    const {city, page = 1, limit = 50} = data;
    
    // Paginated query
    const itemsQuery = db
      .collection('city-items')
      .where('city', '==', city)
      .orderBy('popularity', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    
    const snapshot = await itemsQuery.get();
    
    return {
      items: snapshot.docs.map(doc => doc.data()),
      page,
      hasMore: snapshot.size === limit,
      total: await getTotalCount(city), // Cached count
    };
  });
```

#### B. Add Skeleton Screens
```typescript
// Create reusable skeleton loader
const ItemSkeleton = () => (
  <View style={styles.skeleton}>
    <SkeletonPlaceholder>
      <SkeletonPlaceholder.Item flexDirection="row">
        <SkeletonPlaceholder.Item width={60} height={60} borderRadius={8} />
        <SkeletonPlaceholder.Item marginLeft={16} flex={1}>
          <SkeletonPlaceholder.Item width="80%" height={20} />
          <SkeletonPlaceholder.Item marginTop={8} width="60%" height={16} />
        </SkeletonPlaceholder.Item>
      </SkeletonPlaceholder.Item>
    </SkeletonPlaceholder>
  </View>
);

// Show during initial load
{isLoading && (
  <>
    <ItemSkeleton />
    <ItemSkeleton />
    <ItemSkeleton />
  </>
)}
```

#### C. Move Heavy Operations to Background
```typescript
// Use InteractionManager for non-critical work
import {InteractionManager} from 'react-native';

const performHeavyCalculation = async () => {
  await InteractionManager.runAfterInteractions(async () => {
    // This runs after animations complete
    const results = await calculateCategoryTotals(receipts);
    setCategories(results);
  });
};
```

#### D. Optimize Cache Strategy
```typescript
// Reduce cache sizes and TTLs
const OPTIMIZED_CACHE_CONFIG = {
  maxMemoryCacheSize: 200,          // Reduced from 1000
  maxMemoryCacheBytes: 20 * 1024 * 1024, // 20MB instead of 100MB
  defaultTTL: 1 * 60 * 60 * 1000,   // 1 hour instead of 7 days
};

// Implement cache cleanup on app background
AppState.addEventListener('change', (state) => {
  if (state === 'background') {
    cacheManager.cleanup(); // Remove expired entries
  }
});
```

---

### Phase 3: Advanced (1-2 days) 🚀

#### A. Implement @shopify/flash-list
Replace FlatList with FlashList for 5-10x performance:

```bash
npm install @shopify/flash-list
```

```typescript
import {FlashList} from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={renderItem}
  estimatedItemSize={80}  // Approximate item height
  // Automatically optimized!
/>
```

**Benefits:**
- 5-10x faster rendering
- Lower memory usage
- Better scroll performance
- Automatic recycling

#### B. Add Server-Side Pagination & Caching
```typescript
// Use Firestore composite indexes for efficient pagination
const getPagedCityItems = async (city: string, lastDoc: any, limit: number) => {
  let query = db.collection('city-items')
    .where('city', '==', city)
    .orderBy('popularity', 'desc')
    .limit(limit);
  
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }
  
  return await query.get();
};
```

#### C. Implement Data Prefetching
```typescript
// Prefetch next page while user scrolls
const prefetchNextPage = useCallback(() => {
  if (!prefetching && hasMore) {
    setPrefetching(true);
    loadMoreItems().finally(() => setPrefetching(false));
  }
}, [prefetching, hasMore]);

<FlatList
  onEndReachedThreshold={0.8} // Prefetch when 80% scrolled
  onEndReached={prefetchNextPage}
/>
```

#### D. Add Search Indexing (Algolia/Meilisearch)
For instant search across thousands of items:

```typescript
// Use search service instead of client-side filtering
import {searchService} from '@/shared/services/search';

const searchItems = async (query: string) => {
  const results = await searchService.search('city-items', query, {
    filters: `city:${userCity}`,
    hitsPerPage: 20,
  });
  return results.hits;
};
```

---

## 📊 Expected Performance Improvements

### Load Times
| Screen | Before | After Phase 1 | After Phase 3 |
|--------|---------|--------------|--------------|
| CityItems (1000 items) | 10-30s | 2-3s | <1s |
| Stats (100 receipts) | 5-10s | 2-3s | <1s |
| Shops List | 3-5s | 1-2s | <1s |

### Memory Usage
| Metric | Before | After Phase 1 | After Phase 3 |
|--------|---------|--------------|--------------|
| Peak Memory | 200-300MB | 100-150MB | 50-100MB |
| Cache Size | 100MB | 20MB | 10MB |
| Idle Memory | 150MB | 80MB | 50MB |

### User Experience
- ✅ Initial load: 80% faster
- ✅ Scroll performance: 90% smoother
- ✅ Search: Instant (<100ms)
- ✅ No UI freezes during heavy operations

---

## 🔧 Implementation Priority

### Immediate (Today)
1. ✅ Add FlatList optimization props to CityItemsScreen
2. ✅ Add pagination (client-side) to CityItemsScreen
3. ✅ Add debounced search
4. ✅ Memoize filtered/sorted arrays
5. ✅ Add loading skeletons

### This Week
1. Reduce cache configuration sizes
2. Move heavy calculations to background
3. Add InteractionManager for non-critical work
4. Implement proper FlatList getItemLayout
5. Add prefetching

### Next Sprint
1. Migrate to @shopify/flash-list
2. Implement server-side pagination
3. Add search indexing service
4. Optimize Cloud Functions with caching layer

---

## 🎯 Key Files to Optimize

1. **CityItemsScreen.tsx** - Priority 1
   - Add FlatList optimization props
   - Implement pagination
   - Debounce search
   - Memoize computations

2. **StatsScreen.tsx** - Priority 2
   - Limit initial query (last 100 receipts)
   - Parallel queries instead of sequential
   - Memoize category calculations
   - Add loading states

3. **CacheManager.ts** - Priority 3
   - Reduce memory limits
   - Shorter TTLs
   - Add automatic cleanup
   - Implement LRU eviction

4. **Cloud Functions** - Priority 4
   - Add pagination to getCityItems
   - Implement Redis caching layer
   - Add response compression
   - Optimize Firestore queries

---

## 📝 Testing Checklist

After implementing optimizations:
- [ ] Test with 1000+ items in CityItemsScreen
- [ ] Test with 200+ receipts in StatsScreen
- [ ] Measure app startup time
- [ ] Profile memory usage
- [ ] Test on low-end devices (2GB RAM)
- [ ] Test scroll performance (60 FPS target)
- [ ] Test search responsiveness
- [ ] Monitor crash rate in production

---

## 🚀 Next Steps

Start with Phase 1 (Quick Wins) - implement now for immediate 50-70% performance improvement!
