// Home Screen - Modern Dashboard Design
// Inspired by Urbanist UI Kit - Soft pastels & card-based layout
import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useSubscription, useUser} from '@/shared/contexts';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {analyticsService} from '@/shared/services';

const {width} = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.lg * 2 - Spacing.md) / 2;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Time Period Selector
const TimePeriodSelector = ({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (period: string) => void;
}) => {
  const periods = ['Today', 'This Week', 'This Month'];
  
  return (
    <View style={styles.periodContainer}>
      {periods.map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            selected === period && styles.periodButtonActive,
          ]}
          onPress={() => onSelect(period)}>
          <Text
            style={[
              styles.periodText,
              selected === period && styles.periodTextActive,
            ]}>
            {period}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Stat Card Component - Pastel colored cards
const StatCard = ({
  title,
  value,
  subtitle,
  color,
  icon,
  onPress,
  size = 'normal',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: 'blue' | 'green' | 'yellow' | 'white';
  icon?: string;
  onPress?: () => void;
  size?: 'normal' | 'large';
}) => {
  const bgColor = {
    blue: Colors.cards.blue,
    green: Colors.cards.green,
    yellow: Colors.cards.yellow,
    white: Colors.cards.white,
  }[color];

  return (
    <TouchableOpacity
      style={[
        styles.statCard,
        {backgroundColor: bgColor},
        size === 'large' && styles.statCardLarge,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}>
      <View style={styles.statCardHeader}>
        <Text style={styles.statCardTitle}>{title}</Text>
        {icon && (
          <View style={styles.statCardIcon}>
            <Icon name={icon} size="sm" color={Colors.text.primary} />
          </View>
        )}
      </View>
      <Text style={styles.statCardValue}>{value}</Text>
      {subtitle && <Text style={styles.statCardSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );
};

// Main Scan Button - Clean, prominent
const ScanButton = ({onPress, disabled}: {onPress: () => void; disabled: boolean}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  };

  return (
    <Animated.View style={[styles.scanButtonWrapper, {transform: [{scale: scaleAnim}]}]}>
      <TouchableOpacity
        style={[styles.scanButton, disabled && styles.scanButtonDisabled]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
        <View style={styles.scanButtonContent}>
          <View style={styles.scanIconCircle}>
            <Icon name="camera" size="xl" color={Colors.primary} />
          </View>
          <View style={styles.scanTextContainer}>
            <Text style={styles.scanButtonTitle}>Scanner un ticket</Text>
            <Text style={styles.scanButtonSubtitle}>Comparez les prix instantanément</Text>
          </View>
        </View>
        <Icon name="chevron-right" size="md" color={Colors.text.tertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Quick Action Button
const QuickAction = ({
  icon,
  label,
  onPress,
  color = 'white',
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: 'blue' | 'green' | 'yellow' | 'white';
}) => {
  const bgColor = {
    blue: Colors.cards.blue,
    green: Colors.cards.green,
    yellow: Colors.cards.yellow,
    white: Colors.cards.white,
  }[color];

  return (
    <TouchableOpacity style={[styles.quickAction, {backgroundColor: bgColor}]} onPress={onPress}>
      <Icon name={icon} size="md" color={Colors.text.primary} />
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {canScan, subscription, isTrialActive, trialDaysRemaining, trialScansUsed} = useSubscription();
  const {profile: userProfile} = useUser();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');

  useEffect(() => {
    analyticsService.logScreenView('Home', 'HomeScreen');
  }, []);

  const handleScanPress = () => {
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_subscription');
      navigation.navigate('Subscription');
      return;
    }

    if (!userProfile?.defaultCity) {
      analyticsService.logCustomEvent('scan_redirect_city_selection');
      navigation.navigate('CitySelection');
      return;
    }

    analyticsService.logCustomEvent('scan_started');
    navigation.navigate('Scanner');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const userName = userProfile?.displayName?.split(' ')[0] || '';
  const isPremium = subscription?.isSubscribed;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => navigation.navigate('Settings')}>
              <Icon name="menu" size="md" color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <TimePeriodSelector selected={selectedPeriod} onSelect={setSelectedPeriod} />
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => navigation.navigate('PriceAlerts')}>
            <Icon name="bell" size="md" color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>
            {getGreeting()} {userName ? userName : ''},
          </Text>
          <Text style={styles.greetingSubtitle}>
            voici ce qui se passe dans vos achats
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              title="Scans"
              value={trialScansUsed || 0}
              subtitle={isPremium ? 'illimités' : `/${5 - (trialScansUsed || 0)} restants`}
              color="blue"
              icon="camera"
              onPress={() => navigation.navigate('Main', {screen: 'History'} as any)}
            />
            <StatCard
              title="Économies"
              value="$0"
              subtitle="ce mois"
              color="green"
              icon="trending-down"
              onPress={() => navigation.navigate('Main', {screen: 'Stats'} as any)}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title="Alertes"
              value="0"
              subtitle="actives"
              color="yellow"
              icon="bell"
              onPress={() => navigation.navigate('PriceAlerts')}
            />
            <StatCard
              title="Liste"
              value="0"
              subtitle="articles"
              color="white"
              icon="cart"
              onPress={() => navigation.navigate('ShoppingList')}
            />
          </View>
        </View>

        {/* Main Scan Button */}
        <ScanButton onPress={handleScanPress} disabled={!canScan} />

        {/* Subscription Status */}
        {!isPremium && (
          <TouchableOpacity 
            style={styles.subscriptionBanner}
            onPress={() => navigation.navigate('Subscription')}>
            <View style={styles.subscriptionContent}>
              <View style={styles.subscriptionIcon}>
                <Icon name="star" size="md" color={Colors.primary} />
              </View>
              <View style={styles.subscriptionText}>
                <Text style={styles.subscriptionTitle}>
                  {isTrialActive ? 'Essai gratuit' : 'Passez à Premium'}
                </Text>
                <Text style={styles.subscriptionSubtitle}>
                  {isTrialActive 
                    ? `${trialDaysRemaining} jours restants` 
                    : 'Scans illimités & plus'}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon="file-text"
            label="Longue facture"
            onPress={() => navigation.navigate('MultiPhotoScanner')}
            color="blue"
          />
          <QuickAction
            icon="help"
            label="Assistant IA"
            onPress={() => navigation.navigate('AIAssistant')}
            color="green"
          />
          <QuickAction
            icon="trophy"
            label="Mes succès"
            onPress={() => navigation.navigate('Achievements')}
            color="yellow"
          />
          <QuickAction
            icon="settings"
            label="Paramètres"
            onPress={() => navigation.navigate('Settings')}
            color="white"
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.base,
    paddingBottom: 120,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    width: 44,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Period Selector
  periodContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    padding: Spacing.xs,
  },
  periodButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
  },
  periodTextActive: {
    color: Colors.white,
  },

  // Greeting
  greetingSection: {
    marginBottom: Spacing.xl,
  },
  greeting: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    letterSpacing: Typography.letterSpacing.tight,
  },
  greetingSubtitle: {
    fontSize: Typography.fontSize.lg,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },

  // Stats Grid
  statsGrid: {
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    minHeight: 120,
  },
  statCardLarge: {
    minHeight: 160,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  statCardTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
  },
  statCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardValue: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  statCardSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },

  // Scan Button
  scanButtonWrapper: {
    marginBottom: Spacing.lg,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.cards.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.base,
  },
  scanTextContainer: {
    flex: 1,
  },
  scanButtonTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  scanButtonSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },

  // Subscription Banner
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cards.green,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
  },
  subscriptionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  subscriptionText: {
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  subscriptionSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // Section Title
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wider,
    marginBottom: Spacing.base,
  },

  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  quickAction: {
    width: CARD_WIDTH,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  quickActionLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});

export default HomeScreen;
