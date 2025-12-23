// Moko Payment Screen - Mobile Money Payment Interface
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Modal as RNModal,
  TouchableOpacity,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import functions from '@react-native-firebase/functions';
import {pushNotificationService} from '@/shared/services/firebase';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {RootStackParamList} from '@/shared/types';
import {useAuth, useUser} from '@/shared/contexts';
import {
  mokoPaymentService,
  MobileMoneyProvider,
  PaymentStatus,
} from '@/shared/services/payment';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Button} from '@/shared/components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MokoPaymentRouteProp = RouteProp<RootStackParamList, 'MokoPayment'>;

export function MokoPaymentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MokoPaymentRouteProp>();
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const {profile} = useUser();

  const {amount, planId, planName} = route.params;

  const [visible, setVisible] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [useRegisteredPhone, setUseRegisteredPhone] = useState(true);
  const [provider, setProvider] = useState<MobileMoneyProvider | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [waitingForPin, setWaitingForPin] = useState(false);
  const [statusCheckCount, setStatusCheckCount] = useState(0);

  // Pre-fill phone number from profile on mount
  useEffect(() => {
    if (profile?.phoneNumber && useRegisteredPhone) {
      setPhoneNumber(profile.phoneNumber);
    } else if (!useRegisteredPhone) {
      setPhoneNumber('');
    }
  }, [profile?.phoneNumber, useRegisteredPhone]);

  const handleClose = () => {
    Keyboard.dismiss();
    setVisible(false);
    setTimeout(() => navigation.goBack(), 300);
  };

  // Keyboard visibility listener
  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  // Update provider when phone number changes
  useEffect(() => {
    if (phoneNumber.length >= 11) {
      const detected = mokoPaymentService.detectProvider(phoneNumber);
      setProvider(detected);
    } else {
      setProvider(null);
    }
  }, [phoneNumber]);

  // Subscribe to payment status updates
  useEffect(() => {
    if (!transactionId) return;

    console.log('🔔 Subscribing to payment status for:', transactionId);
    setWaitingForPin(true);
    
    const unsubscribe = mokoPaymentService.subscribeToPaymentStatus(
      transactionId,
      async (status, details) => {
        console.log('💳 Payment status update:', status, details);
        setPaymentStatus(status);
        setStatusCheckCount(prev => prev + 1);

        if (status === 'SUCCESS') {
          setWaitingForPin(false);
          setIsProcessing(true);
          
          try {
            console.log('✅ Payment successful, activating subscription via Firebase...');
            
            // Call Firebase function to activate subscription
            const activateSubscription = functions().httpsCallable('activateSubscriptionFromRailway');
            const result = await activateSubscription({
              planId: planId,
              transactionId: transactionId,
              amount: amount,
              phoneNumber: phoneNumber,
              currency: 'USD',
            });
            
            console.log('🎉 Subscription activation result:', result.data);
            setIsProcessing(false);
            
            // Show success notification
            Alert.alert(
              'Paiement Réussi! 🎉',
              `Votre abonnement ${planName} a été activé avec succès.\n\nMerci pour votre confiance!`,
              [
                {
                  text: 'Voir Mon Abonnement',
                  onPress: () => navigation.navigate('Subscription')
                }
              ]
            );

            // Send push notification
            await pushNotificationService.triggerAchievementNotification(
              `Abonnement ${planName} Activé! 🎉`
            );
            
          } catch (error: any) {
            console.error('Error activating subscription:', error);
            setIsProcessing(false);
            
            // Payment succeeded but subscription activation failed
            Alert.alert(
              'Paiement Réussi',
              'Votre paiement a été traité avec succès, mais l\'activation de l\'abonnement a échoué. Veuillez contacter le support avec votre numéro de transaction: ' + transactionId,
              [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('Subscription')
                }
              ]
            );
          }
        } else if (status === 'FAILED') {
          setWaitingForPin(false);
          Alert.alert(
            'Paiement Échoué ❌',
            'Le paiement n\'a pas pu être traité.\n\nCauses possibles:\n• Solde insuffisant\n• Code PIN incorrect\n• Transaction annulée',
            [
              {
                text: 'Réessayer',
                onPress: () => {
                  setTransactionId(null);
                  setPaymentStatus('PENDING');
                  setIsProcessing(false);
                  setPaymentInitiated(false);
                  setStatusCheckCount(0);
                  setVisible(true); // Show modal again for retry
                }
              },
              {
                text: 'Annuler',
                style: 'cancel',
                onPress: () => navigation.goBack()
              }
            ]
          );
        }
      }
    );

    return unsubscribe;
  }, [transactionId, planId, planName]);

  const handlePayment = async () => {
    if (!user?.uid) {
      Alert.alert('Erreur', 'Vous devez être connecté pour effectuer un paiement');
      return;
    }

    // Validate phone number
    const validation = mokoPaymentService.validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
      Alert.alert('Numéro Invalide', validation.message);
      return;
    }

    setIsProcessing(true);

    try {
      console.log('💳 Initiating payment:', { amount, phoneNumber, userId: user.uid });
      
      const response = await mokoPaymentService.initiatePayment({
        amount: amount,
        phoneNumber: phoneNumber,
        userId: user.uid,
        currency: 'USD',
        userInfo: {
          firstname: profile?.firstName || 'Africanite',
          lastname: profile?.surname || 'Service',
          email: user.email || 'foma.kandy@gmail.com'
        }
      });

      console.log('✅ Payment initiated successfully:', response);
      setTransactionId(response.transaction_id);
      setPaymentInitiated(true);
      setWaitingForPin(true);
      
      // Don't close modal - show waiting state instead
      // Show "check phone" notification with better UX
      Alert.alert(
        '📱 Demande de Paiement Envoyée!',
        `Un code de paiement de $${amount} USD a été envoyé à ${phoneNumber}.\n\n⏳ Vous avez 2 minutes pour entrer votre code PIN sur votre téléphone.`,
        [
          {
            text: 'J\'ai Entré Mon PIN',
            style: 'default'
          }
        ]
      );
      
    } catch (error: any) {
      console.error('❌ Payment initiation failed:', error);
      setIsProcessing(false);
      
      Alert.alert(
        'Erreur de Paiement',
        error.message || 'Une erreur est survenue lors de l\'initiation du paiement',
        [{ text: 'OK' }]
      );
    }
  };

  const getProviderDisplayName = () => {
    if (!provider) return '';
    const names = {
      mpesa: 'Vodacom M-Pesa',
      airtel: 'Airtel Money',
      orange: 'Orange Money',
      afrimoney: 'Africell Money'
    };
    return names[provider];
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <TouchableOpacity 
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View 
          style={[
            styles.modalContent,
            keyboardVisible && styles.modalContentKeyboardOpen,
            { paddingBottom: insets.bottom + Spacing.lg }
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerDrag} />
            <View style={styles.headerTop}>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>Paiement Mobile Money</Text>
                <Text style={styles.headerSubtitle}>{planName}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon name="x" size="md" color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            
            {/* Payment Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Montant à payer</Text>
                <Text style={styles.summaryAmount}>${amount.toFixed(2)} USD</Text>
              </View>
            </View>

            {/* Phone Number Selection */}
            {profile?.phoneNumber && (
              <View style={styles.phoneSelectionContainer}>
                <TouchableOpacity
                  style={[
                    styles.phoneOptionButton,
                    useRegisteredPhone && styles.phoneOptionButtonActive
                  ]}
                  onPress={() => setUseRegisteredPhone(true)}
                  disabled={isProcessing || !!transactionId}>
                  <View style={styles.phoneOptionContent}>
                    <Icon 
                      name={useRegisteredPhone ? 'check-circle' : 'circle'} 
                      size="md" 
                      color={useRegisteredPhone ? Colors.primary : Colors.text.tertiary} 
                    />
                    <View style={styles.phoneOptionText}>
                      <Text style={[
                        styles.phoneOptionLabel,
                        useRegisteredPhone && styles.phoneOptionLabelActive
                      ]}>
                        Téléphone enregistré
                      </Text>
                      <Text style={styles.phoneOptionNumber}>{profile.phoneNumber}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.phoneOptionButton,
                    !useRegisteredPhone && styles.phoneOptionButtonActive
                  ]}
                  onPress={() => setUseRegisteredPhone(false)}
                  disabled={isProcessing || !!transactionId}>
                  <View style={styles.phoneOptionContent}>
                    <Icon 
                      name={!useRegisteredPhone ? 'check-circle' : 'circle'} 
                      size="md" 
                      color={!useRegisteredPhone ? Colors.primary : Colors.text.tertiary} 
                    />
                    <Text style={[
                      styles.phoneOptionLabel,
                      !useRegisteredPhone && styles.phoneOptionLabelActive
                    ]}>
                      Utiliser un autre numéro
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Phone Number Input */}
            {(!useRegisteredPhone || !profile?.phoneNumber) && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Numéro de Téléphone</Text>
                <View style={[
                  styles.inputWrapper,
                  provider && styles.inputWrapperValid
                ]}>
                  <Icon name="phone" size="sm" color={Colors.text.tertiary} />
                  <TextInput
                    style={styles.input}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="243828812498"
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="phone-pad"
                    maxLength={12}
                    editable={!isProcessing && !transactionId}
                  />
                </View>
                <Text style={styles.inputHint}>
                  Format: 12 chiffres commençant par 243
                </Text>
              </View>
            )}

            {/* Show provider detection even when using registered phone */}
            {useRegisteredPhone && profile?.phoneNumber && provider && (
              <View style={styles.providerDetectedCard}>
                <Icon name="check-circle" size="sm" color={Colors.status.success} />
                <Text style={styles.providerDetectedText}>
                  Opérateur détecté: {getProviderDisplayName()}
                </Text>
              </View>
            )}

            {/* Payment Status */}
            {transactionId && (
              <View style={styles.statusCard}>
                {paymentStatus === 'PENDING' && (
                  <View style={styles.statusContent}>
                    <View style={styles.statusIconContainer}>
                      <Icon name="clock" size="xl" color={Colors.status.warning} />
                    </View>
                    <Text style={styles.statusTitle}>En attente...</Text>
                    <Text style={styles.statusText}>
                      Vérifiez votre téléphone et entrez votre code PIN
                    </Text>
                  </View>
                )}
                {paymentStatus === 'SUCCESS' && (
                  <View style={styles.statusContent}>
                    <View style={styles.statusIconContainer}>
                      <Icon name="check-circle" size="xl" color={Colors.status.success} />
                    </View>
                    <Text style={styles.statusTitle}>Paiement réussi! 🎉</Text>
                    <Text style={styles.statusText}>
                      Votre abonnement a été activé
                    </Text>
                  </View>
                )}
                {paymentStatus === 'FAILED' && (
                  <View style={styles.statusContent}>
                    <View style={styles.statusIconContainer}>
                      <Icon name="x-circle" size="xl" color={Colors.status.error} />
                    </View>
                    <Text style={styles.statusTitle}>Paiement échoué</Text>
                    <Text style={styles.statusText}>
                      Veuillez réessayer
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Instructions */}
            {provider && !transactionId && (
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsTitle}>
                  Instructions de paiement
                </Text>
                {mokoPaymentService.getPaymentInstructions(provider).map((instruction, index) => (
                  <View key={index} style={styles.instructionRow}>
                    <Text style={styles.instructionBullet}>•</Text>
                    <Text style={styles.instructionText}>{instruction}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Payment Button */}
          {!transactionId && (
            <View style={styles.buttonContainer}>
              <Button
                title={
                  provider
                    ? `Valide ✓ ${getProviderDisplayName()}`
                    : 'Entrez votre numéro'
                }
                onPress={handlePayment}
                disabled={!provider || isProcessing}
                loading={isProcessing}
                variant="primary"
                size="lg"
                fullWidth
              />
              <Text style={styles.securityText}>
                🔒 Paiement sécurisé via FreshPay PayDRC
              </Text>
            </View>
          )}

          {/* Waiting for PIN State */}
          {waitingForPin && transactionId && (
            <View style={styles.waitingContainer}>
              <View style={styles.waitingCard}>
                <Text style={styles.waitingEmoji}>📱</Text>
                <Text style={styles.waitingTitle}>En attente de confirmation</Text>
                <Text style={styles.waitingText}>
                  Veuillez entrer votre code PIN sur votre téléphone pour confirmer le paiement de ${amount.toFixed(2)} USD
                </Text>
                <View style={styles.waitingDots}>
                  <Text style={styles.waitingDotsText}>⏳ Vérification en cours...</Text>
                </View>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setTransactionId(null);
                    setPaymentStatus('PENDING');
                    setIsProcessing(false);
                    setPaymentInitiated(false);
                    setWaitingForPin(false);
                    setStatusCheckCount(0);
                  }}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  modalContentKeyboardOpen: {
    minHeight: '90%',
    maxHeight: '98%',
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
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
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
  },

  // Summary Card
  summaryCard: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  summaryAmount: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },

  // Input Group
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  inputWrapperValid: {
    borderColor: Colors.status.success,
    backgroundColor: '#F0FDF4',
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
  },
  inputHint: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },

  // Phone Selection
  phoneSelectionContainer: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  phoneOptionButton: {
    backgroundColor: Colors.background.primary,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  phoneOptionButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F9FF',
  },
  phoneOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  phoneOptionText: {
    flex: 1,
  },
  phoneOptionLabel: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  phoneOptionLabelActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
  },
  phoneOptionNumber: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  providerDetectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  providerDetectedText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
  },

  // Instructions Card
  instructionsCard: {
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  instructionsTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  instructionRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  instructionBullet: {
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
    marginRight: Spacing.sm,
    fontFamily: Typography.fontFamily.bold,
  },
  instructionText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    lineHeight: 20,
  },

  // Status Card
  statusCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border.light,
  },
  statusContent: {
    alignItems: 'center',
  },
  statusIconContainer: {
    marginBottom: Spacing.md,
  },
  statusTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  statusText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Button Container
  buttonContainer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  securityText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // Waiting for PIN
  waitingContainer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  waitingCard: {
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  waitingEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  waitingTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  waitingText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  waitingDots: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  waitingDotsText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.primary,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.error,
  },
});
