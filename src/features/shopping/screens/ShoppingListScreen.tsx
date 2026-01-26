// Shopping List Screen - Smart shopping with price optimization
// @deprecated - This screen will be replaced by ShoppingListsScreen + ShoppingListDetailScreen
// Use navigation.navigate('ShoppingLists') instead
import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth, useUser, useScroll} from '@/shared/contexts';
import {firebase} from '@react-native-firebase/functions';
import {
  shoppingListService,
  ShoppingList,
  ShoppingListItem,
  OptimizationResult,
} from '@/shared/services/firebase';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Spinner, Modal, SwipeToDelete, Input, Button, AppLoader} from '@/shared/components';
import {formatCurrency, getExchangeRate} from '@/shared/utils/helpers';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// Community item from search
interface CommunityItemData {
  id: string;
  name: string;
  prices: {
    storeName: string;
    price: number;
    currency: string;
    date: Date | any;
  }[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  currency: string;
}

export function ShoppingListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();
  const {profile: userProfile} = useUser();
  const {scrollY} = useScroll();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Don't render anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [isCreating, setIsCreating] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(
    null,
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Community item search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CommunityItemData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItemForAdd, setSelectedItemForAdd] = useState<CommunityItemData | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Load shopping lists
  useEffect(() => {
    loadLists();
    loadSuggestions();
  }, [user?.uid]);

  const loadLists = async () => {
    if (!user?.uid) {return;}

    try {
      const loadedLists = await shoppingListService.getLists(user.uid);
      setLists(loadedLists);

      if (loadedLists.length > 0 && !selectedList) {
        setSelectedList(loadedLists[0]);
      }
    } catch (error) {
      console.error('Load lists error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuggestions = async () => {
    if (!user?.uid) {return;}

    try {
      const items = await shoppingListService.getQuickSuggestions(user.uid);
      setSuggestions(items);
    } catch (error) {
      console.error('Load suggestions error:', error);
    }
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

  const handleCreateList = useCallback(async () => {
    if (!user?.uid || !newListName.trim()) {return;}

    setIsCreating(true);
    try {
      const list = await shoppingListService.createList(
        user.uid,
        newListName.trim(),
      );
      setLists(prev => [list, ...prev]);
      setSelectedList(list);
      setShowNewListModal(false);
      setNewListName('');
    } catch (error) {
      console.error('Create list error:', error);
      Alert.alert('Erreur', 'Impossible de créer la liste');
    } finally {
      setIsCreating(false);
    }
  }, [user?.uid, newListName]);

  const handleAddItem = useCallback(async () => {
    if (!user?.uid || !selectedList || !newItemName.trim()) {return;}

    setIsCreating(true);
    try {
      const item = await shoppingListService.addItem(
        user.uid,
        selectedList.id,
        {
          name: newItemName.trim(),
          quantity: parseInt(newItemQuantity) || 1,
        },
      );

      // Refresh list
      const updatedList = await shoppingListService.getList(
        user.uid,
        selectedList.id,
      );
      if (updatedList) {
        setSelectedList(updatedList);
        setLists(prev =>
          prev.map(l => (l.id === updatedList.id ? updatedList : l)),
        );
      }

      setShowAddItemModal(false);
      setNewItemName('');
      setNewItemQuantity('1');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedItemForAdd(null);
    } catch (error) {
      console.error('Add item error:', error);
      Alert.alert('Erreur', "Impossible d'ajouter l'article");
    } finally {
      setIsCreating(false);
    }
  }, [user?.uid, selectedList, newItemName, newItemQuantity]);
  
  const handleSelectSearchResult = useCallback((item: CommunityItemData) => {
    setSelectedItemForAdd(item);
    setNewItemName(item.name);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const handleToggleItem = useCallback(
    async (itemId: string) => {
      if (!user?.uid || !selectedList) {return;}

      try {
        await shoppingListService.toggleItem(user.uid, selectedList.id, itemId);

        // Update local state
        setSelectedList(prev => {
          if (!prev) {return prev;}
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
    [user?.uid, selectedList],
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if (!user?.uid || !selectedList) {return;}

      Alert.alert('Supprimer ?', 'Supprimer cet article de la liste ?', [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await shoppingListService.removeItem(
                user.uid,
                selectedList.id,
                itemId,
              );

              setSelectedList(prev => {
                if (!prev) {return prev;}
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
    [user?.uid, selectedList],
  );

  const handleOptimize = useCallback(async () => {
    if (!user?.uid || !selectedList) {return;}

    setIsLoading(true);
    try {
      const result = await shoppingListService.optimizeList(
        user.uid,
        selectedList.id,
      );
      setOptimization(result);

      // Refresh list
      const updatedList = await shoppingListService.getList(
        user.uid,
        selectedList.id,
      );
      if (updatedList) {
        setSelectedList(updatedList);
      }
    } catch (error) {
      console.error('Optimize error:', error);
      Alert.alert('Erreur', "Impossible d'optimiser la liste");
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, selectedList]);

  const handleAddSuggestion = useCallback((itemName: string) => {
    setNewItemName(itemName);
    setShowAddItemModal(true);
  }, []);

  const renderItem = ({
    item,
    index,
  }: {
    item: ShoppingListItem;
    index: number;
  }) => {
    const itemAnim = new Animated.Value(1);

    return (
      <Animated.View
        style={[
          {
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
          },
        ]}>
        <SwipeToDelete
          onDelete={() => handleRemoveItem(item.id)}
          deleteLabel="Supprimer"
          style={{marginBottom: Spacing.sm}}>
          <Animated.View
            style={[
              styles.itemCard,
              item.isChecked && styles.itemCardChecked,
            ]}>
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
                <View style={styles.quantityBadge}>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                </View>
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
              
              {/* Price range if available */}
              {item.bestPrice && item.estimatedPrice && item.estimatedPrice > item.bestPrice && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>
                    Économie: ${(item.estimatedPrice - item.bestPrice).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleToggleItem(item.id)}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon
                name={item.isChecked ? 'check-circle' : 'circle'}
                size="md"
                color={item.isChecked ? Colors.status.success : Colors.text.tertiary}
              />
            </TouchableOpacity>
          </Animated.View>
        </SwipeToDelete>
      </Animated.View>
    );
  };

  if (isLoading && lists.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <AppLoader size="large" message="Chargement..." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="chevron-left" size="md" color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liste de Courses</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* List Selector */}
      {lists.length > 0 && (
        <Animated.ScrollView
          horizontal
          style={[styles.listSelector, {opacity: fadeAnim}]}
          contentContainerStyle={styles.listSelectorContent}
          showsHorizontalScrollIndicator={false}>
          {lists.map((list, index) => (
            <TouchableOpacity
              key={list.id}
              style={[
                styles.listTab,
                selectedList?.id === list.id && styles.listTabActive,
              ]}
              onPress={() => setSelectedList(list)}
              activeOpacity={0.8}>
              {selectedList?.id === list.id ? (
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  style={styles.listTabGradient}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}>
                  <Text style={styles.listTabTextActive}>{list.name}</Text>
                  <Text style={styles.listTabCountActive}>
                    {list.items.length} articles
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.listTabContent}>
                  <Text style={styles.listTabText}>{list.name}</Text>
                  <Text style={styles.listTabCount}>
                    {list.items.length} articles
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </Animated.ScrollView>
      )}

      {/* Selected List Content */}
      {selectedList ? (
        <Animated.View
          style={[
            styles.listContent,
            {
              opacity: fadeAnim,
              transform: [{translateY: slideAnim}],
            },
          ]}>
          {/* Savings Info */}
          {selectedList.potentialSavings > 0 && (
            <View style={styles.savingsCard}>
              <LinearGradient
                colors={[Colors.card.cream, '#F5E6C3']}
                style={styles.savingsGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <View style={styles.savingsIconContainer}>
                  <Icon
                    name="trending-down"
                    size="lg"
                    color={Colors.status.success}
                  />
                </View>
                <View style={styles.savingsInfo}>
                  <Text style={styles.savingsTitle}>
                    Économies potentielles
                  </Text>
                  <Text style={styles.savingsAmount}>
                    ${selectedList.potentialSavings.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.optimizeButton}
                  onPress={handleOptimize}
                  activeOpacity={0.9}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    style={styles.optimizeButtonGradient}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}>
                    <Icon name="zap" size="sm" color={Colors.white} />
                    <Text style={styles.optimizeButtonText}>Optimiser</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}

          {/* Items List */}
          {selectedList.items.length === 0 ? (
            <View style={styles.emptyList}>
              <View style={styles.emptyIconContainer}>
                <Icon
                  name="shopping-cart"
                  size="3xl"
                  color={Colors.text.tertiary}
                />
              </View>
              <Text style={styles.emptyText}>Liste vide</Text>
              <Text style={styles.emptySubtext}>
                Ajoutez des articles à votre liste
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={selectedList.items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.itemsList}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: false})}
                scrollEventThrottle={16}
              />
              
              {/* Total Price Summary */}
              <View style={styles.totalSummaryCard}>
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  style={styles.totalSummaryGradient}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}>
                  <View style={styles.totalHeader}>
                    <Icon name="shopping-cart" size="md" color={Colors.white} />
                    <Text style={styles.totalTitle}>Total à payer</Text>
                  </View>
                  
                  {(() => {
                    let totalUSD = 0;
                    let totalCDF = 0;
                    const exchangeRate = getExchangeRate(); // Get dynamic rate from globalSettings
                    
                    selectedList.items.forEach(item => {
                      const price = item.bestPrice || item.estimatedPrice || 0;
                      const quantity = item.quantity || 1;
                      
                      if (item.bestPrice && price > 0) {
                        // Use the currency from best price if available
                        const currencyFromBest = selectedList.items.find(i => i.id === item.id)?.bestStore;
                        // For now, assume USD if we have best price
                        totalUSD += price * quantity;
                      } else if (item.estimatedPrice && item.estimatedPrice > 0) {
                        totalUSD += item.estimatedPrice * quantity;
                      }
                    });
                    
                    totalCDF = totalUSD * exchangeRate;
                    
                    return (
                      <>
                        <View style={styles.totalRow}>
                          <Text style={styles.totalCurrency}>USD</Text>
                          <Text style={styles.totalAmount}>
                            ${totalUSD.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.totalDivider} />
                        <View style={styles.totalRow}>
                          <Text style={styles.totalCurrency}>CDF</Text>
                          <Text style={styles.totalAmount}>
                            {totalCDF.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC
                          </Text>
                        </View>
                        <View style={styles.totalItemsCount}>
                          <Text style={styles.totalItemsText}>
                            {selectedList.items.length} article{selectedList.items.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </LinearGradient>
              </View>
            </>
          )}

          {/* Quick Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Suggestions rapides</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suggestions.slice(0, 8).map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionChip}
                    onPress={() => handleAddSuggestion(item)}
                    activeOpacity={0.7}>
                    <Icon name="plus" size="xs" color={Colors.primary} />
                    <Text style={styles.suggestionText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Add Item Button */}
          <TouchableOpacity
            style={[styles.addItemButton, {bottom: insets.bottom + Spacing.lg}]}
            onPress={() => setShowAddItemModal(true)}
            activeOpacity={0.9}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.addItemButtonGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <Icon name="plus" size="md" color={Colors.white} />
              <Text style={styles.addItemButtonText}>Ajouter un article</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.noListContainer,
            {
              opacity: fadeAnim,
              transform: [{translateY: slideAnim}],
            },
          ]}>
          <View style={styles.noListIconContainer}>
            <Icon name="clipboard" size="3xl" color={Colors.text.tertiary} />
          </View>
          <Text style={styles.noListTitle}>Aucune liste</Text>
          <Text style={styles.noListText}>
            Créez votre première liste de courses
          </Text>
          <TouchableOpacity
            style={styles.createFirstButton}
            onPress={() => setShowNewListModal(true)}
            activeOpacity={0.9}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.createFirstButtonGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <Icon name="plus" size="md" color={Colors.white} />
              <Text style={styles.createFirstButtonText}>Créer une liste</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.quickActionsTitle}>Actions rapides</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Main', {screen: 'Stats'})}
            activeOpacity={0.7}>
            <View style={[styles.quickActionIconContainer, {backgroundColor: Colors.primary + '15'}]}>
              <Icon name="bar-chart" size="md" color={Colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Statistiques</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Main', {screen: 'Shops'})}
            activeOpacity={0.7}>
            <View style={[styles.quickActionIconContainer, {backgroundColor: Colors.primary + '15'}]}>
              <Icon name="shopping-bag" size="md" color={Colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Magasins</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Main', {screen: 'Profile', params: {screen: 'AIAssistant'}})}
            activeOpacity={0.7}>
            <View style={[styles.quickActionIconContainer, {backgroundColor: Colors.primary + '15'}]}>
              <Icon name="sparkles" size="md" color={Colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Assistant IA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Main', {screen: 'Profile', params: {screen: 'Achievements'}})}
            activeOpacity={0.7}>
            <View style={[styles.quickActionIconContainer, {backgroundColor: Colors.primary + '15'}]}>
              <Icon name="trophy" size="md" color={Colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Succès</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* New List Modal */}
      <Modal
        visible={showNewListModal}
        variant="bottom-sheet"
        title="Nouvelle Liste"
        onClose={() => setShowNewListModal(false)}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Nom de la liste</Text>
          <View style={styles.inputWrapper}>
            <Icon name="list" size="sm" color={Colors.text.tertiary} />
            <TextInput
              style={styles.modalInput}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="Ex: Courses de la semaine..."
              placeholderTextColor={Colors.text.tertiary}
              autoFocus
            />
          </View>
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setShowNewListModal(false)}>
            <Text style={styles.modalCancelText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modalCreateButton,
              !newListName.trim() && styles.modalCreateButtonDisabled,
            ]}
            onPress={handleCreateList}
            disabled={!newListName.trim() || isCreating}>
            {isCreating ? (
              <Spinner size="small" color={Colors.white} />
            ) : (
              <>
                <Icon name="plus" size="sm" color={Colors.white} />
                <Text style={styles.modalCreateText}>Créer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

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
            <Text style={styles.priceComparisonTitle}>Prix dans différents magasins</Text>
            <ScrollView style={styles.priceList} nestedScrollEnabled>
              {selectedItemForAdd.prices
                .sort((a, b) => a.price - b.price)
                .slice(0, 5)
                .map((priceInfo, index) => (
                  <View key={`${priceInfo.storeName}-${index}`} style={styles.priceItem}>
                    <View style={styles.priceRank}>
                      <Text style={styles.priceRankText}>{index + 1}</Text>
                    </View>
                    <View style={styles.priceStoreInfo}>
                      <Text style={styles.priceStoreName}>{priceInfo.storeName}</Text>
                      <Text style={styles.priceCurrency}>{priceInfo.currency}</Text>
                    </View>
                    <Text style={[
                      styles.priceAmount,
                      index === 0 && styles.priceAmountBest
                    ]}>
                      {formatCurrency(priceInfo.price, priceInfo.currency)}
                    </Text>
                  </View>
                ))}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
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
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  headerSpacer: {
    width: 44,
  },
  listSelector: {
    maxHeight: 80,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  listSelectorContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  listTab: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginRight: Spacing.sm,
  },
  listTabContent: {
    backgroundColor: Colors.card.blue,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  listTabActive: {
    ...Shadows.sm,
  },
  listTabGradient: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  listTabText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  listTabTextActive: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  listTabCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  listTabCountActive: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  listContent: {
    flex: 1,
  },
  savingsCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  savingsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  savingsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  savingsInfo: {
    flex: 1,
  },
  savingsTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  savingsAmount: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.status.success,
  },
  optimizeButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  optimizeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  optimizeButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  storesCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    ...Shadows.sm,
  },
  storesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  storesTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  storeRank: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  storeRankText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  storeItems: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  storePrice: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
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
  },
  quantityBadge: {
    backgroundColor: Colors.card.blue,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  itemQuantity: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.white,
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
    backgroundColor: Colors.card.cream,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  savingsText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
  },
  // Total Summary Card
  totalSummaryCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  totalSummaryGradient: {
    padding: Spacing.lg,
  },
  totalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  totalTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  totalCurrency: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: 'rgba(255,255,255,0.8)',
  },
  totalAmount: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  totalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: Spacing.xs,
  },
  totalItemsCount: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  totalItemsText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  // Add Item Modal
  addItemModalContent: {
    minHeight: 450,
    maxHeight: '90%',
  },
  // Search Results
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
  // Price Comparison
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
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  suggestionsTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.blue,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    gap: 4,
  },
  suggestionText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.primary,
  },
  addItemButton: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  addItemButtonGradient: {
    flexDirection: 'row',
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addItemButtonText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  noListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  noListIconContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  noListTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  noListText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  createFirstButton: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  createFirstButtonGradient: {
    flexDirection: 'row',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  createFirstButtonText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
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
  quantitySection: {
    marginBottom: Spacing.lg,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  quantityButton: {
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
  quickActionsSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.white,
  },
  quickActionsTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  quickAction: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  quickActionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickActionLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    textAlign: 'center',
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
