// Moko Payment Screen - Mobile Money Payment Interface
import React, {useState, useEffect, useRef} from 'react';
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
  Animated,
  Dimensions,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {RootStackParamList} from '@/shared/types';
import {useAuth, useUser, useToast} from '@/shared/contexts';
import {usePaymentProcessing} from '@/shared/contexts/PaymentProcessingContext';
import {
  mokoPaymentService,
  MobileMoneyProvider,
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
  const {showToast} = useToast();
  const {startPayment} = usePaymentProcessing();

  const {amount, planId, planName} = route.params;

  const [visible, setVisible] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [useRegisteredPhone, setUseRegisteredPhone] = useState(true);
  const [provider, setProvider] = useState<MobileMoneyProvider | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Animate modal entrance
  useEffect(() => {
    if (visible) {
      // Parallel animations for smooth entrance
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
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
  }, [visible]);

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
    // Animate out
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setTimeout(() => navigation.goBack(), 100);
    });
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
      
      // Start the payment processing context (handles polling + subscription activation)
      startPayment({
        transactionId: response.transaction_id,
        amount: amount,
        phoneNumber: phoneNumber,
        planId: planId,
        planName: planName,
        currency: profile?.preferredCurrency || 'USD',
      });
      
      // Show toast
      showToast(`Entrez votre code PIN sur ${phoneNumber}`, 'info', 4000);
      
      // Close modal and navigate to dashboard
      setVisible(false);
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main', params: { screen: 'Dashboard' } }],
        });
      }, 300);
      
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
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {Platform.OS === 'ios' ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="light"
              blurAmount={25}
            />
          </Animated.View>
        ) : (
          <Animated.View style={[styles.androidOverlay, { opacity: fadeAnim }]} />
        )}
        <KeyboardAvoidingView
          style={styles.overlayContent}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}>
          <TouchableOpacity 
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={handleClose}
          />
        <Animated.View 
          style={[
            styles.modalContent,
            keyboardVisible && styles.modalContentKeyboardOpen,
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
                <Text style={styles.headerTitle}>Paiement Mobile Money</Text>
                <Text style={styles.headerSubtitle}>{planName} - ${amount.toFixed(2)} USD</Text>
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
            
            {/* Phone Number Selection */}
            {profile?.phoneNumber && (
              <View style={styles.phoneSelectionContainer}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.phoneOptionButton,
                    useRegisteredPhone && styles.phoneOptionButtonActive
                  ]}
                  onPress={() => setUseRegisteredPhone(true)}
                  disabled={isProcessing}>
                  <View style={styles.phoneOptionContent}>
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
                  activeOpacity={0.7}
                  style={[
                    styles.phoneOptionButton,
                    !useRegisteredPhone && styles.phoneOptionButtonActive
                  ]}
                  onPress={() => setUseRegisteredPhone(false)}
                  disabled={isProcessing}>
                  <View style={styles.phoneOptionContent}>
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
                    editable={!isProcessing}
                  />
                </View>
                <Text style={styles.inputHint}>
                  Format: 12 chiffres commençant par 243
                </Text>
              </View>
            )}

            {/* Instructions */}
            {provider && (
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
        </Animated.View>
      </KeyboardAvoidingView>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  phoneOptionButton: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  phoneOptionButtonActive: {
    borderColor: '#003049',
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
    color: '#780000',
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
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  instructionRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  instructionBullet: {
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    marginRight: Spacing.sm,
    fontFamily: Typography.fontFamily.bold,
  },
  instructionText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.white,
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
