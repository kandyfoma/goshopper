// Items Screen - Browse and compare item prices across stores
// Redesigned with modern UX and enhanced visual hierarchy
import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Animated,
  Pressable,
  Modal,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {BlurView} from '@react-native-community/blur';
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
import {Icon, FadeIn, SlideIn, AppLoader} from '@/shared/components';
import {ModernTabBar, TabBarIcon} from '@/shared/components/ModernTabBar';
import {formatCurrency, safeToDate} from '@/shared/utils/helpers';
import {useAuth, useUser, useScroll} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';
import {cacheManager, CacheTTL} from '@/shared/services/caching';
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

// Client-side fallback keyword mapping for multi-language search
const FALLBACK_KEYWORDS: Record<string, string[]> = {
  'sucre': ['sugar', 'sucre'], 'sugar': ['sugar', 'sucre'],
  'sel': ['salt', 'sel'], 'salt': ['salt', 'sel'],
  'riz': ['rice', 'riz', 'wali'], 'rice': ['rice', 'riz', 'wali'],
  'pain': ['bread', 'pain', 'mkate'], 'bread': ['bread', 'pain', 'mkate'],
  'huile': ['oil', 'huile', 'mafuta'], 'oil': ['oil', 'huile', 'mafuta'],
  'farine': ['flour', 'farine', 'unga'], 'flour': ['flour', 'farine', 'unga'],
  'eau': ['water', 'eau', 'maji'], 'water': ['water', 'eau', 'maji'],
  'biere': ['beer', 'biere', 'bia'], 'beer': ['beer', 'biere', 'bia'],
  'vin': ['wine', 'vin', 'divai'], 'wine': ['wine', 'vin', 'divai'],
  'jus': ['juice', 'jus'], 'juice': ['juice', 'jus'],
  'savon': ['soap', 'savon', 'sabuni'], 'soap': ['soap', 'savon', 'sabuni'],
  'dentifrice': ['toothpaste', 'dentifrice'], 'toothpaste': ['toothpaste', 'dentifrice'],
  'lait': ['milk', 'lait', 'maziwa'], 'milk': ['milk', 'lait', 'maziwa'],
  'cafe': ['coffee', 'cafe', 'kahawa'], 'coffee': ['coffee', 'cafe', 'kahawa'],
  'the': ['tea', 'the', 'chai'], 'tea': ['tea', 'the', 'chai'],
};

const matchesFallbackKeywords = (itemName: string, query: string): boolean => {
  const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const normalizeItem = normalize(itemName);
  const normalizeQuery = normalize(query);
  const queryKeywords = FALLBACK_KEYWORDS[normalizeQuery] || [];
  return queryKeywords.some(kw => normalize(kw) !== normalizeQuery && normalizeItem.includes(normalize(kw)));
};

export function ItemsScreen() {
  const {user, isAuthenticated} = useAuth();
  const {profile: userProfile} = useUser();
  const {scrollY} = useScroll();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // State
  const [items, setItems] = useState<ItemData[]>([]);
  const [filteredItems, setFilteredItems] = useState<ItemData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'popular'>('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<'ALL' | 'USD' | 'CDF'>('ALL');
  
  // Refs
  const searchAnimation = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const filterFadeAnim = useRef(new Animated.Value(0)).current;
  const filterSlideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Items', 'ItemsScreen');
    
    // Cleanup listener on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Filter modal animations
  useEffect(() => {
    if (showFilterModal) {
      Animated.parallel([
        Animated.timing(filterFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.spring(filterSlideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(filterFadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(filterSlideAnim, {
          toValue: 300,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [showFilterModal]);

  // Setup real-time listener when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadItemsData();
      
      // Cleanup listener when screen loses focus
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    }, [user])
  );

  // Memoize filtered and sorted items for performance
  const filteredAndSortedItems = useMemo(() => {
    let result = items;
    
    // Apply search filter
    if (searchQuery) {
      result = result.filter(item => simpleSearch(item.name, searchQuery));
    }
    
    // Apply client-side filters
    if (selectedStores.length > 0) {
      result = result.filter(item =>
        item.prices.some(price => selectedStores.includes(price.storeName))
      );
    }
    
    if (selectedCurrency !== 'ALL') {
      result = result.filter(item => item.currency === selectedCurrency);
    }
    
    // Apply sorting
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
  }, [items, searchQuery, sortBy, selectedStores, selectedCurrency]);

  useEffect(() => {
    setFilteredItems(filteredAndSortedItems);
  }, [filteredAndSortedItems]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleSearch = () => {
    if (isSearchOpen) {
      // Closing search
      setSearchInput('');
      setSearchQuery('');
      Animated.timing(searchAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => setIsSearchOpen(false));
    } else {
      // Opening search - close other menus
      setShowSortMenu(false);
      setShowFilterModal(false);
      setIsSearchOpen(true);
      Animated.timing(searchAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => searchInputRef.current?.focus());
    }
  };

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Clear cache and reload
    if (user?.uid) {
      const cacheKey = `user-items-${user.uid}`;
      await cacheManager.remove(cacheKey, 'receipts');
    }
    await loadItemsData(true);
    setIsRefreshing(false);
  }, [user?.uid]);

  const loadItemsData = async (forceRefresh: boolean = false) => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    const cacheKey = `user-items-${user.uid}`;

    try {
      // Try loading from cache first for instant display (skip if force refresh)
      if (!forceRefresh) {
        const cachedItems = await cacheManager.get<ItemData[]>(cacheKey, 'receipts');
        if (cachedItems && cachedItems.length > 0) {
          setItems(cachedItems);
          setIsLoading(false);
          // Continue to setup real-time listener below
        }
      }
      
      // Setup real-time listener for automatic updates
      const itemsRef = firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(user.uid)
        .collection('items');
      
      // Unsubscribe from previous listener if exists
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      // Setup listener (try with orderBy, fallback without)
      let unsubscribe: (() => void) | null = null;
      try {
        unsubscribe = itemsRef
          .orderBy('lastPurchaseDate', 'desc')
          .onSnapshot(
            async (snapshot) => {
              const itemsArray: ItemData[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  name: data.name || doc.id,
                  nameNormalized: data.nameNormalized || doc.id,
                  prices: (data.prices || []).map((p: any) => ({
                    storeName: p.storeName || 'Inconnu',
                    price: p.price || 0,
                    currency: p.currency || 'CDF',
                    date: safeToDate(p.date),
                    receiptId: p.receiptId || '',
                  })),
                  minPrice: data.minPrice || 0,
                  maxPrice: data.maxPrice || 0,
                  avgPrice: data.avgPrice || 0,
                  storeCount: data.storeCount || 0,
                  currency: data.currency || 'CDF',
                };
              });

              setItems(itemsArray);
              setIsLoading(false);
              
              // Update cache
              if (itemsArray.length > 0) {
                await cacheManager.set(cacheKey, itemsArray, {
                  namespace: 'receipts',
                  ttl: CacheTTL.HOUR * 6, // Cache for 6 hours
                });
              } else {
                // Clear cache if no items
                await cacheManager.remove(cacheKey, 'receipts');
              }
            },
            (error) => {
              setIsLoading(false);
            }
          );
      } catch (orderError: any) {
        // Fallback without orderBy if index doesn't exist
        unsubscribe = itemsRef.onSnapshot(
          async (snapshot) => {
            const itemsArray: ItemData[] = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name || doc.id,
                nameNormalized: data.nameNormalized || doc.id,
                prices: (data.prices || []).map((p: any) => ({
                  storeName: p.storeName || 'Inconnu',
                  price: p.price || 0,
                  currency: p.currency || 'CDF',
                  date: safeToDate(p.date),
                  receiptId: p.receiptId || '',
                })),
                minPrice: data.minPrice || 0,
                maxPrice: data.maxPrice || 0,
                avgPrice: data.avgPrice || 0,
                storeCount: data.storeCount || 0,
                currency: data.currency || 'CDF',
              };
            });

            setItems(itemsArray);
            setIsLoading(false);
            
            // Update cache
            if (itemsArray.length > 0) {
              await cacheManager.set(cacheKey, itemsArray, {
                namespace: 'receipts',
                ttl: CacheTTL.HOUR * 6,
              });
            } else {
              await cacheManager.remove(cacheKey, 'receipts');
            }
          },
          (error) => {
            setIsLoading(false);
          }
        );
      }
      
      if (unsubscribe) {
        unsubscribeRef.current = unsubscribe;
      }
      
    } catch (error) {
      console.error('Error loading items:', error);
      setIsLoading(false);
    }
  };

  // Simple, reliable search function with bilingual support
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
    
    // 2. Fallback keyword matching for multi-language support
    if (matchesFallbackKeywords(itemName, query)) {
      return true;
    }
    
    // 3. Query contains item (for short item names)
    if (normalizedQuery.includes(normalizedItem) && normalizedItem.length >= 3) {
      return true;
    }
    
    // 4. Word-by-word match (any word matches)
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
    
    // 5. Fuzzy match - allow 1-2 character differences for words >= 4 chars
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

  // Get unique stores from all items
  const uniqueStores = useMemo(() => {
    const storesSet = new Set<string>();
    items.forEach(item => {
      item.prices.forEach(price => {
        storesSet.add(price.storeName);
      });
    });
    return Array.from(storesSet).sort();
  }, [items]);

  // Check if any filters are active
  const hasActiveFilters = selectedStores.length > 0 || selectedCurrency !== 'ALL';

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedStores([]);
    setSelectedCurrency('ALL');
  };

  const filterItems = () => {
    setIsSearching(true);
    
    // Use setTimeout to allow UI to update with loading state
    setTimeout(async () => {
      if (!searchQuery.trim() || !items) {
        setFilteredItems(items || []);
        setIsSearching(false);
        return;
      }

      // Simple, direct search with async translation support
      const filtered = [];
      for (const item of items) {
        if (await simpleSearch(item.name, searchQuery)) {
          filtered.push(item);
        }
      }
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
        <AppLoader fullscreen size="large" message="Chargement des articles..." />
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
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.iconButton, hasActiveFilters && styles.iconButtonActive]}
                onPress={() => {
                  if (isSearchOpen) {
                    toggleSearch();
                  }
                  setShowSortMenu(false);
                  setShowFilterModal(true);
                }}
                activeOpacity={0.7}>
                <Icon name="filter" size="sm" color={hasActiveFilters ? Colors.white : Colors.primary} />
                {hasActiveFilters && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>
                      {selectedStores.length + (selectedCurrency !== 'ALL' ? 1 : 0)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  if (isSearchOpen) {
                    toggleSearch();
                  }
                  setShowFilterModal(false);
                  setShowSortMenu(!showSortMenu);
                }}
                activeOpacity={0.7}>
                <Icon name="sliders" size="sm" color={Colors.primary} />
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
            <View style={styles.searchRightContainer}>
              {isSearching ? (
                <AppLoader size="small" />
              ) : searchInput.length > 0 ? (
                <TouchableOpacity 
                  onPress={() => {
                    setSearchInput('');
                    setSearchQuery('');
                  }}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                  <Icon name="x-circle" size="sm" color={Colors.text.tertiary} />
                </TouchableOpacity>
              ) : null}
            </View>
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
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContainer, {paddingBottom: 100}]}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: false}
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          isSearching ? (
            <AppLoader message="Recherche en cours..." />
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

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.filterOverlay}>
          {Platform.OS === 'ios' ? (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: filterFadeAnim }]}>
              <BlurView
                style={StyleSheet.absoluteFill}
                blurType="light"
                blurAmount={25}
              />
            </Animated.View>
          ) : (
            <Animated.View style={[styles.androidOverlay, { opacity: filterFadeAnim }]} />
          )}
          <View style={styles.filterOverlayContent}>
            <TouchableOpacity
              style={styles.filterOverlayTouchable}
              activeOpacity={1}
              onPress={() => setShowFilterModal(false)}
            />
            <Animated.View
              style={[
                styles.filterModalContent,
                {
                  paddingBottom: insets.bottom,
                  transform: [{ translateY: filterSlideAnim }],
                }
              ]}
            >
              <View style={styles.filterModalHeader}>
                <View style={styles.modalHandle} />
                <Text style={styles.filterModalTitle}>Filtres</Text>
                <TouchableOpacity 
                  onPress={() => setShowFilterModal(false)}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  style={styles.closeButton}
                >
                  <Icon name="x" size="md" color={Colors.white} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.filterModalBody} showsVerticalScrollIndicator={false}>
                {/* Store Filter */}
                {uniqueStores.length > 0 && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Magasins ({uniqueStores.length})</Text>
                    <View style={styles.chipContainer}>
                      {uniqueStores.map(store => {
                        const isSelected = selectedStores.includes(store);
                        return (
                          <TouchableOpacity
                            key={store}
                            style={[styles.chip, isSelected && styles.chipSelected]}
                            onPress={() => {
                              if (isSelected) {
                                setSelectedStores(selectedStores.filter(s => s !== store));
                              } else {
                                setSelectedStores([...selectedStores, store]);
                              }
                            }}
                          >
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                              {store}
                            </Text>
                            {isSelected && (
                              <Icon name="check" size="xs" color={Colors.white} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Currency Filter */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Devise</Text>
                  <View style={styles.chipContainer}>
                    {(['ALL', 'CDF', 'USD'] as const).map(currency => {
                      const isSelected = selectedCurrency === currency;
                      const label = currency === 'ALL' ? 'Toutes' : currency;
                      return (
                        <TouchableOpacity
                          key={currency}
                          style={[styles.chip, isSelected && styles.chipSelected]}
                          onPress={() => setSelectedCurrency(currency)}
                        >
                          <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                            {label}
                          </Text>
                          {isSelected && (
                            <Icon name="check" size="xs" color={Colors.white} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* Modal Footer */}
              <View style={styles.filterModalFooter}>
                <TouchableOpacity
                  style={styles.clearFilterButton}
                  onPress={() => {
                    clearAllFilters();
                  }}
                >
                  <Text style={styles.clearFilterButtonText}>Réinitialiser</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyFilterButton}
                  onPress={() => setShowFilterModal(false)}
                >
                  <Text style={styles.applyFilterButtonText}>
                    Appliquer ({filteredItems.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </View>
      </Modal>

      {/* Main Footer Tabs */}
      <ModernTabBar
        state={{
          index: 1, // Items tab is at index 1
          routes: [
            {key: 'Home', name: 'Home'},
            {key: 'Items', name: 'Items'},
            {key: 'Scanner', name: 'Scanner'},
            {key: 'Stats', name: 'Stats'},
            {key: 'Profile', name: 'Profile'},
          ],
        }}
        descriptors={{
          Home: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="home" label="Accueil" />}},
          Items: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="shopping-bag" label="Articles" />}},
          Scanner: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="camera" label="Scanner" />}},
          Stats: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="bar-chart-2" label="Stats" />}},
          Profile: {options: {tabBarIcon: ({focused}: any) => <TabBarIcon focused={focused} icon="user" label="Profil" />}},
        }}
        navigation={navigation}
        badges={{}}
        scrollY={scrollY}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  searchingText: {
    marginLeft: Spacing.sm,
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },

  // Header Styles
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    position: 'relative',
    zIndex: 10000,
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
  iconButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.status.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  sortMenuHeader: {
    marginTop: Spacing.xs,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    ...Shadows.md,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  sortOptionActive: {
    backgroundColor: Colors.background.secondary,
  },
  sortOptionText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium,
  },
  sortOptionTextActive: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semiBold,
  },
  searchRightContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOverlay: {
    flex: 1,
  },
  androidOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  filterOverlayContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterOverlayTouchable: {
    flex: 1,
  },
  filterModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.accentLight,
    borderRadius: 2,
    position: 'absolute',
    top: Spacing.xs,
    left: '50%',
    marginLeft: -20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  filterModalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
    flex: 1,
    textAlign: 'center',
    marginLeft: -32,
  },
  filterModalBody: {
    paddingHorizontal: Spacing.lg,
    maxHeight: '70%',
  },
  filterSection: {
    marginTop: Spacing.lg,
  },
  filterSectionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primaryDark,
    marginBottom: Spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  chipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accentDark,
  },
  chipText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium,
  },
  chipTextSelected: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semiBold,
  },
  filterModalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.medium,
    backgroundColor: Colors.background.secondary,
  },
  clearFilterButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.accentLight,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  clearFilterButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.accent,
  },
  applyFilterButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    ...Shadows.sm,
  },
  applyFilterButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
});
