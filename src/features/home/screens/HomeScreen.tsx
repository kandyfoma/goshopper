// Home Screen - Modern Dashboard Design
// Inspired by Urbanist UI Kit - Soft pastels & card-based layout
import React, {useEffect, useRef, useState, useCallback} from 'react';
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
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {CompositeNavigationProp} from '@react-navigation/native';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import LinearGradient from 'react-native-linear-gradient';
import {RootStackParamList, MainTabParamList} from '@/shared/types';
import {HomeStackParamList} from '../navigation/HomeStackNavigator';
import {useSubscription, useUser, useTheme, useAuth} from '@/shared/contexts';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Button, SubscriptionLimitModal} from '@/shared/components';
import {analyticsService, hapticService, widgetDataService} from '@/shared/services';
import {hasFeatureAccess} from '@/shared/utils/featureAccess';
import firestore from '@react-native-firebase/firestore';
import {formatCurrency, safeToDate} from '@/shared/utils/helpers';
import {APP_ID} from '@/shared/services/firebase/config';
import {getCurrentMonthBudget} from '@/shared/services/firebase/budgetService';
import {Recommendations} from '@/features/recommendations';

const {width} = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.lg * 2 - Spacing.md) / 2;

type HomeScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList>,
    NativeStackNavigationProp<RootStackParamList>
  >
>;

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

  // Use white text/icons on dark backgrounds (red, crimson, cosmos, blue)
  // Use dark text/icons on light backgrounds (cream, yellow, white)
  const isDarkBg = ['red', 'crimson', 'cosmos', 'blue'].includes(color);
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
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const {colors, isDarkMode} = useTheme();
  const {isAuthenticated} = useAuth();
  const {
    canScan,
    subscription,
    isTrialActive,
    trialDaysRemaining,
    trialScansUsed,
    scansRemaining,
  } = useSubscription();
  const {profile: userProfile} = useUser();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [itemsCount, setItemsCount] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [currentBudget, setCurrentBudget] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Determine display currency: use preferred currency if budget is set, otherwise USD
  const displayCurrency = userProfile?.preferredCurrency || 'USD';

  // Load current month budget
  useEffect(() => {
    const loadBudget = async () => {
      if (!userProfile?.userId) return;

      try {
        console.log('💰 Loading budget for user:', userProfile.userId);
        console.log('💰 Default budget:', userProfile.defaultMonthlyBudget);
        console.log('💰 Legacy budget:', userProfile.monthlyBudget);
        console.log('💰 Currency:', userProfile.preferredCurrency);
        
        const budget = await getCurrentMonthBudget(
          userProfile.userId,
          userProfile.defaultMonthlyBudget || userProfile.monthlyBudget,
          userProfile.preferredCurrency || 'USD',
        );
        console.log('💰 Loaded budget:', budget);
        setCurrentBudget(budget.amount);
      } catch (error) {
        console.error('Error loading budget:', error);
        // Fallback to legacy budget
        setCurrentBudget(userProfile.monthlyBudget || 0);
      }
    };

    loadBudget();
  }, [userProfile?.userId, userProfile?.defaultMonthlyBudget, userProfile?.monthlyBudget, userProfile?.preferredCurrency]);

  // Update widget when budget changes
  useEffect(() => {
    if (currentBudget >= 0 && !isLoadingStats) {
      widgetDataService.updateSpendingWidget({
        monthlyTotal: monthlySpending,
        monthlyBudget: currentBudget,
        currency: displayCurrency,
        lastUpdated: new Date().toISOString(),
        percentUsed: currentBudget > 0 ? (monthlySpending / currentBudget) * 100 : 0,
      });
    }
  }, [currentBudget, monthlySpending, displayCurrency, isLoadingStats]);

  useEffect(() => {
    analyticsService.logScreenView('Home', 'HomeScreen');
  }, []);

  // Fetch monthly spending with real-time listener
  useEffect(() => {
    if (!userProfile?.userId) {
      setIsLoadingStats(false);
      return;
    }

    console.log('📊 Home: Setting up real-time listener for receipts');
    setIsLoadingStats(true);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Subscribe to receipts collection for real-time updates
    const unsubscribe = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userProfile.userId)
      .collection('receipts')
      .onSnapshot(
        (snapshot) => {
          console.log('📊 Home: Receipts updated, recalculating spending');
          
          let total = 0;
          let receiptCount = 0;
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            
            // Try multiple date fields for compatibility with old receipts
            let receiptDate = safeToDate(data.scannedAt);
            
            // If scannedAt is invalid (1970), try other date fields
            if (receiptDate.getFullYear() === 1970) {
              receiptDate = safeToDate(data.createdAt) || safeToDate(data.date) || new Date();
            }
            
            // Only count if receipt is from this month
            if (receiptDate >= startOfMonth) {
              receiptCount++;
              
              // Calculate total based on display currency using standardized fields
              let receiptTotal = 0;
              if (displayCurrency === 'CDF') {
                // For CDF: prioritize totalCDF field
                if (data.totalCDF != null) {
                  receiptTotal = Number(data.totalCDF) || 0;
                } else if (data.currency === 'CDF' && data.total != null) {
                  receiptTotal = Number(data.total) || 0;
                } else if (data.totalUSD != null) {
                  // Convert USD to CDF
                  receiptTotal = (Number(data.totalUSD) || 0) * 2200;
                } else if (data.currency === 'USD' && data.total != null) {
                  receiptTotal = (Number(data.total) || 0) * 2200;
                }
              } else {
                // For USD: prioritize totalUSD field
                if (data.totalUSD != null) {
                  receiptTotal = Number(data.totalUSD) || 0;
                } else if (data.currency === 'USD' && data.total != null) {
                  receiptTotal = Number(data.total) || 0;
                } else if (data.totalCDF != null) {
                  // Convert CDF to USD
                  receiptTotal = (Number(data.totalCDF) || 0) / 2200;
                } else if (data.currency === 'CDF' && data.total != null) {
                  receiptTotal = (Number(data.total) || 0) / 2200;
                }
              }
              
              total += receiptTotal;
            }
          });

          console.log('📊 Home: Total receipts this month:', receiptCount);
          console.log('📊 Home: Total spending:', total, displayCurrency);
          
          // Ensure total is a valid number
          const validTotal = Number.isFinite(total) ? total : 0;
          setMonthlySpending(validTotal);
          setIsLoadingStats(false);
        },
        (error) => {
          console.error('Error in receipts listener:', error);
          setMonthlySpending(0);
          setIsLoadingStats(false);
        }
      );

    return () => {
      unsubscribe();
    };
  }, [userProfile?.userId, displayCurrency]);

  // Fetch items count - reload when screen comes into focus
  const fetchItemsCount = useCallback(async () => {
    if (!userProfile?.userId) return;

    try {
      const receiptsSnapshot = await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(userProfile.userId)
        .collection('receipts')
        .get();

      const itemsSet = new Set<string>();

      receiptsSnapshot.docs.forEach(doc => {
        const receiptData = doc.data();
        const items = receiptData.items || [];

        items.forEach((item: any) => {
          const itemName = item.name?.toLowerCase().trim();
          if (itemName && (item.unitPrice || 0) > 0) {
            itemsSet.add(itemName);
          }
        });
      });

      setItemsCount(itemsSet.size);
    } catch (error) {
      console.error('Error fetching items count:', error);
      setItemsCount(0);
    }
  }, [userProfile?.userId]);

  // Reload items count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 HomeScreen focused, reloading items count');
      fetchItemsCount();
    }, [fetchItemsCount])
  );

  const handleScanPress = () => {
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_subscription');
      navigation.push('Subscription');
      return;
    }

    if (!userProfile?.defaultCity) {
      analyticsService.logCustomEvent('scan_redirect_city_selection');
      navigation.push('CitySelection');
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

  // Guest Welcome Content
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background.primary}]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background.primary}
        />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroIconContainer}>
              <LinearGradient
                colors={[Colors.card.crimson, Colors.card.red]}
                style={styles.heroIconGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Icon name="shopping-bag" size="xl" color={Colors.white} />
              </LinearGradient>
            </View>
            <Text style={styles.heroTitle}>Bienvenue sur Goshopper</Text>
            <Text style={styles.heroSubtitle}>
              L'application intelligente qui révolutionne vos achats
            </Text>
          </View>

          {/* Features Grid */}
          <View style={styles.featuresGrid}>
            <View style={[styles.featureCard, {backgroundColor: Colors.card.blue}]}>
              <Icon name="camera" size="lg" color={Colors.text.primary} />
              <Text style={styles.featureTitle}>Scanner vos tickets</Text>
              <Text style={styles.featureDescription}>
                Numérisez instantanément vos reçus et gardez une trace de tous vos achats
              </Text>
            </View>

            <View style={[styles.featureCard, {backgroundColor: Colors.card.cosmos}]}>
              <Icon name="stats" size="lg" color={Colors.text.inverse} />
              <Text style={[styles.featureTitle, {color: Colors.text.inverse}]}>Comparer les prix</Text>
              <Text style={[styles.featureDescription, {color: Colors.text.inverse}]}>
                Trouvez les meilleurs prix dans tous vos magasins préférés
              </Text>
            </View>

            <View style={[styles.featureCard, {backgroundColor: Colors.card.yellow}]}>
              <Icon name="wallet" size="lg" color={Colors.text.primary} />
              <Text style={styles.featureTitle}>Gérer votre budget</Text>
              <Text style={styles.featureDescription}>
                Suivez vos dépenses et économisez plus facilement
              </Text>
            </View>

            <View style={[styles.featureCard, {backgroundColor: Colors.card.cream}]}>
              <Icon name="help" size="lg" color={Colors.text.primary} />
              <Text style={styles.featureTitle}>Assistant IA</Text>
              <Text style={styles.featureDescription}>
                Obtenez des conseils personnalisés pour optimiser vos achats
              </Text>
            </View>
          </View>

          {/* Benefits Section */}
          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>Pourquoi rejoindre notre communauté ?</Text>
            
            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, {backgroundColor: Colors.card.blue}]}>
                <Icon name="check-circle" size="sm" color={Colors.text.primary} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Gratuit pour commencer</Text>
                <Text style={styles.benefitDescription}>5 scans gratuits pour découvrir l'app</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, {backgroundColor: Colors.card.cosmos}]}>
                <Icon name="shield" size="sm" color={Colors.text.inverse} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Sécurisé et privé</Text>
                <Text style={styles.benefitDescription}>Vos données sont protégées et confidentielles</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, {backgroundColor: Colors.card.yellow}]}>
                <Icon name="trending-up" size="sm" color={Colors.text.primary} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Économisez plus</Text>
                <Text style={styles.benefitDescription}>En moyenne 20% d'économies par mois</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, {backgroundColor: Colors.card.crimson}]}>
                <Icon name="users" size="sm" color={Colors.text.inverse} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Rejoignez la communauté</Text>
                <Text style={styles.benefitDescription}>Des milliers d'utilisateurs satisfaits</Text>
              </View>
            </View>
          </View>

          {/* CTA Buttons */}
          <View style={styles.ctaContainer}>
            <Button
              variant="primary"
              title="Créer un compte gratuit"
              onPress={() => {
                analyticsService.logCustomEvent('guest_register_clicked');
                navigation.push('Register');
              }}
            />

            <Button
              variant="outline"
              title="J'ai déjà un compte"
              onPress={() => {
                analyticsService.logCustomEvent('guest_login_clicked');
                navigation.push('Login');
              }}
            />
          </View>

          {/* Footer */}
          <View style={styles.guestFooter}>
            <Text style={styles.footerText}>
              En vous inscrivant, c'est{' '}
              <Text style={styles.footerHighlight}>gratuit, rapide et sécurisé</Text>
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Authenticated User Content
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
            onPress={() => navigation.push('Notifications')}>
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

        {/* Grace Period Banner */}
        {subscription?.status === 'grace' && subscription?.gracePeriodEnd && (
          <TouchableOpacity
            style={styles.graceBanner}
            onPress={() => navigation.push('Subscription')}>
            <View style={styles.graceIconContainer}>
              <Icon name="clock" size="md" color={Colors.status.warning} />
            </View>
            <View style={styles.graceContent}>
              <Text style={styles.graceTitle}>Période de grâce</Text>
              <Text style={styles.graceMessage}>
                {scansRemaining} scans restants • Expire le{' '}
                {new Date(subscription.gracePeriodEnd).toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              title="Scans"
              value={trialScansUsed || 0}
              subtitle={
                scansRemaining === -1
                  ? 'illimités'
                  : `${scansRemaining} restants`
              }
              color="blue"
              icon="camera"
              onPress={() => navigation.navigate('SubscriptionDetails')}
            />
            <StatCard
              title="Articles"
              value={itemsCount || 0}
              subtitle="mes articles"
              color="cosmos"
              icon="cart"
              onPress={() => navigation.push('Items')}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title="Budget"
              value={
                currentBudget > 0
                  ? `${currentBudget.toLocaleString()} ${displayCurrency}`
                  : `0 ${displayCurrency}`
              }
              subtitle="mensuel"
              color="yellow"
              icon="wallet"
              onPress={() => navigation.push('BudgetSettings')}
            />
            <StatCard
              title="Dépenses"
              value={
                isLoadingStats
                  ? '—'
                  : `${(Number.isFinite(monthlySpending) ? monthlySpending : 0).toLocaleString(undefined, {maximumFractionDigits: 0})} ${displayCurrency}`
              }
              subtitle="ce mois"
              color="yellow"
              icon="credit-card"
              onPress={() => navigation.push('History')}
            />
          </View>
        </View>

        {/* Main Scan Button */}
        <ScanButton onPress={handleScanPress} disabled={!canScan} />

        {/* AI Recommendations */}
        <Recommendations
          onItemPress={item => {
            // Navigate to item details or price comparison
            console.log('Item pressed:', item);
          }}
          limit={5}
        />

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon="shopping-bag"
            label="Mes Magasins"
            onPress={() => navigation.push('Shops')}
            color="cosmos"
          />
          <QuickAction
            icon="help"
            label="Assistant IA"
            onPress={() => navigation.push('AIAssistant')}
            color="yellow"
          />
          <QuickAction
            icon="trophy"
            label="Mes succès"
            onPress={() => navigation.push('Achievements')}
            color="blue"
          />
          <QuickAction
            icon="cart"
            label="Mes listes"
            onPress={() => navigation.push('ShoppingLists')}
            color="crimson"
          />
        </View>
      </ScrollView>

      {/* Subscription Limit Modal */}
      <SubscriptionLimitModal
        visible={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType="generic"
        customTitle="Statistiques"
        customMessage="Les statistiques avancées sont réservées aux abonnés Standard et Premium. Mettez à niveau pour visualiser vos dépenses."
      />
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

  // Grace Period Banner
  graceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.yellow,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.status.warning,
    ...Shadows.sm,
  },
  graceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  graceContent: {
    flex: 1,
  },
  graceTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  graceMessage: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
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
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  scanButtonSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: '#FFFFFF',
    opacity: 0.95,
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

  // Guest Welcome Styles
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    marginBottom: Spacing.xl,
  },
  heroIconContainer: {
    marginBottom: Spacing.lg,
  },
  heroIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xl,
  },
  heroTitle: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: Typography.letterSpacing.tight,
  },
  heroSubtitle: {
    fontSize: Typography.fontSize.lg,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },

  featuresGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  featureCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  featureTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  featureDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },

  benefitsSection: {
    marginBottom: Spacing.xl * 2,
  },
  benefitsTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs / 2,
  },
  benefitDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 18,
  },

  ctaContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  ctaPrimary: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  ctaPrimaryText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  ctaSecondary: {
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.border.medium,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },

  guestFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  footerText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  footerHighlight: {
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
});

export default HomeScreen;
