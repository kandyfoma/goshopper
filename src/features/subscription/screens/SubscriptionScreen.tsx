// Subscription Screen - Modern Redesign with Clean UX
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import {useSubscription, useAuth} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {
  SUBSCRIPTION_PLANS,
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

type PlanId = 'freemium' | 'free' | 'basic' | 'standard' | 'premium';

interface MobileMoneyOption {
  id: string;
  name: string;
  color: string;
  logo?: any;
  prefixes: string[];
}

const MOBILE_MONEY_OPTIONS: MobileMoneyOption[] = [
  {
    id: 'mpesa',
    name: 'M-Pesa',
    color: '#10B981',
    logo: require('../../../../assets/money-transfer/m-pesa.png'),
    prefixes: ['81', '82', '83'],
  },
  {
    id: 'orange',
    name: 'Orange Money',
    color: '#FF6600',
    logo: require('../../../../assets/money-transfer/orange-money.png'),
    prefixes: ['80'],
  },
  {
    id: 'airtel',
    name: 'Airtel Money',
    color: '#ED1C24',
    logo: require('../../../../assets/money-transfer/airtal-money.png'),
    prefixes: ['84', '85', '86', '89', '90', '91', '97', '99'],
  },
  {
    id: 'afrimoney',
    name: 'AfriMoney',
    color: '#FDB913',
    logo: require('../../../../assets/money-transfer/afrimoney.png'),
    prefixes: ['98'],
  },
];

const PLAN_FEATURES: Record<PlanId, {icon: string; highlight: string}[]> = {
  freemium: [
    {icon: 'camera', highlight: '3 scans/mois'},
    {icon: 'sparkles', highlight: 'IA basique'},
  ],
  free: [],
  basic: [
    {icon: 'camera', highlight: '25 scans/mois'},
    {icon: 'sparkles', highlight: 'Reconnaissance IA'},
    {icon: 'list', highlight: 'Listes de courses'},
  ],
  standard: [
    {icon: 'camera', highlight: '100 scans/mois'},
    {icon: 'sparkles', highlight: 'IA avancée'},
    {icon: 'chart-line', highlight: 'Stats complètes'},
    {icon: 'trending-up', highlight: 'Comparaison prix'},
    {icon: 'bell', highlight: 'Alertes prix'},
  ],
  premium: [
    {icon: 'camera', highlight: '1,000 scans/mois'},
    {icon: 'sparkles', highlight: 'IA premium'},
    {icon: 'trending-up', highlight: 'Comparaison prix'},
    {icon: 'chart-line', highlight: 'Stats complètes'},
    {icon: 'chart-bar', highlight: 'Analytics pro'},
    {icon: 'bell', highlight: 'Alertes prioritaires'},
    {icon: 'list', highlight: 'Listes avancées'},
    {icon: 'download', highlight: 'Export données'},
  ],
};

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

  if (!isAuthenticated) {
    return null;
  }

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('standard');
  const [selectedDuration, setSelectedDuration] =
    useState<SubscriptionDuration>(1);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    analyticsService.logScreenView('Subscription', 'SubscriptionScreen');
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkUserLocation = async () => {
      if (!user?.uid) {
        if (isMounted) setIsLoadingLocation(false);
        return;
      }
      try {
        await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('profile')
          .doc('main')
          .get();
        if (isMounted) setIsLoadingLocation(false);
      } catch (error) {
        console.error('Error checking user location:', error);
        if (isMounted) setIsLoadingLocation(false);
      }
    };
    checkUserLocation();
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const isCurrentPlan = (planId: PlanId) => subscription?.planId === planId;

  const getCurrentPricing = () => {
    const plan = SUBSCRIPTION_PLANS[selectedPlan];
    if (!plan) return {total: 0, monthly: 0, savings: 0};
    return calculateDiscountedPrice(plan.price, selectedDuration);
  };

  const pricing = getCurrentPricing();

  const handleSubscribe = () => {
    const plan = SUBSCRIPTION_PLANS[selectedPlan];
    const durationLabel = SUBSCRIPTION_DURATIONS.find(
      d => d.months === selectedDuration,
    );

    analyticsService.logCustomEvent('subscription_attempted', {
      plan_id: selectedPlan,
      duration_months: selectedDuration,
      amount: pricing.total,
      currency: 'USD',
    });

    navigation.navigate('MokoPayment', {
      amount: pricing.total,
      planId: selectedPlan,
      planName: `${plan.name} - ${durationLabel?.labelFr || selectedDuration + ' mois'}`,
    });
  };

  if (isLoadingLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Spinner size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  // Filter out 'free' and 'freemium' - freemium is auto-assigned monthly
  const plans = Object.entries(SUBSCRIPTION_PLANS).filter(
    ([id]) => id !== 'free' && id !== 'freemium',
  ) as [PlanId, typeof SUBSCRIPTION_PLANS['basic']][];

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
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="chevron-left" size="md" color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Abonnement</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Trial Banner */}
        {isTrialActive && (
          <Animated.View
            style={[
              styles.trialBanner,
              {opacity: fadeAnim, transform: [{scale: scaleAnim}]},
            ]}>
            <View style={styles.trialIconContainer}>
              <Icon name="gift" size="lg" color={Colors.white} />
            </View>
            <View style={styles.trialInfo}>
              <Text style={styles.trialTitle}>Essai gratuit actif</Text>
              <Text style={styles.trialDays}>
                {trialDaysRemaining} jours restants
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Plan Selection - Horizontal Cards */}
        <Text style={styles.sectionTitle}>Choisir un plan</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.plansScrollContent}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH * 0.75 + Spacing.md}>
          {plans.map(([id, plan]) => {
            const planId = id as PlanId;
            const isSelected = selectedPlan === planId;
            const isCurrent = isCurrentPlan(planId);
            const isPopular = planId === 'standard';

            return (
              <Animated.View
                key={planId}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                  {opacity: fadeAnim, transform: [{scale: scaleAnim}]},
                ]}>
                {isPopular && (
                  <View style={styles.popularTag}>
                    <Icon name="star" size="xs" color={Colors.white} />
                    <Text style={styles.popularText}>Populaire</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => setSelectedPlan(planId)}
                  activeOpacity={0.9}
                  style={styles.planCardInner}>
                  <View style={[
                    styles.planIconContainer,
                    isSelected && styles.planIconContainerSelected,
                  ]}>
                    <Icon
                      name={
                        planId === 'basic'
                          ? 'zap'
                          : planId === 'standard'
                          ? 'crown'
                          : 'diamond'
                      }
                      size="xl"
                      color={isSelected ? Colors.white : Colors.primary}
                    />
                  </View>

                  <Text
                    style={[
                      styles.planName,
                      isSelected && styles.planNameSelected,
                    ]}>
                    {plan.name}
                  </Text>

                  <View style={styles.planPriceRow}>
                    <Text
                      style={[
                        styles.planPrice,
                        isSelected && styles.planPriceSelected,
                      ]}>
                      {formatCurrency(plan.price)}
                    </Text>
                    <Text
                      style={[
                        styles.planPeriod,
                        isSelected && styles.planPeriodSelected,
                      ]}>
                      /mois
                    </Text>
                  </View>

                  <View style={styles.planFeatures}>
                    {PLAN_FEATURES[planId].slice(0, 3).map((feature, idx) => (
                      <View key={idx} style={styles.planFeatureRow}>
                        <Icon
                          name={feature.icon}
                          size="sm"
                          color={
                            isSelected
                              ? 'rgba(255,255,255,0.8)'
                              : Colors.text.tertiary
                          }
                        />
                        <Text
                          style={[
                            styles.planFeatureText,
                            isSelected && styles.planFeatureTextSelected,
                          ]}>
                          {feature.highlight}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {isCurrent && (
                    <View style={styles.currentPlanBadge}>
                      <Icon name="check" size="xs" color={Colors.white} />
                      <Text style={styles.currentPlanText}>Plan actuel</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Duration Selection */}
        <Text style={styles.sectionTitle}>Durée</Text>
        <View style={styles.durationContainer}>
          {SUBSCRIPTION_DURATIONS.map(duration => {
            const isSelected = selectedDuration === duration.months;
            const planPrice = SUBSCRIPTION_PLANS[selectedPlan]?.price || 0;
            const durationPricing = calculateDiscountedPrice(
              planPrice,
              duration.months,
            );

            return (
              <TouchableOpacity
                key={duration.months}
                style={[
                  styles.durationPill,
                  isSelected && styles.durationPillSelected,
                ]}
                onPress={() => setSelectedDuration(duration.months)}
                activeOpacity={0.8}>
                {duration.discountPercent > 0 && (
                  <View style={styles.durationDiscount}>
                    <Text style={styles.durationDiscountText}>
                      -{duration.discountPercent}%
                    </Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.durationText,
                    isSelected && styles.durationTextSelected,
                  ]}>
                  {duration.labelFr}
                </Text>
                <Text
                  style={[
                    styles.durationPrice,
                    isSelected && styles.durationPriceSelected,
                  ]}>
                  {formatCurrency(durationPricing.total)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Separator */}
        <View style={styles.sectionSeparator} />

        {/* Payment Methods Preview */}
        <Text style={styles.sectionTitle}>Moyens de paiement</Text>
        <View style={styles.paymentMethodsRow}>
          {MOBILE_MONEY_OPTIONS.map(option => (
            <View key={option.id} style={styles.paymentMethodItem}>
              {option.logo && (
                <Image
                  source={option.logo}
                  style={styles.paymentMethodLogo}
                  resizeMode="contain"
                />
              )}
            </View>
          ))}
        </View>
        <Text style={styles.paymentMethodHint}>
          Détection automatique du réseau lors du paiement
        </Text>

        {/* Separator */}
        <View style={styles.sectionSeparator} />

        {/* Features included */}
        <View style={styles.featuresCard}>
          <View style={styles.featuresHeader}>
            <Icon name="check-circle" size="md" color={Colors.status.success} />
            <Text style={styles.featuresTitle}>
              Inclus dans {SUBSCRIPTION_PLANS[selectedPlan]?.name}
            </Text>
          </View>
          <View style={styles.featuresGrid}>
            {PLAN_FEATURES[selectedPlan].map((feature, idx) => (
              <View key={idx} style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Icon name={feature.icon} size="sm" color={Colors.primary} />
                </View>
                <Text style={styles.featureText}>{feature.highlight}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom CTA */}
      <Animated.View
        style={[
          styles.bottomCTA,
          {
            paddingBottom: insets.bottom + Spacing.md,
            opacity: fadeAnim,
          },
        ]}>
        <View style={styles.ctaSummary}>
          <Text style={styles.ctaPlan}>
            {SUBSCRIPTION_PLANS[selectedPlan]?.name}
          </Text>
          <Text style={styles.ctaDuration}>
            {
              SUBSCRIPTION_DURATIONS.find(d => d.months === selectedDuration)
                ?.labelFr
            }
          </Text>
        </View>
        <View style={styles.ctaPricing}>
          <Text style={styles.ctaTotal}>{formatCurrency(pricing.total)}</Text>
          {pricing.savings > 0 && (
            <Text style={styles.ctaSavings}>
              Économie: {formatCurrency(pricing.savings)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleSubscribe}
          activeOpacity={0.9}>
          <Text style={styles.ctaButtonText}>Continuer</Text>
          <Icon name="arrow-right" size="sm" color={Colors.white} />
        </TouchableOpacity>
      </Animated.View>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
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
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },

  // Trial Banner
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.status.success,
    ...Shadows.sm,
  },
  trialIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.cream,
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
  trialDays: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.status.success,
  },

  // Section Title
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },

  // Plan Cards
  plansScrollContent: {
    paddingRight: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  planCard: {
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border.light,
    overflow: 'hidden',
    ...Shadows.md,
  },
  planCardSelected: {
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  planCardInner: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  popularTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.yellow,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomLeftRadius: BorderRadius.lg,
    gap: 4,
    zIndex: 1,
  },
  popularText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  planIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  planIconContainerSelected: {
    backgroundColor: Colors.card.cream,
  },
  planName: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  planNameSelected: {
    color: Colors.primary,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  planPrice: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  planPriceSelected: {
    color: Colors.primary,
  },
  planPeriod: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginLeft: 4,
  },
  planPeriodSelected: {
    color: Colors.text.secondary,
  },
  planFeatures: {
    width: '100%',
    gap: Spacing.sm,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  planFeatureText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  planFeatureTextSelected: {
    color: Colors.primary,
  },
  currentPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.cream,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.status.success,
  },
  currentPlanText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.status.success,
  },

  // Duration Selection
  durationContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  durationPill: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border.light,
    position: 'relative',
    ...Shadows.sm,
  },
  durationPillSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.card.cream,
  },
  durationDiscount: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.card.yellow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.status.success,
  },
  durationDiscountText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.status.success,
  },
  durationText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  durationTextSelected: {
    color: Colors.primary,
  },
  durationPrice: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  durationPriceSelected: {
    color: Colors.primary,
  },

  // Payment Methods
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  paymentMethodItem: {
    width: 72,
    height: 72,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  paymentMethodLogo: {
    width: 56,
    height: 56,
  },
  paymentMethodHint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xl,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: Spacing.xl,
  },

  // Features Card
  featuresCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  featuresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  featuresTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  featureIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    flex: 1,
  },

  // Bottom CTA
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.lg,
  },
  ctaSummary: {
    flex: 1,
  },
  ctaPlan: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  ctaDuration: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  ctaPricing: {
    alignItems: 'flex-end',
    marginRight: Spacing.md,
  },
  ctaTotal: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  ctaSavings: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  ctaButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
});

export default SubscriptionScreen;
