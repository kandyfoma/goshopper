// Shopping Lists Screen - Overview of all shopping lists (Samsung Notes style)
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Alert,
  TextInput,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {RootStackParamList} from '@/shared/types';
import {useAuth} from '@/shared/contexts';
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
import {Icon, Spinner, Modal} from '@/shared/components';
import ModernTabBar from '@/shared/components/ModernTabBar';
import {formatDate} from '@/shared/utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function ShoppingListsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Load lists
  useEffect(() => {
    if (user?.uid) {
      loadLists();
    }
  }, [user?.uid]);

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

  const loadLists = async () => {
    if (!user?.uid) return;

    try {
      const loadedLists = await shoppingListService.getLists(user.uid, false); // Get all lists including completed
      setLists(loadedLists);
    } catch (error) {
      console.error('Load lists error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!user?.uid || !newListName.trim()) return;

    setIsCreating(true);
    try {
      const list = await shoppingListService.createList(
        user.uid,
        newListName.trim(),
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

    return (
      <Animated.View
        style={[
          {
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
          },
        ]}>
        <TouchableOpacity
          style={[styles.listCard, !item.isActive && styles.listCardCompleted]}
          onPress={() => navigation.navigate('ShoppingListDetail', {listId: item.id})}
          onLongPress={() => setEditingListId(item.id)}
          activeOpacity={0.7}>
          <View style={styles.listHeader}>
            {isEditing ? (
              <View style={styles.editNameContainer}>
                <TextInput
                  style={styles.editNameInput}
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
                <Text style={styles.listName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.listDate}>
                  {formatDate(item.updatedAt)}
                </Text>
              </View>
            )}

            <View style={styles.listActions}>
              {!item.isActive && (
                <View style={styles.completedBadge}>
                  <Icon name="check-circle" size="sm" color={Colors.status.success} />
                </View>
              )}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeleteList(item.id, item.name)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon name="trash" size="sm" color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.listStats}>
            <View style={styles.statItem}>
              <Icon name="shopping-bag" size="sm" color={Colors.primary} />
              <Text style={styles.statText}>
                {checkedCount}/{itemsCount} articles
              </Text>
            </View>

            {item.potentialSavings > 0 && (
              <View style={styles.statItem}>
                <Icon name="trending-down" size="sm" color={Colors.status.success} />
                <Text style={styles.statText}>
                  ${item.potentialSavings.toFixed(2)} économies
                </Text>
              </View>
            )}
          </View>

          {/* Progress bar */}
          {itemsCount > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={['#780000', '#FDB913']}
                  style={[styles.progressBarFill, {width: `${progress * 100}%`}]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          )}

          {/* Preview first few items */}
          {item.items.length > 0 && (
            <View style={styles.previewContainer}>
              {item.items.slice(0, 3).map((listItem, idx) => (
                <View key={listItem.id} style={styles.previewItem}>
                  <Icon
                    name={listItem.isChecked ? 'check-square' : 'square'}
                    size="xs"
                    color={listItem.isChecked ? Colors.status.success : Colors.text.tertiary}
                  />
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
              {item.items.length > 3 && (
                <Text style={styles.moreItems}>
                  +{item.items.length - 3} autres...
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
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
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="chevron-left" size="md" color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Listes</Text>
        <TouchableOpacity
          style={styles.newListButton}
          onPress={() => setShowNewListModal(true)}>
          <Icon name="plus" size="sm" color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Lists */}
      {lists.length === 0 ? (
        <Animated.View
          style={[
            styles.emptyContainer,
            {
              opacity: fadeAnim,
              transform: [{translateY: slideAnim}],
            },
          ]}>
          <View style={styles.emptyIconContainer}>
            <Icon name="clipboard" size="3xl" color={Colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>Aucune liste</Text>
          <Text style={styles.emptyText}>
            Créez votre première liste de courses
          </Text>
          <TouchableOpacity
            style={styles.createFirstButton}
            onPress={() => setShowNewListModal(true)}
            activeOpacity={0.9}>
            <LinearGradient
              colors={['#780000', '#FDB913']}
              style={styles.createFirstButtonGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <Icon name="plus" size="md" color={Colors.white} />
              <Text style={styles.createFirstButtonText}>Créer une liste</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <FlatList
          data={lists}
          renderItem={renderListItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

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
      <ModernTabBar />
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
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  newListButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: '#780000',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  listContainer: {
    padding: Spacing.lg,
  },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border.light,
    ...Shadows.md,
  },
  listCardCompleted: {
    opacity: 0.7,
    backgroundColor: Colors.card.cream,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
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
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.yellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editNameContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  editNameInput: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  listStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.card.blue,
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
    color: Colors.primary,
    minWidth: 35,
    textAlign: 'right',
  },
  previewContainer: {
    gap: Spacing.xs,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    flex: 1,
  },
  previewTextChecked: {
    textDecorationLine: 'line-through',
    color: Colors.text.tertiary,
  },
  moreItems: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
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
  modalActions: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.card.cream,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },
  modalCreateButton: {
    flex: 1,
    backgroundColor: '#780000',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    ...Shadows.md,
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
