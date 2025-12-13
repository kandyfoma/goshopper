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
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import functions from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';
import {useSubscription, useAuth} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {
  SUBSCRIPTION_PLANS,
  TRIAL_DURATION_DAYS,
  calculateDiscountedPrice,
} from '@/shared/utils/constants';
import {formatCurrency} from '@/shared/utils/helpers';
import {SubscriptionDuration, SUBSCRIPTION_DURATIONS} from '@/shared/types';
import {analyticsService} from '@/shared/services/analytics';
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
}

const MOBILE_MONEY_OPTIONS: MobileMoneyOption[] = [
  {id: 'mpesa', name: 'M-Pesa', icon: 'phone', color: '#4CAF50'},
  {id: 'orange', name: 'Orange Money', icon: 'circle', color: '#FF6600'},
  {id: 'airtel', name: 'Airtel Money', icon: 'circle', color: '#ED1C24'},
  {id: 'afrimoney', name: 'AfriMoney', icon: 'heart', color: '#FFB300'},
];

export function SubscriptionScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();
  const {subscription, isTrialActive, trialDaysRemaining} = useSubscription();

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
  const [email, setEmail] = useState('');
  const [isInDRC, setIsInDRC] = useState<boolean | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    const checkUserLocation = async () => {
      if (!user?.uid) {
        setIsInDRC(true);
        setIsLoadingLocation(false);
        return;
      }
      try {
        const profileDoc = await firestore()
          .collection('artifacts')
          .doc('goshopperai')
          .collection('users')
          .doc(user.uid)
          .collection('profile')
          .doc('main')
          .get();
        if (profileDoc.exists) {
          const profile = profileDoc.data();
          const isInDRCValue =
            profile?.isInDRC !== undefined
              ? profile.isInDRC
              : profile?.countryCode === 'CD' || true;
          setIsInDRC(isInDRCValue);
          if (profile?.phoneNumber) {setPhoneNumber(profile.phoneNumber);}
          if (profile?.email) {setEmail(profile.email);}
        } else {
          setIsInDRC(true);
        }
      } catch (error) {
        console.error('Error checking user location:', error);
        setIsInDRC(true);
      } finally {
        setIsLoadingLocation(false);
      }
    };
    checkUserLocation();
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

  const handleMobileMoneyPayment = async () => {
    if (!selectedMobileMoney) {
      Alert.alert('Mobile Money', 'Veuillez sélectionner un opérateur');
      return;
    }
    if (!phoneNumber || phoneNumber.length < 9) {
      Alert.alert('Numéro de téléphone', 'Veuillez entrer un numéro valide');
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
                [{text: 'OK', onPress: () => navigation.goBack()}],
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
            try {
              await functions().httpsCallable('createPaymentIntent')({
                planId: selectedPlan,
                currency: 'USD',
                email,
                durationMonths: selectedDuration,
              });

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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}>
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
              colors={[Colors.primary, Colors.primaryDark]}
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
            <LinearGradient
              colors={[Colors.card.cream, '#F5E6C3']}
              style={styles.trialGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
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
            </LinearGradient>
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
            <LinearGradient
              colors={[Colors.card.blue, '#C8D4E8']}
              style={styles.renewGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
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
            </LinearGradient>
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
                    onPress={() => setSelectedMobileMoney(opt.id)}
                    activeOpacity={0.8}>
                    <View
                      style={[
                        styles.mobileMoneyIconContainer,
                        {backgroundColor: `${opt.color}20`},
                      ]}>
                      <Icon 
                        name={opt.icon} 
                        size="lg" 
                        color={opt.color}
                        variant="filled"
                      />
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
                    style={styles.phoneInput}
                    placeholder="812345678"
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    maxLength={12}
                  />
                </View>
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
            <LinearGradient
              colors={
                isProcessing
                  ? [Colors.border.light, Colors.border.light]
                  : [Colors.primary, Colors.primaryDark]
              }
              style={styles.subscribeButtonGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              {isProcessing ? (
                <Spinner size="small" color={Colors.white} />
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
            </LinearGradient>
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
      </ScrollView>
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
    backgroundColor: Colors.card.blue,
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
    backgroundColor: Colors.card.yellow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
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
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: Colors.border.light,
    alignItems: 'center',
    position: 'relative',
    ...Shadows.sm,
  },
  durationCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.card.blue,
  },
  bestValueCard: {
    borderColor: Colors.card.yellow,
    backgroundColor: '#FFFDF5',
  },
  discountBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  bestValueBadge: {
    backgroundColor: '#F59E0B',
  },
  discountBadgeText: {
    color: Colors.white,
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
    backgroundColor: Colors.card.cream,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
    gap: 4,
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
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  paymentTypeButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.card.blue,
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
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  mobileMoneyCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.card.blue,
  },
  mobileMoneyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
    backgroundColor: Colors.card.blue,
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
    backgroundColor: Colors.card.blue,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
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
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
  },
  subscribeButtonSavings: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    opacity: 0.9,
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
});

export default SubscriptionScreen;
