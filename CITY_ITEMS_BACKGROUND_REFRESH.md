# City Items Background Refresh System

## Overview
Automatic background refresh system for the City Items (community prices) page that keeps data fresh without user interaction.

## Features

### 1. **Silent Background Refresh**
- Automatically refreshes city items data every **5 minutes** when the page is active
- Updates cache silently without disrupting the user experience
- Shows a subtle spinner in the header during refresh
- Runs independently of user actions

### 2. **While-Reading Refresh**
- Triggers after **10 seconds** of viewing the page
- Checks if cache is stale (older than 3 minutes)
- Only fetches new data if needed
- Updates items seamlessly in the background

### 3. **Cache Preloading**
- Preloads city items into cache when:
  - User logs in
  - User profile loads
  - App starts up
- Ensures data is ready before user navigates to the page
- Non-blocking operation

### 4. **Real-time Updates**
- Subscribe to data changes using listener pattern
- Multiple components can react to the same refresh
- Automatic cleanup when component unmounts

## Architecture

### Services

#### `cityItemsRefreshService.ts`
Central service managing all refresh operations:

```typescript
// Start auto-refresh for a city
cityItemsRefreshService.startAutoRefresh(city);

// Stop auto-refresh
cityItemsRefreshService.stopAutoRefresh(city);

// Silent refresh (no UI disruption)
await cityItemsRefreshService.silentRefresh(city);

// Refresh while reading (respects cache freshness)
await cityItemsRefreshService.refreshWhileReading(city);

// Preload into cache
await cityItemsRefreshService.preloadCityItems(city);

// Subscribe to updates
const unsubscribe = cityItemsRefreshService.subscribe(city, (items) => {
  setItems(items);
});
```

### Integration Points

#### **CityItemsScreen.tsx**
```typescript
useFocusEffect(
  useCallback(() => {
    // Start auto-refresh when screen is focused
    cityItemsRefreshService.startAutoRefresh(userProfile.defaultCity);
    
    // Subscribe to background updates
    const unsubscribe = cityItemsRefreshService.subscribe(
      userProfile.defaultCity,
      (updatedItems) => {
        setItems(updatedItems);
        setIsSilentRefreshing(false);
      }
    );
    
    // Cleanup
    return () => {
      cityItemsRefreshService.stopAutoRefresh(userProfile.defaultCity);
      unsubscribe();
    };
  }, [userProfile?.defaultCity])
);
```

#### **CachePreloader.ts**
```typescript
async preloadCriticalData(userId: string) {
  const userData = await getUserData(userId);
  const defaultCity = userData?.defaultCity;
  
  if (defaultCity) {
    // Preload city items on app startup
    await cityItemsRefreshService.preloadCityItems(defaultCity);
  }
}
```

#### **CacheManager.ts**
Added `getMetadata()` method to check cache age:
```typescript
const metadata = await cacheManager.getMetadata('city-items-kinshasa', 'receipts');
if (metadata) {
  const age = Date.now() - metadata.timestamp;
  const isStale = age > STALE_THRESHOLD;
}
```

## Configuration

### Refresh Intervals
```typescript
REFRESH_INTERVAL = 5 * 60 * 1000;      // 5 minutes - auto-refresh interval
STALE_THRESHOLD = 3 * 60 * 1000;       // 3 minutes - cache considered stale
WHILE_READING_DELAY = 10000;           // 10 seconds - delay before while-reading refresh
```

### Cache Settings
```typescript
CacheTTL.DAY                           // 24 hours - city items cache TTL
CachePriority.HIGH                     // High priority for city items
```

## User Experience

### What Users See

1. **Initial Load**
   - Data loads from cache instantly (if available)
   - Background refresh starts automatically
   - No visual indication unless refresh takes time

2. **Active Viewing**
   - After 10 seconds, silent refresh begins
   - Small spinner appears next to page title
   - Items update seamlessly without scroll disruption
   - Spinner disappears when complete

3. **Pull to Refresh**
   - Still works as before
   - Forces immediate refresh
   - Bypasses cache completely

4. **Background Updates**
   - Every 5 minutes, cache refreshes automatically
   - No visual indication
   - Users always see fresh data

### Performance Benefits

- **Reduced Wait Times**: Data is preloaded before navigation
- **Always Fresh**: Auto-refresh ensures data is never stale
- **Smooth UX**: Silent updates don't interrupt reading
- **Bandwidth Efficient**: Only refreshes when needed (stale check)

## Analytics

Tracks background refresh events:
```typescript
analyticsService.logCustomEvent('city_items_auto_refresh', {
  city: 'Kinshasa',
  itemCount: 1234,
  success: true,
});
```

## Error Handling

- **Silent Mode**: Errors don't disrupt UI
- **Fallback to Cache**: Uses cached data on network failure
- **Retry Logic**: Auto-refresh will try again on next interval
- **Timeout Protection**: 30-second timeout for Cloud Function calls

## Future Enhancements

### Potential Improvements
1. **Smart Refresh Intervals**: Adjust based on data change frequency
2. **Network-Aware**: Pause on poor connection, accelerate on WiFi
3. **Battery Optimization**: Reduce refresh rate when battery is low
4. **Delta Updates**: Only fetch changed items instead of full dataset
5. **Push Notifications**: Server pushes updates instead of polling

### Advanced Features
- **Predictive Preloading**: Preload based on user behavior
- **Compression**: Reduce data transfer size
- **Background Fetch**: iOS/Android background refresh APIs
- **Offline Queue**: Store failed refreshes for retry

## Testing

### Manual Testing
1. Open City Items page
2. Wait 10 seconds → should see spinner
3. Wait 5 minutes → should refresh silently
4. Pull to refresh → should work immediately
5. Close and reopen app → data should be cached

### Debug Logs
Enable detailed logging:
```typescript
console.log('🔄 [CityItemsRefresh] Starting auto-refresh for city:', city);
console.log('✅ [CityItemsRefresh] Silent refresh completed:', itemCount);
console.log('⚠️ [CityItemsRefresh] Silent refresh error:', error);
```

## Troubleshooting

### Cache Not Updating
- Check if auto-refresh started: Look for "Starting auto-refresh" log
- Verify city is set in user profile
- Check cache age with `getMetadata()`

### Memory Leaks
- Ensure `unsubscribe()` is called on unmount
- Verify `stopAutoRefresh()` is called when leaving screen
- Check that timers are cleared properly

### Performance Issues
- Monitor memory usage with cache stats
- Reduce refresh interval if needed
- Check for duplicate refresh timers

## Files Modified

1. **Created**:
   - `src/features/items/services/cityItemsRefreshService.ts` (new service)
   - `src/features/items/services/index.ts` (exports)

2. **Updated**:
   - `src/features/items/screens/CityItemsScreen.tsx` (integration)
   - `src/shared/services/caching/CachePreloader.ts` (preload city items)
   - `src/shared/services/caching/CacheManager.ts` (add getMetadata method)

## Summary

The background refresh system provides a seamless experience where city items are always fresh without requiring user interaction. Data is preloaded on app startup, auto-refreshed every 5 minutes, and can be manually refreshed at any time. The system is network-efficient, respects cache freshness, and operates silently in the background.
