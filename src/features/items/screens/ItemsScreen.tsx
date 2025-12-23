// Items Screen - Browse and compare item prices across stores
// Redesigned with modern UX and enhanced visual hierarchy
import React, {useState, useEffect, useRef, useCallback} from 'react';
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
  Modal,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import {firebase} from '@react-native-firebase/functions';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn} from '@/shared/components';
import {formatCurrency, safeToDate} from '@/shared/utils/helpers';
import {useAuth, useUser, useSubscription} from '@/shared/contexts';
import {hasFeatureAccess, showUpgradePrompt} from '@/shared/utils/featureAccess';
import {analyticsService} from '@/shared/services/analytics';
import {APP_ID} from '@/shared/services/firebase/config';

// User's personal item data (Tier 2: User Aggregated Items)
// Source: artifacts/{APP_ID}/users/{userId}/items/{itemNameNormalized}
interface ItemData {
  id: string;
  name: string;
  nameNormalized?: string;
  prices: {
    storeName: string;
    price: number;
    currency: 'USD' | 'CDF';
    date: Date | any; // Can be Date or Firestore Timestamp
    receiptId: string;
  }[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  currency: 'USD' | 'CDF'; // Primary currency for display
}

export function ItemsScreen() {
  const {user, isAuthenticated} = useAuth();
  const {profile: userProfile} = useUser();
  const {subscription} = useSubscription();
  const navigation = useNavigation();
  const [items, setItems] = useState<ItemData[]>([]);
  const [filteredItems, setFilteredItems] = useState<ItemData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchAnimation = useRef(new Animated.Value(0)).current;

  // Check feature access
  const hasAccess = hasFeatureAccess('priceComparison', subscription);

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Items', 'ItemsScreen');
    
    // Show upgrade prompt if no access
    if (!hasAccess) {
      showUpgradePrompt('priceComparison', () => {
        // @ts-ignore
        navigation.navigate('Subscription');
      });
    }
  }, [hasAccess]);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 ItemsScreen focused, reloading data');
      loadItemsData();
    }, [user])
  );

  useEffect(() => {
    filterItems();
  }, [items, searchQuery]);

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

  const loadItemsData = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('📦 Loading items for user:', user.uid);
      
      // Fetch user's aggregated items from backend (Tier 2: User Aggregated Items)
      // This collection is automatically maintained by Cloud Functions when receipts are created/updated
      let itemsSnapshot;
      try {
        itemsSnapshot = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('items')
          .orderBy('lastPurchaseDate', 'desc')
          .get();
      } catch (orderError: any) {
        // Fallback without orderBy if index doesn't exist
        console.log('⚠️ OrderBy failed, fetching without ordering:', orderError.code);
        itemsSnapshot = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('items')
          .get();
      }

      console.log('📦 Items found:', itemsSnapshot.size);

      // If no items found, check if user has receipts and trigger rebuild
      if (itemsSnapshot.empty) {
        console.log('📦 No items found, checking for receipts...');
        const receiptsSnapshot = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('receipts')
          .limit(1)
          .get();

        if (!receiptsSnapshot.empty) {
          console.log('📦 Receipts found but no items - triggering rebuild...');
          try {
            const functionsInstance = firebase.app().functions('europe-west1');
            const rebuildCallable = functionsInstance.httpsCallable('rebuildItemsAggregation');
            await rebuildCallable();
            console.log('✅ Items aggregation rebuilt, reloading...');
            
            // Reload items after rebuild
            let reloadedItemsSnapshot;
            try {
              reloadedItemsSnapshot = await firestore()
                .collection('artifacts')
                .doc(APP_ID)
                .collection('users')
                .doc(user.uid)
                .collection('items')
                .orderBy('lastPurchaseDate', 'desc')
                .get();
            } catch (orderError: any) {
              // Fallback without orderBy
              console.log('⚠️ OrderBy failed on reload, fetching without ordering');
              reloadedItemsSnapshot = await firestore()
                .collection('artifacts')
                .doc(APP_ID)
                .collection('users')
                .doc(user.uid)
                .collection('items')
                .get();
            }

            const itemsArray: ItemData[] = reloadedItemsSnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name || doc.id,
                nameNormalized: data.nameNormalized || doc.id,
                prices: (data.prices || []).map((p: any) => ({
                  storeName: p.storeName || 'Inconnu',
                  price: p.price || 0,
                  currency: p.currency || 'USD',
                  date: safeToDate(p.date),
                  receiptId: p.receiptId || '',
                })),
                minPrice: data.minPrice || 0,
                maxPrice: data.maxPrice || 0,
                avgPrice: data.avgPrice || 0,
                storeCount: data.storeCount || 0,
                currency: data.currency || 'USD',
              };
            });

            setItems(itemsArray);
            return;
          } catch (rebuildError) {
            console.error('❌ Error rebuilding items:', rebuildError);
            // Continue with empty items
          }
        } else {
          console.log('📦 No receipts found - user has no data yet');
        }
      }

      const itemsArray: ItemData[] = itemsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || doc.id,
          nameNormalized: data.nameNormalized || doc.id,
          prices: (data.prices || []).map((p: any) => ({
            storeName: p.storeName || 'Inconnu',
            price: p.price || 0,
            currency: p.currency || 'USD',
            date: safeToDate(p.date),
            receiptId: p.receiptId || '',
          })),
          minPrice: data.minPrice || 0,
          maxPrice: data.maxPrice || 0,
          avgPrice: data.avgPrice || 0,
          storeCount: data.storeCount || 0,
          currency: data.currency || 'USD',
        };
      });

      setItems(itemsArray);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Simple, reliable search function
  const simpleSearch = (itemName: string, query: string): boolean => {
    // Normalize both strings: lowercase, remove accents
    const normalize = (str: string) => 
      str.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .trim();
    
    const normalizedItem = normalize(itemName);
    const normalizedQuery = normalize(query);
    
    // 1. Direct contains match
    if (normalizedItem.includes(normalizedQuery)) {
      return true;
    }
    
    // 2. Query contains item (for short item names)
    if (normalizedQuery.includes(normalizedItem) && normalizedItem.length >= 3) {
      return true;
    }
    
    // 3. Word-by-word match (any word matches)
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);
    const itemWords = normalizedItem.split(/\s+/).filter(w => w.length >= 2);
    
    for (const qWord of queryWords) {
      for (const iWord of itemWords) {
        // Word contains match
        if (iWord.includes(qWord) || qWord.includes(iWord)) {
          return true;
        }
        // Start-of-word match (e.g., "tom" matches "tomate")
        if (iWord.startsWith(qWord) || qWord.startsWith(iWord)) {
          return true;
        }
      }
    }
    
    // 4. Fuzzy match - allow 1-2 character differences for words >= 4 chars
    if (normalizedQuery.length >= 4) {
      for (const iWord of itemWords) {
        if (iWord.length >= 4) {
          const distance = levenshteinDistance(normalizedQuery, iWord);
          const maxDistance = Math.floor(Math.max(normalizedQuery.length, iWord.length) * 0.3);
          if (distance <= maxDistance) {
            return true;
          }
        }
      }
    }
    
    return false;
  };
  
  // Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1: string, str2: string): number => {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }
    return dp[m][n];
  };

  const filterItems = () => {
    setIsSearching(true);
    
    // Use setTimeout to allow UI to update with loading state
    setTimeout(() => {
      if (!searchQuery.trim()) {
        setFilteredItems(items);
        setIsSearching(false);
        return;
      }

      // Simple, direct search
      const filtered = items.filter(item => simpleSearch(item.name, searchQuery));
      setFilteredItems(filtered);

      // Log search for analytics
      analyticsService.logCustomEvent('item_search', {
        query: searchQuery,
        results_count: filtered.length,
      });
      
      setIsSearching(false);
    }, 0);
  };

  const renderItem = ({item, index}: {item: ItemData; index: number}) => {
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

                          // Use safeToDate for all timestamp conversions
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des articles...</Text>
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
                <Icon name="shopping-bag" size="md" color={Colors.primary} />
                <Text style={styles.title}>Articles</Text>
              </View>
              <Text style={styles.subtitle}>
                {items.length} produits suivis
              </Text>
            </View>
            <TouchableOpacity
              style={styles.searchButton}
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
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.text.tertiary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x-circle" size="sm" color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Results Badge */}
      {(searchQuery || filteredItems.length > 0) && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsBadge}>
            <Icon name="filter" size="xs" color={Colors.primary} />
            <Text style={styles.resultsText}>
              {filteredItems.length} résultat
              {filteredItems.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {searchQuery && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}>
              <Text style={styles.clearText}>Tout afficher</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Items List */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
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
                  name={searchQuery ? 'search' : 'shopping-bag'}
                  size="xl"
                  color={Colors.text.tertiary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? 'Aucun article trouvé'
                  : 'Aucun article disponible'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Essayez un autre terme de recherche'
                  : 'Scannez des factures pour voir vos articles ici'}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },

  // Header Styles
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
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
    backgroundColor: Colors.card.red,
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

  // Empty State Styles
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
});
