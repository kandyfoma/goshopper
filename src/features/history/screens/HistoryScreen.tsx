// History Screen - List of past receipts
// Styled with GoShopper Design System (Blue + Gold)
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
import {useNavigation, useNavigationState} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from '@/shared/services/firebase/config';
import {Receipt, RootStackParamList, MainTabParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn, EmptyState, SwipeToDelete, TabSelector} from '@/shared/components';
import {ModernTabBar, TabBarIcon} from '@/shared/components/ModernTabBar';
import {formatCurrency, formatDate, safeToDate, convertCurrency} from '@/shared/utils/helpers';
import {useAuth} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';
import {spotlightSearchService, offlineService} from '@/shared/services';
import {receiptStorageService} from '@/shared/services/firebase';
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
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'price'>('date');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchAnimation = useRef(new Animated.Value(0)).current;

  // Tab configuration (useMemo to prevent recreation on every render)
  const tabs = React.useMemo(() => [
    { icon: 'list', label: 'Tous', value: 'all' },
    { icon: 'calendar', label: 'Ce mois', value: 'month' },
  ], []);

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

      let receiptsSnapshot;
      try {
        // Try with orderBy first (requires index)
        receiptsSnapshot = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('receipts')
          .orderBy('scannedAt', 'desc')
          .get();
      } catch (indexError) {
        // Fallback: get all and sort client-side
        console.log('Index not ready, fetching all receipts and sorting client-side');
        receiptsSnapshot = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('receipts')
          .get();
      }

      const receiptsData: Receipt[] = receiptsSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Process items first
        const processedItems = (data.items || []).map((item: any) => ({
          id: item.id || Math.random().toString(36).substring(7),
          name: item.name || 'Article inconnu',
          nameNormalized: item.nameNormalized || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          totalPrice: item.totalPrice || 0,
          unit: item.unit,
          category: item.category || 'Autres',
          confidence: item.confidence || 0.85,
        }));
        
        // Calculate total from items if not provided
        const calculatedTotal = processedItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
        const finalTotal = data.total || calculatedTotal || 0;
        
        return {
          id: doc.id,
          userId: data.userId,
          storeName: data.storeName && data.storeName !== 'null' ? data.storeName : 'Magasin inconnu',
          storeNameNormalized: data.storeNameNormalized || '',
          storeAddress: data.storeAddress,
          storePhone: data.storePhone,
          receiptNumber: data.receiptNumber,
          date: safeToDate(data.scannedAt || data.date),
          currency: data.currency || 'USD',
          items: processedItems,
          subtotal: data.subtotal,
          tax: data.tax,
          total: finalTotal,
          totalUSD: data.totalUSD,
          totalCDF: data.totalCDF,
          processingStatus: data.processingStatus || 'completed',
          createdAt: safeToDate(data.createdAt) || new Date(),
          updatedAt: safeToDate(data.updatedAt) || new Date(),
          scannedAt: safeToDate(data.scannedAt) || new Date(),
        };
      });

      // Sort by scannedAt descending (in case we used client-side fallback)
      receiptsData.sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime());

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
            total: c.total || 0,
            date: new Date(c.date),
            items: [],
            // Add other required fields with defaults
            userId: user?.uid || '',
            storeNameNormalized: '',
            currency: 'USD' as const, // Default to USD for cached receipts
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

  const filterReceiptsByTab = useCallback((receipts: Receipt[], tabValue: string) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    switch (tabValue) {
      case 'month':
        return receipts.filter(receipt => {
          const receiptDate = safeToDate(receipt.date);
          return receiptDate.getMonth() === currentMonth && 
                 receiptDate.getFullYear() === currentYear;
        });
      case 'all':
      default:
        return receipts;
    }
  }, []);

  // Sort receipts
  const sortReceipts = useCallback((receiptsToSort: Receipt[], sortBy: 'date' | 'name' | 'price') => {
    const sorted = [...receiptsToSort];
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => 
          (a.storeName || '').localeCompare(b.storeName || '')
        );
      case 'price':
        return sorted.sort((a, b) => (b.total || 0) - (a.total || 0));
      case 'date':
      default:
        return sorted.sort((a, b) => 
          b.scannedAt.getTime() - a.scannedAt.getTime()
        );
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadReceipts();
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    setIsSearching(true);
    
    // Use setTimeout to allow UI to update with loading state
    setTimeout(() => {
      let filtered = filterReceiptsByTab(receipts, tabs[activeTab].value);
      
      if (searchQuery.trim() !== '') {
        // Normalize function: lowercase + remove accents
        const normalize = (str: string) => 
          str.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        
        const query = normalize(searchQuery);
        filtered = filtered.filter(r => {
          const storeName = normalize(r.storeName || '');
          const storeAddress = normalize(r.storeAddress || '');
          
          // Check if query is in store name or address
          if (storeName.includes(query) || storeAddress.includes(query)) {
            return true;
          }
          
          // Check if any word starts with query
          const storeWords = storeName.split(/\s+/);
          for (const word of storeWords) {
            if (word.startsWith(query) || query.startsWith(word)) {
              return true;
            }
          }
          
          return false;
        });
      }
      
      // Apply sorting
      filtered = sortReceipts(filtered, sortBy);
      setFilteredReceipts(filtered);
      setIsSearching(false);
    }, 0);
  }, [searchQuery, receipts, activeTab, tabs, filterReceiptsByTab, sortReceipts, sortBy]);

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
        // Use receiptStorage.deleteReceipt to properly update shop stats
        await receiptStorageService.deleteReceipt(user.uid, receiptId);

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
              <Text style={styles.storeName} numberOfLines={1}>
                {item.storeName && item.storeName !== 'null' ? item.storeName : 'Magasin inconnu'}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.itemCountBadge}>
                  <Icon name="package" size="xs" color={Colors.primary} />
                  <Text style={styles.itemCountText}>{item.items?.length || 0}</Text>
                </View>
                <View style={styles.dateRow}>
                  <Icon name="calendar" size="xs" color={Colors.text.tertiary} />
                  <Text style={styles.receiptDate}>
                    {formatDate(item.date)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.receiptRight}>
              <View style={styles.totalContainer}>
                {item.currency === 'USD' ? (
                  <>
                    <Text style={styles.totalAmount}>
                      {formatCurrency(item.total, 'USD')}
                    </Text>
                    <Text style={styles.totalAmountSecondary}>
                      {item.totalCDF
                        ? formatCurrency(item.totalCDF, 'CDF')
                        : `≈ ${formatCurrency(convertCurrency(item.total, 'USD', 'CDF'), 'CDF')}`
                      }
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.totalAmount}>
                      {formatCurrency(item.total, 'CDF')}
                    </Text>
                    <Text style={styles.totalAmountSecondary}>
                      {item.totalUSD
                        ? formatCurrency(item.totalUSD, 'USD')
                        : `≈ ${formatCurrency(convertCurrency(item.total, 'CDF', 'USD'), 'USD')}`
                      }
                    </Text>
                  </>
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

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Recherche...</Text>
        </View>
      );
    }
    
    return (
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
  };

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
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Historique</Text>
            <Text style={styles.headerSubtitle}>Vos factures scannées</Text>
          </View>
          
          <View style={styles.headerActions}>
            {/* Sort Button in Header */}
            <TouchableOpacity 
              style={styles.headerSortButton}
              onPress={() => setShowSortMenu(!showSortMenu)}
              activeOpacity={0.7}
            >
              <Icon name="filter" size="sm" color={Colors.primary} />
            </TouchableOpacity>
            
            {/* Search Button */}
            <TouchableOpacity 
              style={styles.headerSortButton}
              onPress={toggleSearch}
              activeOpacity={0.7}
            >
              <Icon name={isSearchOpen ? 'x' : 'search'} size="sm" color={Colors.primary} />
            </TouchableOpacity>
          </View>
          
          {/* Sort Menu */}
          {showSortMenu && (
            <View style={styles.sortMenuHeader}>
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'date' && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy('date');
                  setShowSortMenu(false);
                }}
              >
                <Icon name="calendar" size="sm" color={sortBy === 'date' ? Colors.primary : Colors.text.secondary} />
                <Text style={[styles.sortOptionText, sortBy === 'date' && styles.sortOptionTextActive]}>
                  Date
                </Text>
                {sortBy === 'date' && <Icon name="check" size="sm" color={Colors.primary} />}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'name' && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy('name');
                  setShowSortMenu(false);
                }}
              >
                <Icon name="store" size="sm" color={sortBy === 'name' ? Colors.primary : Colors.text.secondary} />
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
          <View style={styles.searchBar}>
            <Icon name="search" size="sm" color={Colors.text.tertiary} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Rechercher un magasin..."
              placeholderTextColor={Colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x-circle" size="sm" color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Tab Bar */}
      <SlideIn direction="right" delay={200}>
        <View style={styles.tabBarContainer}>
          <TabSelector
            tabs={tabs}
            activeIndex={activeTab}
            onTabPress={setActiveTab}
          />
        </View>
      </SlideIn>

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
                    // Use totalUSD field if available, otherwise convert
                    let usdAmount = 0;
                    if (r.totalUSD != null) {
                      usdAmount = r.totalUSD;
                    } else if (r.currency === 'USD') {
                      usdAmount = r.total || 0;
                    } else if (r.totalCDF != null) {
                      usdAmount = convertCurrency(r.totalCDF, 'CDF', 'USD');
                    } else if (r.currency === 'CDF') {
                      usdAmount = convertCurrency(r.total || 0, 'CDF', 'USD');
                    }
                    return sum + usdAmount;
                  }, 0),
                  'USD',
                )}
              </Text>
              <Text style={styles.statLabel}>Total USD</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatCurrency(
                  filteredReceipts.reduce((sum, r) => {
                    // Use totalCDF field if available, otherwise convert
                    let cdfAmount = 0;
                    if (r.totalCDF != null) {
                      cdfAmount = r.totalCDF;
                    } else if (r.currency === 'CDF') {
                      cdfAmount = r.total || 0;
                    } else if (r.totalUSD != null) {
                      cdfAmount = convertCurrency(r.totalUSD, 'USD', 'CDF');
                    } else if (r.currency === 'USD') {
                      cdfAmount = convertCurrency(r.total || 0, 'USD', 'CDF');
                    }
                    return sum + cdfAmount;
                  }, 0),
                  'CDF',
                )}
              </Text>
              <Text style={styles.statLabel}>Total FC</Text>
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
          {paddingBottom: 100}, // Space for tab bar
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

      {/* Main Footer Tabs */}
      <ModernTabBar
        state={{
          index: 0,
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    position: 'relative',
    zIndex: 9998,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  headerSortButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
    marginTop: 4,
  },
  sortMenuHeader: {
    position: 'absolute',
    top: 60,
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
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  searchBar: {
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
  tabBarContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
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
    paddingBottom: 100,
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
    marginBottom: Spacing.xs,
    alignItems: 'center',
    ...Shadows.md,
  },
  receiptIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  receiptInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  storeName: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  itemCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.cream,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  itemCountText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primary,
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
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    marginBottom: 2,
  },
  totalAmountSecondary: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.tertiary,
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
  
  // Sort Styles
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
});
