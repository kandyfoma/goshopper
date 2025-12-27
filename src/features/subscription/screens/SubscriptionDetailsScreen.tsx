import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useSubscription} from '@/shared/contexts/SubscriptionContext';
import {Icon, FadeIn, Button, BackButton} from '@/shared/components';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function SubscriptionDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    subscription,
    isTrialActive,
    trialDaysRemaining,
    scansRemaining,
    canScan,
    daysUntilExpiration,
    isExpiringSoon,
  } = useSubscription();

  const isPremium = subscription?.isSubscribed && subscription?.status === 'active' && subscription?.planId === 'premium';
  const isActive = subscription?.isSubscribed && subscription?.status === 'active';
  const isTrial = isTrialActive;
  const scansUsed = subscription?.monthlyScansUsed || subscription?.trialScansUsed || 0;
  const scanLimit = subscription?.planId === 'premium' ? 1000 : 
                    subscription?.planId === 'standard' ? 100 :
                    subscription?.planId === 'basic' ? 25 :
                    subscription?.trialScansLimit || 10;

  // Format dates
  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getStatusColor = () => {
    if (isPremium) return Colors.status.success;
    if (isActive) return Colors.card.cosmos;
    if (isTrial) return Colors.card.blue;
    if (subscription?.status === 'grace') return Colors.card.yellow;
    if (subscription?.status === 'freemium') return Colors.text.tertiary;
    return Colors.text.tertiary;
  };

  const getStatusText = () => {
    if (isPremium) return 'Abonnement Premium Actif';
    if (isActive) {
      const planName = subscription?.planId === 'basic' ? 'Basic' : subscription?.planId === 'standard' ? 'Standard' : 'Premium';
      return `Abonnement ${planName} Actif`;
    }
    if (isTrial) return `Essai Gratuit - ${trialDaysRemaining} jours restants`;
    if (subscription?.status === 'grace') return `Période de grâce - ${daysUntilExpiration} jours restants`;
    if (subscription?.status === 'freemium') return 'Plan Gratuit';
    return 'Aucun Abonnement';
  };

  const getStatusIcon = () => {
    if (isPremium || isActive) return 'check-circle';
    if (isTrial) return 'clock';
    if (subscription?.status === 'grace') return 'alert-circle';
    return 'x-circle';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <FadeIn>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <BackButton />
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Mon Abonnement</Text>
              <Text style={styles.subtitle}>
                {isPremium
                  ? 'Premium actif'
                  : isActive
                  ? `${subscription?.planId} actif`
                  : isTrial
                  ? `${trialDaysRemaining} jours restants`
                  : subscription?.status === 'grace'
                  ? 'Période de grâce'
                  : 'Aucun abonnement'}
              </Text>
            </View>
          </View>
        </View>
      </FadeIn>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusBadge, {backgroundColor: getStatusColor() + '15'}]}>
            <Icon name={getStatusIcon()} size="xl" color={getStatusColor()} />
          </View>
          <Text style={styles.statusTitle}>{getStatusText()}</Text>
          {!isPremium && !isActive && !isTrial && subscription?.status !== 'grace' && (
            <Text style={styles.statusSubtitle}>
              Passez à Premium pour des scans illimités
            </Text>
          )}
          {isTrial && (
            <Text style={styles.statusSubtitle}>
              Profitez de votre période d'essai gratuite
            </Text>
          )}
          {isActive && !isPremium && (
            <Text style={styles.statusSubtitle}>
              Votre abonnement est actif jusqu'au {formatDate(subscription?.subscriptionEndDate)}
            </Text>
          )}
          {subscription?.status === 'grace' && (
            <Text style={styles.statusSubtitle}>
              Renouvelez votre abonnement avant expiration
            </Text>
          )}
        </View>

        {/* Scans Usage Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Icon name="camera" size="md" color={Colors.card.red} />
            <Text style={styles.infoTitle}>Utilisation des Scans</Text>
          </View>
          
          <View style={styles.scansProgress}>
            <View style={styles.scansNumbers}>
              <View style={styles.scansStat}>
                <Text style={styles.scansValue}>{scansUsed || 0}</Text>
                <Text style={styles.scansLabel}>Utilisés</Text>
              </View>
              <View style={styles.scansDivider} />
              <View style={styles.scansStat}>
                <Text style={[styles.scansValue, {color: Colors.card.blue}]}>
                  {scansRemaining}
                </Text>
                <Text style={styles.scansLabel}>Restants</Text>
              </View>
            </View>

            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(100, scanLimit > 0 ? (scansUsed / scanLimit) * 100 : 0).toFixed(0)}%` as any,
                  },
                ]}
              />
            </View>
          </View>

          {scansRemaining <= 5 && (
            <View style={styles.warningBox}>
              <Icon name="alert-circle" size="sm" color={Colors.card.red} />
              <Text style={styles.warningText}>
                Il vous reste {scansRemaining} scan{scansRemaining !== 1 ? 's' : ''}. Passez à Premium pour des scans illimités !
              </Text>
            </View>
          )}
        </View>

        {/* Subscription Details Card */}
        {(isTrial || isActive || isPremium) && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Icon name="calendar" size="md" color={Colors.card.red} />
              <Text style={styles.infoTitle}>Détails de l'Abonnement</Text>
            </View>

            <View style={styles.detailsList}>
              {isTrial && (
                <>
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <Icon name="play-circle" size="sm" color={Colors.text.tertiary} />
                      <Text style={styles.detailLabel}>Date de début</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {formatDate(subscription?.trialStartDate)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <Icon name="clock" size="sm" color={Colors.text.tertiary} />
                      <Text style={styles.detailLabel}>Expire le</Text>
                    </View>
                    <Text style={[styles.detailValue, {color: Colors.card.red, fontFamily: Typography.fontFamily.bold}]}>
                      {formatDate(subscription?.trialEndDate)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <Icon name="zap" size="sm" color={Colors.text.tertiary} />
                      <Text style={styles.detailLabel}>Type</Text>
                    </View>
                    <Text style={styles.detailValue}>Essai gratuit</Text>
                  </View>
                </>
              )}

              {(isActive || isPremium) && !isTrial && (
                <>
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <Icon name="shopping-bag" size="sm" color={Colors.text.tertiary} />
                      <Text style={styles.detailLabel}>Plan actuel</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {subscription?.planId === 'basic' ? 'Basic' : 
                       subscription?.planId === 'standard' ? 'Standard' : 'Premium'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <Icon name="play-circle" size="sm" color={Colors.text.tertiary} />
                      <Text style={styles.detailLabel}>Date de début</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {formatDate(subscription?.subscriptionStartDate)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <Icon name="calendar" size="sm" color={Colors.text.tertiary} />
                      <Text style={styles.detailLabel}>{isExpiringSoon ? 'Expire le' : 'Valide jusqu\'au'}</Text>
                    </View>
                    <Text style={[styles.detailValue, isExpiringSoon ? {color: Colors.card.red, fontFamily: Typography.fontFamily.bold} : {color: Colors.card.blue, fontFamily: Typography.fontFamily.bold}]}>
                      {formatDate(subscription?.subscriptionEndDate)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <Icon name="zap" size="sm" color={Colors.text.tertiary} />
                      <Text style={styles.detailLabel}>Durée</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {subscription?.durationMonths || 1} mois
                    </Text>
                  </View>
                  {subscription?.lastPaymentAmount && (
                    <View style={styles.detailRow}>
                      <View style={styles.detailLeft}>
                        <Icon name="dollar-sign" size="sm" color={Colors.text.tertiary} />
                        <Text style={styles.detailLabel}>Montant payé</Text>
                      </View>
                      <Text style={styles.detailValue}>
                        {subscription.lastPaymentAmount} {subscription.currency || 'USD'}
                      </Text>
                    </View>
                  )}
                  {(subscription?.bonusScans ?? 0) > 0 && (
                    <View style={styles.detailRow}>
                      <View style={styles.detailLeft}>
                        <Icon name="gift" size="sm" color={Colors.text.tertiary} />
                        <Text style={styles.detailLabel}>Scans bonus</Text>
                      </View>
                      <Text style={[styles.detailValue, {color: Colors.card.blue}]}>
                        +{subscription?.bonusScans}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        {/* Subscription History Card */}
        {subscription && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Icon name="list" size="md" color={Colors.card.red} />
              <Text style={styles.infoTitle}>Historique d'abonnement</Text>
            </View>

            <View style={styles.historyList}>
              {subscription.lastPaymentDate && (
                <View style={styles.historyItem}>
                  <View style={styles.historyIcon}>
                    <Icon name="check-circle" size="sm" color={Colors.status.success} />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyTitle}>Paiement reçu</Text>
                    <Text style={styles.historyDate}>{formatDate(subscription.lastPaymentDate)}</Text>
                    {subscription.lastPaymentAmount && (
                      <Text style={styles.historyAmount}>{subscription.lastPaymentAmount} {subscription.currency || 'USD'}</Text>
                    )}
                  </View>
                </View>
              )}
              
              {subscription.subscriptionStartDate && (
                <View style={styles.historyItem}>
                  <View style={styles.historyIcon}>
                    <Icon name="zap" size="sm" color={Colors.card.blue} />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyTitle}>Abonnement activé</Text>
                    <Text style={styles.historyDate}>{formatDate(subscription.subscriptionStartDate)}</Text>
                  </View>
                </View>
              )}

              {isTrial && subscription.trialStartDate && (
                <View style={styles.historyItem}>
                  <View style={styles.historyIcon}>
                    <Icon name="gift" size="sm" color={Colors.card.yellow} />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyTitle}>Essai gratuit démarré</Text>
                    <Text style={styles.historyDate}>{formatDate(subscription.trialStartDate)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Features Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Icon name="star" size="md" color={Colors.card.red} />
            <Text style={styles.infoTitle}>
              {isPremium ? 'Vos Avantages Premium' : 'Avantages Premium'}
            </Text>
          </View>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Icon
                name="check-circle"
                size="sm"
                color={isPremium ? Colors.status.success : Colors.text.tertiary}
              />
              <Text style={styles.featureText}>Scans illimités</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon
                name="check-circle"
                size="sm"
                color={isPremium ? Colors.status.success : Colors.text.tertiary}
              />
              <Text style={styles.featureText}>Comparaison de prix en temps réel</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon
                name="check-circle"
                size="sm"
                color={isPremium ? Colors.status.success : Colors.text.tertiary}
              />
              <Text style={styles.featureText}>Assistant IA personnalisé</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon
                name="check-circle"
                size="sm"
                color={isPremium ? Colors.status.success : Colors.text.tertiary}
              />
              <Text style={styles.featureText}>Alertes de prix personnalisées</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon
                name="check-circle"
                size="sm"
                color={isPremium ? Colors.status.success : Colors.text.tertiary}
              />
              <Text style={styles.featureText}>Statistiques avancées</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon
                name="check-circle"
                size="sm"
                color={isPremium ? Colors.status.success : Colors.text.tertiary}
              />
              <Text style={styles.featureText}>Support prioritaire</Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        {!isPremium && canScan && (
          <Button
            title="Voir les plans disponibles"
            onPress={() => navigation.push('Subscription')}
            variant="primary"
            icon={<Icon name="zap" size="sm" color={Colors.white} />}
          />
        )}
        {!canScan && (
          <Button
            title="Améliorer mon plan"
            onPress={() => navigation.push('Subscription')}
            variant="primary"
            icon={<Icon name="zap" size="sm" color={Colors.white} />}
          />
        )}
      </ScrollView>
    </SafeAreaView>
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
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },

  // Header Styles
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    ...Shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginLeft: 36, // Align with title after icon
  },

  // Status Card
  statusCard: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  statusBadge: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  statusTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  statusSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Details List
  detailsList: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.md,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  detailLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  detailValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },

  // Info Card
  infoCard: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  infoTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  scansProgress: {
    gap: Spacing.md,
  },
  scansNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  scansStat: {
    alignItems: 'center',
    flex: 1,
  },
  scansValue: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.card.red,
  },
  scansLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  scansDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border.light,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.card.red,
    borderRadius: BorderRadius.full,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.yellow,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  featuresList: {
    gap: Spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  featureText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },

  // History List
  historyList: {
    gap: Spacing.sm,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.md,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  historyDate: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  historyAmount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.success,
    marginTop: 2,
  },
});

export default SubscriptionDetailsScreen;
