// Shopping List Detail Screen - Modern list view with full CRUD
import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {firebase} from '@react-native-firebase/functions';
import RNModal from 'react-native-modal';
import {BlurView} from '@react-native-community/blur';
import {RootStackParamList} from '@/shared/types';
import {useAuth, useUser, useScroll} from '@/shared/contexts';
import {
  shoppingListService,
  ShoppingList,
  ShoppingListItem,
} from '@/shared/services/firebase';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Spinner, SwipeToDelete, FadeIn, SlideIn, Input, Button, BackButton} from '@/shared/components';
import {formatCurrency} from '@/shared/utils/helpers';

// Import ProfileStackParamList for shopping screens
import type {ProfileStackParamList} from '@/features/profile/navigation/ProfileStackNavigator';

type RouteParams = RouteProp<ProfileStackParamList, 'ShoppingListDetail'>;
type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

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

// Community item from search
interface CommunityItemData {
  id: string;
  name: string;
  searchKeywords?: string[]; // Multi-language search keywords
  prices: {
    storeName: string;
    price: number;
    currency: 'USD' | 'CDF';
    date: Date | any;
  }[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  currency: 'USD' | 'CDF';
}

export function ShoppingListDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();
  const {profile: userProfile} = useUser();
  const {scrollY} = useScroll();

  const listId = route.params?.listId;

  const [list, setList] = useState<ShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editedListName, setEditedListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [isCreating, setIsCreating] = useState(false);

  // Community item search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CommunityItemData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItemForAdd, setSelectedItemForAdd] = useState<CommunityItemData | null>(null);
  const [selectedStore, setSelectedStore] = useState<{storeName: string; price: number; currency: 'USD' | 'CDF'} | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FAB animation
  const fabScale = useRef(new Animated.Value(1)).current;

  // Modal animations
  const addItemSlideAnim = useRef(new Animated.Value(0)).current;
  const addItemFadeAnim = useRef(new Animated.Value(0)).current;
  const addItemScaleAnim = useRef(new Animated.Value(0.9)).current;

  const editNameSlideAnim = useRef(new Animated.Value(0)).current;
  const editNameFadeAnim = useRef(new Animated.Value(0)).current;
  const editNameScaleAnim = useRef(new Animated.Value(0.9)).current;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Load list on focus
  useFocusEffect(
    useCallback(() => {
      if (user?.uid && listId) {
        loadList();
      }
    }, [user?.uid, listId])
  );

  // FAB pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(fabScale, {
          toValue: 1.08,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fabScale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Add Item Modal animations
  useEffect(() => {
    if (showAddItemModal) {
      // Reset animations
      addItemSlideAnim.setValue(100);
      addItemFadeAnim.setValue(0);
      addItemScaleAnim.setValue(0.9);

      // Start animations
      Animated.parallel([
        Animated.spring(addItemSlideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
        Animated.timing(addItemFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(addItemScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
      ]).start();
    }
  }, [showAddItemModal, addItemSlideAnim, addItemFadeAnim, addItemScaleAnim]);

  // Edit Name Modal animations
  useEffect(() => {
    if (showEditNameModal) {
      // Reset animations
      editNameSlideAnim.setValue(100);
      editNameFadeAnim.setValue(0);
      editNameScaleAnim.setValue(0.9);

      // Start animations
      Animated.parallel([
        Animated.spring(editNameSlideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
        Animated.timing(editNameFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(editNameScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
      ]).start();
    }
  }, [showEditNameModal, editNameSlideAnim, editNameFadeAnim, editNameScaleAnim]);

  const loadList = async (showRefresh = false) => {
    if (!user?.uid || !listId) return;

    if (showRefresh) {
      setIsRefreshing(true);
    }

    try {
      const loadedList = await shoppingListService.getList(user.uid, listId);
      setList(loadedList);
    } catch (error) {
      console.error('Load list error:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste');
      navigation.goBack();
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadList(true);
  };

  // Search community items
  const searchCommunityItems = useCallback(async (query: string) => {
    if (!query.trim() || !userProfile?.defaultCity) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const functionsInstance = firebase.app().functions('europe-west1');
      const result = await functionsInstance.httpsCallable('getCityItems')({
        city: userProfile.defaultCity,
      });

      const data = result.data as {
        success: boolean;
        items: CommunityItemData[];
      };

      if (data.success && data.items) {
        const normalizedQuery = query.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

        // Filter items by search query - check name, keywords, and fallback keywords
        const filtered = data.items.filter(item => {
          const normalizedName = item.name.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          
          // 1. Check if query matches the item name
          if (normalizedName.includes(normalizedQuery)) {
            return true;
          }
          
          // 2. Check if query matches any searchKeywords (backend multi-language)
          if (item.searchKeywords && item.searchKeywords.length > 0) {
            const keywordMatch = item.searchKeywords.some(keyword => {
              const normalizedKeyword = keyword.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
              return normalizedKeyword.includes(normalizedQuery) || normalizedQuery.includes(normalizedKeyword);
            });
            if (keywordMatch) return true;
          }
          
          // 3. Fallback: client-side keyword mapping
          if (matchesFallbackKeywords(item.name, query)) {
            return true;
          }
          
          return false;
        });
        setSearchResults(filtered.slice(0, 10)); // Limit to 10 results
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [userProfile?.defaultCity]);

  // Debounced search - triggered by newItemName changes
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Only search if modal is open and we're not selecting from results
    if (showAddItemModal && !selectedItemForAdd) {
      searchTimeoutRef.current = setTimeout(() => {
        searchCommunityItems(newItemName);
      }, 300);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [newItemName, searchCommunityItems, showAddItemModal, selectedItemForAdd]);

  const handleSelectSearchResult = useCallback((item: CommunityItemData) => {
    setSelectedItemForAdd(item);
    setNewItemName(item.name);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const handleAddItem = useCallback(async () => {
    if (!user?.uid || !list || !newItemName.trim()) return;

    setIsCreating(true);
    try {
      await shoppingListService.addItem(
        user.uid,
        list.id,
        {
          name: newItemName.trim(),
          quantity: parseInt(newItemQuantity) || 1,
          bestStore: selectedStore?.storeName,
          bestPrice: selectedStore?.price,
          currency: selectedStore?.currency,
        },
      );

      // Refresh list
      await loadList();

      setShowAddItemModal(false);
      setNewItemName('');
      setNewItemQuantity('1');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedItemForAdd(null);
      setSelectedStore(null);
    } catch (error) {
      console.error('Add item error:', error);
      Alert.alert('Erreur', "Impossible d'ajouter l'article");
    } finally {
      setIsCreating(false);
    }
  }, [user?.uid, list, newItemName, newItemQuantity, selectedStore]);

  const handleToggleItem = useCallback(
    async (itemId: string) => {
      if (!user?.uid || !list) return;

      try {
        await shoppingListService.toggleItem(user.uid, list.id, itemId);

        // Update local state
        setList(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map(item =>
              item.id === itemId ? {...item, isChecked: !item.isChecked} : item,
            ),
          };
        });
      } catch (error) {
        console.error('Toggle item error:', error);
      }
    },
    [user?.uid, list],
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if (!user?.uid || !list) return;

      Alert.alert('Supprimer ?', 'Supprimer cet article de la liste ?', [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await shoppingListService.removeItem(
                user.uid,
                list.id,
                itemId,
              );

              setList(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  items: prev.items.filter(item => item.id !== itemId),
                };
              });
            } catch (error) {
              console.error('Remove item error:', error);
            }
          },
        },
      ]);
    },
    [user?.uid, list],
  );

  const handleUpdateQuantity = useCallback(
    async (itemId: string, newQuantity: number) => {
      if (!user?.uid || !list || newQuantity < 1) return;

      try {
        await shoppingListService.updateItemQuantity(
          user.uid,
          list.id,
          itemId,
          newQuantity,
        );

        setList(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map(item =>
              item.id === itemId ? {...item, quantity: newQuantity} : item,
            ),
          };
        });
      } catch (error) {
        console.error('Update quantity error:', error);
      }
    },
    [user?.uid, list],
  );

  const handleUpdateListName = useCallback(async () => {
    if (!user?.uid || !list || !editedListName.trim()) return;

    setIsCreating(true);
    try {
      await shoppingListService.updateListName(
        user.uid,
        list.id,
        editedListName.trim(),
      );

      setList(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          name: editedListName.trim(),
        };
      });

      setShowEditNameModal(false);
      setEditedListName('');
    } catch (error) {
      console.error('Update list name error:', error);
      Alert.alert('Erreur', 'Impossible de modifier le nom');
    } finally {
      setIsCreating(false);
    }
  }, [user?.uid, list, editedListName]);

  const renderItem = ({
    item,
    index,
  }: {
    item: ShoppingListItem;
    index: number;
  }) => {
    const lineTotal = item.bestPrice ? item.bestPrice * (item.quantity || 1) : null;
    const estimatedLineTotal = item.estimatedPrice ? item.estimatedPrice * (item.quantity || 1) : null;
    
    return (
      <SlideIn delay={index * 30} direction="up" distance={20}>
        <SwipeToDelete
          onDelete={() => handleRemoveItem(item.id)}
          deleteLabel="Supprimer"
          style={{marginBottom: Spacing.sm}}>
          <View
            style={[
              styles.itemCard,
              item.isChecked && styles.itemCardChecked,
            ]}>
            {/* Modern checkbox */}
            <TouchableOpacity
              style={[
                styles.checkBox,
                item.isChecked && styles.checkBoxChecked,
              ]}
              onPress={() => handleToggleItem(item.id)}
              activeOpacity={0.7}>
              {item.isChecked && (
                <Icon name="check" size="sm" color={Colors.white} />
              )}
            </TouchableOpacity>

            <View style={styles.itemInfo}>
              {/* Item name and quantity row */}
              <View style={styles.itemHeaderRow}>
                <Text
                  style={[
                    styles.itemName,
                    item.isChecked && styles.itemNameChecked,
                  ]}
                  numberOfLines={1}>
                  {item.name}
                </Text>
                {/* Quantity controls */}
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                    hitSlop={{top: 5, bottom: 5, left: 5, right: 5}}>
                    <Icon name="minus" size="xs" color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                    hitSlop={{top: 5, bottom: 5, left: 5, right: 5}}>
                    <Icon name="plus" size="xs" color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Store and Price Row */}
              {item.bestStore && item.bestPrice ? (
                <View style={styles.itemStoreRow}>
                  <View style={styles.storeInfoContainer}>
                    <View style={styles.storeIconBadge}>
                      <Icon name="shopping-bag" size="xs" color={Colors.white} />
                    </View>
                    <Text style={styles.storeName} numberOfLines={1}>{item.bestStore}</Text>
                  </View>
                  <View style={styles.priceContainer}>
                    <Text style={styles.unitPriceLabel}>
                      {formatCurrency(item.bestPrice, item.currency || 'CDF')}/unité
                    </Text>
                    {lineTotal && item.quantity > 1 && (
                      <Text style={styles.lineTotalPrice}>
                        = {formatCurrency(lineTotal, item.currency || 'CDF')}
                      </Text>
                    )}
                  </View>
                </View>
              ) : item.estimatedPrice ? (
                <View style={styles.itemStoreRow}>
                  <View style={styles.storeInfoContainer}>
                    <View style={[styles.storeIconBadge, styles.estimatedBadge]}>
                      <Icon name="help-circle" size="xs" color={Colors.text.secondary} />
                    </View>
                    <Text style={styles.storeNameEstimated}>Prix estimé</Text>
                  </View>
                  <View style={styles.priceContainer}>
                    <Text style={styles.estimatedPrice}>
                      ~{formatCurrency(item.estimatedPrice, item.currency || 'CDF')}/unité
                    </Text>
                    {estimatedLineTotal && item.quantity > 1 && (
                      <Text style={styles.lineTotalEstimated}>
                        = ~{formatCurrency(estimatedLineTotal, item.currency || 'CDF')}
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.itemStoreRow}>
                  <View style={styles.storeInfoContainer}>
                    <View style={[styles.storeIconBadge, styles.noPriceBadge]}>
                      <Icon name="alert-circle" size="xs" color={Colors.text.tertiary} />
                    </View>
                    <Text style={styles.noPriceText}>Prix non disponible</Text>
                  </View>
                </View>
              )}

              {/* Savings indicator */}
              {item.bestPrice && item.estimatedPrice && item.estimatedPrice > item.bestPrice && (
                <View style={styles.savingsBadge}>
                  <Icon name="trending-down" size="xs" color={Colors.status.success} />
                  <Text style={styles.savingsText}>
                    Économie: {formatCurrency((item.estimatedPrice - item.bestPrice) * (item.quantity || 1), item.currency || 'CDF')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </SwipeToDelete>
      </SlideIn>
    );
  };

  if (!isAuthenticated || isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Spinner size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  if (!list) {
    return null;
  }

  // Calculate progress
  const checkedCount = list.items.filter(i => i.isChecked).length;
  const progress = list.items.length > 0 ? checkedCount / list.items.length : 0;

  // Helper function to render search result item
  const renderSearchResultItem = (item: CommunityItemData) => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.searchResultItem,
        (selectedItemForAdd?.id === item.id) ? styles.searchResultItemSelected : undefined,
      ]}
      onPress={() => setSelectedItemForAdd(item)}
      activeOpacity={0.7}>
      <View style={styles.searchResultContent}>
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName}>{item.name}</Text>
          <Text style={styles.searchResultPrice}>
            À partir de {formatCurrency(item.minPrice, item.currency)}
          </Text>
        </View>
        <View style={styles.searchResultStats}>
          <Text style={styles.searchResultStores}>
            {item.storeCount} magasin{item.storeCount > 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <FadeIn duration={300}>
        <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
          <BackButton />
          
          <TouchableOpacity 
            style={styles.headerTitleContainer}
            onLongPress={() => {
              setEditedListName(list.name);
              setShowEditNameModal(true);
            }}
            activeOpacity={0.8}>
            <Text style={styles.headerTitle} numberOfLines={1}>{list.name}</Text>
            <Text style={styles.headerSubtitle}>
              {checkedCount}/{list.items.length} articles
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              setEditedListName(list.name);
              setShowEditNameModal(true);
            }}>
            <Icon name="edit-2" size="sm" color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Budget Summary Bar */}
        {list.items.length > 0 && list.items.some(item => item.bestPrice) && (
          <View style={styles.budgetSummaryBar}>
            {(() => {
              let totalBestPrice = 0;
              let totalEstimated = 0;
              const storeMap = new Map<string, number>();
              // Determine primary currency from items (most common)
              const currencyCount = new Map<string, number>();
              
              list.items.forEach(item => {
                const qty = item.quantity || 1;
                const itemCurrency = item.currency || 'CDF';
                currencyCount.set(itemCurrency, (currencyCount.get(itemCurrency) || 0) + 1);
                if (item.bestPrice) {
                  totalBestPrice += item.bestPrice * qty;
                  if (item.bestStore) {
                    storeMap.set(item.bestStore, (storeMap.get(item.bestStore) || 0) + 1);
                  }
                }
                if (item.estimatedPrice) {
                  totalEstimated += item.estimatedPrice * qty;
                }
              });
              
              const savings = totalEstimated > totalBestPrice ? totalEstimated - totalBestPrice : 0;
              const topStores = Array.from(storeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2);
              // Get the most common currency
              const primaryCurrency = Array.from(currencyCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] as 'USD' | 'CDF' || 'CDF';
              
              return (
                <>
                  <View style={styles.budgetItem}>
                    <Icon name="credit-card" size="xs" color={Colors.primary} />
                    <Text style={styles.budgetLabel}>Total</Text>
                    <Text style={styles.budgetValue}>{formatCurrency(totalBestPrice, primaryCurrency)}</Text>
                  </View>
                  {savings > 0 && (
                    <View style={styles.budgetItem}>
                      <Icon name="trending-down" size="xs" color={Colors.status.success} />
                      <Text style={styles.budgetLabel}>Économies</Text>
                      <Text style={[styles.budgetValue, styles.savingsValue]}>{formatCurrency(savings, primaryCurrency)}</Text>
                    </View>
                  )}
                  {topStores.length > 0 && (
                    <View style={styles.budgetItem}>
                      <Icon name="shopping-bag" size="xs" color={Colors.text.secondary} />
                      <Text style={styles.budgetLabel}>{topStores.map(s => s[0]).join(', ')}</Text>
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        )}
      </FadeIn>

      {/* Progress bar under header */}
      {list.items.length > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <Animated.View 
              style={[
                styles.progressBarFill, 
                {
                  width: `${progress * 100}%`,
                  backgroundColor: progress === 1 ? Colors.status.success : Colors.primary,
                }
              ]} 
            />
          </View>
        </View>
      )}

      {/* Items List */}
      {list.items.length === 0 ? (
        <FadeIn delay={200} duration={400}>
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>Liste vide</Text>
            <Text style={styles.emptySubtext}>
              Ajoutez des articles à votre liste
            </Text>
            <TouchableOpacity
              style={styles.emptyAddButton}
              onPress={() => setShowAddItemModal(true)}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#C1121F', '#780000']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.emptyAddButtonGradient}>
                <Icon name="plus" size="sm" color={Colors.white} />
                <Text style={styles.emptyAddButtonText}>Ajouter un article</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </FadeIn>
      ) : (
        <>
          <FlatList
            data={list.items}
            renderItem={renderItem}
            keyExtractor={(item: ShoppingListItem) => item.id}
            contentContainerStyle={styles.itemsList}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: false})}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
          />

          {/* Total Price Summary */}
          {list.items.some(item => item.bestPrice) && (
            <View style={styles.totalSummaryCard}>
              {(() => {
                let totalBestPrice = 0;
                let totalEstimated = 0;
                let itemsWithPrice = 0;
                const storeBreakdown = new Map<string, {count: number; total: number; currency: 'USD' | 'CDF'}>();
                // Determine primary currency from items
                const currencyCount = new Map<string, number>();

                list.items.forEach(item => {
                  const qty = item.quantity || 1;
                  const itemCurrency = item.currency || 'CDF';
                  currencyCount.set(itemCurrency, (currencyCount.get(itemCurrency) || 0) + 1);
                  if (item.bestPrice) {
                    totalBestPrice += item.bestPrice * qty;
                    itemsWithPrice++;
                    if (item.bestStore) {
                      const existing = storeBreakdown.get(item.bestStore) || {count: 0, total: 0, currency: itemCurrency};
                      storeBreakdown.set(item.bestStore, {
                        count: existing.count + 1,
                        total: existing.total + (item.bestPrice * qty),
                        currency: itemCurrency,
                      });
                    }
                  }
                  if (item.estimatedPrice) {
                    totalEstimated += item.estimatedPrice * qty;
                  }
                });

                const savings = totalEstimated > totalBestPrice ? totalEstimated - totalBestPrice : 0;
                const storeList = Array.from(storeBreakdown.entries()).sort((a, b) => b[1].total - a[1].total);
                // Get the most common currency
                const primaryCurrency = Array.from(currencyCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] as 'USD' | 'CDF' || 'CDF';

                return (
                  <>
                    {/* Store Breakdown */}
                    {storeList.length > 0 && (
                      <View style={styles.storeBreakdownSection}>
                        <Text style={styles.storeBreakdownTitle}>Répartition par magasin</Text>
                        {storeList.map(([store, data]) => (
                          <View key={store} style={styles.storeBreakdownItem}>
                            <View style={styles.storeBreakdownLeft}>
                              <View style={styles.storeBreakdownIcon}>
                                <Icon name="shopping-bag" size="xs" color={Colors.primary} />
                              </View>
                              <View>
                                <Text style={styles.storeBreakdownName}>{store}</Text>
                                <Text style={styles.storeBreakdownCount}>{data.count} article{data.count > 1 ? 's' : ''}</Text>
                              </View>
                            </View>
                            <Text style={styles.storeBreakdownTotal}>{formatCurrency(data.total, data.currency)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Divider */}
                    <View style={styles.summaryDivider} />

                    {/* Totals */}
                    <View style={styles.totalSummaryContent}>
                      <View>
                        <Text style={styles.totalLabel}>Total estimé</Text>
                        <Text style={styles.totalSubLabel}>{itemsWithPrice}/{list.items.length} articles avec prix</Text>
                      </View>
                      <Text style={styles.totalAmount}>
                        {formatCurrency(totalBestPrice, primaryCurrency)}
                      </Text>
                    </View>

                    {/* Savings */}
                    {savings > 0 && (
                      <View style={styles.savingsSummaryRow}>
                        <View style={styles.savingsSummaryLeft}>
                          <Icon name="trending-down" size="sm" color={Colors.status.success} />
                          <Text style={styles.savingsSummaryLabel}>Économies totales</Text>
                        </View>
                        <Text style={styles.savingsSummaryAmount}>-{formatCurrency(savings, primaryCurrency)}</Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>
          )}
        </>
      )}

      {/* Floating Add Button */}
      <Animated.View 
        style={[
          styles.floatingButton, 
          {
            bottom: insets.bottom + Spacing.lg,
            transform: [{scale: fabScale}],
          }
        ]}>
        <TouchableOpacity
          onPress={() => setShowAddItemModal(true)}
          activeOpacity={0.9}>
          <LinearGradient
            colors={['#C1121F', '#780000']}
            style={styles.floatingButtonGradient}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}>
            <Icon name="plus" size="lg" color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Add Item Modal with Search */}
      <RNModal
        isVisible={showAddItemModal}
        onBackdropPress={() => {
          setShowAddItemModal(false);
          setNewItemName('');
          setNewItemQuantity('1');
          setSearchResults([]);
          setSelectedItemForAdd(null);
          setSelectedStore(null);
        }}
        onBackButtonPress={() => {
          setShowAddItemModal(false);
          setNewItemName('');
          setNewItemQuantity('1');
          setSearchResults([]);
          setSelectedItemForAdd(null);
          setSelectedStore(null);
        }}
        backdropOpacity={0.25}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver={true}
        hideModalContentWhileAnimating={true}
        style={styles.modal}>
        {Platform.OS === 'ios' ? (
          <BlurView style={styles.overlay} blurType="dark" blurAmount={10}>
            <Animated.View style={[styles.androidOverlay, { opacity: addItemFadeAnim }]} />
            <View style={styles.overlayContent}>
              <TouchableOpacity
                style={styles.overlayTouchable}
                activeOpacity={1}
                onPress={() => {
                  setShowAddItemModal(false);
                  setNewItemName('');
                  setNewItemQuantity('1');
                  setSearchResults([]);
                  setSelectedItemForAdd(null);
                  setSelectedStore(null);
                }}
              />
              <Animated.View
                style={[
                  styles.modalContent,
                  {
                    paddingBottom: insets.bottom + Spacing.lg,
                    transform: [
                      { translateY: addItemSlideAnim },
                      { scale: addItemScaleAnim },
                    ],
                  }
                ]}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.headerDrag} />
                  <View style={styles.headerTop}>
                    <View style={styles.headerContent}>
                      <Text style={styles.modalHeaderTitle}>Ajouter un article</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => {
                        setShowAddItemModal(false);
                        setNewItemName('');
                        setNewItemQuantity('1');
                        setSearchResults([]);
                        setSelectedItemForAdd(null);
                        setSelectedStore(null);
                      }}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                      <Icon name="x" size="md" color={Colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled>
                  {/* Search Section */}
                  <View style={styles.addItemSearchSection}>
                    <View style={styles.searchInputContainer}>
                      <Input
                        label="Nom de l'article"
                        value={newItemName}
                        onChangeText={(text) => {
                          setNewItemName(text);
                          setSelectedItemForAdd(null);
                        }}
                        placeholder="Ex: Sucre, Riz, Huile..."
                        leftIcon="search"
                      />
                    </View>

                    {/* Modern Quantity Selector */}
                    <View style={styles.quantitySelector}>
                      <Text style={styles.quantitySelectorLabel}>Quantité</Text>
                      <View style={styles.quantitySelectorRow}>
                        <TouchableOpacity
                          style={styles.quantityBtn}
                          onPress={() =>
                            setNewItemQuantity(String(Math.max(1, parseInt(newItemQuantity) - 1)))
                          }>
                          <Icon name="minus" size="sm" color={Colors.white} />
                        </TouchableOpacity>
                        <View style={styles.quantityDisplay}>
                          <Text style={styles.quantityNumber}>{newItemQuantity}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.quantityBtn}
                          onPress={() => setNewItemQuantity(String(parseInt(newItemQuantity) + 1))}>
                          <Icon name="plus" size="sm" color={Colors.white} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Loading indicator while searching */}
                  {isSearching && (
                    <View style={styles.searchingIndicator}>
                      <Spinner size="small" color={Colors.primary} />
                      <Text style={styles.searchingText}>Recherche en cours...</Text>
                    </View>
                  )}

                  {/* Search Results */}
                  {searchResults.length > 0 && !selectedItemForAdd && (
                    <View style={styles.searchResultsContainer}>
                      <View style={styles.searchResultsHeader}>
                        <Icon name="database" size="sm" color={Colors.primary} />
                        <Text style={styles.searchResultsTitle}>
                          {searchResults.length} article{searchResults.length > 1 ? 's' : ''} trouvé{searchResults.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={styles.searchResultsList}>
                        {searchResults.map(renderSearchResultItem)}
                      </View>
                    </View>
                  )}

                  {/* Price Comparison for selected item */}
                  {selectedItemForAdd && (
                    <View style={styles.priceComparisonContainer}>
                      <View style={styles.priceComparisonHeader}>
                        <Icon name="dollar-sign" size="sm" color={Colors.primary} />
                        <Text style={styles.priceComparisonTitle}>
                          Prix pour "{selectedItemForAdd.name}"
                        </Text>
                      </View>
                      <View style={styles.priceList}>
                        {selectedItemForAdd.prices.map((priceInfo, index) => {
                          const isSelected = selectedStore?.storeName === priceInfo.storeName && selectedStore?.price === priceInfo.price;
                          const isBest = priceInfo.price === selectedItemForAdd.minPrice;
                          return (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.priceItem,
                                isSelected && styles.priceItemSelected,
                                isBest && styles.priceItemBest,
                              ]}
                              onPress={() => setSelectedStore({storeName: priceInfo.storeName, price: priceInfo.price, currency: priceInfo.currency})}
                              activeOpacity={0.7}>
                              {isBest && (
                                <View style={styles.bestPriceBadge}>
                                  <Text style={styles.bestPriceText}>Meilleur prix</Text>
                                </View>
                              )}
                              <View style={styles.priceItemContent}>
                                <View style={styles.priceStoreInfo}>
                                  <Text style={[
                                    styles.priceStoreName,
                                    isSelected && styles.priceStoreNameSelected
                                  ]}>{priceInfo.storeName}</Text>
                                  <Text style={styles.priceCurrency}>{priceInfo.currency}</Text>
                                </View>
                                <View style={styles.priceAmountContainer}>
                                  <Text style={[
                                    styles.priceAmount,
                                    isBest && styles.priceAmountBest,
                                  ]}>
                                    {formatCurrency(priceInfo.price, priceInfo.currency)}
                                  </Text>
                                  {isSelected && (
                                    <View style={styles.selectedCheck}>
                                      <Icon name="check" size="xs" color={Colors.white} />
                                    </View>
                                  )}
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Add Button */}
                  <View style={styles.addItemButtonContainer}>
                    <Button
                      title="Ajouter à ma liste"
                      onPress={handleAddItem}
                      disabled={!newItemName.trim() || isCreating}
                      loading={isCreating}
                      icon={<Icon name="plus" size="sm" color={Colors.white} />}
                      iconPosition="left"
                      fullWidth
                    />
                  </View>
                </ScrollView>
              </Animated.View>
            </View>
          </BlurView>
        ) : (
          <Animated.View style={[styles.androidOverlay, { opacity: addItemFadeAnim }]} />
        )}
        <View style={styles.overlayContent}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => {
              setShowAddItemModal(false);
              setNewItemName('');
              setNewItemQuantity('1');
              setSearchResults([]);
              setSelectedItemForAdd(null);
              setSelectedStore(null);
            }}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                paddingBottom: insets.bottom + Spacing.lg,
                transform: [
                  { translateY: addItemSlideAnim },
                  { scale: addItemScaleAnim },
                ],
              }
            ]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerDrag} />
              <View style={styles.headerTop}>
                <View style={styles.headerContent}>
                  <Text style={styles.modalHeaderTitle}>Ajouter un article</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowAddItemModal(false);
                    setNewItemName('');
                    setNewItemQuantity('1');
                    setSearchResults([]);
                    setSelectedItemForAdd(null);
                    setSelectedStore(null);
                  }}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Icon name="x" size="md" color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled>
              {/* Search Section */}
              <View style={styles.addItemSearchSection}>
                <View style={styles.searchInputContainer}>
                  <Input
                    label="Nom de l'article"
                    value={newItemName}
                    onChangeText={(text) => {
                      setNewItemName(text);
                      setSelectedItemForAdd(null);
                    }}
                    placeholder="Ex: Sucre, Riz, Huile..."
                    leftIcon="search"
                  />
                </View>

                {/* Modern Quantity Selector */}
                <View style={styles.quantitySelector}>
                  <Text style={styles.quantitySelectorLabel}>Quantité</Text>
                  <View style={styles.quantitySelectorRow}>
                    <TouchableOpacity
                      style={styles.quantityBtn}
                      onPress={() =>
                        setNewItemQuantity(String(Math.max(1, parseInt(newItemQuantity) - 1)))
                      }>
                      <Icon name="minus" size="sm" color={Colors.white} />
                    </TouchableOpacity>
                    <View style={styles.quantityDisplay}>
                      <Text style={styles.quantityNumber}>{newItemQuantity}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.quantityBtn}
                      onPress={() => setNewItemQuantity(String(parseInt(newItemQuantity) + 1))}>
                      <Icon name="plus" size="sm" color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Loading indicator while searching */}
              {isSearching && (
                <View style={styles.searchingIndicator}>
                  <Spinner size="small" color={Colors.primary} />
                  <Text style={styles.searchingText}>Recherche en cours...</Text>
                </View>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && !selectedItemForAdd && (
                <View style={styles.searchResultsContainer}>
                  <View style={styles.searchResultsHeader}>
                    <Icon name="database" size="sm" color={Colors.primary} />
                    <Text style={styles.searchResultsTitle}>
                      {searchResults.length} article{searchResults.length > 1 ? 's' : ''} trouvé{searchResults.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.searchResultsList}>
                    {searchResults.map(renderSearchResultItem)}
                  </View>
                </View>
              )}

              {/* Price Comparison for selected item */}
              {selectedItemForAdd && (
                <View style={styles.priceComparisonContainer}>
                  <View style={styles.priceComparisonHeader}>
                    <Icon name="dollar-sign" size="sm" color={Colors.primary} />
                    <Text style={styles.priceComparisonTitle}>
                      Prix pour "{selectedItemForAdd.name}"
                    </Text>
                  </View>
                  <View style={styles.priceList}>
                    {selectedItemForAdd.prices.map((priceInfo, index) => {
                      const isSelected = selectedStore?.storeName === priceInfo.storeName && selectedStore?.price === priceInfo.price;
                      const isBest = priceInfo.price === selectedItemForAdd.minPrice;
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.priceItem,
                            isSelected && styles.priceItemSelected,
                            isBest && styles.priceItemBest,
                          ]}
                          onPress={() => setSelectedStore({storeName: priceInfo.storeName, price: priceInfo.price, currency: priceInfo.currency})}
                          activeOpacity={0.7}>
                          {isBest && (
                            <View style={styles.bestPriceBadge}>
                              <Text style={styles.bestPriceText}>Meilleur prix</Text>
                            </View>
                          )}
                          <View style={styles.priceItemContent}>
                            <View style={styles.priceStoreInfo}>
                              <Text style={[
                                styles.priceStoreName,
                                isSelected && styles.priceStoreNameSelected
                              ]}>{priceInfo.storeName}</Text>
                              <Text style={styles.priceCurrency}>{priceInfo.currency}</Text>
                            </View>
                            <View style={styles.priceAmountContainer}>
                              <Text style={[
                                styles.priceAmount,
                                isBest && styles.priceAmountBest,
                              ]}>
                                {formatCurrency(priceInfo.price, priceInfo.currency)}
                              </Text>
                              {isSelected && (
                                <View style={styles.selectedCheck}>
                                  <Icon name="check" size="xs" color={Colors.white} />
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Add Button */}
              <View style={styles.addItemButtonContainer}>
                <Button
                  title="Ajouter à ma liste"
                  onPress={handleAddItem}
                  disabled={!newItemName.trim() || isCreating}
                  loading={isCreating}
                  icon={<Icon name="plus" size="sm" color={Colors.white} />}
                  iconPosition="left"
                  fullWidth
                />
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </RNModal>

      {/* Edit List Name Modal */}
      <RNModal
        isVisible={showEditNameModal}
        onBackdropPress={() => {
          setShowEditNameModal(false);
          setEditedListName('');
        }}
        onBackButtonPress={() => {
          setShowEditNameModal(false);
          setEditedListName('');
        }}
        backdropOpacity={0.25}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver={true}
        hideModalContentWhileAnimating={true}
        style={styles.modal}>
        {Platform.OS === 'ios' ? (
          <BlurView style={styles.overlay} blurType="dark" blurAmount={10}>
            <Animated.View style={[styles.androidOverlay, { opacity: editNameFadeAnim }]} />
            <View style={styles.overlayContent}>
              <TouchableOpacity
                style={styles.overlayTouchable}
                activeOpacity={1}
                onPress={() => {
                  setShowEditNameModal(false);
                  setEditedListName('');
                }}
              />
              <Animated.View
                style={[
                  styles.modalContent,
                  {
                    paddingBottom: insets.bottom + Spacing.lg,
                    transform: [
                      { translateY: editNameSlideAnim },
                      { scale: editNameScaleAnim },
                    ],
                  }
                ]}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.headerDrag} />
                  <View style={styles.headerTop}>
                    <View style={styles.headerContent}>
                      <Text style={styles.modalHeaderTitle}>Modifier le nom</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => {
                        setShowEditNameModal(false);
                        setEditedListName('');
                      }}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                      <Icon name="x" size="md" color={Colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled>
                  <View style={styles.editNameContent}>
                    <Input
                      label="Nom de la liste"
                      value={editedListName}
                      onChangeText={setEditedListName}
                      placeholder="Ex: Courses de la semaine..."
                      leftIcon="edit-2"
                      autoFocus
                    />

                    <View style={styles.addItemButtonContainer}>
                      <Button
                        title="Enregistrer"
                        onPress={handleUpdateListName}
                        disabled={!editedListName.trim() || isCreating}
                        loading={isCreating}
                        icon={<Icon name="check" size="sm" color={Colors.white} />}
                        iconPosition="left"
                        fullWidth
                      />
                    </View>
                  </View>
                </ScrollView>
              </Animated.View>
            </View>
          </BlurView>
        ) : (
          <Animated.View style={[styles.androidOverlay, { opacity: editNameFadeAnim }]} />
        )}
        <View style={styles.overlayContent}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => {
              setShowEditNameModal(false);
              setEditedListName('');
            }}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                paddingBottom: insets.bottom + Spacing.lg,
                transform: [
                  { translateY: editNameSlideAnim },
                  { scale: editNameScaleAnim },
                ],
              }
            ]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerDrag} />
              <View style={styles.headerTop}>
                <View style={styles.headerContent}>
                  <Text style={styles.modalHeaderTitle}>Modifier le nom</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                        setShowEditNameModal(false);
                        setEditedListName('');
                      }}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                      <Icon name="x" size="md" color={Colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled>
                  <View style={styles.editNameContent}>
                    <Input
                      label="Nom de la liste"
                      value={editedListName}
                      onChangeText={setEditedListName}
                      placeholder="Ex: Courses de la semaine..."
                      leftIcon="edit-2"
                      autoFocus
                    />

                    <View style={styles.addItemButtonContainer}>
                      <Button
                        title="Enregistrer"
                        onPress={handleUpdateListName}
                        disabled={!editedListName.trim() || isCreating}
                        loading={isCreating}
                        icon={<Icon name="check" size="sm" color={Colors.white} />}
                        iconPosition="left"
                        fullWidth
                      />
                    </View>
                  </View>
                </ScrollView>
              </Animated.View>
            </View>
          </RNModal>
    </View>
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
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    gap: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  
  // Progress
  progressContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },

  // Budget Summary Bar
  budgetSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.cream,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.lg,
    flexWrap: 'wrap',
  },
  budgetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  budgetLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  budgetValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  savingsValue: {
    color: Colors.status.success,
  },

  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  
  // Empty state
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  emptyIllustration: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
  },
  emptyText: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  emptySubtext: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  emptyAddButton: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  emptyAddButtonGradient: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyAddButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  itemsList: {
    padding: Spacing.lg,
    paddingBottom: 200,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xs,
    ...Shadows.sm,
  },
  itemCardChecked: {
    backgroundColor: Colors.card.cream,
    opacity: 0.8,
  },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    borderWidth: 2,
    borderColor: Colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  checkBoxChecked: {
    backgroundColor: Colors.status.success,
    borderColor: Colors.status.success,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    flex: 1,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: Colors.text.tertiary,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  itemStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  storeIconBadge: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  estimatedBadge: {
    backgroundColor: Colors.card.yellow,
  },
  noPriceBadge: {
    backgroundColor: Colors.card.cream,
  },
  storeName: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
    flex: 1,
  },
  storeNameEstimated: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  noPriceText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  unitPriceLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.status.success,
  },
  lineTotalPrice: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  estimatedPrice: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  lineTotalEstimated: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    gap: Spacing.xs,
  },
  quantityButton: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.white,
    minWidth: 24,
    textAlign: 'center',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.cream,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  itemPrice: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
  },
  estimatedPriceBadge: {
    backgroundColor: Colors.card.yellow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  itemEstimatedPrice: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    gap: 4,
  },
  savingsText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.status.success,
  },
  statusIndicator: {
    padding: Spacing.xs,
  },
  statusIndicatorChecked: {
    opacity: 0.8,
  },
  totalSummaryCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  storeBreakdownSection: {
    marginBottom: Spacing.md,
  },
  storeBreakdownTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  storeBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  storeBreakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  storeBreakdownIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeBreakdownName: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  storeBreakdownCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  storeBreakdownTotal: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: Spacing.md,
  },
  totalSummaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  totalSubLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  totalTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  totalAmount: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  savingsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  savingsSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  savingsSummaryLabel: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
  },
  savingsSummaryAmount: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.status.success,
  },
  floatingButton: {
    position: 'absolute',
    right: Spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    ...Shadows.xl,
  },
  floatingButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal styles
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  modalInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.white,
  },
  // New styles for simplified Add Item Modal
  addItemModalContent: {
    minHeight: 500,
  },
  addItemSearchSection: {
    marginBottom: Spacing.lg,
  },
  searchInputContainer: {
    marginBottom: Spacing.md,
  },
  quantitySelector: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
  },
  quantitySelectorLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  quantitySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  quantityBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityDisplay: {
    minWidth: 60,
    alignItems: 'center',
  },
  quantityNumber: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  searchResultsContainer: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  searchResultsTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  // RNModal styles
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  androidOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    minHeight: 300,
    ...Shadows.xl,
  },
  modalHeader: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerDrag: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border.light,
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  headerContent: {
    flex: 1,
  },
  modalHeaderTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    maxHeight: '100%',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  searchResultContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  searchResultPrice: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
  },
  searchResultStats: {
    alignItems: 'flex-end',
  },
  searchResultStores: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  searchResultItemSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  searchingText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  priceComparisonContainer: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  priceComparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  priceComparisonTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  priceList: {
    gap: Spacing.sm,
  },
  priceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  priceItemSelected: {
    backgroundColor: Colors.primary,
  },
  priceItemBest: {
    borderWidth: 2,
    borderColor: Colors.status.success,
  },
  bestPriceBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.status.success,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bestPriceText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  priceItemContent: {
    flex: 1,
  },
  priceStoreInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  priceStoreName: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  priceStoreNameSelected: {
    color: Colors.white,
  },
  priceCurrency: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  priceAmountContainer: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.status.success,
  },
  priceAmountBest: {
    color: Colors.white,
  },
  selectedCheck: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemButtonContainer: {
    marginTop: Spacing.lg,
  },
  editNameContent: {
    paddingVertical: Spacing.lg,
  },
});
