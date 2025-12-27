// Subscription Duration & Payment Selection Screen
import React, {useState} from 'react';
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
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {
  SUBSCRIPTION_PLANS,
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
} from '@/shared/theme/theme';
import {Icon, BackButton} from '@/shared/components';

type PlanId = 'basic' | 'standard' | 'premium';

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

type RouteParams = RouteProp<RootStackParamList, 'SubscriptionDuration'>;

export function SubscriptionDurationScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();

  const {
    planId,
    isScanPack,
    scanPackId,
    scanPackScans,
    scanPackPrice,
    isUpgrade,
    isDowngrade,
    currentPlanId,
    currentEndDate,
    remainingScans,
  } = route.params;
  
  // Handle scan packs differently
  if (isScanPack && scanPackId) {
    const handlePurchaseScanPack = () => {
      analyticsService.logCustomEvent('scan_pack_attempted', {
        pack_id: scanPackId,
        scans: scanPackScans,
        amount: scanPackPrice,
        currency: 'USD',
      });

      navigation.navigate('MokoPayment', {
        amount: scanPackPrice || 0,
        planId: `scanpack_${scanPackId}`,
        planName: `Pack de ${scanPackScans} scans`,
        isScanPack: true,
        scanPackId,
      });
    };

    return (
      <View style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={[styles.scrollContent, {paddingTop: insets.top + Spacing.md}]}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}>
              <Icon name="chevron-left" size="md" color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Pack de Scans</Text>
          </View>
          
          <View style={styles.scanPackInfo}>
            <Icon name="zap" size="xl" color="#FF6B35" />
            <Text style={styles.scanPackTitle}>{scanPackScans} Scans</Text>
            <Text style={styles.scanPackPrice}>${scanPackPrice}</Text>
            <Text style={styles.scanPackDescription}>
              Ajoutez {scanPackScans} scans bonus à votre compte
            </Text>
          </View>

          <TouchableOpacity style={styles.ctaButton} onPress={handlePurchaseScanPack}>
            <Text style={styles.ctaButtonText}>Continuer vers le paiement</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const plan = SUBSCRIPTION_PLANS[planId];

  const [selectedDuration, setSelectedDuration] =
    useState<SubscriptionDuration>(3);

  const handleContinue = () => {
    const durationLabel = SUBSCRIPTION_DURATIONS.find(
      d => d.months === selectedDuration,
    );
    const pricing = calculateDiscountedPrice(plan.price, selectedDuration);

    analyticsService.logCustomEvent('subscription_attempted', {
      plan_id: planId,
      duration_months: selectedDuration,
      amount: pricing.total,
      currency: 'USD',
    });

    navigation.navigate('MokoPayment', {
      amount: pricing.total,
      planId,
      planName: `${plan.name} - ${durationLabel?.labelFr || selectedDuration + ' mois'}`,
    });
  };

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
          <Text style={styles.headerTitle}>Choisir la durée</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Upgrade/Downgrade Banner */}
        {(isUpgrade || isDowngrade) && currentPlanId && (
          <View style={[
            styles.changeBanner,
            {backgroundColor: isUpgrade ? '#ECFDF5' : '#FEF3C7'}
          ]}>
            <Icon
              name={isUpgrade ? 'trending-up' : 'trending-down'}
              size="md"
              color={isUpgrade ? '#10B981' : '#F59E0B'}
            />
            <View style={styles.changeBannerContent}>
              <Text style={[
                styles.changeBannerTitle,
                {color: isUpgrade ? '#047857' : '#B45309'}
              ]}>
                {isUpgrade ? 'Mise à niveau' : 'Changement de plan'}
              </Text>
              <Text style={styles.changeBannerText}>
                {isUpgrade
                  ? `Vous passez de ${currentPlanId} à ${planId}. Votre temps restant sera conservé et vos scans non utilisés seront ajoutés en bonus.`
                  : `Vous passez de ${currentPlanId} à ${planId}. Le changement prendra effet immédiatement. Vos scans non utilisés (${remainingScans || 0}) seront conservés.`
                }
              </Text>
              {currentEndDate && (
                <Text style={styles.changeBannerDate}>
                  Abonnement actuel expire le: {new Date(currentEndDate).toLocaleDateString('fr-FR')}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Selected Plan Summary */}
        <View style={[
          styles.planSummary,
          {
            backgroundColor: planId === 'basic' ? '#FDF0D5' : planId === 'standard' ? '#669BBC' : '#003049',
          }
        ]}>
          <Text style={[
            styles.planSummaryLabel,
            {color: planId === 'basic' ? Colors.text.secondary : '#FFFFFF'}
          ]}>Plan sélectionné</Text>
          <Text style={[
            styles.planSummaryName,
            {color: planId === 'basic' ? Colors.text.primary : '#FFFFFF'}
          ]}>{plan.name}</Text>
          <Text style={[
            styles.planSummaryPrice,
            {color: planId === 'basic' ? Colors.text.secondary : '#FFFFFF', opacity: planId === 'basic' ? 1 : 0.9}
          ]}>
            {formatCurrency(plan.price)}/mois
          </Text>
        </View>

        {/* Plan Features - Grid Layout */}
        <Text style={styles.sectionTitle}>Fonctionnalités incluses</Text>
        <View style={styles.featuresGrid}>
          <View style={styles.featureColumn}>
            {plan.features.slice(0, Math.ceil(plan.features.length / 2)).map((feature, idx) => (
              <Text key={idx} style={styles.featureText}>
                ✓ {feature}
              </Text>
            ))}
          </View>
          <View style={styles.featureColumn}>
            {plan.features.slice(Math.ceil(plan.features.length / 2)).map((feature, idx) => (
              <Text key={idx} style={styles.featureText}>
                ✓ {feature}
              </Text>
            ))}
          </View>
        </View>

        {/* Duration Selection - Design 2 */}
        <Text style={styles.sectionTitle}>Durée de l'abonnement</Text>
        <View style={styles.durationList}>
          {SUBSCRIPTION_DURATIONS.map(duration => {
            const isSelected = selectedDuration === duration.months;
            const durationPricing = calculateDiscountedPrice(
              plan.price,
              duration.months,
            );

            return (
              <TouchableOpacity
                key={duration.months}
                style={[
                  styles.durationCard,
                  isSelected && styles.durationCardSelected,
                ]}
                onPress={() => setSelectedDuration(duration.months)}
                activeOpacity={0.9}>
                <View style={styles.durationCardContent}>
                  <View style={{flex: 1}}>
                    <Text
                      style={[
                        styles.durationCardTitle,
                        isSelected && {color: '#FFFFFF'},
                      ]}>
                      {duration.labelFr} - {formatCurrency(durationPricing.total)}
                    </Text>
                    {duration.badgeFr && (
                      <Text style={[styles.durationCardBadge, isSelected && {color: '#FFFFFF'}]}>
                        {duration.badgeFr}
                      </Text>
                    )}
                    <Text style={[styles.durationCardInfo, isSelected && {color: '#FFFFFF', opacity: 0.9}]}>
                      Essai gratuit 30 jours • Puis {formatCurrency(durationPricing.monthly)}/mois
                      {durationPricing.savings > 0 && (
                        <Text>
                          {'\n'}Économisez {formatCurrency(durationPricing.savings)}
                        </Text>
                      )}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkmarkCircle}>
                      <Icon name="check" size="md" color={Colors.white} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Payment Provider Section */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Moyen de paiement</Text>
          <View style={styles.paymentGrid}>
            {MOBILE_MONEY_OPTIONS.map(option => (
              <View key={option.id} style={styles.paymentCard}>
                <Image
                  source={option.logo}
                  style={styles.paymentCardLogo}
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>
          <Text style={styles.paymentHint}>
            Détection automatique lors du paiement
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Bottom CTA */}
      <View
        style={[
          styles.bottomCTA,
          {paddingBottom: insets.bottom + Spacing.md},
        ]}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleContinue}
          activeOpacity={0.9}>
          <Text style={styles.ctaButtonText}>
            Payer {formatCurrency(calculateDiscountedPrice(plan.price, selectedDuration).total)}
          </Text>
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
    paddingHorizontal: Spacing.lg,
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

  // Change Banner (Upgrade/Downgrade)
  changeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  changeBannerContent: {
    flex: 1,
  },
  changeBannerTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 4,
  },
  changeBannerText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  changeBannerDate: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.tertiary,
    marginTop: 8,
  },

  // Plan Summary
  planSummary: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  planSummaryLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: 4,
  },
  planSummaryName: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 4,
  },
  planSummaryPrice: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
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

  // Section Title
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },

  // Duration Selection - Design 2
  durationList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  durationCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  durationCardSelected: {
    borderColor: '#669BBC',
    borderWidth: 2,
    backgroundColor: '#669BBC',
  },
  durationCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationCardTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  durationCardBadge: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.status.success,
    marginBottom: 4,
  },
  durationCardInfo: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
  checkmarkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#003049',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },

  // Scan Pack Styles
  scanPackInfo: {
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  scanPackTitle: {
    fontSize: Typography.fontSize['4xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  scanPackPrice: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: '#FF6B35',
    marginTop: Spacing.sm,
  },
  scanPackDescription: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },

  // Payment Provider Section
  paymentSection: {
    marginBottom: Spacing.lg,
  },
  paymentGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  paymentCard: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  paymentCardLogo: {
    width: '100%',
    height: '100%',
  },
  paymentHint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },

  // Bottom CTA
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  ctaButton: {
    backgroundColor: '#003049',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
});

export default SubscriptionDurationScreen;
