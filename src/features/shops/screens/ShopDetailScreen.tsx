// Shop Detail Screen - List of all receipts from a specific shop
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
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import {Receipt, RootStackParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, EmptyState} from '@/shared/components';
import {formatCurrency, formatDate} from '@/shared/utils/helpers';
import {useAuth} from '@/shared/contexts';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ShopDetailRouteProp = RouteProp<RootStackParamList, 'ShopDetail'>;

export function ShopDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ShopDetailRouteProp>();
  const {shopId, shopName} = route.params;
  const {user} = useAuth();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    loadShopReceipts();
  }, [user, shopId]);

  const loadShopReceipts = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const receiptsSnapshot = await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .collection('receipts')
        .where('storeNameNormalized', '==', shopId)
        .orderBy('scannedAt', 'desc')
        .get();

      const receiptsData: Receipt[] = receiptsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          storeName: data.storeName || 'Magasin inconnu',
          storeNameNormalized: data.storeNameNormalized || '',
          storeAddress: data.storeAddress,
          storePhone: data.storePhone,
          receiptNumber: data.receiptNumber,
          date: data.scannedAt?.toDate() || new Date(),
          currency: data.currency || 'USD',
          items: (data.items || []).map((item: any) => ({
            id: item.id || Math.random().toString(36).substring(7),
            name: item.name || 'Article inconnu',
            nameNormalized: item.nameNormalized || '',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
            totalPrice: item.totalPrice || 0,
            unit: item.unit,
            category: item.category || 'Autres',
            confidence: item.confidence || 0.85,
          })),
          subtotal: data.subtotal,
          tax: data.tax,
          total: data.total || 0,
          totalUSD: data.totalUSD,
          totalCDF: data.totalCDF,
          processingStatus: data.processingStatus || 'completed',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          scannedAt: data.scannedAt?.toDate() || new Date(),
        };
      });

      setReceipts(receiptsData);

      // Calculate total spent
      const total = receiptsData.reduce((sum, receipt) => {
        return sum + (receipt.totalUSD || receipt.total || 0);
      }, 0);
      setTotalSpent(total);
    } catch (error) {
      console.error('Error loading shop receipts:', error);
      setReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceiptPress = (receiptId: string, receipt: Receipt) => {
    navigation.push('ReceiptDetail', {receiptId});
  };

  const renderReceiptItem = ({item}: {item: Receipt}) => {
    return (
      <TouchableOpacity
        style={styles.receiptCard}
        onPress={() => handleReceiptPress(item.id, item)}
        activeOpacity={0.7}>
        <View style={styles.receiptIcon}>
          <Icon name="receipt" size="md" color={Colors.card.crimson} />
        </View>

        <View style={styles.receiptInfo}>
          <View style={styles.dateRow}>
            <Icon name="calendar" size="xs" color={Colors.text.tertiary} />
            <Text style={styles.receiptDate}>{formatDate(item.date)}</Text>
          </View>
          <Text style={styles.itemCount}>
            {item.items?.length || 0} article{(item.items?.length || 0) !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.receiptRight}>
          <Text style={styles.totalAmount}>
            {item.totalUSD !== undefined && item.totalCDF !== undefined
              ? formatCurrency(item.totalUSD)
              : formatCurrency(item.total || 0, item.currency)}
          </Text>
          {item.totalUSD !== undefined && item.totalCDF !== undefined && (
            <Text style={styles.totalAmountSecondary}>
              {formatCurrency(item.totalCDF, 'CDF')}
            </Text>
          )}
        </View>

        <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
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
          <Text style={styles.title} numberOfLines={1}>
            {shopName}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
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
        <Text style={styles.title} numberOfLines={1}>
          {shopName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Stats Summary */}
      {receipts.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{receipts.length}</Text>
            <Text style={styles.statLabel}>
              Facture{receipts.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {formatCurrency(totalSpent, 'USD')}
            </Text>
            <Text style={styles.statLabel}>Total Dépensé</Text>
          </View>
        </View>
      )}

      {/* Receipts List */}
      <FlatList
        data={receipts}
        renderItem={renderReceiptItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="receipt"
            title="Aucune facture"
            description="Aucune facture trouvée pour ce magasin"
          />
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
    paddingHorizontal: Spacing.sm,
  },
  headerSpacer: {
    width: 44,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statValue: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.card.crimson,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },

  // List
  listContainer: {
    padding: Spacing.lg,
    paddingTop: 0,
  },

  // Receipt Card
  receiptCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    ...Shadows.sm,
  },
  receiptIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.base,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  receiptInfo: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  receiptDate: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
  },
  itemCount: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
  },
  receiptRight: {
    alignItems: 'flex-end',
    marginRight: Spacing.sm,
  },
  totalAmount: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  totalAmountSecondary: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
});
