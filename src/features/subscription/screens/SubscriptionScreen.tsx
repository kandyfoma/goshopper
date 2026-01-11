// Subscription Screen - Plan Selection (Design 1)
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import {useSubscription, useAuth} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {SUBSCRIPTION_PLANS} from '@/shared/utils/constants';
import {SCAN_PACKS} from '@/shared/types/scanPacks.types';
import {formatCurrency} from '@/shared/utils/helpers';
import {analyticsService} from '@/shared/services/analytics';
import {APP_ID} from '@/shared/services/firebase/config';
import {useScroll} from '@/shared/contexts';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '@/shared/theme/theme';
import {Icon, Spinner, BackButton} from '@/shared/components';

type PlanId = 'freemium' | 'free' | 'basic' | 'standard' | 'premium';

export function SubscriptionScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated, isLoading: isAuthLoading} = useAuth();
  const {subscription, isTrialActive, trialDaysRemaining, scansRemaining, canScan} = useSubscription();
  const {scrollY} = useScroll();

  // Hooks must be called unconditionally
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    analyticsService.logScreenView('Subscription', 'SubscriptionScreen');
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      navigation.replace('Login');
    }
  }, [isAuthenticated, isAuthLoading, navigation]);

  // Show loading while checking auth
  if (isAuthLoading) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <Spinner size="lg" color={Colors.primary.main} />
      </View>
    );
  }

  // Don't render content if not authenticated (will redirect)
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <Spinner size="lg" color={Colors.primary.main} />
      </View>
    );
  }

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
  
  // Determine if this is an upgrade or downgrade
  const getPlanTier = (planId: PlanId): number => {
    switch (planId) {
      case 'freemium':
      case 'free':
        return 0;
      case 'basic':
        return 1;
      case 'standard':
        return 2;
      case 'premium':
        return 3;
      default:
        return 0;
    }
  };

  const isUpgrade = (targetPlanId: PlanId) => {
    if (!subscription?.planId) return true;
    return getPlanTier(targetPlanId) > getPlanTier(subscription.planId as PlanId);
  };

  const isDowngrade = (targetPlanId: PlanId) => {
    if (!subscription?.planId) return false;
    return getPlanTier(targetPlanId) < getPlanTier(subscription.planId as PlanId);
  };

  const handlePlanSelect = (planId: PlanId) => {
    // Only allow subscribing to paid plans
    if (planId === 'freemium' || planId === 'free') return;
    
    // Don't allow selecting the current active plan
    if (isCurrentPlan(planId)) return;
    
    setSelectedPlan(planId);
    
    const changeType = isUpgrade(planId) ? 'upgrade' : isDowngrade(planId) ? 'downgrade' : 'new';
    
    analyticsService.logCustomEvent('subscription_plan_selected', {
      plan_id: planId,
      change_type: changeType,
      current_plan: subscription?.planId || 'none',
    });

    // Navigate to duration selection screen with upgrade/downgrade info
    navigation.navigate('SubscriptionDuration', {
      planId,
      isUpgrade: isUpgrade(planId),
      isDowngrade: isDowngrade(planId),
      currentPlanId: subscription?.planId,
      currentEndDate: subscription?.subscriptionEndDate,
      remainingScans: scansRemaining,
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
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: false})}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Choisir un abonnement</Text>
        </View>

        {/* Trial Banner */}
        {isTrialActive && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialTitle}>
              Essai: {trialDaysRemaining}j restants
            </Text>
          </View>
        )}

        {/* Current Subscription Details */}
        {subscription && (
          <View style={styles.currentSubscriptionCard}>
            <View style={styles.currentSubscriptionHeader}>
              <Text style={styles.currentSubscriptionTitle}>
                Abonnement actuel
              </Text>
              <View style={[
                styles.statusBadge,
                {backgroundColor: subscription.status === 'active' ? '#10B981' : subscription.status === 'trial' ? '#F59E0B' : '#6B7280'}
              ]}>
                <Text style={styles.statusBadgeText}>
                  {subscription.status === 'active' ? 'Actif' : 
                   subscription.status === 'trial' ? 'Essai' :
                   subscription.status === 'grace' ? 'Période de grâce' :
                   subscription.status === 'freemium' ? 'Gratuit' : 'Inactif'}
                </Text>
              </View>
            </View>

            <View style={styles.subscriptionDetails}>
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Plan</Text>
                  <Text style={styles.detailValue}>
                    {subscription.planId === 'freemium' ? 'Gratuit' :
                     subscription.planId === 'basic' ? 'Basic' :
                     subscription.planId === 'standard' ? 'Standard' :
                     subscription.planId === 'premium' ? 'Premium' : 'Aucun'}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Scans restants</Text>
                  <Text style={styles.detailValue}>
                    {scansRemaining}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Utilisés ce mois</Text>
                  <Text style={styles.detailValue}>
                    {subscription.monthlyScansUsed || 0}
                  </Text>
                </View>
                {subscription.subscriptionEndDate && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Expire le</Text>
                    <Text style={styles.detailValue}>
                      {new Date(subscription.subscriptionEndDate).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                )}
              </View>

              {(subscription.bonusScans ?? 0) > 0 && (
                <View style={styles.bonusScansContainer}>
                  <Icon name="gift" size="sm" color={Colors.primary} />
                  <Text style={styles.bonusScansText}>
                    {subscription.bonusScans} scans bonus disponibles
                  </Text>
                </View>
              )}

              {!canScan && scansRemaining === 0 && (
                <View style={styles.warningContainer}>
                  <Icon name="alert-circle" size="sm" color="#F59E0B" />
                  <Text style={styles.warningText}>
                    Limite de scans atteinte. Passez à un plan supérieur.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Buy Scans Card - Quick Option */}
        <View style={styles.buyScansCard}>
          <View style={styles.buyScansContent}>
            <View style={styles.buyScansIconContainer}>
              <Icon name="zap" size="lg" color="#FF6B35" />
            </View>
            <View style={styles.buyScansTextContainer}>
              <Text style={styles.buyScansTitle}>Acheter des Scans</Text>
              <Text style={styles.buyScansSubtitle}>
                Besoin de plus de scans rapidement?
              </Text>
            </View>
          </View>
          <View style={styles.buyScansPacksPreview}>
            <TouchableOpacity
              style={styles.buyScansPackItem}
              onPress={() => {
                const pack = SCAN_PACKS.medium;
                navigation.navigate('MokoPayment', {
                  amount: pack.price,
                  planId: `scanpack_${pack.id}`,
                  planName: `Pack de ${pack.scans} scans`,
                  isScanPack: true,
                  scanPackId: pack.id,
                });
              }}
              activeOpacity={0.7}>
              <Text style={styles.buyScansPackNumber}>10</Text>
              <Text style={styles.buyScansPackLabel}>scans</Text>
              <Text style={styles.buyScansPackPrice}>$0.99</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.buyScansPackItem}
              onPress={() => {
                const pack = SCAN_PACKS.large;
                navigation.navigate('MokoPayment', {
                  amount: pack.price,
                  planId: `scanpack_${pack.id}`,
                  planName: `Pack de ${pack.scans} scans`,
                  isScanPack: true,
                  scanPackId: pack.id,
                });
              }}
              activeOpacity={0.7}>
              <Text style={styles.buyScansPackNumber}>25</Text>
              <Text style={styles.buyScansPackLabel}>scans</Text>
              <Text style={styles.buyScansPackPrice}>$1.99</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buyScansPackItem, styles.buyScansPackPopular]}
              onPress={() => {
                const pack = SCAN_PACKS.large;
                navigation.navigate('MokoPayment', {
                  amount: pack.price * 2.5,
                  planId: 'scanpack_xlarge',
                  planName: 'Pack de 50 scans',
                  isScanPack: true,
                  scanPackId: 'xlarge',
                });
              }}
              activeOpacity={0.7}>
              <Text style={[styles.buyScansPackNumber, {color: '#FFF'}]}>50</Text>
              <Text style={[styles.buyScansPackLabel, {color: '#FFF'}]}>scans</Text>
              <Text style={[styles.buyScansPackPrice, {color: '#FFF'}]}>$4.99</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan Selection - Stacked Cards (Design 1) */}
        <View style={styles.plansStack}>
          {plans.map(([id, plan], index) => {
            const planId = id as PlanId;
            const isSelected = selectedPlan === planId;
            const isCurrent = isCurrentPlan(planId);
            const isPlanUpgrade = isUpgrade(planId);
            const isPlanDowngrade = isDowngrade(planId);
            
            // Assign colors to plans - Using app branding
            const cardColor = planId === 'basic' ? '#FDF0D5' : planId === 'standard' ? '#669BBC' : '#003049';
            const scanCount = planId === 'basic' ? '25' : planId === 'standard' ? '100' : '1,000';
            // White text for standard and premium, dark text for basic
            const textColor = planId === 'basic' ? Colors.text.primary : '#FFFFFF';
            const iconColor = planId === 'basic' ? Colors.text.primary : '#FFFFFF';
            
            // Get key features for each plan (first 2)
            const keyFeatures = plan.features.slice(0, 2);

            return (
              <TouchableOpacity
                key={planId}
                style={[
                  styles.planStackCard,
                  {backgroundColor: cardColor},
                  isSelected && styles.planStackCardSelected,
                  isCurrent && styles.planStackCardDisabled,
                ]}
                onPress={() => handlePlanSelect(planId)}
                activeOpacity={0.9}
                disabled={isCurrent}>
                <View style={styles.planStackContent}>
                  <View style={{flex: 1}}>
                    <View style={styles.planLabelRow}>
                      <Text style={[styles.planStackLabel, {color: textColor}]}>{plan.name.toUpperCase()}</Text>
                      {!isCurrent && subscription?.isSubscribed && (
                        <View style={[
                          styles.changeBadge,
                          {backgroundColor: isPlanUpgrade ? '#10B981' : '#F59E0B'}
                        ]}>
                          <Icon
                            name={isPlanUpgrade ? 'trending-up' : 'trending-down'}
                            size="xs"
                            color="#FFFFFF"
                          />
                          <Text style={styles.changeBadgeText}>
                            {isPlanUpgrade ? 'Upgrade' : 'Downgrade'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.planStackPrice, {color: textColor}]}>
                      {formatCurrency(plan.price)}/mois
                    </Text>
                    <Text style={[styles.planStackInfo, {color: textColor, marginBottom: Spacing.xs}]}>
                      {scanCount} scans/mois • Essai 30 jours gratuit
                    </Text>
                    <View style={styles.planFeaturesList}>
                      {keyFeatures.map((feature, idx) => (
                        <View key={idx} style={styles.planFeatureItem}>
                          <Text style={[styles.planFeatureText, {color: textColor}]}>
                            ✓ {feature}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {isSelected ? (
                    <Icon name="check" size="lg" color={iconColor} />
                  ) : (
                    <Icon name="chevron-right" size="lg" color={iconColor} />
                  )}
                </View>
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Plan actuel</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Features - Grid Layout */}
        <Text style={styles.sectionTitle}>
          Fonctionnalités incluses
        </Text>
        <View style={styles.featuresGrid}>
          <View style={styles.featureColumn}>
            <Text style={styles.featureText}>
              ✓ Essai gratuit de 30 jours
            </Text>
            <Text style={styles.featureText}>
              ✓ Reconnaissance intelligente IA
            </Text>
            <Text style={styles.featureText}>
              ✓ Listes de courses illimitées
            </Text>
          </View>
          <View style={styles.featureColumn}>
            <Text style={styles.featureText}>
              ✓ Comparaison de prix en temps réel
            </Text>
            <Text style={styles.featureText}>
              ✓ Statistiques détaillées
            </Text>
            <Text style={styles.featureText}>
              ✓ Alertes prix personnalisées
            </Text>
          </View>
        </View>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    flex: 1,
  },

  // Trial Banner - Tag style
  trialBanner: {
    alignSelf: 'flex-end',
    backgroundColor: '#003049', // Dark blue
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  trialTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: '#FFFFFF',
  },

  // Current Subscription Card
  currentSubscriptionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  currentSubscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  currentSubscriptionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  statusBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  subscriptionDetails: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  detailItem: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  detailLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  bonusScansContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  bonusScansText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.primary,
    flex: 1,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  warningText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: '#92400E',
    flex: 1,
  },

  // Buy Scans Card
  buyScansCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#FF6B35',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FF6B3520',
  },
  buyScansContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  buyScansIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B3515',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyScansTextContainer: {
    flex: 1,
  },
  buyScansTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  buyScansSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  buyScansPacksPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  buyScansPackItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F5F5F5',
    minWidth: 70,
  },
  buyScansPackPopular: {
    backgroundColor: '#FF6B35',
  },
  buyScansPackNumber: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  buyScansPackLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },
  buyScansPackPrice: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.accent,
    marginTop: 2,
  },

  // Section Title
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },

  // Plan Cards - Stacked (Design 1)
  plansStack: {
    gap: Spacing.md,
  },
  planStackCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    minHeight: 120,
  },
  planStackCardSelected: {
    opacity: 0.95,
  },
  planStackCardDisabled: {
    opacity: 0.6,
  },
  planStackContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  planStackLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    letterSpacing: 0.5,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  changeBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
  planStackPrice: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  planStackInfo: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  planFeaturesList: {
    marginTop: Spacing.xs,
    gap: 4,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  planFeatureText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  currentBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: -Spacing.xs,
    backgroundColor: '#003049', // Dark blue
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  currentBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },

  // Features - Grid layout
  featuresGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  featureColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
  featureText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    paddingVertical: 4,
  },
});

export default SubscriptionScreen;
