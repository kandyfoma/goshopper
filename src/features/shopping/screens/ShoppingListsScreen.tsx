// Shopping Lists Screen - Modern, intuitive shopping list management
import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
  RefreshControl,
  Dimensions,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import RNModal from 'react-native-modal';
import {BlurView} from '@react-native-community/blur';
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
import {Icon, Spinner, FadeIn, SlideIn, Input, Button, SubscriptionLimitModal, BackButton} from '@/shared/components';
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

  // Animation refs
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

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

  // Animation effects
  useEffect(() => {
    if (showNewListModal) {
      // Reset animations
      slideAnim.setValue(100);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);

      // Start animations
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
      ]).start();
    }
  }, [showNewListModal, slideAnim, fadeAnim, scaleAnim]);

  // FAB pulse animation - removed as it was confusing to users
  // useEffect(() => {
  //   const pulse = Animated.loop(
  //     Animated.sequence([
  //       Animated.timing(fabScale, {
  //         toValue: 1.05,
  //         duration: 1000,
  //         useNativeDriver: true,
  //       }),
  //       Animated.timing(fabScale, {
  //         toValue: 1,
  //         duration: 1000,
  //         useNativeDriver: true,
  //       }),
  //     ])
  //   );
  //   pulse.start();
  //   return () => pulse.stop();
  // }, []);

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
      setShowLimitModal(true);
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
                    <View 
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <FadeIn duration={400}>
        <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
          <BackButton />
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Mes Listes</Text>
            <Text style={styles.headerSubtitle}>
              {lists.length} liste{lists.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </FadeIn>

      {/* Lists */}
      {lists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="clipboard-list" size="xl" color={Colors.text.tertiary} />
          
          <Text style={styles.emptyTitle}>Aucune liste de courses</Text>
          <Text style={styles.emptyText}>
            Créez votre première liste pour organiser vos courses facilement
          </Text>
          
          <Button
            title="Créer une liste"
            onPress={handleOpenNewListModal}
            icon={<Icon name="plus" size="sm" color={Colors.white} />}
            iconPosition="left"
            fullWidth={false}
          />
        </View>
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

      {/* Floating Action Button - Static and clear */}
      {lists.length > 0 && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            onPress={handleOpenNewListModal}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#C1121F', '#780000']}
              style={styles.fab}>
              <Icon name="plus" size="lg" color={Colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* New List Modal */}
      <RNModal
        isVisible={showNewListModal}
        onBackdropPress={() => {
          setShowNewListModal(false);
          setNewListName('');
        }}
        onBackButtonPress={() => {
          setShowNewListModal(false);
          setNewListName('');
        }}
        backdropOpacity={0.25}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver={true}
        hideModalContentWhileAnimating={true}
        style={styles.modal}>
        {Platform.OS === 'ios' ? (
          <BlurView style={styles.overlay} blurType="dark" blurAmount={10}>
            <Animated.View style={[styles.androidOverlay, { opacity: fadeAnim }]} />
            <View style={styles.overlayContent}>
              <TouchableOpacity
                style={styles.overlayTouchable}
                activeOpacity={1}
                onPress={() => {
                  setShowNewListModal(false);
                  setNewListName('');
                }}
              />
              <Animated.View
                style={[
                  styles.modalContent,
                  {
                    paddingBottom: insets.bottom + Spacing.lg,
                    transform: [
                      { translateY: slideAnim },
                      { scale: scaleAnim },
                    ],
                  }
                ]}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerDrag} />
                  <View style={styles.headerTop}>
                    <View style={styles.headerContent}>
                      <Text style={styles.headerTitle}>Créer une liste</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => {
                        setShowNewListModal(false);
                        setNewListName('');
                      }}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                      <Icon name="x" size="md" color={Colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                  {/* Hero illustration */}
                  <View style={styles.modalHero}>
                    <View style={styles.modalHeroIcon}>
                      <Icon name="clipboard-list" size="xl" color={Colors.white} />
                    </View>
                    <Text style={styles.modalHeroText}>
                      Organisez vos courses intelligemment
                    </Text>
                  </View>

                  {/* Input */}
                  <View style={styles.modalInputSection}>
                    <Input
                      label="Nom de la liste"
                      value={newListName}
                      onChangeText={setNewListName}
                      placeholder="Ex: Courses de la semaine..."
                      leftIcon="edit-3"
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => handleCreateList()}
                    />
                  </View>

                  {/* Quick suggestions */}
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsLabel}>
                      <Icon name="zap" size="xs" color={Colors.primary} /> Créer rapidement
                    </Text>
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

                  {/* Create Button */}
                  <View style={styles.modalButtonContainer}>
                    <Button
                      title="Créer ma liste"
                      onPress={() => handleCreateList()}
                      disabled={!newListName.trim() || isCreating}
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
          <Animated.View style={[styles.androidOverlay, { opacity: fadeAnim }]} />
        )}
        <View style={styles.overlayContent}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => {
              setShowNewListModal(false);
              setNewListName('');
            }}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                paddingBottom: insets.bottom + Spacing.lg,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim },
                ],
              }
            ]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerDrag} />
              <View style={styles.headerTop}>
                <View style={styles.headerContent}>
                  <Text style={styles.headerTitle}>Créer une liste</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowNewListModal(false);
                    setNewListName('');
                  }}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Icon name="x" size="md" color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {/* Hero illustration */}
              <View style={styles.modalHero}>
                <View style={styles.modalHeroIcon}>
                  <Icon name="clipboard-list" size="xl" color={Colors.white} />
                </View>
                <Text style={styles.modalHeroText}>
                  Organisez vos courses intelligemment
                </Text>
              </View>

              {/* Input */}
              <View style={styles.modalInputSection}>
                <Input
                  label="Nom de la liste"
                  value={newListName}
                  onChangeText={setNewListName}
                  placeholder="Ex: Courses de la semaine..."
                  leftIcon="edit-3"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => handleCreateList()}
                />
              </View>

              {/* Quick suggestions */}
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>
                  <Icon name="zap" size="xs" color={Colors.primary} /> Créer rapidement
                </Text>
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

              {/* Create Button */}
              <View style={styles.modalButtonContainer}>
                <Button
                  title="Créer ma liste"
                  onPress={() => handleCreateList()}
                  disabled={!newListName.trim() || isCreating}
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

      {/* Subscription Limit Modal */}
      <SubscriptionLimitModal
        visible={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType="shoppingList"
        requiredPlan="Basic"
        currentPlan={subscription?.planId === 'freemium' ? 'Gratuit' : undefined}
      />
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
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    gap: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
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
  
  // Modal styles
  modal: {
    margin: 0,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  androidOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    borderTopLeftRadius: BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    minHeight: '75%',
    maxHeight: '95%',
    ...Shadows.lg,
  },
  header: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerDrag: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border.medium,
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalHero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  modalHeroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalHeroText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  modalInputSection: {
    marginBottom: Spacing.lg,
    width: '100%',
  },
  suggestionsContainer: {
    marginBottom: Spacing.xl,
    width: '100%',
  },
  suggestionsLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.full,
  },
  suggestionText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.white,
  },
  modalButtonContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    width: '100%',
  },
});
