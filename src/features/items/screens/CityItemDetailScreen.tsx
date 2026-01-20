// City Item Detail Screen - Full details of a city item
// Shows all prices, stores, purchase history, and statistics
import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useNavigation, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Colors,
  TextStyles,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn, WatchItemButton, BackButton, AppFooter} from '@/shared/components';
import {formatCurrency, safeToDate, formatDate} from '@/shared/utils/helpers';
import {RootStackParamList} from '@/shared/types';
import {useScroll} from '@/shared/contexts';

type RouteProps = RouteProp<RootStackParamList, 'CityItemDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CityItemDetailData {
  id: string;
  name: string;
  category?: string;
  searchKeywords?: string[];
  prices: {
    storeName: string;
    originalName?: string;
    price: number;
    currency: string;
    date: Date | any;
    userId: string;
    receiptId?: string;
  }[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  currency: string;
  userCount: number;
  totalPurchases: number;
  lastPurchaseDate: Date;
  createdAt?: Date;
  popularityScore?: number;
  priceVolatility?: number;
  priceChangePercent?: number;
}

export const CityItemDetailScreen: React.FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const {scrollY} = useScroll();
  const item = route.params?.item as CityItemDetailData;

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size="xl" color={Colors.status.error} />
          <Text style={styles.errorText}>Item not found</Text>
          <TouchableOpacity
            style={styles.errorBackButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.errorBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Sort prices by date (newest first)
  const sortedPrices = useMemo(() => {
    return [...item.prices].sort((a, b) => {
      const dateA = safeToDate(a.date);
      const dateB = safeToDate(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [item.prices]);

  // Group prices by store
  const pricesByStore = useMemo(() => {
    const grouped = new Map<
      string,
      Array<{
        price: number;
        date: Date;
        currency: string;
        originalName?: string;
      }>
    >();

    sortedPrices.forEach(p => {
      if (!grouped.has(p.storeName)) {
        grouped.set(p.storeName, []);
      }
      grouped.get(p.storeName)!.push({
        price: p.price,
        date: safeToDate(p.date),
        currency: p.currency,
        originalName: p.originalName,
      });
    });

    // Convert to array and sort by best price
    return Array.from(grouped.entries())
      .map(([storeName, prices]) => ({
        storeName,
        prices,
        bestPrice: Math.min(...prices.map(p => p.price)),
        avgPrice: prices.reduce((sum, p) => sum + p.price, 0) / prices.length,
        priceCount: prices.length,
      }))
      .sort((a, b) => a.bestPrice - b.bestPrice);
  }, [sortedPrices]);

  const savingsPercent =
    item.maxPrice > 0
      ? Math.round(((item.maxPrice - item.minPrice) / item.maxPrice) * 100)
      : 0;

  const createdDate = item.createdAt ? safeToDate(item.createdAt) : null;
  const lastPurchase = safeToDate(item.lastPurchaseDate);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {item.name}
          </Text>
        </View>
        <WatchItemButton itemName={item.name} size="medium" />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: false})}
        scrollEventThrottle={16}
      >
        {/* Item Summary Card */}
        <FadeIn>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrapper}>
              <Icon name="shopping-bag" size="xl" color={Colors.text.inverse} />
            </View>

            {/* Item Name */}
            <Text style={styles.summaryItemName} numberOfLines={2}>
              {item.name}
            </Text>

            {/* Category */}
            {item.category && (
              <View style={styles.categoryBadge}>
                <Icon name="tag" size="xs" color={Colors.primary} />
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            )}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Icon name="shopping-cart" size="sm" color={Colors.text.tertiary} />
                <Text style={styles.statValue}>{item.totalPurchases || item.prices.length}</Text>
                <Text style={styles.statLabel}>Achats</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Icon name="map-pin" size="sm" color={Colors.text.tertiary} />
                <Text style={styles.statValue}>{item.storeCount}</Text>
                <Text style={styles.statLabel}>Magasins</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Icon name="users" size="sm" color={Colors.text.tertiary} />
                <Text style={styles.statValue}>{item.userCount}</Text>
                <Text style={styles.statLabel}>Utilisateurs</Text>
              </View>
            </View>

            {/* Dates */}
            <View style={styles.datesContainer}>
              {createdDate && (
                <View style={styles.dateRow}>
                  <Icon name="calendar" size="xs" color={Colors.text.tertiary} />
                  <Text style={styles.dateLabel}>Première fois vu: </Text>
                  <Text style={styles.dateValue}>{formatDate(createdDate)}</Text>
                </View>
              )}
              <View style={styles.dateRow}>
                <Icon name="clock" size="xs" color={Colors.text.tertiary} />
                <Text style={styles.dateLabel}>Dernier achat: </Text>
                <Text style={styles.dateValue}>{formatDate(lastPurchase)}</Text>
              </View>
            </View>
          </View>
        </FadeIn>

        {/* Price Overview */}
        <SlideIn delay={100}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Icon name="trending-up" size="md" color={Colors.primary} />
              <Text style={styles.sectionTitle}>Aperçu des prix</Text>
            </View>

            <View style={styles.priceGrid}>
              <View style={styles.priceBox}>
                <Text style={styles.priceBoxLabel}>Meilleur prix</Text>
                <Text style={[styles.priceBoxValue, styles.priceBest]}>
                  {formatCurrency(item.minPrice, item.currency)}
                </Text>
              </View>
              <View style={styles.priceBox}>
                <Text style={styles.priceBoxLabel}>Prix moyen</Text>
                <Text style={[styles.priceBoxValue, styles.priceAvg]}>
                  {formatCurrency(item.avgPrice, item.currency)}
                </Text>
              </View>
              <View style={styles.priceBox}>
                <Text style={styles.priceBoxLabel}>Prix max</Text>
                <Text style={[styles.priceBoxValue, styles.priceMax]}>
                  {formatCurrency(item.maxPrice, item.currency)}
                </Text>
              </View>
            </View>

            {savingsPercent > 0 && (
              <View style={styles.savingsHighlight}>
                <Icon name="trending-down" size="sm" color={Colors.status.success} />
                <Text style={styles.savingsHighlightText}>
                  Économisez jusqu'à {savingsPercent}% en choisissant le bon magasin!
                </Text>
              </View>
            )}
          </View>
        </SlideIn>

        {/* Prices by Store */}
        <SlideIn delay={200}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Icon name="map-pin" size="md" color={Colors.primary} />
              <Text style={styles.sectionTitle}>
                Prix par magasin ({pricesByStore.length})
              </Text>
            </View>

            {pricesByStore.map((store, index) => (
              <View key={store.storeName} style={styles.storeCard}>
                <View style={styles.storeHeader}>
                  <View style={styles.storeRank}>
                    <Text style={styles.storeRankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName} numberOfLines={1}>
                      {store.storeName}
                    </Text>
                    {(() => {
                      const uniqueOriginalNames = [...new Set(store.prices.map(p => p.originalName).filter(Boolean))].filter(name => name !== item.name);
                      return uniqueOriginalNames.length > 0 ? (
                        <Text style={styles.storeOriginalName} numberOfLines={2}>
                          {uniqueOriginalNames.join(' / ')}
                        </Text>
                      ) : null;
                    })()}
                    <Text style={styles.storeMeta}>
                      {store.priceCount} prix enregistré{store.priceCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.storePriceColumn}>
                    <Text style={styles.storeBestPrice}>
                      {formatCurrency(store.bestPrice, item.currency)}
                    </Text>
                    {store.prices.length > 1 && (
                      <Text style={styles.storeAvgPrice}>
                        Moy: {formatCurrency(store.avgPrice, item.currency)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Recent prices for this store */}
                {store.prices.slice(0, 3).map((price, pIndex) => (
                  <View key={pIndex} style={styles.priceHistoryItem}>
                    <View style={styles.priceHistoryDot} />
                    <View style={styles.priceHistoryLeft}>
                      <Text style={styles.priceHistoryDate}>
                        {createdDate ? formatDate(createdDate) : formatDate(price.date)}
                      </Text>
                      {price.originalName && price.originalName !== item.name && (
                        <Text style={styles.priceHistoryOriginalName}>
                          {price.originalName}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.priceHistoryValue}>
                      {formatCurrency(price.price, price.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </SlideIn>

        {/* All Prices History */}
        <SlideIn delay={300}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Icon name="list" size="md" color={Colors.primary} />
              <Text style={styles.sectionTitle}>
                Historique complet ({sortedPrices.length} prix)
              </Text>
            </View>

            {sortedPrices.map((price, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyDate}>
                    {createdDate ? formatDate(createdDate) : formatDate(safeToDate(price.date))}
                  </Text>
                  <Text style={styles.historyStore} numberOfLines={1}>
                    {price.storeName}
                  </Text>
                </View>
                <Text style={styles.historyPrice}>
                  {formatCurrency(price.price, price.currency)}
                </Text>
              </View>
            ))}
          </View>
        </SlideIn>

        <View style={styles.bottomSpacer} />
        <AppFooter compact />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    ...TextStyles.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
    alignItems: 'center',
  },
  summaryIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  summaryItemName: {
    ...TextStyles.h3,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  categoryText: {
    ...TextStyles.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: Spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border.light,
  },
  statValue: {
    ...TextStyles.h3,
    color: Colors.primary,
    fontWeight: '700',
  },
  statLabel: {
    ...TextStyles.caption,
    color: Colors.text.tertiary,
  },
  datesContainer: {
    width: '100%',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateLabel: {
    ...TextStyles.caption,
    color: Colors.text.tertiary,
  },
  dateValue: {
    ...TextStyles.caption,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...TextStyles.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  priceGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  priceBox: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  priceBoxLabel: {
    ...TextStyles.caption,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
  },
  priceBoxValue: {
    ...TextStyles.body,
    fontWeight: '700',
  },
  priceBest: {
    color: Colors.status.success,
  },
  priceAvg: {
    color: Colors.status.warning,
  },
  priceMax: {
    color: Colors.status.error,
  },
  savingsHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.status.successLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  savingsHighlightText: {
    ...TextStyles.body,
    color: Colors.status.success,
    fontWeight: '600',
    flex: 1,
  },
  storeCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  storeRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeRankText: {
    ...TextStyles.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    ...TextStyles.body,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  storeOriginalName: {
    ...TextStyles.caption,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  storeMeta: {
    ...TextStyles.caption,
    color: Colors.text.tertiary,
  },
  storePriceColumn: {
    alignItems: 'flex-end',
  },
  storeBestPrice: {
    ...TextStyles.body,
    color: Colors.status.success,
    fontWeight: '700',
  },
  storeAvgPrice: {
    ...TextStyles.caption,
    color: Colors.text.tertiary,
  },
  priceHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  priceHistoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  priceHistoryLeft: {
    flex: 1,
  },
  priceHistoryDate: {
    ...TextStyles.caption,
    color: Colors.text.tertiary,
  },
  priceHistoryOriginalName: {
    ...TextStyles.caption,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  priceHistoryValue: {
    ...TextStyles.caption,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  historyLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  historyDate: {
    ...TextStyles.caption,
    color: Colors.text.tertiary,
    marginBottom: 2,
  },
  historyStore: {
    ...TextStyles.body,
    color: Colors.text.secondary,
  },
  historyPrice: {
    ...TextStyles.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: Spacing.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    ...TextStyles.body,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorBackButton: {
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  errorBackButtonText: {
    ...TextStyles.body,
    color: Colors.white,
    fontWeight: '600',
    textAlign: 'center',
  },
});
