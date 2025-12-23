// City Items Screen - Browse items from all users in the same city
// Shows aggregated price data for community price comparison
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
import {Icon, FadeIn, SlideIn} from '@/shared/components';
import {formatCurrency, safeToDate} from '@/shared/utils/helpers';
import {useAuth, useUser} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';
import {RootStackParamList} from '@/shared/types';

// City/Community item data (Tier 3: Community Prices - Anonymous)
// Source: getCityItems Cloud Function → artifacts/{APP_ID}/users/*/items
// Aggregates items from all users in the same city
interface CityItemData {
  id: string;
  name: string;
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
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function CityItemsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {isAuthenticated} = useAuth();
  const {profile: userProfile, isLoading: profileLoading} = useUser();
  const [items, setItems] = useState<CityItemData[]>([]);
  const [filteredItems, setFilteredItems] = useState<CityItemData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'popular'>('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchAnimation = useRef(new Animated.Value(0)).current;

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('City Items', 'CityItemsScreen');
  }, []);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 CityItemsScreen focused, reloading data');
      if (!profileLoading && userProfile?.defaultCity) {
        loadCityItemsData();
      } else if (!profileLoading) {
        setIsLoading(false);
      }
    }, [userProfile?.defaultCity, profileLoading])
  );

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, sortBy]);

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

  const loadCityItemsData = async () => {
    console.log(
      '🔄 loadCityItemsData called, userProfile:',
      userProfile,
      'profileLoading:',
      profileLoading,
    );
    if (profileLoading) {
      console.log('⏳ Profile still loading, skipping');
      return;
    }
    if (!userProfile?.defaultCity) {
      console.log('❌ No defaultCity, skipping');
      setIsLoading(false);
      return;
    }

    console.log('📡 Calling getCityItems for city:', userProfile.defaultCity);
    try {
      const functionsInstance = firebase.app().functions('europe-west1');
      const result = await functionsInstance.httpsCallable('getCityItems')({
        city: userProfile.defaultCity,
      });

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
        } else {
          console.log('ℹ️ No items available for this city yet');
          setItems([]);
        }
      } else {
        console.log('❌ No items returned');
        setItems([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading city items:', error);
      
      // Check if it's a INTERNAL error or network issue
      if (error.message?.includes('INTERNAL')) {
        console.log('🔄 Internal server error, city items may not be populated yet');
      }
      
      setItems([]);
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
    let filtered: CityItemData[];
    
    if (!searchQuery.trim()) {
      filtered = items;
    } else {
      // Simple, direct search
      filtered = items.filter(item => simpleSearch(item.name, searchQuery));
      
      // Log search for analytics
      analyticsService.logCustomEvent('city_items_search', {
        query: searchQuery,
        results_count: filtered.length,
      });
    }
    
    // Apply sorting
    const sorted = [...filtered];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price':
        sorted.sort((a, b) => a.minPrice - b.minPrice);
        break;
      case 'popular':
      default:
        sorted.sort((a, b) => b.prices.length - a.prices.length);
        break;
    }
    
    setFilteredItems(sorted);
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
              <Icon name="users" size="md" color={Colors.text.inverse} />
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
                <View style={styles.metaBadge}>
                  <Icon name="users" size="xs" color={Colors.text.tertiary} />
                  <Text style={styles.metaText}>
                    {item.userCount} utilisateur{item.userCount > 1 ? 's' : ''}
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
    paddingBottom: 100,
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
});
