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
  StatusBar,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {RootStackParamList} from '@/shared/types';
import {useSubscription, useUser, useTheme} from '@/shared/contexts';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {analyticsService, hapticService, widgetDataService} from '@/shared/services';
import firestore from '@react-native-firebase/firestore';
import {formatCurrency} from '@/shared/utils/helpers';

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
      {periods.map(period => (
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
  color: 'red' | 'crimson' | 'blue' | 'cosmos' | 'cream' | 'yellow' | 'white';
  icon?: string;
  onPress?: () => void;
  size?: 'normal' | 'large';
}) => {
  const bgColor = {
    red: Colors.cards.red,
    crimson: Colors.cards.crimson,
    blue: Colors.cards.blue,
    cosmos: Colors.cards.cosmos,
    cream: Colors.cards.cream,
    yellow: Colors.cards.yellow,
    white: Colors.cards.white,
  }[color];

  // Use white text on dark backgrounds (red, crimson, cosmos)
  // Use dark text on light backgrounds (blue, cream, yellow, white)
  const isDarkBg = ['red', 'crimson', 'cosmos'].includes(color);
  const textColor = isDarkBg ? Colors.text.inverse : Colors.text.primary;
  const iconColor = isDarkBg ? Colors.text.inverse : Colors.text.primary;

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
      {/* Icon at top right */}
      {icon && (
        <View style={styles.statCardIconTop}>
          <Icon name={icon} size="sm" color={iconColor} />
        </View>
      )}
      
      {/* Text content at bottom */}
      <View style={styles.statCardTextContent}>
        {title && <Text style={[styles.statCardTitle, {color: textColor}]}>{title}</Text>}
        <Text style={[styles.statCardValue, {color: textColor}]}>{value}</Text>
        {subtitle && <Text style={[styles.statCardSubtitle, {color: textColor}]}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );
};

// Main Scan Button - Eye-catching gradient design
const ScanButton = ({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle pulsing glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [glowAnim]);

  const handlePressIn = () => {
    hapticService.light();
    Animated.spring(scaleAnim, {
      toValue: 0.96,
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

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[styles.scanButtonWrapper, {transform: [{scale: scaleAnim}]}]}>
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.scanButtonGlow,
          {opacity: disabled ? 0 : glowOpacity},
        ]}
      />
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}>
        <LinearGradient
          colors={
            disabled
              ? [Colors.border.light, Colors.background.secondary]
              : [Colors.card.crimson, Colors.card.red]
          }
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.scanButton}>
          {/* Decorative circles */}
          <View style={styles.scanButtonDecor1} />
          <View style={styles.scanButtonDecor2} />

          <View style={styles.scanButtonContent}>
            <View style={styles.scanIconWrapper}>
              <View style={styles.scanIconCircle}>
                <Icon name="camera" size="xl" color={Colors.card.crimson} />
              </View>
              <View style={styles.scanIconRing} />
            </View>
            <View style={styles.scanTextContainer}>
              <Text style={styles.scanButtonTitle}>
                Scanner un ticket
              </Text>
              <Text style={styles.scanButtonSubtitle}>
                Comparez les prix instantanément
              </Text>
            </View>
            <View style={styles.scanArrowCircle}>
              <Icon name="arrow-right" size="md" color={Colors.white} />
            </View>
          </View>
        </LinearGradient>
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
  color?: 'red' | 'crimson' | 'blue' | 'cosmos' | 'cream' | 'yellow' | 'white';
}) => {
  const bgColor = {
    red: Colors.cards.red,
    crimson: Colors.cards.crimson,
    blue: Colors.cards.blue,
    cosmos: Colors.cards.cosmos,
    cream: Colors.cards.cream,
    yellow: Colors.cards.yellow,
    white: Colors.cards.white,
  }[color];

  // Use white text/icons on dark backgrounds (red, crimson, cosmos)
  // Use dark text/icons on light backgrounds (blue, cream, yellow, white)
  const isDarkBg = ['red', 'crimson', 'cosmos'].includes(color);
  const textColor = isDarkBg ? Colors.text.inverse : Colors.text.primary;
  const iconColor = isDarkBg ? Colors.text.inverse : Colors.text.primary;

  return (
    <TouchableOpacity
      style={[styles.quickAction, {backgroundColor: bgColor}]}
      onPress={onPress}>
      <Icon name={icon} size="md" color={iconColor} />
      <Text style={[styles.quickActionLabel, {color: textColor}]}>{label}</Text>
    </TouchableOpacity>
  );
};

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {colors, isDarkMode} = useTheme();
  const {
    canScan,
    subscription,
    isTrialActive,
    trialDaysRemaining,
    trialScansUsed,
  } = useSubscription();
  const {profile: userProfile} = useUser();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    analyticsService.logScreenView('Home', 'HomeScreen');
  }, []);

  // Fetch monthly spending
  useEffect(() => {
    const fetchMonthlySpending = async () => {
      if (!userProfile?.userId) return;

      try {
        setIsLoadingStats(true);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const receiptsSnapshot = await firestore()
          .collection('artifacts')
          .doc('goshopperai')
          .collection('users')
          .doc(userProfile.userId)
          .collection('receipts')
          .where('scannedAt', '>=', startOfMonth)
          .get();

        let total = 0;
        receiptsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          // Use the currency that matches user's budget preference
          if (userProfile.preferredCurrency === 'CDF') {
            total += data.totalCDF || 0;
          } else {
            total += data.totalUSD || 0;
          }
        });

        setMonthlySpending(total);
        
        // Update widget data
        const budget = userProfile?.monthlyBudget || 500;
        widgetDataService.updateSpendingWidget({
          monthlyTotal: total,
          monthlyBudget: budget,
          currency: userProfile?.preferredCurrency || 'USD',
          lastUpdated: new Date().toISOString(),
          percentUsed: budget > 0 ? (total / budget) * 100 : 0,
        });
      } catch (error) {
        console.error('Error fetching monthly spending:', error);
        setMonthlySpending(0);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchMonthlySpending();
  }, [userProfile?.userId, userProfile?.preferredCurrency]);

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
    if (hour < 12) {
      return 'Bonjour';
    }
    if (hour < 18) {
      return 'Bon après-midi';
    }
    return 'Bonsoir';
  };

  const userName = userProfile?.displayName?.split(' ')[0] || '';
  const isPremium = subscription?.isSubscribed;

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background.primary}]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background.primary}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>{/* Empty space for balance */}</View>
          <View style={styles.headerCenter}>
            {/* Logo or app name could go here */}
          </View>
          <TouchableOpacity
            style={[styles.notificationButton, {backgroundColor: colors.background.secondary}]}
            onPress={() => navigation.navigate('PriceAlerts')}>
            <Icon name="bell" size="md" color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={[styles.greeting, {color: colors.text.primary}]}>
            {getGreeting()} {userName ? userName : ''},
          </Text>
          <Text style={[styles.greetingSubtitle, {color: colors.text.secondary}]}>
            voici ce qui se passe dans vos achats
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              title=""
              value={trialScansUsed || 0}
              subtitle={
                isPremium
                  ? 'illimités'
                  : `${5 - (trialScansUsed || 0)} scans restants`
              }
              color="blue"
              icon="camera"
              onPress={() =>
                navigation.navigate('Main', {screen: 'History'} as any)
              }
            />
            <StatCard
              title=""
              value="0"
              subtitle="articles"
              color="cosmos"
              icon="cart"
              onPress={() => navigation.navigate('ShoppingList')}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title=""
              value={
                userProfile?.monthlyBudget
                  ? `${userProfile.monthlyBudget} ${userProfile?.preferredCurrency || 'USD'}`
                  : `0 ${userProfile?.preferredCurrency || 'USD'}`
              }
              subtitle="Budget Mensuel"
              color="yellow"
              icon="wallet"
              onPress={() => navigation.navigate('Stats')}
            />
            <StatCard
              title=""
              value={
                isLoadingStats
                  ? '—'
                  : `${monthlySpending.toFixed(0)} ${userProfile?.preferredCurrency || 'USD'}`
              }
              subtitle="Dépenses Totales"
              color="yellow"
              icon="credit-card"
              onPress={() => navigation.navigate('Stats')}
            />
          </View>
        </View>

        {/* Main Scan Button */}
        <ScanButton onPress={handleScanPress} disabled={!canScan} />

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon="stats"
            label="Statistiques"
            onPress={() => navigation.navigate('Stats')}
            color="cosmos"
          />
          <QuickAction
            icon="shopping-bag"
            label="Mes Magasins"
            onPress={() => navigation.navigate('Shops')}
            color="blue"
          />
          <QuickAction
            icon="help"
            label="Assistant IA"
            onPress={() => navigation.navigate('AIAssistant')}
            color="yellow"
          />
          <QuickAction
            icon="trophy"
            label="Mes succès"
            onPress={() => navigation.navigate('Achievements')}
            color="blue"
          />
          <QuickAction
            icon="settings"
            label="Paramètres"
            onPress={() => navigation.navigate('Settings')}
            color="crimson"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
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
  headerCenter: {
    flex: 1,
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
    justifyContent: 'flex-end',
  },
  statCardLarge: {
    minHeight: 160,
  },
  statCardIconTop: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardTextContent: {
    width: '100%',
  },
  statCardTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
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
    marginBottom: Spacing.xl,
    position: 'relative',
  },
  scanButtonGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.card.red,
    opacity: 0.3,
  },
  scanButton: {
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    minHeight: 120,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.lg,
  },
  scanButtonDecor1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scanButtonDecor2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  scanButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  scanIconWrapper: {
    position: 'relative',
    marginRight: Spacing.base,
  },
  scanIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  scanIconRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  scanTextContainer: {
    flex: 1,
  },
  scanButtonTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  scanButtonSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  scanArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
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
