// City Items Screen - Browse items from all users in the same city
// Shows aggregated price data for community price comparison
import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import {firebase} from '@react-native-firebase/functions';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn, SubscriptionLimitModal, WatchItemButton} from '@/shared/components';
import {formatCurrency, safeToDate} from '@/shared/utils/helpers';
import {useAuth, useUser, useSubscription} from '@/shared/contexts';
import {hasFeatureAccess} from '@/shared/utils/featureAccess';
import {analyticsService} from '@/shared/services/analytics';
import {cacheManager, CacheTTL} from '@/shared/services/caching';
import {translationService} from '@/shared/services/translation';
import {RootStackParamList} from '@/shared/types';

// City/Community item data (Tier 3: Community Prices - Anonymous)
// Source: getCityItems Cloud Function → artifacts/{APP_ID}/users/*/items
// Aggregates items from all users in the same city
interface CityItemData {
  id: string;
  name: string;
  category?: string;        // Item category (e.g., 'Boissons', 'Alimentation')
  searchKeywords?: string[]; // Keywords for enhanced search (e.g., ['wine', 'vin'] for 'merlot')
  prices: {
    storeName: string;
    price: number;
    currency: 'USD' | 'CDF';
    date: Date | any; // Can be Date or Firestore Timestamp
    userId: string;
  }[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  currency: 'USD' | 'CDF';
  userCount: number; // Number of users who purchased this item
  lastPurchaseDate: Date;
  createdAt?: Date;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Pagination constants
const ITEMS_PER_PAGE = 50;
const ITEM_HEIGHT = 120; // Approximate height for getItemLayout optimization

export function CityItemsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {isAuthenticated} = useAuth();
  const {profile: userProfile, isLoading: profileLoading} = useUser();
  const {subscription} = useSubscription();
  const [items, setItems] = useState<CityItemData[]>([]);
  const [displayedItems, setDisplayedItems] = useState<CityItemData[]>([]); // Items currently displayed
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Immediate input value
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'popular'>('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchAnimation = useRef(new Animated.Value(0)).current;
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check feature access
  const hasAccess = hasFeatureAccess('priceComparison', subscription);

  // Debounced search - only trigger search 300ms after user stops typing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput]);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('City Items', 'CityItemsScreen');
    
    // Show upgrade modal if no access
    if (!hasAccess) {
      setShowLimitModal(true);
    }
  }, [hasAccess]);

  // Reload data when screen comes into focus - always fetch fresh data
  useFocusEffect(
    useCallback(() => {

      
      // Guard: Re-check access when screen regains focus
      if (!hasAccess) {
        setShowLimitModal(true);
        setIsLoading(false); // Stop loading to show the modal
        return;
      }
      
      if (!profileLoading && userProfile?.defaultCity) {
        loadCityItemsData(true); // Always force refresh for real-time data
      } else if (!profileLoading) {
        setIsLoading(false);
      }
    }, [userProfile?.defaultCity, profileLoading, hasAccess])
  );

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    await loadCityItemsData(true); // Force refresh
    setRefreshing(false);
  };

  // Memoize filtered and sorted items for performance
  const filteredAndSortedItems = useMemo(() => {
    let result = items;
    
    // Filter by search query
    if (searchQuery) {
      result = items.filter(item => {
        const normalize = (str: string) => 
          str.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        
        const normalizedItem = normalize(item.name);
        const normalizedQuery = normalize(searchQuery);
        
        // Quick checks for performance
        if (normalizedItem.includes(normalizedQuery)) return true;
        if (item.category && normalize(item.category).includes(normalizedQuery)) return true;
        if (item.searchKeywords?.some(kw => normalize(kw).includes(normalizedQuery))) return true;
        
        return false;
      });
    }
    
    // Sort items
    const sorted = [...result].sort((a, b) => {
      if (sortBy === 'price') {
        return a.minPrice - b.minPrice;
      } else if (sortBy === 'popular') {
        return b.prices.length - a.prices.length;
      } else {
        return a.name.localeCompare(b.name);
      }
    });
    
    return sorted;
  }, [items, searchQuery, sortBy]);

  // Update displayed items when filtered items or page changes
  useEffect(() => {
    const start = 0;
    const end = page * ITEMS_PER_PAGE;
    const newDisplayedItems = filteredAndSortedItems.slice(start, end);
    
    setDisplayedItems(newDisplayedItems);
    setHasMore(end < filteredAndSortedItems.length);
  }, [filteredAndSortedItems, page]);

  // Load more items when user scrolls to bottom
  const loadMoreItems = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    // Small delay for smooth UX and debouncing
    setTimeout(() => {
      setPage(prev => prev + 1);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMore]);

  const toggleSearch = () => {
    if (isSearchOpen) {
      // Closing search
      setSearchQuery('');
      Animated.timing(searchAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => setIsSearchOpen(false));
    } else {
      // Opening search
      setIsSearchOpen(true);
      Animated.timing(searchAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => searchInputRef.current?.focus());
    }
  };

  const loadCityItemsData = async (forceRefresh: boolean = false) => {
    if (profileLoading) {
      console.log('⏳ Profile still loading, skipping');
      return;
    }
    if (!userProfile?.defaultCity) {
      console.log('❌ No defaultCity, skipping');
      setIsLoading(false);
      return;
    }

    const city = userProfile.defaultCity;
    const cacheKey = `city-items-${city}`;

    // Try cache first (skip if force refresh)
    if (!forceRefresh) {
      try {
        const cachedData = await cacheManager.get<CityItemData[]>(cacheKey, 'receipts');
        if (cachedData && cachedData.length > 0) {
          setItems(cachedData);
          setIsLoading(false);
          return;
        }
      } catch (cacheError) {
        console.log('⚠️ Cache read failed:', cacheError);
      }
    } else {
      // Force refresh - clear the cache first
      console.log('🔄 Force refresh - clearing cache for:', cacheKey);
      try {
        await cacheManager.remove(cacheKey, 'receipts');
      } catch (e) {
        console.log('⚠️ Failed to clear cache:', e);
      }
    }

    console.log('📡 Calling getCityItems for city:', city);
    try {
      const functionsInstance = firebase.app().functions('europe-west1');
      
      // Set a timeout for the function call
      const callFunction = functionsInstance.httpsCallable('getCityItems', {
        timeout: 30000, // 30 seconds timeout
      });
      
      console.log('⏰ Starting Cloud Function call...');
      
      // Add a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);
      });
      
      const functionPromise = callFunction({ city });
      
      const result = await Promise.race([functionPromise, timeoutPromise]) as any;

      console.log('✅ getCityItems result:', result);
      const data = result.data as {
        success: boolean;
        items: CityItemData[];
        city: string;
        message?: string;
      };

      if (data.success) {
        if (data.items && data.items.length > 0) {
          const itemsArray = data.items.sort(
            (a: any, b: any) => b.prices.length - a.prices.length,
          ); // Sort by total purchases
          console.log('📦 Setting items:', itemsArray.length);
          setItems(itemsArray);

          // Cache the data
          try {
            await cacheManager.set(cacheKey, itemsArray, {
              namespace: 'receipts',
              ttl: CacheTTL.DAY, // Cache for 24 hours
            });
            console.log('💾 Cached city items for city:', city);
          } catch (cacheError) {
            console.log('⚠️ Failed to cache city items:', cacheError);
          }
        } else {
          console.log('ℹ️ No items available for this city yet');
          setItems([]);
          // Clear cache when server returns empty list
          try {
            await cacheManager.remove(cacheKey, 'receipts');
            console.log('🗑️ Cleared stale city items cache');
          } catch (cacheError) {
            console.log('⚠️ Failed to clear cache:', cacheError);
          }
        }
      } else {
        console.log('❌ No items returned');
        setItems([]);
        // Clear cache on unsuccessful response
        try {
          await cacheManager.remove(cacheKey, 'receipts');
        } catch (cacheError) {
          console.log('⚠️ Failed to clear cache:', cacheError);
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading city items:', error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error code:', error?.code);
      console.error('❌ Error stack:', error?.stack);
      
      // Check if it's a timeout
      if (error?.message?.includes('timed out')) {
        console.log('⏱️ Request timed out - the city items collection may be too large');
      }
      
      // Check if it's a INTERNAL error or network issue
      if (error.message?.includes('INTERNAL')) {
        console.log('🔄 Internal server error, city items may not be populated yet');
      }
      
      setItems([]);
    } finally {
      console.log('🏁 loadCityItemsData finished');
      setIsLoading(false);
    }
  };

  const renderItem = ({item, index}: {item: CityItemData; index: number}) => {
    const savingsPercent =
      item.maxPrice > 0
        ? Math.round(((item.maxPrice - item.minPrice) / item.maxPrice) * 100)
        : 0;
    const hasSavings = savingsPercent > 5; // Show badge if savings > 5%

    // Get top 2 stores with best prices
    const sortedPrices = [...item.prices].sort((a, b) => a.price - b.price);
    const topStores = sortedPrices
      .slice(0, 2)
      .filter(
        (p, i, arr) => arr.findIndex(x => x.storeName === p.storeName) === i,
      );

    return (
      <SlideIn delay={index * 50}>
        <Pressable
          style={({pressed}) => [
            styles.itemCard,
            pressed && styles.itemCardPressed,
          ]}
          android_ripple={{color: Colors.primaryLight}}>
          {/* Card Header */}
          <View style={styles.itemHeader}>
            <View style={styles.itemIconWrapper}>
              <Icon name="shopping-bag" size="md" color={Colors.text.inverse} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={styles.itemMetaRow}>
                <View style={styles.metaBadge}>
                  <Icon
                    name="shopping-cart"
                    size="xs"
                    color={Colors.text.tertiary}
                  />
                  <Text style={styles.metaText}>{item.prices.length}</Text>
                </View>
                <View style={styles.metaBadge}>
                  <Icon name="map-pin" size="xs" color={Colors.text.tertiary} />
                  <Text style={styles.metaText}>
                    {item.storeCount} magasin{item.storeCount > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </View>
            {hasSavings && (
              <View style={styles.savingsBadge}>
                <Icon
                  name="trending-down"
                  size="xs"
                  color={Colors.text.inverse}
                />
                <Text style={styles.savingsText}>-{savingsPercent}%</Text>
              </View>
            )}
          </View>

          {/* Price Comparison */}
          <View style={styles.priceComparison}>
            <View style={styles.priceColumn}>
              <Text style={styles.priceLabel}>Meilleur prix</Text>
              <Text style={styles.priceBest}>
                {formatCurrency(item.minPrice, item.currency)}
              </Text>
            </View>
            <View style={styles.priceColumnDivider} />
            <View style={styles.priceColumn}>
              <Text style={styles.priceLabel}>Prix moyen</Text>
              <Text style={styles.priceAvg}>
                {formatCurrency(item.avgPrice, item.currency)}
              </Text>
            </View>
            <View style={styles.priceColumnDivider} />
            <View style={styles.priceColumn}>
              <Text style={styles.priceLabel}>Prix max</Text>
              <Text style={styles.priceMax}>
                {formatCurrency(item.maxPrice, item.currency)}
              </Text>
            </View>
          </View>

          {/* Top Stores */}
          {topStores.length > 0 && (
            <View style={styles.storesSection}>
              <View style={styles.storesTitleRow}>
                <Icon name="award" size="xs" color={Colors.primary} />
                <Text style={styles.storesTitle}>Meilleurs prix</Text>
                <View style={styles.storesTitleSpacer} />
                <WatchItemButton
                  itemName={item.name}
                  itemNameNormalized={item.id}
                  city={userProfile?.defaultCity || ''}
                  currentPrice={item.minPrice}
                  currentStore={topStores[0]?.storeName}
                  size="small"
                />
              </View>
              {topStores.map((priceData, idx) => (
                <View
                  key={`${priceData.storeName}-${idx}`}
                  style={styles.storeRow}>
                  <View style={styles.storeRank}>
                    <Text style={styles.storeRankText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName} numberOfLines={1}>
                      {priceData.storeName}
                    </Text>
                    <Text style={styles.storeDate}>
                      {(() => {
                        try {
                          const date = priceData.date;
                          if (!date) {
                            return 'Date inconnue';
                          }

                          // Handle Firestore Timestamp using safeToDate
                          const jsDate = safeToDate(date);
                          return jsDate.toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          });
                        } catch {
                          return 'Date inconnue';
                        }
                      })()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.storePriceBadge,
                      idx === 0 && styles.storePriceBadgeBest,
                    ]}>
                    <Text
                      style={[
                        styles.storePrice,
                        idx === 0 && styles.storePriceBest,
                      ]}>
                      {formatCurrency(priceData.price, priceData.currency)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Pressable>
      </SlideIn>
    );
  };

  if (!userProfile?.defaultCity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Icon name="map-pin" size="3xl" color={Colors.text.secondary} />
          <Text style={styles.centerTitle}>Ville non définie</Text>
          <Text style={styles.centerSubtitle}>
            Définissez votre ville dans les paramètres pour voir les articles de
            votre communauté.
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsButtonText}>Aller aux paramètres</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            Chargement des articles communautaires...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <FadeIn>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.titleRow}>
                <Icon name="users" size="md" color={Colors.primary} />
                <Text style={styles.title}>
                  Articles de {userProfile.defaultCity}
                </Text>
              </View>
              <Text style={styles.subtitle}>
                {items.length} produits communautaires
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowSortMenu(!showSortMenu)}
                activeOpacity={0.7}>
                <Icon name="filter" size="sm" color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={toggleSearch}
                activeOpacity={0.7}>
                <Icon
                  name={isSearchOpen ? 'x' : 'search'}
                  size="sm"
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Sort Menu */}
          {showSortMenu && (
            <View style={styles.sortMenuHeader}>
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'popular' && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy('popular');
                  setShowSortMenu(false);
                }}
              >
                <Icon name="trending-up" size="sm" color={sortBy === 'popular' ? Colors.primary : Colors.text.secondary} />
                <Text style={[styles.sortOptionText, sortBy === 'popular' && styles.sortOptionTextActive]}>
                  Populaire
                </Text>
                {sortBy === 'popular' && <Icon name="check" size="sm" color={Colors.primary} />}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'name' && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy('name');
                  setShowSortMenu(false);
                }}
              >
                <Icon name="type" size="sm" color={sortBy === 'name' ? Colors.primary : Colors.text.secondary} />
                <Text style={[styles.sortOptionText, sortBy === 'name' && styles.sortOptionTextActive]}>
                  Nom
                </Text>
                {sortBy === 'name' && <Icon name="check" size="sm" color={Colors.primary} />}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'price' && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy('price');
                  setShowSortMenu(false);
                }}
              >
                <Icon name="dollar-sign" size="sm" color={sortBy === 'price' ? Colors.primary : Colors.text.secondary} />
                <Text style={[styles.sortOptionText, sortBy === 'price' && styles.sortOptionTextActive]}>
                  Prix
                </Text>
                {sortBy === 'price' && <Icon name="check" size="sm" color={Colors.primary} />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </FadeIn>

      {/* Animated Search Bar */}
      {isSearchOpen && (
        <Animated.View
          style={[
            styles.searchContainer,
            {
              opacity: searchAnimation,
              transform: [
                {
                  translateY: searchAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}>
          <View style={styles.searchWrapper}>
            <Icon name="search" size="sm" color={Colors.text.tertiary} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Rechercher un article..."
              value={searchInput}
              onChangeText={setSearchInput}
              placeholderTextColor={Colors.text.tertiary}
            />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchInput('');
                setSearchQuery('');
              }}>
                <Icon name="x-circle" size="sm" color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Results Badge */}
      {(searchQuery || displayedItems.length > 0) && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsBadge}>
            <Icon name="filter" size="xs" color={Colors.primary} />
            <Text style={styles.resultsText}>
              {filteredAndSortedItems.length} résultat
              {filteredAndSortedItems.length !== 1 ? 's' : ''}
              {displayedItems.length < filteredAndSortedItems.length && ` (${displayedItems.length} affichés)`}
            </Text>
          </View>
          {searchQuery && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setSearchInput('');
                setSearchQuery('');
              }}>
              <Text style={styles.clearText}>Tout afficher</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Items List */}
      <FlatList
        data={displayedItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        // Performance Optimizations
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={100}
        // Infinite Scroll
        onEndReached={loadMoreItems}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingMoreText}>Chargement...</Text>
            </View>
          ) : null
        }
        
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
            title="Actualiser les données..."
            titleColor={Colors.text.secondary}
          />
        }
        ListEmptyComponent={
          isSearching ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Recherche...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrapper}>
                <Icon
                  name={searchQuery ? 'search' : 'users'}
                  size="xl"
                  color={Colors.text.tertiary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? 'Aucun article trouvé'
                  : 'Aucun article communautaire'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Essayez un autre terme de recherche'
                  : "Les articles de votre communauté apparaîtront ici une fois que d'autres utilisateurs auront scanné leurs reçus."}
              </Text>
            </View>
          )
        }
      />

      {/* Subscription Limit Modal */}
      <SubscriptionLimitModal
        visible={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType="priceComparison"
        requiredPlan="Standard"
        currentPlan={subscription?.planId === 'freemium' ? 'Gratuit' : subscription?.planId === 'basic' ? 'Basic' : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  // Header Styles
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    position: 'relative',
    zIndex: 1000,
    ...Shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginLeft: 36, // Align with title after icon
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  sortMenuHeader: {
    position: 'absolute',
    top: 90,
    right: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    minWidth: 180,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.lg,
    zIndex: 9999,
    elevation: 10,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  sortOptionActive: {
    backgroundColor: Colors.card.cream,
  },
  sortOptionText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
  },
  sortOptionTextActive: {
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primary,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search Styles
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
  },

  // Results Badge
  resultsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  resultsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.yellow,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  resultsText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
  },
  clearButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  clearText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.medium,
  },

  // List Styles
  listContainer: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 150,
    flexGrow: 0,
  },

  // Item Card Styles
  itemCard: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  itemCardPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  itemIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card.cosmos,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    lineHeight: Typography.fontSize.base * 1.3,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.card.cosmos,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  savingsText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.inverse,
  },

  // Price Comparison Styles
  priceComparison: {
    flexDirection: 'row',
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  priceColumn: {
    flex: 1,
    alignItems: 'center',
  },
  priceColumnDivider: {
    width: 1,
    backgroundColor: Colors.border.light,
    marginHorizontal: Spacing.xs,
  },
  priceLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  priceBest: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.card.red,
  },
  priceAvg: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.card.cosmos,
  },
  priceMax: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.secondary,
  },

  // Stores Section Styles
  storesSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingTop: Spacing.sm,
  },
  storesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  storesTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  storesTitleSpacer: {
    flex: 1,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  storeRank: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.crimson,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  storeRankText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.inverse,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  storeDate: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
  },
  storePriceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.card.yellow,
    borderRadius: BorderRadius.md,
  },
  storePriceBadgeBest: {
    backgroundColor: Colors.card.red,
  },
  storePrice: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  storePriceBest: {
    color: Colors.text.inverse,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  centerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  centerSubtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  settingsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  settingsButtonText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.semiBold,
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.lg,
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.md * 1.5,
    maxWidth: 280,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  backButtonText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.semiBold,
    textAlign: 'center',
  },
  loadingMore: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  loadingMoreText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginLeft: Spacing.sm,
  },
});
