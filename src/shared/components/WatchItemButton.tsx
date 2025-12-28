// Watch Item Button - Add price drop alerts for items (Premium Feature)
// Uses the existing priceAlertsService for managing user-item alert relationships
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Icon} from '@/shared/components';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {useAuth, useSubscription, useToast} from '@/shared/contexts';
import {priceAlertsService, PriceAlert} from '@/shared/services/firebase/priceAlerts';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {formatCurrency} from '@/shared/utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface WatchItemButtonProps {
  itemName: string;
  itemNameNormalized?: string; // Optional, used for lookup optimization
  city?: string;
  currentPrice?: number;
  currentStore?: string;
  currency?: 'USD' | 'CDF';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function WatchItemButton({
  itemName,
  itemNameNormalized,
  city,
  currentPrice,
  currentStore,
  currency = 'USD',
  size = 'medium',
  showLabel = false,
}: WatchItemButtonProps) {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAuth();
  const {subscription} = useSubscription();
  const {showToast} = useToast();

  const [existingAlert, setExistingAlert] = useState<PriceAlert | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Check if user has premium access (planId is 'premium' or 'standard')
  const hasPremium =
    subscription?.isSubscribed &&
    subscription?.status === 'active' &&
    (subscription?.planId === 'premium' || subscription?.planId === 'standard');

  const isWatching = !!existingAlert;

  // Check if item already has an active alert
  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    const checkAlertStatus = async () => {
      try {
        const alerts = await priceAlertsService.getAlertsForProduct(
          user.uid,
          itemName,
        );
        setExistingAlert(alerts.length > 0 ? alerts[0] : null);
        if (alerts.length > 0 && alerts[0].targetPrice) {
          setTargetPrice(alerts[0].targetPrice.toString());
        }
      } catch (error) {
        console.error('Error checking alert status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAlertStatus();
  }, [user?.uid, itemName]);

  const handlePress = () => {
    if (!user?.uid) {
      navigation.navigate('Login');
      return;
    }

    if (!hasPremium) {
      showToast('Fonctionnalité Premium - Passez à Premium pour recevoir des alertes de prix.', 'info', 4000);
      navigation.navigate('Subscription');
      return;
    }

    if (isWatching && existingAlert) {
      // If already watching, ask if they want to remove the alert
      handleRemoveAlert();
    } else {
      // Show modal to set alert
      setShowAlertModal(true);
    }
  };

  const handleRemoveAlert = async () => {
    if (!user?.uid || !existingAlert) return;

    try {
      setIsLoading(true);
      await priceAlertsService.deleteAlert(user.uid, existingAlert.id);
      setExistingAlert(null);
      showToast(`Alerte supprimée pour ${itemName}`, 'success', 3000);
    } catch (error) {
      console.error('Error removing alert:', error);
      showToast('Impossible de supprimer l\'alerte', 'error', 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAlert = async () => {
    if (!user?.uid) return;

    setIsSaving(true);
    try {
      const priceValue = targetPrice ? parseFloat(targetPrice) : currentPrice;

      if (!priceValue || priceValue <= 0) {
        showToast('Veuillez entrer un prix cible valide', 'error', 3000);
        setIsSaving(false);
        return;
      }

      const alert = await priceAlertsService.createAlert(user.uid, {
        productName: itemName,
        targetPrice: priceValue,
        city: city,
        currency: currency,
      });

      setExistingAlert(alert);
      setShowAlertModal(false);

      showToast(`🔔 Alerte créée pour ${itemName} à ${formatCurrency(priceValue, currency)}`, 'success', 4000);
    } catch (error: any) {
      console.error('Error creating alert:', error);
      showToast(error.message || 'Impossible de créer l\'alerte', 'error', 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Size configurations
  const sizeConfig = {
    small: {iconSize: 16, padding: 6, fontSize: 10},
    medium: {iconSize: 20, padding: 8, fontSize: 12},
    large: {iconSize: 24, padding: 12, fontSize: 14},
  };

  const config = sizeConfig[size];

  if (isLoading) {
    return (
      <View style={[styles.buttonContainer, {padding: config.padding}]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        style={[
          styles.buttonContainer,
          {padding: config.padding},
          isWatching && styles.buttonActive,
        ]}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <Icon
          name={isWatching ? 'bell' : 'bell-off'}
          size={config.iconSize as any}
          color={isWatching ? Colors.primary : Colors.text.tertiary}
        />
        {showLabel && (
          <Text
            style={[
              styles.buttonLabel,
              {fontSize: config.fontSize},
              isWatching && styles.buttonLabelActive,
            ]}>
            {isWatching ? 'Alerté' : 'Alerter'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Alert Settings Modal */}
      <Modal
        visible={showAlertModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAlertModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              style={styles.modalHeader}>
              <Icon name="bell" size="lg" color={Colors.text.inverse} />
              <Text style={styles.modalTitle}>Alerte de Prix</Text>
            </LinearGradient>

            <View style={styles.modalBody}>
              {/* Item info */}
              <View style={styles.itemInfoSection}>
                <Text style={styles.itemInfoLabel}>Article</Text>
                <Text style={styles.itemInfoName} numberOfLines={2}>
                  {itemName}
                </Text>
                {currentPrice && (
                  <Text style={styles.itemInfoPrice}>
                    Prix actuel: {formatCurrency(currentPrice, currency)}
                    {currentStore && ` chez ${currentStore}`}
                  </Text>
                )}
              </View>

              {/* Target Price Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Prix cible ({currency})</Text>
                <Text style={styles.inputHint}>
                  Vous serez alerté quand le prix atteint ou descend en dessous de ce montant
                </Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>
                    {currency === 'USD' ? '$' : 'FC'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={targetPrice}
                    onChangeText={setTargetPrice}
                    placeholder={currentPrice ? (currentPrice * 0.9).toFixed(2) : '0.00'}
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                </View>
                {currentPrice && targetPrice && parseFloat(targetPrice) < currentPrice && (
                  <View style={styles.savingsPreview}>
                    <Icon name="trending-down" size="xs" color={Colors.status.success} />
                    <Text style={styles.savingsText}>
                      Économie potentielle: {formatCurrency(currentPrice - parseFloat(targetPrice), currency)} (
                      {Math.round(((currentPrice - parseFloat(targetPrice)) / currentPrice) * 100)}%)
                    </Text>
                  </View>
                )}
              </View>

              {/* Quick target buttons */}
              {currentPrice && (
                <View style={styles.quickTargets}>
                  <Text style={styles.quickTargetsLabel}>Suggestions:</Text>
                  <View style={styles.quickTargetsRow}>
                    {[10, 15, 20, 25].map(percent => (
                      <TouchableOpacity
                        key={percent}
                        style={[
                          styles.quickTargetButton,
                          targetPrice === (currentPrice * (1 - percent / 100)).toFixed(2) &&
                            styles.quickTargetButtonActive,
                        ]}
                        onPress={() =>
                          setTargetPrice((currentPrice * (1 - percent / 100)).toFixed(2))
                        }>
                        <Text
                          style={[
                            styles.quickTargetText,
                            targetPrice === (currentPrice * (1 - percent / 100)).toFixed(2) &&
                              styles.quickTargetTextActive,
                          ]}>
                          -{percent}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAlertModal(false)}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!targetPrice || isSaving) && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveAlert}
                disabled={!targetPrice || isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.text.inverse} />
                ) : (
                  <>
                    <Icon name="bell" size="sm" color={Colors.text.inverse} />
                    <Text style={styles.saveButtonText}>Créer l'alerte</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  buttonActive: {
    backgroundColor: Colors.primaryLight + '20',
  },
  buttonLabel: {
    color: Colors.text.tertiary,
    fontFamily: Typography.fontFamily.medium,
  },
  buttonLabelActive: {
    color: Colors.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.inverse,
  },
  modalBody: {
    padding: Spacing.lg,
  },

  // Item Info
  itemInfoSection: {
    backgroundColor: Colors.background.secondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  itemInfoLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  itemInfoName: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  itemInfoPrice: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },

  // Input
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  inputHint: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border.light,
    overflow: 'hidden',
  },
  currencyPrefix: {
    paddingHorizontal: Spacing.md,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.secondary,
    backgroundColor: Colors.background.tertiary,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },

  // Savings Preview
  savingsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.status.success + '15',
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  savingsText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
  },

  // Quick Targets
  quickTargets: {
    marginBottom: Spacing.md,
  },
  quickTargetsLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  quickTargetsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickTargetButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    alignItems: 'center',
  },
  quickTargetButtonActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  quickTargetText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },
  quickTargetTextActive: {
    color: Colors.primary,
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    padding: Spacing.lg,
    paddingTop: 0,
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.inverse,
  },
});
