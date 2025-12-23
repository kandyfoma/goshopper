// Shopping Lists Screen - Modern, intuitive shopping list management
import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Alert,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {RootStackParamList} from '@/shared/types';
import {useAuth, useSubscription} from '@/shared/contexts';
import {canCreateShoppingList} from '@/shared/utils/featureAccess';
import {
  shoppingListService,
  ShoppingList,
} from '@/shared/services/firebase';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Spinner, Modal, FadeIn, SlideIn} from '@/shared/components';
import {formatDate} from '@/shared/utils/helpers';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// Modern card color schemes for visual variety
const CARD_COLORS = [
  { bg: '#FDF0D5', accent: '#780000', icon: '#C1121F' },  // Cream/Gochujang
  { bg: '#E8F4FF', accent: '#003049', icon: '#669BBC' },  // Blue Marble
  { bg: '#FFF5E6', accent: '#D97706', icon: '#F59E0B' },  // Warm Orange
  { bg: '#F0FDF4', accent: '#166534', icon: '#22C55E' },  // Fresh Green
  { bg: '#FDF2F8', accent: '#9D174D', icon: '#EC4899' },  // Rose Pink
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Quick suggestions for list names
const LIST_SUGGESTIONS = [
  '🛒 Courses de la semaine',
  '🎉 Fête / Événement',
  '🏠 Produits ménagers',
  '🍳 Recette spéciale',
  '👶 Bébé / Enfants',
];

export function ShoppingListsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();
  const {subscription} = useSubscription();

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);

  // FAB animation
  const fabScale = useRef(new Animated.Value(1)).current;
  const fabRotate = useRef(new Animated.Value(0)).current;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Load lists on focus
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadLists();
      }
    }, [user?.uid])
  );

  // FAB pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(fabScale, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fabScale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const loadLists = async (showRefresh = false) => {
    if (!user?.uid) return;

    if (showRefresh) {
      setIsRefreshing(true);
    }

    try {
      const loadedLists = await shoppingListService.getLists(user.uid, false);
      setLists(loadedLists);
    } catch (error) {
      console.error('Load lists error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadLists(true);
  };

  const handleCreateList = async (name?: string) => {
    const listName = name || newListName;
    if (!user?.uid || !listName.trim()) return;

    // Check if user can create more lists (freemium: 1 list only)
    const listCheck = canCreateShoppingList(subscription, lists.length);
    if (!listCheck.canCreate) {
      Alert.alert(
        'Limite atteinte',
        listCheck.reason || 'Vous avez atteint la limite de listes',
        [
          {text: 'Annuler', style: 'cancel'},
          {text: 'Mettre à niveau', onPress: () => navigation.navigate('Subscription')},
        ]
      );
      return;
    }

    setIsCreating(true);
    try {
      const list = await shoppingListService.createList(
        user.uid,
        listName.trim(),
      );
      setLists(prev => [list, ...prev]);
      setShowNewListModal(false);
      setNewListName('');
      
      // Navigate to the new list detail
      navigation.navigate('ShoppingListDetail', {listId: list.id});
    } catch (error) {
      console.error('Create list error:', error);
      Alert.alert('Erreur', 'Impossible de créer la liste');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenNewListModal = () => {
    // Animate FAB
    Animated.sequence([
      Animated.timing(fabRotate, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fabRotate, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    setShowNewListModal(true);
  };

  const handleDeleteList = (listId: string, listName: string) => {
    Alert.alert(
      'Supprimer la liste',
      `Voulez-vous supprimer "${listName}" ?`,
      [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await shoppingListService.deleteList(user!.uid, listId);
              setLists(prev => prev.filter(l => l.id !== listId));
            } catch (error) {
              console.error('Delete list error:', error);
              Alert.alert('Erreur', 'Impossible de supprimer la liste');
            }
          },
        },
      ],
    );
  };

  const handleEditListName = async (listId: string, newName: string) => {
    if (!user?.uid || !newName.trim()) return;

    try {
      // Update in Firestore (you'll need to add this method to shoppingListService)
      await shoppingListService.updateListName(user.uid, listId, newName.trim());
      
      // Update local state
      setLists(prev =>
        prev.map(l => (l.id === listId ? {...l, name: newName.trim()} : l)),
      );
      setEditingListId(null);
    } catch (error) {
      console.error('Edit list name error:', error);
      Alert.alert('Erreur', 'Impossible de modifier le nom');
    }
  };

  const handleCompleteList = async (listId: string) => {
    if (!user?.uid) return;

    try {
      await shoppingListService.completeList(user.uid, listId);
      await loadLists(); // Reload to update status
    } catch (error) {
      console.error('Complete list error:', error);
    }
  };

  const renderListItem = ({item, index}: {item: ShoppingList; index: number}) => {
    const isEditing = editingListId === item.id;
    const itemsCount = item.items.length;
    const checkedCount = item.items.filter(i => i.isChecked).length;
    const progress = itemsCount > 0 ? checkedCount / itemsCount : 0;
    const colorScheme = CARD_COLORS[index % CARD_COLORS.length];

    return (
      <SlideIn delay={index * 50} direction="up" distance={30}>
        <TouchableOpacity
          style={[
            styles.listCard,
            {backgroundColor: colorScheme.bg},
            !item.isActive && styles.listCardCompleted,
          ]}
          onPress={() => navigation.navigate('ShoppingListDetail', {listId: item.id})}
          onLongPress={() => setEditingListId(item.id)}
          activeOpacity={0.8}>
          {/* Accent bar */}
          <View style={[styles.cardAccent, {backgroundColor: colorScheme.accent}]} />
          
          <View style={styles.cardContent}>
            <View style={styles.listHeader}>
              {/* Left: Icon + Info */}
              <View style={styles.listHeaderLeft}>
                <View style={[styles.listIconContainer, {backgroundColor: colorScheme.accent}]}>
                  <Icon 
                    name={item.isActive ? 'shopping-cart' : 'check-circle'} 
                    size="md" 
                    color={Colors.white} 
                  />
                </View>
                
                {isEditing ? (
                  <View style={styles.editNameContainer}>
                    <TextInput
                      style={[styles.editNameInput, {borderColor: colorScheme.accent}]}
                      value={item.name}
                      onChangeText={(text) => {
                        setLists(prev =>
                          prev.map(l => (l.id === item.id ? {...l, name: text} : l)),
                        );
                      }}
                      onBlur={() => handleEditListName(item.id, item.name)}
                      onSubmitEditing={() => handleEditListName(item.id, item.name)}
                      autoFocus
                    />
                  </View>
                ) : (
                  <View style={styles.listInfo}>
                    <Text style={[styles.listName, {color: colorScheme.accent}]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.listDate}>
                      {formatDate(item.updatedAt)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Right: Actions */}
              <View style={styles.listActions}>
                {!item.isActive && (
                  <View style={styles.completedBadge}>
                    <Icon name="check" size="xs" color={Colors.status.success} />
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, {backgroundColor: `${colorScheme.accent}15`}]}
                  onPress={() => handleDeleteList(item.id, item.name)}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Icon name="trash-2" size="sm" color={colorScheme.accent} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.listStats}>
              <View style={[styles.statBadge, {backgroundColor: `${colorScheme.accent}15`}]}>
                <Icon name="package" size="xs" color={colorScheme.icon} />
                <Text style={[styles.statText, {color: colorScheme.accent}]}>
                  {checkedCount}/{itemsCount}
                </Text>
              </View>

              {item.potentialSavings > 0 && (
                <View style={[styles.statBadge, {backgroundColor: '#22C55E20'}]}>
                  <Icon name="trending-down" size="xs" color={Colors.status.success} />
                  <Text style={[styles.statText, {color: Colors.status.success}]}>
                    ${item.potentialSavings.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            {/* Modern progress bar */}
            {itemsCount > 0 && (
              <View style={styles.progressSection}>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBg}>
                    <Animated.View 
                      style={[
                        styles.progressBarFill, 
                        {
                          width: `${progress * 100}%`,
                          backgroundColor: progress === 1 ? Colors.status.success : colorScheme.accent,
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.progressText, {color: colorScheme.accent}]}>
                    {Math.round(progress * 100)}%
                  </Text>
                </View>
              </View>
            )}

            {/* Preview items with modern chips */}
            {item.items.length > 0 && (
              <View style={styles.previewContainer}>
                {item.items.slice(0, 4).map((listItem, idx) => (
                  <View 
                    key={listItem.id} 
                    style={[
                      styles.previewChip,
                      listItem.isChecked && styles.previewChipChecked,
                      {borderColor: colorScheme.accent},
                    ]}>
                    <Text
                      style={[
                        styles.previewText,
                        listItem.isChecked && styles.previewTextChecked,
                      ]}
                      numberOfLines={1}>
                      {listItem.name}
                    </Text>
                  </View>
                ))}
                {item.items.length > 4 && (
                  <View style={[styles.moreChip, {backgroundColor: colorScheme.accent}]}>
                    <Text style={styles.moreChipText}>+{item.items.length - 4}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </SlideIn>
    );
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Spinner size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  const fabRotateInterpolate = fabRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '135deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <FadeIn duration={400}>
        <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="arrow-left" size="md" color={Colors.text.primary} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Mes Listes</Text>
            <Text style={styles.headerSubtitle}>
              {lists.length} liste{lists.length !== 1 ? 's' : ''}
            </Text>
          </View>
          
          <View style={styles.headerRight} />
        </View>
      </FadeIn>

      {/* Lists */}
      {lists.length === 0 ? (
        <FadeIn delay={200} duration={500}>
          <View style={styles.emptyContainer}>
            {/* Gradient illustration */}
            <LinearGradient
              colors={['#FDF0D5', '#F5E6C3']}
              style={styles.emptyIllustration}>
              <View style={styles.emptyIconOuter}>
                <LinearGradient
                  colors={['#C1121F', '#780000']}
                  style={styles.emptyIconInner}>
                  <Icon name="clipboard-list" size="xl" color={Colors.white} />
                </LinearGradient>
              </View>
            </LinearGradient>
            
            <Text style={styles.emptyTitle}>Aucune liste</Text>
            <Text style={styles.emptyText}>
              Organisez vos courses avec des listes personnalisées
            </Text>
            
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={handleOpenNewListModal}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#C1121F', '#780000']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.createFirstButtonGradient}>
                <Icon name="plus" size="md" color={Colors.white} />
                <Text style={styles.createFirstButtonText}>Créer ma première liste</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </FadeIn>
      ) : (
        <FlatList
          data={lists}
          renderItem={renderListItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
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
      )}

      {/* Floating Action Button */}
      {lists.length > 0 && (
        <Animated.View 
          style={[
            styles.fabContainer,
            {
              transform: [
                {scale: fabScale},
              ],
            },
          ]}>
          <TouchableOpacity
            onPress={handleOpenNewListModal}
            activeOpacity={0.9}>
            <LinearGradient
              colors={['#C1121F', '#780000']}
              style={styles.fab}>
              <Animated.View style={{transform: [{rotate: fabRotateInterpolate}]}}>
                <Icon name="plus" size="lg" color={Colors.white} />
              </Animated.View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* New List Modal */}
      <Modal
        visible={showNewListModal}
        variant="bottom-sheet"
        size="medium"
        title="Nouvelle Liste"
        onClose={() => {
          setShowNewListModal(false);
          setNewListName('');
        }}>
        <View style={styles.modalContent}>
          {/* Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Nom de la liste</Text>
            <View style={styles.inputWrapper}>
              <Icon name="edit-3" size="sm" color={Colors.primary} />
              <TextInput
                style={styles.modalInput}
                value={newListName}
                onChangeText={setNewListName}
                placeholder="Donnez un nom à votre liste..."
                placeholderTextColor={Colors.text.tertiary}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => handleCreateList()}
              />
              {newListName.length > 0 && (
                <TouchableOpacity onPress={() => setNewListName('')}>
                  <Icon name="x" size="sm" color={Colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Quick suggestions */}
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Suggestions rapides</Text>
            <View style={styles.suggestionsGrid}>
              {LIST_SUGGESTIONS.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => handleCreateList(suggestion)}
                  activeOpacity={0.7}>
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setShowNewListModal(false);
                setNewListName('');
              }}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalCreateButton,
                !newListName.trim() && styles.modalCreateButtonDisabled,
              ]}
              onPress={() => handleCreateList()}
              disabled={!newListName.trim() || isCreating}>
              {isCreating ? (
                <Spinner size="small" color={Colors.white} />
              ) : (
                <LinearGradient
                  colors={newListName.trim() ? ['#C1121F', '#780000'] : ['#D1D5DB', '#9CA3AF']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.createButtonGradient}>
                  <Icon name="plus" size="sm" color={Colors.white} />
                  <Text style={styles.modalCreateText}>Créer</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
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
  headerRight: {
    width: 44,
  },
  
  // List container
  listContainer: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  
  // Modern Card
  listCard: {
    borderRadius: BorderRadius['2xl'],
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  listCardCompleted: {
    opacity: 0.75,
  },
  cardAccent: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    padding: Spacing.lg,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  listIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 4,
  },
  listDate: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  listActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  completedBadge: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: '#22C55E20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editNameContainer: {
    flex: 1,
  },
  editNameInput: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  
  // Stats
  listStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  statText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
  },
  
  // Progress
  progressSection: {
    marginBottom: Spacing.md,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  progressText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    minWidth: 32,
    textAlign: 'right',
  },
  
  // Preview chips
  previewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  previewChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    maxWidth: '45%',
  },
  previewChipChecked: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: Colors.status.success,
  },
  previewText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  previewTextChecked: {
    textDecorationLine: 'line-through',
    color: Colors.text.tertiary,
  },
  moreChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  moreChipText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  emptyIllustration: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  createFirstButton: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
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
  
  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    ...Shadows.xl,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Modal
  modalContent: {
    padding: Spacing.lg,
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
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.border.light,
  },
  modalInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  
  // Suggestions
  suggestionsContainer: {
    marginBottom: Spacing.lg,
  },
  suggestionsLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card.yellow,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  suggestionText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  
  // Modal actions
  modalActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.card.cream,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  modalCancelText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },
  modalCreateButton: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  modalCreateButtonDisabled: {
    opacity: 0.6,
  },
  createButtonGradient: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  modalCreateText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
});
