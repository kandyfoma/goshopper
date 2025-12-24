// Subscription Screen - Plan Selection (Design 1)
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import {useSubscription, useAuth} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {SUBSCRIPTION_PLANS} from '@/shared/utils/constants';
import {formatCurrency} from '@/shared/utils/helpers';
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

  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
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

  const handlePlanSelect = (planId: PlanId) => {
    // Only allow subscribing to paid plans
    if (planId === 'freemium' || planId === 'free') return;
    
    setSelectedPlan(planId);
    
    analyticsService.logCustomEvent('subscription_plan_selected', {
      plan_id: planId,
    });

    // Navigate to duration selection screen
    navigation.navigate('SubscriptionDuration', {planId});
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
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="chevron-left" size="md" color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choisir un abonnement</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Trial Banner */}
        {isTrialActive && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialTitle}>
              Essai: {trialDaysRemaining}j restants
            </Text>
          </View>
        )}

        {/* Plan Selection - Stacked Cards (Design 1) */}
        <View style={styles.plansStack}>
          {plans.map(([id, plan], index) => {
            const planId = id as PlanId;
            const isSelected = selectedPlan === planId;
            const isCurrent = isCurrentPlan(planId);
            
            // Assign colors to plans - Using app branding
            const cardColor = planId === 'basic' ? '#FDF0D5' : planId === 'standard' ? '#669BBC' : '#003049';
            const scanCount = planId === 'basic' ? '25' : planId === 'standard' ? '100' : '1,000';
            // White text for standard and premium, dark text for basic
            const textColor = planId === 'basic' ? Colors.text.primary : '#FFFFFF';
            const iconColor = planId === 'basic' ? Colors.text.primary : '#FFFFFF';

            return (
              <TouchableOpacity
                key={planId}
                style={[
                  styles.planStackCard,
                  {backgroundColor: cardColor},
                  isSelected && styles.planStackCardSelected,
                ]}
                onPress={() => handlePlanSelect(planId)}
                activeOpacity={0.9}>
                <View style={styles.planStackContent}>
                  <View style={{flex: 1}}>
                    <Text style={[styles.planStackLabel, {color: textColor}]}>{plan.name.toUpperCase()}</Text>
                    <Text style={[styles.planStackPrice, {color: textColor}]}>
                      {formatCurrency(plan.price)}/mois
                    </Text>
                    <Text style={[styles.planStackInfo, {color: textColor}]}>
                      {scanCount} scans par mois • Essai gratuit 30 jours{' \n'}
                      Puis {formatCurrency(plan.price)}/mois après l'essai
                    </Text>
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
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  headerSpacer: {
    width: 44,
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
  planStackContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planStackLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
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
