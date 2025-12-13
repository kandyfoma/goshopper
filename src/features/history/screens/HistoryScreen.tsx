// History Screen - List of past receipts
// Styled with GoShopperAI Design System (Blue + Gold)
import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
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
import {Icon, FadeIn, SlideIn, EmptyState, SwipeToDelete} from '@/shared/components';
import {formatCurrency, formatDate} from '@/shared/utils/helpers';
import {useAuth} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';
import {spotlightSearchService, offlineService} from '@/shared/services';
import {useIsOnline} from '@/shared/hooks';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, isAuthenticated} = useAuth();
  const isOnline = useIsOnline();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<Receipt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.push('Login');
    }
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('History', 'HistoryScreen');
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [user]);

  const loadReceipts = async () => {
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
          date: data.scannedAt?.toDate() || 
                (data.date && typeof data.date.toDate === 'function' ? data.date.toDate() : 
                 data.date && typeof data.date === 'object' && data.date.seconds ? new Date(data.date.seconds * 1000) :
                 new Date()),
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
      setFilteredReceipts(receiptsData);

      // Cache receipts for offline access
      offlineService.cacheReceipts(
        receiptsData.map(r => ({
          id: r.id,
          storeName: r.storeName,
          total: r.total,
          date: r.date.toISOString(),
          itemCount: r.items?.length || 0,
          cachedAt: Date.now(),
        }))
      );

      // Index receipts for Spotlight/App Search
      spotlightSearchService.indexReceipts(
        receiptsData.map(r => ({
          id: r.id,
          shopName: r.storeName,
          date: r.date,
          total: r.total,
          itemCount: r.items?.length || 0,
        }))
      );
    } catch (error) {
      console.error('Error loading receipts:', error);
      
      // If offline, try to load from cache
      if (!isOnline) {
        const cachedReceipts = await offlineService.getCachedReceipts();
        if (cachedReceipts.length > 0) {
          // Convert cached format back to Receipt format (minimal)
          const offlineReceipts = cachedReceipts.map(c => ({
            id: c.id,
            storeName: c.storeName,
            total: c.total,
            date: new Date(c.date),
            items: [],
            // Add other required fields with defaults
            userId: user?.uid || '',
            storeNameNormalized: '',
            currency: 'EUR',
            processingStatus: 'completed' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            scannedAt: new Date(c.date),
          }));
          setReceipts(offlineReceipts as Receipt[]);
          setFilteredReceipts(offlineReceipts as Receipt[]);
          return;
        }
      }
      
      // Keep empty array on error
      setReceipts([]);
      setFilteredReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadReceipts();
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredReceipts(receipts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = receipts.filter(
        r =>
          r.storeName.toLowerCase().includes(query) ||
          r.storeAddress?.toLowerCase().includes(query),
      );
      setFilteredReceipts(filtered);
    }
  }, [searchQuery, receipts]);

  const handleReceiptPress = (receiptId: string, receipt: Receipt) => {
    analyticsService.logCustomEvent('receipt_viewed', {receipt_id: receiptId});
    navigation.push('ReceiptDetail', {receiptId});
  };

  const getStatusColor = (status: Receipt['status']) => {
    switch (status) {
      case 'processed':
        return Colors.status.success;
      case 'processing':
        return Colors.status.warning;
      case 'error':
        return Colors.status.error;
      default:
        return Colors.text.tertiary;
    }
  };

  const getStatusLabel = (status: Receipt['status']) => {
    switch (status) {
      case 'processed':
        return 'Traité';
      case 'processing':
        return 'En cours...';
      case 'error':
        return 'Erreur';
      default:
        return status;
    }
  };

  // Delete receipt handler
  const handleDeleteReceipt = useCallback(
    async (receiptId: string) => {
      if (!user?.uid) return;

      try {
        await firestore()
          .collection('artifacts')
          .doc('goshopperai')
          .collection('users')
          .doc(user.uid)
          .collection('receipts')
          .doc(receiptId)
          .delete();

        // Remove from local state
        setReceipts(prev => prev.filter(r => r.id !== receiptId));
        setFilteredReceipts(prev => prev.filter(r => r.id !== receiptId));

        // Remove from Spotlight search index
        spotlightSearchService.removeReceipt(receiptId);

        analyticsService.logCustomEvent('receipt_deleted', {receiptId});
      } catch (error) {
        console.error('Error deleting receipt:', error);
      }
    },
    [user?.uid],
  );

  const renderReceiptItem = ({item, index}: {item: Receipt; index: number}) => {
    return (
      <SlideIn direction="left" delay={index * 50}>
        <SwipeToDelete
          onDelete={() => handleDeleteReceipt(item.id)}
          deleteLabel="Supprimer"
          style={{marginBottom: Spacing.sm}}>
          <TouchableOpacity
            style={styles.receiptCard}
            onPress={() => handleReceiptPress(item.id, item)}
            activeOpacity={0.7}>
            <View style={styles.receiptIcon}>
              <Icon name="receipt" size="lg" color={Colors.primary} />
            </View>

            <View style={styles.receiptInfo}>
              <Text style={styles.storeName}>{item.storeName}</Text>
              <Text style={styles.storeAddress} numberOfLines={1}>
                {item.storeAddress || 'Adresse non spécifiée'}
              </Text>
              <View style={styles.dateRow}>
                <Icon name="calendar" size="xs" color={Colors.text.tertiary} />
                <Text style={styles.receiptDate}>
                  {formatDate(item.date)}
                </Text>
              </View>
            </View>

            <View style={styles.receiptRight}>
              <View style={styles.totalContainer}>
                {item.totalUSD !== undefined && item.totalCDF !== undefined ? (
                  <>
                    <Text style={styles.totalAmount}>
                      {formatCurrency(item.totalUSD)}
                    </Text>
                    <Text style={styles.totalAmountSecondary}>
                      {formatCurrency(item.totalCDF, 'CDF')}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.totalAmount}>
                    {formatCurrency(
                      item.totalAmount || item.total,
                      item.currency,
                    )}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {backgroundColor: getStatusColor(item.status) + '20'},
                ]}>
                <Text
                  style={[
                    styles.statusText,
                    {color: getStatusColor(item.status)},
                  ]}>
                  {getStatusLabel(item.status)}
                </Text>
              </View>
              <Icon
                name="chevron-right"
                size="sm"
                color={Colors.text.tertiary}
              />
            </View>
          </TouchableOpacity>
        </SwipeToDelete>
      </SlideIn>
    );
  };

  const renderEmptyState = () => (
    <EmptyState
      icon="receipt"
      title={searchQuery ? 'Aucun résultat' : 'Pas encore de factures'}
      description={
        searchQuery
          ? "Essayez avec d'autres termes de recherche"
          : 'Scannez votre première facture pour commencer à suivre vos dépenses'
      }
      actionLabel={!searchQuery ? 'Scanner une facture' : undefined}
      onAction={!searchQuery ? () => navigation.navigate('Scanner') : undefined}
    />
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement de l'historique...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <FadeIn>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Historique</Text>
          <Text style={styles.headerSubtitle}>Vos factures scannées</Text>
        </View>
      </FadeIn>

      {/* Search Bar */}
      <FadeIn delay={100}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Icon name="search" size="sm" color={Colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un magasin..."
              placeholderTextColor={Colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x" size="sm" color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </FadeIn>

      {/* Stats Bar */}
      {receipts.length > 0 && (
        <SlideIn direction="up" delay={150}>
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{filteredReceipts.length}</Text>
              <Text style={styles.statLabel}>Factures</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatCurrency(
                  filteredReceipts.reduce((sum, r) => {
                    if (r.totalUSD !== undefined) {
                      return sum + r.totalUSD;
                    }
                    if (r.currency === 'USD') {
                      return sum + (r.totalAmount || r.total);
                    }
                    return sum;
                  }, 0),
                )}
              </Text>
              <Text style={styles.statLabel}>Total USD</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatCurrency(
                  filteredReceipts.reduce((sum, r) => {
                    if (r.totalCDF !== undefined) {
                      return sum + r.totalCDF;
                    }
                    if (r.currency === 'CDF') {
                      return sum + (r.totalAmount || r.total);
                    }
                    return sum;
                  }, 0),
                  'CDF',
                )}
              </Text>
              <Text style={styles.statLabel}>Total CDF</Text>
            </View>
          </View>
        </SlideIn>
      )}

      {/* Receipts List */}
      <FlatList
        data={filteredReceipts}
        renderItem={renderReceiptItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredReceipts.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  headerContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border.light,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
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
    width: 52,
    height: 52,
    borderRadius: BorderRadius.base,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  receiptInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  storeName: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  storeAddress: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  receiptDate: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
  },
  receiptRight: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
  totalContainer: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
    marginBottom: 2,
  },
  totalAmountSecondary: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
  },
});
