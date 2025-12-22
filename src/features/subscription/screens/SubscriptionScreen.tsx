// Subscription Screen - Paywall with multiple duration options and discounts
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import functions from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';
import {useSubscription, useAuth, useToast} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {
  SUBSCRIPTION_PLANS,
  TRIAL_DURATION_DAYS,
  calculateDiscountedPrice,
} from '@/shared/utils/constants';
import {formatCurrency} from '@/shared/utils/helpers';
import {SubscriptionDuration, SUBSCRIPTION_DURATIONS} from '@/shared/types';
import {analyticsService} from '@/shared/services/analytics';
import {APP_ID} from '@/shared/services/firebase/config';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Spinner} from '@/shared/components';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

type MobileMoneyProvider = 'mpesa' | 'orange' | 'airtel' | 'afrimoney';
type PaymentMethodType = 'mobile_money' | 'card';
type PlanId = 'free' | 'basic' | 'standard' | 'premium';

interface MobileMoneyOption {
  id: MobileMoneyProvider;
  name: string;
  icon: string;
  color: string;
  logo?: any;
}

const MOBILE_MONEY_OPTIONS: MobileMoneyOption[] = [
  {id: 'mpesa', name: 'M-Pesa', icon: 'phone', color: '#10B981', logo: require('../../../../assets/money-transfer/m-pesa.png')},
  {id: 'orange', name: 'Orange Money', icon: 'circle', color: '#FF6600', logo: require('../../../../assets/money-transfer/orange-money.png')},
  {id: 'airtel', name: 'Airtel Money', icon: 'circle', color: '#ED1C24', logo: require('../../../../assets/money-transfer/airtal-money.png')},
  {id: 'afrimoney', name: 'AfriMoney', icon: 'heart', color: '#FDB913', logo: require('../../../../assets/money-transfer/afrimoney.png')},
];

export function SubscriptionScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();
  const {subscription, isTrialActive, trialDaysRemaining} = useSubscription();
  const {showToast} = useToast();

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

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('standard');
  const [selectedDuration, setSelectedDuration] =
    useState<SubscriptionDuration>(1);
  const [paymentMethodType, setPaymentMethodType] =
    useState<PaymentMethodType>('mobile_money');
  const [selectedMobileMoney, setSelectedMobileMoney] =
    useState<MobileMoneyProvider | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

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

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Subscription', 'SubscriptionScreen');
  }, []);

  // Safety: Reset processing state if stuck (e.g., after 60 seconds)
  useEffect(() => {
    if (isProcessing) {
      const safetyTimer = setTimeout(() => {
        console.warn('Processing state stuck - auto-resetting');
        setIsProcessing(false);
      }, 60000); // 60 seconds

      return () => clearTimeout(safetyTimer);
    }
  }, [isProcessing]);

  const [email, setEmail] = useState('');
  const [isInDRC, setIsInDRC] = useState<boolean | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkUserLocation = async () => {
      if (!user?.uid) {
        if (isMounted) {
          setIsInDRC(true);
          setIsLoadingLocation(false);
        }
        return;
      }
      try {
        const profileDoc = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('profile')
          .doc('main')
          .get();
        if (isMounted && profileDoc.exists) {
          const profile = profileDoc.data();
          const isInDRCValue =
            profile?.isInDRC !== undefined
              ? profile.isInDRC
              : profile?.countryCode === 'CD' || true;
          setIsInDRC(isInDRCValue);
          if (profile?.phoneNumber) {setPhoneNumber(profile.phoneNumber);}
          if (profile?.email) {setEmail(profile.email);}
        } else if (isMounted) {
          setIsInDRC(true);
        }
      } catch (error) {
        console.error('Error checking user location:', error);
        if (isMounted) {
          setIsInDRC(true);
        }
      } finally {
        if (isMounted) {
          setIsLoadingLocation(false);
        }
      }
    };
    checkUserLocation();
    
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (isInDRC !== null) {
      setPaymentMethodType(isInDRC ? 'mobile_money' : 'card');
    }
  }, [isInDRC]);

  const isCurrentPlan = (planId: PlanId) => subscription?.planId === planId;

  // Check if user can renew early (subscription expiring or already subscribed)
  const canRenewEarly =
    subscription?.isSubscribed &&
    (subscription?.status === 'active' ||
      subscription?.status === 'expiring_soon');

  // Calculate if subscription is expiring soon (within 7 days)
  const isExpiringSoon =
    subscription?.status === 'expiring_soon' ||
    (subscription?.daysUntilExpiration !== undefined &&
      subscription.daysUntilExpiration <= 7);
  const daysUntilExpiration = subscription?.daysUntilExpiration || 0;

  // Get current plan pricing with selected duration
  const getCurrentPricing = () => {
    const plan = SUBSCRIPTION_PLANS[selectedPlan];
    if (!plan) {return {total: 0, monthly: 0, savings: 0};}
    return calculateDiscountedPrice(plan.price, selectedDuration);
  };

  const pricing = getCurrentPricing();

  // Phone number validation for DRC providers
  const validatePhoneNumber = (number: string, provider: MobileMoneyProvider | null): string | null => {
    if (!number || number.length < 9) {
      return isInDRC ? 'Numéro trop court (9 chiffres requis)' : 'Number too short (9 digits required)';
    }
    
    if (!provider) {
      return null; // No provider selected, skip provider validation
    }
    
    const firstTwoDigits = number.substring(0, 2);
    const providerPrefixes = {
      mpesa: ['81', '82', '89'], // Vodacom
      airtel: ['97', '99'],
      orange: ['80', '85', '88', '98'],
      afrimoney: ['90', '91', '92', '93', '94', '95', '96'] // Africell
    };
    
    const validPrefixes = providerPrefixes[provider];
    if (validPrefixes && !validPrefixes.includes(firstTwoDigits)) {
      const providerName = MOBILE_MONEY_OPTIONS.find(opt => opt.id === provider)?.name || provider;
      return isInDRC 
        ? `Ce numéro ne correspond pas à ${providerName}`
        : `This number doesn't match ${providerName}`;
    }
    
    return null;
  };

  const handleMobileMoneyPayment = async () => {
    if (!selectedMobileMoney) {
      Alert.alert('Mobile Money', 'Veuillez sélectionner un opérateur');
      return;
    }
    
    const phoneValidationError = validatePhoneNumber(phoneNumber, selectedMobileMoney);
    if (phoneValidationError) {
      Alert.alert('Numéro de téléphone', phoneValidationError);
      return;
    }
    const plan = SUBSCRIPTION_PLANS[selectedPlan];
    const durationLabel = SUBSCRIPTION_DURATIONS.find(
      d => d.months === selectedDuration,
    );

    Alert.alert(
      'Confirmer',
      `Souscrire à ${plan.name} pour ${
        durationLabel?.labelFr || selectedDuration + ' mois'
      }\n` +
        `Total: ${formatCurrency(pricing.total)}${
          pricing.savings > 0
            ? `\nÉconomie: ${formatCurrency(pricing.savings)}`
            : ''
        }`,
      [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Confirmer',
          onPress: async () => {
            // Track subscription attempt
            analyticsService.logCustomEvent('subscription_attempted', {
              plan_id: selectedPlan,
              duration_months: selectedDuration,
              payment_method: 'mobile_money',
              provider: selectedMobileMoney,
              amount: pricing.total,
              currency: 'USD',
            });

            setIsProcessing(true);
            // Safety timeout to prevent stuck state
            const timeoutId = setTimeout(() => {
              setIsProcessing(false);
              Alert.alert('Timeout', 'La demande a pris trop de temps. Réessayez.');
            }, 30000); // 30 seconds timeout
            
            try {
              const result = await functions().httpsCallable(
                'initiateMokoPayment',
              )({
                planId: selectedPlan,
                paymentMethod: selectedMobileMoney,
                amount: pricing.total,
                currency: 'USD',
                phoneNumber,
                durationMonths: selectedDuration,
              });
              clearTimeout(timeoutId);
              const {status, message} = result.data as any;

              // Track subscription result
              analyticsService.logCustomEvent('subscription_completed', {
                plan_id: selectedPlan,
                duration_months: selectedDuration,
                payment_method: 'mobile_money',
                provider: selectedMobileMoney,
                amount: pricing.total,
                currency: 'USD',
                success: status === 'success',
                status: status,
              });

              Alert.alert(
                status === 'success' ? 'Activé!' : 'Initié',
                message || 'Vérifiez votre téléphone',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      if (status === 'success') {
                        showToast('Souscription activée avec succès!', 'success', 3000);
                      }
                      navigation.goBack();
                    }
                  }
                ],
              );
            } catch (error: any) {
              // Track subscription failure
              analyticsService.logCustomEvent('subscription_failed', {
                plan_id: selectedPlan,
                duration_months: selectedDuration,
                payment_method: 'mobile_money',
                provider: selectedMobileMoney,
                amount: pricing.total,
                error: error.message,
              });
              Alert.alert('Erreur', error.message || 'Réessayez');
            } finally {
              clearTimeout(timeoutId);
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleCardPayment = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert(
        'Email',
        isInDRC ? 'Entrez un email valide' : 'Enter a valid email',
      );
      return;
    }
    const plan = SUBSCRIPTION_PLANS[selectedPlan];
    const durationLabel = SUBSCRIPTION_DURATIONS.find(
      d => d.months === selectedDuration,
    );

    Alert.alert(
      isInDRC ? 'Confirmer' : 'Confirm',
      `Subscribe to ${plan.name} for ${
        durationLabel?.label || selectedDuration + ' months'
      }\n` +
        `Total: ${formatCurrency(pricing.total)}${
          pricing.savings > 0
            ? `\nSavings: ${formatCurrency(pricing.savings)}`
            : ''
        }`,
      [
        {text: isInDRC ? 'Annuler' : 'Cancel', style: 'cancel'},
        {
          text: isInDRC ? 'Continuer' : 'Continue',
          onPress: async () => {
            // Track subscription attempt
            analyticsService.logCustomEvent('subscription_attempted', {
              plan_id: selectedPlan,
              duration_months: selectedDuration,
              payment_method: 'card',
              amount: pricing.total,
              currency: 'USD',
            });

            setIsProcessing(true);
            // Safety timeout to prevent stuck state
            const timeoutId = setTimeout(() => {
              setIsProcessing(false);
              Alert.alert('Timeout', 'Request took too long. Please try again.');
            }, 30000); // 30 seconds timeout
            
            try {
              await functions().httpsCallable('createPaymentIntent')({
                planId: selectedPlan,
                currency: 'USD',
                email,
                durationMonths: selectedDuration,
              });
              clearTimeout(timeoutId);

              // Track subscription result (card payment is more complex, so we track initiation)
              analyticsService.logCustomEvent('subscription_completed', {
                plan_id: selectedPlan,
                duration_months: selectedDuration,
                payment_method: 'card',
                amount: pricing.total,
                currency: 'USD',
                success: true,
                status: 'initiated',
              });

              Alert.alert(
                isInDRC ? 'Paiement carte' : 'Card Payment',
                'Stripe SDK integration required',
                [{text: 'OK'}],
              );
            } catch (error: any) {
              // Track subscription failure
              analyticsService.logCustomEvent('subscription_failed', {
                plan_id: selectedPlan,
                duration_months: selectedDuration,
                payment_method: 'card',
                amount: pricing.total,
                error: error.message,
              });
              Alert.alert('Error', error.message || 'Try again');
            } finally {
              clearTimeout(timeoutId);
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleSubscribe = () => {
    paymentMethodType === 'mobile_money'
      ? handleMobileMoneyPayment()
      : handleCardPayment();
  };

  if (isLoadingLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Spinner size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
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

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: insets.top + Spacing.md,
                paddingBottom: insets.bottom + 40,
              },
            ]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isProcessing}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}>
        {/* Header */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="chevron-left" size="md" color={Colors.text.primary} />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.header,
            {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
          ]}>
          <View style={styles.proIconContainer}>
            <LinearGradient
              colors={['#780000', '#FDB913']}
              style={styles.proIconGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <Icon name="crown" size="xl" color={Colors.white} />
            </LinearGradient>
          </View>
          <Text style={styles.headerTitle}>GoShopper Pro</Text>
          <Text style={styles.headerSubtitle}>
            {isInDRC
              ? 'Débloquez toutes les fonctionnalités'
              : 'Unlock all premium features'}
          </Text>
        </Animated.View>

        {/* Trial Banner */}
        {isTrialActive && (
          <Animated.View style={[styles.trialCard, {opacity: fadeAnim}]}>
            <View style={styles.trialGradient}>
              <View style={styles.trialIconContainer}>
                <Icon name="gift" size="lg" color={Colors.status.success} />
              </View>
              <View style={styles.trialInfo}>
                <Text style={styles.trialTitle}>
                  {isInDRC ? 'Essai gratuit actif' : 'Free Trial Active'}
                </Text>
                <Text style={styles.trialDesc}>
                  {trialDaysRemaining}{' '}
                  {isInDRC ? 'jours restants' : 'days left'}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Expiring Soon Banner */}
        {isExpiringSoon && !isTrialActive && (
          <Animated.View style={[styles.warningCard, {opacity: fadeAnim}]}>
            <View style={styles.warningIconContainer}>
              <Icon
                name="alert-triangle"
                size="lg"
                color={Colors.status.error}
              />
            </View>
            <View style={styles.trialInfo}>
              <Text style={styles.warningTitle}>
                {isInDRC
                  ? 'Abonnement expire bientôt!'
                  : 'Subscription expiring soon!'}
              </Text>
              <Text style={styles.warningDesc}>
                {daysUntilExpiration} {isInDRC ? 'jours restants' : 'days left'}{' '}
                - {isInDRC ? 'Renouvelez maintenant!' : 'Renew now!'}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Renew Early Banner */}
        {canRenewEarly && !isExpiringSoon && (
          <Animated.View style={[styles.renewCard, {opacity: fadeAnim}]}>
            <View style={styles.renewGradient}>
              <View style={styles.renewIconContainer}>
                <Icon name="sparkles" size="lg" color={Colors.primary} />
              </View>
              <View style={styles.trialInfo}>
                <Text style={styles.renewTitle}>
                  {isInDRC ? 'Renouveler tôt?' : 'Renew Early?'}
                </Text>
                <Text style={styles.renewDesc}>
                  {isInDRC
                    ? 'Prolongez votre abonnement maintenant et économisez!'
                    : 'Extend your subscription now and save!'}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Plan Selection */}
        <Text style={styles.sectionTitle}>
          {isInDRC ? 'Choisir un plan' : 'Choose a Plan'}
        </Text>

        {Object.entries(SUBSCRIPTION_PLANS)
          .filter(([id]) => id !== 'free')
          .map(([id, plan]) => {
            const planId = id as PlanId;
            const isSelected = selectedPlan === planId;
            const isCurrent = isCurrentPlan(planId);
            return (
              <TouchableOpacity
                key={planId}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                onPress={() => setSelectedPlan(planId)}
                disabled={isCurrent && !canRenewEarly}
                activeOpacity={0.8}>
                {isSelected && (
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    style={styles.planSelectedIndicator}
                    start={{x: 0, y: 0}}
                    end={{x: 0, y: 1}}
                  />
                )}
                <View style={styles.planHeader}>
                  <View style={styles.planNameContainer}>
                    <Text
                      style={[
                        styles.planName,
                        isSelected && styles.planNameSelected,
                      ]}>
                      {plan.name}
                    </Text>
                    {planId === 'standard' && (
                      <View style={styles.popularBadge}>
                        <Icon
                          name="star"
                          size="xs"
                          color={Colors.card.yellow}
                        />
                        <Text style={styles.popularBadgeText}>
                          {isInDRC ? 'Populaire' : 'Popular'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.planPriceContainer}>
                    <Text
                      style={[
                        styles.planPrice,
                        isSelected && styles.planPriceSelected,
                      ]}>
                      {formatCurrency(plan.price)}
                    </Text>
                    <Text style={styles.planPeriod}>
                      /{isInDRC ? 'mois' : 'mo'}
                    </Text>
                  </View>
                </View>
                <View style={styles.planFeature}>
                  <Icon
                    name="camera"
                    size="sm"
                    color={isSelected ? Colors.primary : Colors.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.featureText,
                      isSelected && styles.featureTextSelected,
                    ]}>
                    {plan.scanLimit === -1
                      ? isInDRC
                        ? 'Scans illimités'
                        : 'Unlimited scans'
                      : `${plan.scanLimit} scans`}
                  </Text>
                </View>
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Icon
                      name="check"
                      size="xs"
                      color={Colors.status.success}
                    />
                    <Text style={styles.currentText}>
                      {isInDRC ? 'Plan actuel' : 'Current'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

        {/* Duration Selection */}
        {selectedPlan !== 'free' && (
          <>
            <Text style={styles.sectionTitle}>
              {isInDRC ? "Durée d'abonnement" : 'Subscription Duration'}
            </Text>
            <View style={styles.durationGrid}>
              {SUBSCRIPTION_DURATIONS.map(duration => {
                const isSelected = selectedDuration === duration.months;
                const planPrice = SUBSCRIPTION_PLANS[selectedPlan]?.price || 0;
                const durationPricing = calculateDiscountedPrice(
                  planPrice,
                  duration.months,
                );
                const isBestValue = duration.months === 12;

                return (
                  <TouchableOpacity
                    key={duration.months}
                    style={[
                      styles.durationCard,
                      isSelected && styles.durationCardSelected,
                      isBestValue && styles.bestValueCard,
                    ]}
                    onPress={() => setSelectedDuration(duration.months)}
                    activeOpacity={0.8}>
                    {duration.discountPercent > 0 && (
                      <View
                        style={[
                          styles.discountBadge,
                          isBestValue && styles.bestValueBadge,
                        ]}>
                        <Text style={styles.discountBadgeText}>
                          {isInDRC ? duration.badgeFr : duration.badge}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.durationLabel,
                        isSelected && styles.durationLabelSelected,
                      ]}>
                      {isInDRC ? duration.labelFr : duration.label}
                    </Text>
                    <Text
                      style={[
                        styles.durationPrice,
                        isSelected && styles.durationPriceSelected,
                      ]}>
                      {formatCurrency(durationPricing.total)}
                    </Text>
                    {duration.months > 1 && (
                      <Text style={styles.monthlyEquivalent}>
                        ~{formatCurrency(durationPricing.monthly)}/
                        {isInDRC ? 'mois' : 'mo'}
                      </Text>
                    )}
                    {durationPricing.savings > 0 && (
                      <View style={styles.savingsBadge}>
                        <Icon
                          name="trending-down"
                          size="xs"
                          color={Colors.status.success}
                        />
                        <Text style={styles.savingsText}>
                          {formatCurrency(durationPricing.savings)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Payment Method Selection */}
        {selectedPlan !== 'free' && isInDRC && (
          <>
            <Text style={styles.sectionTitle}>Mode de paiement</Text>
            <View style={styles.paymentTypeSelector}>
              <TouchableOpacity
                style={[
                  styles.paymentTypeButton,
                  paymentMethodType === 'mobile_money' &&
                    styles.paymentTypeButtonSelected,
                ]}
                onPress={() => setPaymentMethodType('mobile_money')}
                activeOpacity={0.8}>
                <View style={styles.paymentTypeIcon}>
                  <Icon
                    name="smartphone"
                    size="md"
                    color={
                      paymentMethodType === 'mobile_money'
                        ? Colors.primary
                        : Colors.text.tertiary
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.paymentTypeText,
                    paymentMethodType === 'mobile_money' &&
                      styles.paymentTypeTextSelected,
                  ]}>
                  Mobile Money
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.paymentTypeButton,
                  paymentMethodType === 'card' &&
                    styles.paymentTypeButtonSelected,
                ]}
                onPress={() => setPaymentMethodType('card')}
                activeOpacity={0.8}>
                <View style={styles.paymentTypeIcon}>
                  <Icon
                    name="credit-card"
                    size="md"
                    color={
                      paymentMethodType === 'card'
                        ? Colors.primary
                        : Colors.text.tertiary
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.paymentTypeText,
                    paymentMethodType === 'card' &&
                      styles.paymentTypeTextSelected,
                  ]}>
                  Visa/Card
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {selectedPlan !== 'free' &&
          isInDRC &&
          paymentMethodType === 'mobile_money' && (
            <>
              <Text style={styles.sectionTitle}>Opérateur</Text>
              <View style={styles.mobileMoneyGrid}>
                {MOBILE_MONEY_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.mobileMoneyCard,
                      selectedMobileMoney === opt.id &&
                        styles.mobileMoneyCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedMobileMoney(opt.id);
                      // Re-validate phone number with new provider
                      if (phoneNumber) {
                        const error = validatePhoneNumber(phoneNumber, opt.id);
                        setPhoneError(error);
                      }
                    }}
                    activeOpacity={0.8}>
                    <View
                      style={[
                        styles.mobileMoneyIconContainer,
                        {backgroundColor: `${opt.color}20`},
                      ]}>
                      {opt.logo ? (
                        <Image 
                          source={opt.logo}
                          style={styles.mobileMoneyLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <Icon name={opt.icon} size="md" color={opt.color} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.mobileMoneyName,
                        selectedMobileMoney === opt.id &&
                          styles.mobileMoneyNameSelected,
                      ]}>
                      {opt.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Téléphone</Text>
                <View style={styles.phoneInputWrapper}>
                  <View style={styles.phonePrefixContainer}>
                    <Text style={styles.phonePrefix}>+243</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.phoneInput,
                      phoneError && styles.phoneInputError
                    ]}
                    placeholder="812345678"
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={(text) => {
                      // Clean the input and format it
                      let cleanText = text.replace(/[^0-9]/g, '');
                      
                      // Remove leading zero if present (handle 088 -> 88 case)
                      if (cleanText.startsWith('0')) {
                        cleanText = cleanText.substring(1);
                      }
                      
                      // Limit to 9 digits maximum
                      if (cleanText.length > 9) {
                        cleanText = cleanText.substring(0, 9);
                      }
                      
                      setPhoneNumber(cleanText);
                      
                      // Validate phone number
                      const error = validatePhoneNumber(cleanText, selectedMobileMoney);
                      setPhoneError(error);
                    }}
                  />
                </View>
                {phoneError && (
                  <Text style={styles.phoneErrorText}>{phoneError}</Text>
                )}
              </View>
            </>
          )}

        {selectedPlan !== 'free' &&
          (!isInDRC || paymentMethodType === 'card') && (
            <>
              <Text style={styles.sectionTitle}>
                {isInDRC ? 'Paiement carte' : 'Card Payment'}
              </Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.emailInputWrapper}>
                  <Icon name="mail" size="sm" color={Colors.text.tertiary} />
                  <TextInput
                    style={styles.emailInput}
                    placeholder="your@email.com"
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>
              <View style={styles.cardNotice}>
                <Icon name="shield" size="md" color={Colors.primary} />
                <Text style={styles.cardNoticeText}>
                  {isInDRC
                    ? 'Paiement sécurisé Stripe'
                    : 'Secure Stripe payment'}
                </Text>
              </View>
            </>
          )}

        {/* Subscribe Button */}
        {selectedPlan !== 'free' && (
          <TouchableOpacity
            style={[
              styles.subscribeButton,
              isProcessing && styles.subscribeButtonDisabled,
            ]}
            onPress={handleSubscribe}
            disabled={isProcessing}
            activeOpacity={0.9}>
            <View
              style={[
                styles.subscribeButtonGradient,
                {
                  backgroundColor: Colors.white,
                  borderWidth: 2,
                  borderColor: isProcessing ? Colors.border.light : Colors.primary,
                }
              ]}>
              {isProcessing ? (
                <Spinner size="small" color={Colors.primary} />
              ) : (
                <View style={styles.subscribeButtonContent}>
                  <Text style={styles.subscribeButtonText}>
                    {canRenewEarly
                      ? isInDRC
                        ? 'Renouveler'
                        : 'Renew'
                      : isInDRC
                      ? "S'abonner"
                      : 'Subscribe'}{' '}
                    - {formatCurrency(pricing.total)}
                  </Text>
                  {pricing.savings > 0 && (
                    <Text style={styles.subscribeButtonSavings}>
                      {isInDRC
                        ? `Économie de ${formatCurrency(pricing.savings)}`
                        : `Save ${formatCurrency(pricing.savings)}`}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}

        <Text style={styles.termsText}>
          {selectedDuration === 1
            ? isInDRC
              ? 'Renouvellement automatique mensuel'
              : 'Auto-renews monthly'
            : isInDRC
            ? `Paiement unique pour ${selectedDuration} mois`
            : `One-time payment for ${selectedDuration} months`}
        </Text>

        {/* Feature List */}
        {selectedPlan !== 'free' && (
          <View style={styles.featuresList}>
            <View style={styles.featuresHeader}>
              <Icon name="sparkles" size="md" color={Colors.primary} />
              <Text style={styles.featuresTitle}>
                {isInDRC
                  ? 'Inclus dans votre abonnement'
                  : 'Included in your subscription'}
              </Text>
            </View>
            {SUBSCRIPTION_PLANS[selectedPlan]?.features.map(
              (feature, index) => (
                <View key={index} style={styles.featureItemRow}>
                  <Icon name="check" size="sm" color={Colors.status.success} />
                  <Text style={styles.featureItem}>{feature}</Text>
                </View>
              ),
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Actions rapides</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={[styles.quickAction, {backgroundColor: Colors.white}]}
              onPress={() => navigation.push('Stats')}>
              <Icon name="stats" size="md" color={Colors.primary} />
              <Text style={[styles.quickActionLabel, {color: Colors.text.primary}]}>Statistiques</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, {backgroundColor: Colors.white}]}
              onPress={() => navigation.push('Shops')}>
              <Icon name="shopping-bag" size="md" color={Colors.primary} />
              <Text style={[styles.quickActionLabel, {color: Colors.text.primary}]}>Mes Magasins</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, {backgroundColor: Colors.white}]}
              onPress={() => navigation.push('AIAssistant')}>
              <Icon name="help" size="md" color={Colors.primary} />
              <Text style={[styles.quickActionLabel, {color: Colors.text.primary}]}>Assistant IA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, {backgroundColor: Colors.white}]}
              onPress={() => navigation.push('Achievements')}>
              <Icon name="trophy" size="md" color={Colors.primary} />
              <Text style={[styles.quickActionLabel, {color: Colors.text.primary}]}>Mes succès</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, {backgroundColor: Colors.white}]}
              onPress={() => navigation.push('Settings')}>
              <Icon name="settings" size="md" color={Colors.primary} />
              <Text style={[styles.quickActionLabel, {color: Colors.text.primary}]}>Paramètres</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  proIconContainer: {
    marginBottom: Spacing.md,
  },
  proIconGradient: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Trial/Banner cards
  trialCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  trialGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.lg,
  },
  trialIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  trialInfo: {
    flex: 1,
  },
  trialTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  trialDesc: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: Colors.status.error,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  warningIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  warningTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.status.error,
  },
  warningDesc: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  renewCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  renewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.lg,
  },
  renewIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  renewTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  renewDesc: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },

  // Plan cards
  planCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border.light,
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.sm,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  planSelectedIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  planNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  planName: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  planNameSelected: {
    color: Colors.primary,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FDB913',
  },
  popularBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  planPriceSelected: {
    color: Colors.primary,
  },
  planPeriod: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  planFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  featureTextSelected: {
    color: Colors.primary,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 4,
  },
  currentText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.status.success,
  },

  // Duration selection
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  durationCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm) / 2,
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 3,
    borderColor: Colors.border.light,
    alignItems: 'center',
    position: 'relative',
    ...Shadows.md,
  },
  durationCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  bestValueCard: {
    borderColor: '#FDB913',
    backgroundColor: Colors.white,
  },
  discountBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  bestValueBadge: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  discountBadgeText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
  },
  durationLabel: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  durationLabelSelected: {
    color: Colors.primary,
  },
  durationPrice: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  durationPriceSelected: {
    color: Colors.primary,
  },
  monthlyEquivalent: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.status.success,
  },
  savingsText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.status.success,
  },

  // Payment methods
  paymentTypeSelector: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  paymentTypeButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 3,
    borderColor: Colors.border.light,
    ...Shadows.md,
  },
  paymentTypeButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  paymentTypeIcon: {
    marginBottom: Spacing.sm,
  },
  paymentTypeText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },
  paymentTypeTextSelected: {
    color: Colors.primary,
  },

  // Mobile Money
  mobileMoneyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  mobileMoneyCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm) / 2,
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius['2xl'],
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.border.light,
    ...Shadows.md,
  },
  mobileMoneyCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.card.cream,
  },
  mobileMoneyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  mobileMoneyLogo: {
    width: 48,
    height: 48,
  },
  mobileMoneyIcon: {
    fontSize: 24,
  },
  mobileMoneyName: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },
  mobileMoneyNameSelected: {
    color: Colors.primary,
  },

  // Input fields
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
    overflow: 'hidden',
  },
  phonePrefixContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderRightWidth: 1,
    borderRightColor: Colors.border.light,
  },
  phonePrefix: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  phoneInputError: {
    borderColor: Colors.status.error,
  },
  phoneErrorText: {
    marginTop: Spacing.xs,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.status.error,
  },
  phoneInputError: {
    borderColor: Colors.status.error,
  },
  phoneErrorText: {
    marginTop: Spacing.xs,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.status.error,
  },
  emailInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  emailInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  cardNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  cardNoticeText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },

  // Subscribe button
  subscribeButton: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeButtonGradient: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  subscribeButtonContent: {
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
  },
  subscribeButtonSavings: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    opacity: 0.7,
    marginTop: 4,
  },
  termsText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },

  // Features list
  featuresList: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    ...Shadows.sm,
  },
  featuresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  featuresTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  featureItem: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },
  quickActionsSection: {
    marginTop: Spacing.xl,
  },
  quickActionsTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  quickAction: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  quickActionLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});

export default SubscriptionScreen;
