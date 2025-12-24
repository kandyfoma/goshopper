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
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {firebase} from '@react-native-firebase/functions';
import {RootStackParamList} from '@/shared/types';
import {useAuth, useUser} from '@/shared/contexts';
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
import {Icon, Spinner, Modal, SwipeToDelete, FadeIn, SlideIn, Input, Button} from '@/shared/components';
import {formatCurrency} from '@/shared/utils/helpers';

type RouteParams = RouteProp<RootStackParamList, 'ShoppingListDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Community item from search
interface CommunityItemData {
  id: string;
  name: string;
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
        // Filter items by search query
        const filtered = data.items.filter(item =>
          item.name.toLowerCase().includes(query.toLowerCase())
        );
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
              <Text
                style={[
                  styles.itemName,
                  item.isChecked && styles.itemNameChecked,
                ]}>
                {item.name}
              </Text>
              <View style={styles.itemDetails}>
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

                {/* Price badges */}
                {item.bestPrice && item.bestStore && (
                  <View style={styles.priceBadge}>
                    <Icon name="tag" size="xs" color={Colors.status.success} />
                    <Text style={styles.itemPrice}>
                      ${item.bestPrice.toFixed(2)} @ {item.bestStore}
                    </Text>
                  </View>
                )}
                {item.estimatedPrice && !item.bestPrice && (
                  <View style={styles.estimatedPriceBadge}>
                    <Text style={styles.itemEstimatedPrice}>
                      ~${item.estimatedPrice.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Savings indicator */}
              {item.bestPrice && item.estimatedPrice && item.estimatedPrice > item.bestPrice && (
                <View style={styles.savingsBadge}>
                  <Icon name="trending-down" size="xs" color={Colors.status.success} />
                  <Text style={styles.savingsText}>
                    Économie: ${(item.estimatedPrice - item.bestPrice).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            {/* Status indicator */}
            <View style={[
              styles.statusIndicator,
              item.isChecked && styles.statusIndicatorChecked,
            ]}>
              <Icon
                name={item.isChecked ? 'check-circle' : 'circle'}
                size="md"
                color={item.isChecked ? Colors.status.success : Colors.border.medium}
              />
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

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <FadeIn duration={300}>
        <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="chevron-left" size="md" color={Colors.text.primary} />
          </TouchableOpacity>
          
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
            keyExtractor={item => item.id}
            contentContainerStyle={styles.itemsList}
            showsVerticalScrollIndicator={false}
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
              <View style={styles.totalSummaryContent}>
                <Text style={styles.totalTitle}>Total</Text>
                {(() => {
                  let totalUSD = 0;

                  list.items.forEach(item => {
                    if (item.bestPrice) {
                      totalUSD += item.bestPrice * (item.quantity || 1);
                    }
                  });

                  return (
                    <Text style={styles.totalAmount}>
                      ${totalUSD.toFixed(2)}
                    </Text>
                  );
                })()}
              </View>
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
      <Modal
        visible={showAddItemModal}
        variant="bottom-sheet"
        size="large"
        title="Ajouter Article"
        contentStyle={styles.addItemModalContent}
        onClose={() => {
          setShowAddItemModal(false);
          setNewItemName('');
          setNewItemQuantity('1');
          setSearchResults([]);
          setSelectedItemForAdd(null);
          setSelectedStore(null);
        }}>
        {/* Search input row with quantity dropdown - same line */}
        <View style={styles.addItemRow}>
          <View style={styles.searchInputContainer}>
            <Input
              label="Rechercher un article"
              value={newItemName}
              onChangeText={(text) => {
                setNewItemName(text);
                setSelectedItemForAdd(null); // Reset selection when typing
              }}
              placeholder="Ex: Sucre, Riz, Huile..."
              leftIcon="search"
            />
          </View>
          
          {/* Quantity Dropdown */}
          <View style={styles.quantityDropdownContainer}>
            <View style={styles.quantityDropdown}>
              <TouchableOpacity
                style={styles.quantityDropdownButton}
                onPress={() =>
                  setNewItemQuantity(
                    String(Math.max(1, parseInt(newItemQuantity) - 1)),
                  )
                }>
                <Icon name="minus" size="xs" color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.quantityDropdownValue}>{newItemQuantity}</Text>
              <TouchableOpacity
                style={styles.quantityDropdownButton}
                onPress={() =>
                  setNewItemQuantity(String(parseInt(newItemQuantity) + 1))
                }>
                <Icon name="plus" size="xs" color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Search Results - Show while typing */}
        {searchResults.length > 0 && !selectedItemForAdd && (
          <View style={styles.searchResultsContainer}>
            <Text style={styles.searchResultsTitle}>Articles trouvés ({searchResults.length})</Text>
            <ScrollView style={styles.searchResultsScroll} nestedScrollEnabled showsVerticalScrollIndicator>
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectSearchResult(item)}>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultStats}>
                      {item.storeCount} magasins • {formatCurrency(item.minPrice, item.currency)} - {formatCurrency(item.maxPrice, item.currency)}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Loading indicator while searching */}
        {isSearching && (
          <View style={styles.searchingIndicator}>
            <Spinner size="small" color={Colors.primary} />
            <Text style={styles.searchingText}>Recherche en cours...</Text>
          </View>
        )}

        {/* Selected Item Price Comparison */}
        {selectedItemForAdd && (
          <View style={styles.priceComparisonContainer}>
            <Text style={styles.priceComparisonTitle}>Choisir un magasin</Text>
            <ScrollView style={styles.priceList} nestedScrollEnabled>
              {selectedItemForAdd.prices
                .sort((a, b) => a.price - b.price)
                .slice(0, 5)
                .map((priceInfo, index) => {
                  const isSelected = selectedStore?.storeName === priceInfo.storeName && selectedStore?.price === priceInfo.price;
                  return (
                    <TouchableOpacity
                      key={`${priceInfo.storeName}-${index}`}
                      style={[
                        styles.priceItem,
                        isSelected && styles.priceItemSelected
                      ]}
                      onPress={() => setSelectedStore({
                        storeName: priceInfo.storeName,
                        price: priceInfo.price,
                        currency: priceInfo.currency
                      })}>
                      <View style={styles.priceRank}>
                        <Text style={styles.priceRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.priceStoreInfo}>
                        <Text style={[
                          styles.priceStoreName,
                          isSelected && styles.priceStoreNameSelected
                        ]}>{priceInfo.storeName}</Text>
                        <Text style={styles.priceCurrency}>{priceInfo.currency}</Text>
                      </View>
                      <Text style={[
                        styles.priceAmount,
                        index === 0 && styles.priceAmountBest,
                        isSelected && styles.priceAmountSelected
                      ]}>
                        {formatCurrency(priceInfo.price, priceInfo.currency)}
                      </Text>
                      {isSelected && (
                        <Icon name="check" size="sm" color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        )}

        {/* Add Button */}
        <View style={styles.addItemButtonContainer}>
          <Button
            title="Ajouter"
            onPress={handleAddItem}
            disabled={!newItemName.trim() || isCreating}
            loading={isCreating}
            icon={<Icon name="plus" size="sm" color={Colors.white} />}
            iconPosition="left"
            fullWidth
          />
        </View>
      </Modal>

      {/* Edit List Name Modal */}
      <Modal
        title="Modifier le nom"
        visible={showEditNameModal}
        onClose={() => {
          setShowEditNameModal(false);
          setEditedListName('');
        }}>
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
            disabled={!editedListName.trim()}
            icon={<Icon name="check" size="sm" color={Colors.white} />}
            iconPosition="left"
            fullWidth
          />
        </View>
      </Modal>
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
    marginBottom: Spacing.sm,
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
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: Colors.text.tertiary,
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
    color: Colors.text.secondary,
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
  totalSummaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    color: Colors.text.primary,
  },
  // Add Item Modal
  addItemModalContent: {
    minHeight: 450,
    maxHeight: '90%',
  },
  searchResultsContainer: {
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    maxHeight: 300,
  },
  searchResultsScroll: {
    maxHeight: 240,
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
  searchResultsTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  searchResultStats: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  priceComparisonContainer: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  priceComparisonTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  priceList: {
    maxHeight: 200,
  },
  priceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  priceItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF5F5',
  },
  priceRank: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  priceRankText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  priceStoreInfo: {
    flex: 1,
  },
  priceStoreName: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  priceStoreNameSelected: {
    color: Colors.primary,
  },
  priceCurrency: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  priceAmount: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  priceAmountBest: {
    color: Colors.status.success,
  },
  priceAmountSelected: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  quantitySection: {
    marginBottom: Spacing.lg,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  quantityButtonModal: {
    width: 48,
    height: 48,
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInputContainer: {
    backgroundColor: Colors.card.yellow,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  quantityInput: {
    width: 50,
    textAlign: 'center',
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.card.blue,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },
  modalCreateButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  modalCreateButtonDisabled: {
    backgroundColor: Colors.border.light,
  },
  modalCreateText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  // New styles for simplified Add Item Modal
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchInputContainer: {
    flex: 1,
  },
  quantityDropdownContainer: {
    justifyContent: 'flex-end',
  },
  quantityDropdownLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  quantityDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.base,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    height: 48,
    paddingHorizontal: Spacing.xs,
  },
  quantityDropdownButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityDropdownValue: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    minWidth: 28,
    textAlign: 'center',
  },
  addItemButtonContainer: {
    marginTop: Spacing.lg,
  },
});
