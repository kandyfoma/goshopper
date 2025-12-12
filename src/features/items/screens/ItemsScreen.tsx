// Items Screen - Browse and compare item prices across stores
// Redesigned with modern UX and enhanced visual hierarchy
import React, {useState, useEffect, useRef} from 'react';
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
import firestore from '@react-native-firebase/firestore';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn} from '@/shared/components';
import {formatCurrency} from '@/shared/utils/helpers';
import {useAuth, useUser} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';

interface ItemData {
  id: string;
  name: string;
  prices: {
    storeName: string;
    price: number;
    currency: 'USD' | 'CDF';
    date: Date;
    receiptId: string;
  }[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  currency: 'USD' | 'CDF'; // Primary currency for display
}

export function ItemsScreen() {
  const {user} = useAuth();
  const {profile: userProfile} = useUser();
  const [items, setItems] = useState<ItemData[]>([]);
  const [filteredItems, setFilteredItems] = useState<ItemData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Items', 'ItemsScreen');
  }, []);

  useEffect(() => {
    loadItemsData();
  }, [user]);

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
      // Get all receipts for the user (not filtered by city since receipts may not have city field)
      const receiptsSnapshot = await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .collection('receipts')
        .orderBy('scannedAt', 'desc')
        .get();

      const itemsMap = new Map<string, ItemData>();

      receiptsSnapshot.docs.forEach(doc => {
        const receiptData = doc.data();
        const items = receiptData.items || [];

        items.forEach((item: any) => {
          const itemName = item.name?.toLowerCase().trim();
          if (!itemName) {
            return;
          }

          const price = item.unitPrice || 0;
          if (price <= 0) {
            return;
          }

          if (!itemsMap.has(itemName)) {
            itemsMap.set(itemName, {
              id: itemName,
              name: item.name,
              prices: [],
              minPrice: price,
              maxPrice: price,
              avgPrice: price,
              storeCount: 1,
              currency: receiptData.currency || 'USD',
            });
          }

          const itemData = itemsMap.get(itemName)!;
          itemData.prices.push({
            storeName: receiptData.storeName || 'Inconnu',
            price: price,
            currency: receiptData.currency || 'USD',
            date: receiptData.scannedAt?.toDate() || new Date(),
            receiptId: doc.id,
          });

          // Update statistics
          itemData.minPrice = Math.min(itemData.minPrice, price);
          itemData.maxPrice = Math.max(itemData.maxPrice, price);
          itemData.avgPrice =
            itemData.prices.reduce((sum, p) => sum + p.price, 0) /
            itemData.prices.length;
          itemData.storeCount = new Set(
            itemData.prices.map(p => p.storeName),
          ).size;

          // Determine primary currency (most common)
          const currencyCounts = itemData.prices.reduce((acc, p) => {
            acc[p.currency] = (acc[p.currency] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          itemData.currency = Object.entries(currencyCounts).sort(
            ([, a], [, b]) => b - a,
          )[0][0] as 'USD' | 'CDF';
        });
      });

      const itemsArray = Array.from(itemsMap.values()).sort(
        (a, b) => b.prices.length - a.prices.length,
      ); // Sort by frequency

      setItems(itemsArray);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterItems = () => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(query),
    );
    setFilteredItems(filtered);

    // Track item search
    analyticsService.logCustomEvent('item_search', {
      query: query,
      results_count: filtered.length,
    });
  };

  const renderItem = ({item, index}: {item: ItemData; index: number}) => {
    const savingsPercent =
      item.maxPrice > 0
        ? Math.round(((item.maxPrice - item.minPrice) / item.maxPrice) * 100)
        : 0;
    const hasSavings = savingsPercent > 5; // Show badge if savings > 5%

    // Get top 3 stores with best prices
    const sortedPrices = [...item.prices].sort((a, b) => a.price - b.price);
    const topStores = sortedPrices
      .slice(0, 3)
      .filter((p, i, arr) => arr.findIndex(x => x.storeName === p.storeName) === i);

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
              <Icon name="shopping-bag" size="md" color={Colors.primary} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={styles.itemMetaRow}>
                <View style={styles.metaBadge}>
                  <Icon name="shopping-cart" size="xs" color={Colors.text.tertiary} />
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
                <Icon name="trending-down" size="xs" color={Colors.status.success} />
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
                <View key={`${priceData.storeName}-${idx}`} style={styles.storeRow}>
                  <View style={styles.storeRank}>
                    <Text style={styles.storeRankText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName} numberOfLines={1}>
                      {priceData.storeName}
                    </Text>
                    <Text style={styles.storeDate}>
                      {priceData.date.toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
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
              {filteredItems.length} résultat{filteredItems.length !== 1 ? 's' : ''}
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
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
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
    backgroundColor: Colors.card.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  itemCardPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  itemIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    lineHeight: Typography.fontSize.lg * 1.3,
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
    backgroundColor: Colors.card.green,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  savingsText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },

  // Price Comparison Styles
  priceComparison: {
    flexDirection: 'row',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
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
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.status.success,
  },
  priceAvg: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  priceMax: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.secondary,
  },

  // Stores Section Styles
  storesSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingTop: Spacing.md,
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
  },
  storeRank: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  storeRankText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
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
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
  },
  storePriceBadgeBest: {
    backgroundColor: Colors.card.green,
  },
  storePrice: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  storePriceBest: {
    color: Colors.text.primary,
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
