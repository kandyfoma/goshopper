// Price Alerts Screen - Urbanist Design System
// Set and manage price drop notifications with sleek pastels
import React, {useState, useEffect, useCallback} from 'react';
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
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '@/shared/contexts';
import {useToast} from '@/shared/contexts';
import {priceAlertsService, PriceAlert} from '@/shared/services/firebase';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Spinner, Modal} from '@/shared/components';

export function PriceAlertsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const {showToast} = useToast();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newTargetPrice, setNewTargetPrice] = useState('');
  const [newCity, setNewCity] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Major DRC cities - deduplicated and sorted
  const DRC_CITIES = [
    'Kinshasa',
    'Lubumbashi',
    'Mbuji-Mayi',
    'Kisangani',
    'Kananga',
    'Bukavu',
    'Goma',
    'Tshikapa',
    'Kolwezi',
    'Likasi',
    'Uvira',
    'Butembo',
    'Beni',
    'Bunia',
    'Isiro',
    'Mbandaka',
    'Kikwit',
    'Matadi',
    'Boma',
    'Bandundu',
    'Gemena',
    'Kabinda',
    'Mwene-Ditu',
    'Kalemie',
    'Kindu',
    'Lisala',
    'Bumba',
    'Inongo',
    'Boende',
    'Lusambo',
    'Ilebo',
    'Kisantu',
    'Mbanza-Ngungu',
    'Kasangulu',
    'Tshela',
  ].sort();

  // Load alerts
  useEffect(() => {
    if (!user?.uid) {return;}

    const unsubscribe = priceAlertsService.subscribeToAlerts(
      user.uid,
      loadedAlerts => {
        setAlerts(loadedAlerts);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleCreateAlert = useCallback(async () => {
    if (!user?.uid || !newProductName.trim() || !newTargetPrice) {return;}

    setIsCreating(true);
    try {
      await priceAlertsService.createAlert(user.uid, {
        productName: newProductName.trim(),
        targetPrice: parseFloat(newTargetPrice),
        city: newCity || undefined,
      });

      setShowAddModal(false);
      setNewProductName('');
      setNewTargetPrice('');
      setNewCity('');
      showToast('Alerte créée avec succès', 'success');
    } catch (error) {
      console.error('Create alert error:', error);
      showToast("Impossible de créer l'alerte", 'error');
    } finally {
      setIsCreating(false);
    }
  }, [user?.uid, newProductName, newTargetPrice]);

  const handleDeleteAlert = useCallback(
    async (alertId: string) => {
      if (!user?.uid) {return;}

      Alert.alert("Supprimer l'alerte ?", 'Cette action est irréversible.', [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await priceAlertsService.deleteAlert(user.uid, alertId);
              showToast('Alerte supprimée avec succès', 'success');
            } catch (error) {
              console.error('Delete alert error:', error);
              showToast('Erreur lors de la suppression', 'error');
            }
          },
        },
      ]);
    },
    [user?.uid],
  );

  const handleToggleAlert = useCallback(
    async (alertId: string, isActive: boolean) => {
      if (!user?.uid) {return;}

      try {
        await priceAlertsService.updateAlert(user.uid, alertId, {
          isActive: !isActive,
        });
      } catch (error) {
        console.error('Toggle alert error:', error);
      }
    },
    [user?.uid],
  );

  const renderAlertItem = ({item}: {item: PriceAlert}) => {
    const isTriggered = item.isTriggered;
    const hasPrice = item.currentLowestPrice !== undefined;

    return (
      <Animated.View
        style={[styles.alertCard, isTriggered && styles.alertCardTriggered]}>
        <View style={styles.alertHeader}>
          <View
            style={[
              styles.alertIconContainer,
              {
                backgroundColor: isTriggered
                  ? Colors.card.cream
                  : Colors.card.blue,
              },
            ]}>
            <Icon name="bell" size="md" color={Colors.text.primary} />
          </View>
          <View style={styles.alertInfo}>
            <Text style={styles.alertProductName}>{item.productName}</Text>
            <Text style={styles.alertTarget}>
              Prix cible: ${item.targetPrice.toFixed(2)}
            </Text>
            {item.city && (
              <View style={styles.alertCityContainer}>
                <Icon name="map-pin" size="xs" color={Colors.text.tertiary} />
                <Text style={styles.alertCity}>{item.city}</Text>
              </View>
            )}
          </View>
          {isTriggered && (
            <View style={styles.triggeredBadge}>
              <Icon
                name="check-circle"
                size="xs"
                color={Colors.status.success}
              />
              <Text style={styles.triggeredBadgeText}>Atteint!</Text>
            </View>
          )}
        </View>

        {hasPrice && (
          <View style={styles.priceInfo}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Prix actuel</Text>
              <Text style={styles.currentPrice}>
                ${item.currentLowestPrice?.toFixed(2)}
              </Text>
            </View>
            {item.currentLowestStore && (
              <Text style={styles.storeText}>
                chez {item.currentLowestStore}
              </Text>
            )}
          </View>
        )}

        <View style={styles.alertActions}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              !item.isActive && styles.toggleButtonInactive,
            ]}
            onPress={() => handleToggleAlert(item.id, item.isActive)}>
            <Icon
              name={item.isActive ? 'check' : 'pause'}
              size="xs"
              color={
                item.isActive ? Colors.status.success : Colors.text.tertiary
              }
            />
            <Text
              style={[
                styles.toggleButtonText,
                !item.isActive && styles.toggleButtonTextInactive,
              ]}>
              {item.isActive ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteAlert(item.id)}>
            <Icon name="trash" size="sm" color={Colors.status.error} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Spinner size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des alertes...</Text>
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
        <Text style={styles.headerTitle}>Alertes de Prix</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <LinearGradient
          colors={[Colors.card.yellow, '#E8E9A0']}
          style={styles.infoGradient}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}>
          <View style={styles.infoIconContainer}>
            <Icon name="bell" size="md" color={Colors.text.primary} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Comment ça marche ?</Text>
            <Text style={styles.infoText}>
              Définissez un prix cible pour un article. Nous vous alertons quand
              le prix baisse !
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icon name="bell-off" size="3xl" color={Colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>Aucune alerte</Text>
          <Text style={styles.emptyText}>
            Créez votre première alerte pour suivre les prix
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderAlertItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Button */}
      <TouchableOpacity
        style={[styles.addButton, {bottom: insets.bottom + Spacing.lg}]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.9}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.addButtonGradient}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}>
          <Icon name="plus" size="md" color={Colors.white} />
          <Text style={styles.addButtonText}>Nouvelle Alerte</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Alert Modal */}
      <Modal
        visible={showAddModal}
        variant="bottom-sheet"
        title="Nouvelle Alerte"
        onClose={() => {
          setShowAddModal(false);
          setNewProductName('');
          setNewTargetPrice('');
          setNewCity('');
        }}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Nom du produit</Text>
          <View style={styles.inputWrapper}>
            <Icon name="tag" size="sm" color={Colors.text.tertiary} />
            <TextInput
              style={styles.input}
              value={newProductName}
              onChangeText={setNewProductName}
              placeholder="Ex: Sucre 1kg, Riz 5kg..."
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Prix cible ($)</Text>
          <View style={styles.inputWrapper}>
            <Icon name="dollar" size="sm" color={Colors.text.tertiary} />
            <TextInput
              style={styles.input}
              value={newTargetPrice}
              onChangeText={setNewTargetPrice}
              placeholder="Ex: 1.50"
              placeholderTextColor={Colors.text.tertiary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Ville (optionnel)</Text>
          <View style={styles.inputWrapper}>
            <Icon name="map-pin" size="sm" color={Colors.text.tertiary} />
            <TextInput
              style={styles.input}
              value={newCity}
              onChangeText={setNewCity}
              placeholder="Laissez vide pour votre ville par défaut"
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowAddModal(false);
              setNewProductName('');
              setNewTargetPrice('');
              setNewCity('');
            }}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.createButton,
              (!newProductName.trim() || !newTargetPrice) &&
                styles.createButtonDisabled,
            ]}
            onPress={handleCreateAlert}
            disabled={
              !newProductName.trim() || !newTargetPrice || isCreating
            }>
            {isCreating ? (
              <Spinner size="small" color={Colors.white} />
            ) : (
              <>
                <Icon name="plus" size="sm" color={Colors.white} />
                <Text style={styles.createButtonText}>Créer</Text>
              </>
            )}
          </TouchableOpacity>
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
  headerRight: {
    width: 40,
  },
  infoCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  infoGradient: {
    flexDirection: 'row',
    padding: Spacing.lg,
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  infoText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  emptyContainer: {
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
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },
  alertCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  alertCardTriggered: {
    borderWidth: 2,
    borderColor: Colors.status.success,
    backgroundColor: Colors.card.cream,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  alertIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  alertInfo: {
    flex: 1,
  },
  alertProductName: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  alertTarget: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },
  alertCity: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  alertCityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  triggeredBadge: {
    backgroundColor: Colors.card.cream,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  triggeredBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.status.success,
  },
  priceInfo: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.medium,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  priceLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
  },
  currentPrice: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  storeText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  alertActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.medium,
  },
  toggleButton: {
    backgroundColor: Colors.card.cream,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleButtonInactive: {
    backgroundColor: Colors.card.blue,
  },
  toggleButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.status.success,
  },
  toggleButtonTextInactive: {
    color: Colors.text.tertiary,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,82,82,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  addButtonGradient: {
    flexDirection: 'row',
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addButtonText: {
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
  input: {
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
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.card.blue,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },
  createButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  createButtonDisabled: {
    backgroundColor: Colors.border.light,
  },
  createButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
});
