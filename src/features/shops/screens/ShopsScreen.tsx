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
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import {RootStackParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, EmptyState, AppFooter} from '@/shared/components';
import {formatCurrency} from '@/shared/utils/helpers';
import {useAuth} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

    try {
      setIsLoading(true);

      const shopsSnapshot = await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .collection('shops')
        .orderBy('totalSpent', 'desc')
        .get();

      const shopsData: Shop[] = shopsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Magasin inconnu',
          nameNormalized: data.nameNormalized || '',
          address: data.address,
          phone: data.phone,
          receiptCount: data.receiptCount || 0,
          totalSpent: data.totalSpent || 0,
          currency: data.currency || 'USD',
          lastVisit: data.lastVisit?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });

      setShops(shopsData);
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
            <Icon
              name="dollar-sign"
              size="xs"
              color={isDarkBg ? 'rgba(255, 255, 255, 0.7)' : Colors.text.tertiary}
            />
            <Text style={[styles.statText, {color: subtextColor}]}>
              {formatCurrency(item.totalSpent, item.currency)}
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size="md" color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Mes Magasins</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des magasins...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size="md" color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Mes Magasins</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Shop Count */}
      {shops.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {shops.length} magasin{shops.length !== 1 ? 's' : ''} visité
            {shops.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },

  // Count
  countContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  countText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
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
