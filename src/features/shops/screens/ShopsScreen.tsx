// Shops Screen - List of all shops user has visited
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import {HomeStackParamList} from '@/features/home/navigation/HomeStackNavigator';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, EmptyState, AppFooter, BackButton, FadeIn} from '@/shared/components';
import {formatCurrency, safeToDate} from '@/shared/utils/helpers';
import {useAuth} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';
import {networkAwareCache, CacheTTL, CachePriority} from '@/shared/services/caching';
import {APP_ID} from '@/shared/services/firebase/config';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, 'Shops'>;

interface Shop {
  id: string;
  name: string;
  nameNormalized: string;
  address?: string;
  phone?: string;
  receiptCount: number;
  totalSpent: number;
  currency: 'USD' | 'CDF';
  lastVisit: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CARD_COLORS: Array<'red' | 'crimson' | 'blue' | 'cosmos' | 'cream'> = [
  'crimson',
  'cosmos',
  'blue',
  'red',
  'cream',
];

export function ShopsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    analyticsService.logScreenView('Shops', 'ShopsScreen');
  }, []);

  useEffect(() => {
    loadShops();
  }, [user]);

  const loadShops = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    const userId = user.uid;
    const cacheKey = `shops-${userId}`;

    try {
      setIsLoading(true);

      // Fetch shops with network-aware caching
      const result = await networkAwareCache.fetchWithCache({
        cacheKey,
        namespace: 'shops',
        ttl: CacheTTL.THIRTY_MINUTES,
        priority: CachePriority.NORMAL,
        fetchFn: async () => {
          const shopsSnapshot = await firestore()
            .collection('artifacts')
            .doc(APP_ID)
            .collection('users')
            .doc(userId)
            .collection('shops')
            .get();

          const shopsData: Shop[] = shopsSnapshot.docs
            .filter(doc => doc.exists && doc.data())
            .map(doc => {
              const data = doc.data()!;
              return {
                id: doc.id,
                name: data.name || 'Magasin inconnu',
                nameNormalized: data.nameNormalized || '',
                address: data.address,
                phone: data.phone,
                receiptCount: data.receiptCount || 0,
                totalSpent: data.totalSpent || 0,
                currency: data.currency || 'USD',
                lastVisit: safeToDate(data.lastVisit),
                createdAt: safeToDate(data.createdAt),
                updatedAt: safeToDate(data.updatedAt),
              };
            });

          // Sort by totalSpent descending
          shopsData.sort((a, b) => b.totalSpent - a.totalSpent);

          return shopsData;
        },
        onStaleData: (shopsData) => {
          console.log('📦 Using cached shops (stale)');
          setShops(shopsData);
        },
      });

      if (result.data) {
        setShops(result.data);
      } else {
        setShops([]);
      }
    } catch (error) {
      console.error('Error loading shops:', error);
      setShops([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShopPress = (shop: Shop) => {
    analyticsService.logCustomEvent('shop_viewed', {shop_id: shop.id});
    navigation.push('ShopDetail', {shopId: shop.id, shopName: shop.name});
  };

  const getCardColor = (index: number) => {
    return CARD_COLORS[index % CARD_COLORS.length];
  };

  const renderShopItem = ({item, index}: {item: Shop; index: number}) => {
    const cardColor = getCardColor(index);
    const bgColor = Colors.card[cardColor];
    const isDarkBg = ['red', 'crimson', 'cosmos'].includes(cardColor);
    const textColor = isDarkBg ? Colors.text.inverse : Colors.text.primary;
    const subtextColor = isDarkBg
      ? 'rgba(255, 255, 255, 0.8)'
      : Colors.text.secondary;

    return (
      <TouchableOpacity
        style={[styles.shopCard, {backgroundColor: bgColor}]}
        onPress={() => handleShopPress(item)}
        activeOpacity={0.7}>
        <View style={styles.shopHeader}>
          <View
            style={[
              styles.shopIconWrapper,
              {
                backgroundColor: isDarkBg
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.05)',
              },
            ]}>
            <Icon name="shopping-bag" size="md" color={textColor} />
          </View>
          <View style={styles.shopInfo}>
            <Text style={[styles.shopName, {color: textColor}]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.address && (
              <Text
                style={[styles.shopAddress, {color: subtextColor}]}
                numberOfLines={1}>
                {item.address}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.shopStats}>
          <View style={styles.statItem}>
            <Icon
              name="receipt"
              size="xs"
              color={isDarkBg ? 'rgba(255, 255, 255, 0.7)' : Colors.text.tertiary}
            />
            <Text style={[styles.statText, {color: subtextColor}]}>
              {item.receiptCount} facture{item.receiptCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statText, {color: subtextColor}]}>
              {item.currency === 'CDF' 
                ? `${Math.round(item.totalSpent).toLocaleString('fr-CD')} FC`
                : item.totalSpent.toFixed(2)
              }
            </Text>
          </View>
        </View>

        <View style={styles.shopFooter}>
          <Icon
            name="chevron-right"
            size="sm"
            color={isDarkBg ? 'rgba(255, 255, 255, 0.6)' : Colors.text.tertiary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Modern Header */}
        <FadeIn duration={400}>
          <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
            <BackButton />
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Mes Magasins</Text>
            </View>
            
            <View style={styles.headerRight} />
          </View>
        </FadeIn>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des magasins...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <FadeIn duration={400}>
        <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
          <BackButton />
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Mes Magasins</Text>
            <Text style={styles.headerSubtitle}>
              {shops.length} magasin{shops.length !== 1 ? 's' : ''}
            </Text>
          </View>
          
          <View style={styles.headerRight} />
        </View>
      </FadeIn>

      {/* Shops List */}
      <FlatList
        data={shops}
        renderItem={renderShopItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="shopping-bag"
            title="Aucun magasin"
            description="Scannez des factures pour voir vos magasins ici"
          />
        }
        ListFooterComponent={<AppFooter compact />}
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

  // Modern Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background.primary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  headerRight: {
    width: 44,
  },

  // List
  listContainer: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // Shop Card
  shopCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  shopIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  shopAddress: {
    fontSize: Typography.fontSize.sm,
  },
  shopStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    fontSize: Typography.fontSize.sm,
  },
  shopFooter: {
    alignItems: 'flex-end',
  },
});
