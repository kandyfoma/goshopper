// Shopping List Screen - Smart shopping with price optimization
import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
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
import {useAuth} from '@/shared/contexts';
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
import {Icon, Spinner} from '@/shared/components';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export function ShoppingListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();

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
    if (!user?.uid) return;

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
    if (!user?.uid) return;

    try {
      const items = await shoppingListService.getQuickSuggestions(user.uid);
      setSuggestions(items);
    } catch (error) {
      console.error('Load suggestions error:', error);
    }
  };

  const handleCreateList = useCallback(async () => {
    if (!user?.uid || !newListName.trim()) return;

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
    if (!user?.uid || !selectedList || !newItemName.trim()) return;

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
    } catch (error) {
      console.error('Add item error:', error);
      Alert.alert('Erreur', "Impossible d'ajouter l'article");
    } finally {
      setIsCreating(false);
    }
  }, [user?.uid, selectedList, newItemName, newItemQuantity]);

  const handleToggleItem = useCallback(
    async (itemId: string) => {
      if (!user?.uid || !selectedList) return;

      try {
        await shoppingListService.toggleItem(user.uid, selectedList.id, itemId);

        // Update local state
        setSelectedList(prev => {
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
    [user?.uid, selectedList],
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if (!user?.uid || !selectedList) return;

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
    [user?.uid, selectedList],
  );

  const handleOptimize = useCallback(async () => {
    if (!user?.uid || !selectedList) return;

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

  const renderItem = ({item, index}: {item: ShoppingListItem; index: number}) => {
    const itemAnim = new Animated.Value(1);
    
    return (
      <Animated.View
        style={[
          styles.itemCard,
          item.isChecked && styles.itemCardChecked,
          {
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
          },
        ]}>
        <TouchableOpacity
          style={[styles.checkBox, item.isChecked && styles.checkBoxChecked]}
          onPress={() => handleToggleItem(item.id)}
          activeOpacity={0.7}>
          {item.isChecked && (
            <Icon name="check" size="sm" color={Colors.white} />
          )}
        </TouchableOpacity>

        <View style={styles.itemInfo}>
          <Text
            style={[styles.itemName, item.isChecked && styles.itemNameChecked]}>
            {item.name}
          </Text>
          <View style={styles.itemDetails}>
            <View style={styles.quantityBadge}>
              <Text style={styles.itemQuantity}>x{item.quantity}</Text>
            </View>
            {item.bestPrice && (
              <View style={styles.priceBadge}>
                <Icon name="tag" size="xs" color={Colors.status.success} />
                <Text style={styles.itemPrice}>
                  ${item.bestPrice.toFixed(2)} @ {item.bestStore}
                </Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.id)}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="x" size="sm" color={Colors.text.tertiary} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (isLoading && lists.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Spinner size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="chevron-left" size="md" color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liste de Courses</Text>
        <TouchableOpacity
          style={styles.newListHeaderButton}
          onPress={() => setShowNewListModal(true)}>
          <Icon name="plus" size="sm" color={Colors.primary} />
        </TouchableOpacity>
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
                colors={[Colors.card.green, '#B8D9B0']}
                style={styles.savingsGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <View style={styles.savingsIconContainer}>
                  <Icon name="trending-down" size="lg" color={Colors.status.success} />
                </View>
                <View style={styles.savingsInfo}>
                  <Text style={styles.savingsTitle}>Économies potentielles</Text>
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

          {/* Store Recommendations */}
          {selectedList.optimizedStores.length > 0 && (
            <View style={styles.storesCard}>
              <View style={styles.storesHeader}>
                <Icon name="store" size="md" color={Colors.text.primary} />
                <Text style={styles.storesTitle}>Magasins recommandés</Text>
              </View>
              {selectedList.optimizedStores.slice(0, 3).map((store, index) => (
                <View key={store.storeNameNormalized} style={styles.storeRow}>
                  <View style={styles.storeRank}>
                    <Text style={styles.storeRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName}>{store.storeName}</Text>
                    <Text style={styles.storeItems}>
                      {store.itemCount} articles
                    </Text>
                  </View>
                  <Text style={styles.storePrice}>
                    ${store.totalPrice.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Items List */}
          {selectedList.items.length === 0 ? (
            <View style={styles.emptyList}>
              <View style={styles.emptyIconContainer}>
                <Icon name="shopping-cart" size="3xl" color={Colors.text.tertiary} />
              </View>
              <Text style={styles.emptyText}>Liste vide</Text>
              <Text style={styles.emptySubtext}>
                Ajoutez des articles à votre liste
              </Text>
            </View>
          ) : (
            <FlatList
              data={selectedList.items}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.itemsList}
              showsVerticalScrollIndicator={false}
            />
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

      {/* New List Modal */}
      <Modal
        visible={showNewListModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewListModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {paddingBottom: insets.bottom + Spacing.lg}]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nouvelle Liste</Text>

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
          </View>
        </View>
      </Modal>

      {/* Add Item Modal */}
      <Modal
        visible={showAddItemModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddItemModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {paddingBottom: insets.bottom + Spacing.lg}]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Ajouter Article</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nom de l'article</Text>
              <View style={styles.inputWrapper}>
                <Icon name="tag" size="sm" color={Colors.text.tertiary} />
                <TextInput
                  style={styles.modalInput}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="Ex: Sucre, Riz, Huile..."
                  placeholderTextColor={Colors.text.tertiary}
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.quantitySection}>
              <Text style={styles.inputLabel}>Quantité</Text>
              <View style={styles.quantityContainer}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() =>
                    setNewItemQuantity(
                      String(Math.max(1, parseInt(newItemQuantity) - 1)),
                    )
                  }>
                  <Icon name="minus" size="sm" color={Colors.primary} />
                </TouchableOpacity>
                <View style={styles.quantityInputContainer}>
                  <TextInput
                    style={styles.quantityInput}
                    value={newItemQuantity}
                    onChangeText={setNewItemQuantity}
                    keyboardType="number-pad"
                  />
                </View>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() =>
                    setNewItemQuantity(String(parseInt(newItemQuantity) + 1))
                  }>
                  <Icon name="plus" size="sm" color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowAddItemModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalCreateButton,
                  !newItemName.trim() && styles.modalCreateButtonDisabled,
                ]}
                onPress={handleAddItem}
                disabled={!newItemName.trim() || isCreating}>
                {isCreating ? (
                  <Spinner size="small" color={Colors.white} />
                ) : (
                  <>
                    <Icon name="plus" size="sm" color={Colors.white} />
                    <Text style={styles.modalCreateText}>Ajouter</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  newListHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: Colors.text.secondary,
  },
  listTabTextActive: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  listTabCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
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
    backgroundColor: Colors.card.green,
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
    color: Colors.text.secondary,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.green,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.border.light,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
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
});
