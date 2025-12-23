// Subscription Screen - Simplified Clean Design
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
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
} from '@/shared/theme/theme';
import {Icon, Spinner} from '@/shared/components';

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
          <View style={styles.trialBanner}>
            <Icon name="gift" size="md" color={Colors.status.success} />
            <Text style={styles.trialTitle}>
              Essai: {trialDaysRemaining}j restants
            </Text>
          </View>
        )}

        {/* Plan Selection */}
        <Text style={styles.sectionTitle}>Choisir un plan</Text>
        <View style={styles.plansRow}>
          {plans.map(([id, plan]) => {
            const planId = id as PlanId;
            const isSelected = selectedPlan === planId;
            const isCurrent = isCurrentPlan(planId);
            const isPopular = planId === 'standard';

            return (
              <TouchableOpacity
                key={planId}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan(planId)}
                activeOpacity={0.8}>
                {isPopular && (
                  <View style={styles.popularTag}>
                    <Text style={styles.popularText}>★</Text>
                  </View>
                )}
                <Text style={[
                  styles.planName,
                  isSelected && styles.planNameSelected,
                ]}>
                  {plan.name}
                </Text>
                <Text style={[
                  styles.planPrice,
                  isSelected && styles.planPriceSelected,
                ]}>
                  {formatCurrency(plan.price)}/mois
                </Text>
                <Text style={styles.planScans}>
                  {planId === 'basic' ? '25' : planId === 'standard' ? '100' : '1000'} scans
                </Text>
                {isCurrent && (
                  <Text style={styles.currentPlanText}>✓ Actuel</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

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
                <Text style={[
                  styles.durationText,
                  isSelected && styles.durationTextSelected,
                ]}>
                  {duration.labelFr}
                  {duration.discountPercent > 0 && ` (-${duration.discountPercent}%)`}
                </Text>
                <Text style={[
                  styles.durationPrice,
                  isSelected && styles.durationPriceSelected,
                ]}>
                  {formatCurrency(durationPricing.total)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Payment Methods - Compact */}
        <View style={styles.paymentRow}>
          {MOBILE_MONEY_OPTIONS.map(option => (
            <Image
              key={option.id}
              source={option.logo}
              style={styles.paymentLogo}
              resizeMode="contain"
            />
          ))}
        </View>

        {/* Features - Simple List */}
        <Text style={styles.sectionTitle}>
          {SUBSCRIPTION_PLANS[selectedPlan]?.name} inclut:
        </Text>
        <View style={styles.featuresList}>
          {PLAN_FEATURES[selectedPlan].map((feature, idx) => (
            <Text key={idx} style={styles.featureText}>
              ✓ {feature.highlight}
            </Text>
          ))}
        </View>
      </ScrollView>

      {/* Fixed Bottom CTA */}
      <View style={[styles.bottomCTA, {paddingBottom: insets.bottom + Spacing.sm}]}>
        <View style={styles.ctaInfo}>
          <Text style={styles.ctaTotal}>{formatCurrency(pricing.total)}</Text>
          {pricing.savings > 0 && (
            <Text style={styles.ctaSavings}>-{formatCurrency(pricing.savings)}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleSubscribe}
          activeOpacity={0.9}>
          <Text style={styles.ctaButtonText}>Payer</Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: Spacing.md,
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
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  headerSpacer: {
    width: 36,
  },

  // Trial Banner - Simplified
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  trialTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
  },

  // Section Title
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },

  // Plan Cards - Side by side
  plansRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  planCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.card.cream,
  },
  popularTag: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.card.yellow,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularText: {
    fontSize: 10,
    color: Colors.text.primary,
  },
  planName: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  planNameSelected: {
    color: Colors.primary,
  },
  planPrice: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.secondary,
  },
  planPriceSelected: {
    color: Colors.primary,
  },
  planScans: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  currentPlanText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
    marginTop: 2,
  },

  // Duration Selection - Compact
  durationContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  durationPill: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  durationPillSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.card.cream,
  },
  durationText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  durationTextSelected: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
  },
  durationPrice: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  durationPriceSelected: {
    color: Colors.primary,
  },

  // Payment Methods - Compact row
  paymentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  paymentLogo: {
    width: 40,
    height: 40,
  },

  // Features - Simple list
  featuresList: {
    marginBottom: Spacing.md,
  },
  featureText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    paddingVertical: 2,
  },

  // Bottom CTA - Compact
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  ctaButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
});

export default SubscriptionScreen;
