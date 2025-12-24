// Profile Screen - Urbanist Design System
// GoShopper - Soft Pastel Colors with Clean Typography
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAuth, useSubscription, useUser} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, AppFooter, Button} from '@/shared/components';
import {SUBSCRIPTION_PLANS, TRIAL_SCAN_LIMIT} from '@/shared/utils/constants';
import {formatCurrency, formatDate} from '@/shared/utils/helpers';
import {firebase} from '@react-native-firebase/functions';
import {analyticsService} from '@/shared/services/analytics';
import {getCurrentMonthBudget} from '@/shared/services/firebase/budgetService';

const {width} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Stat Card Component with Pastel Background
const StatCard = ({
  icon,
  value,
  label,
  color = 'blue',
}: {
  icon: string;
  value: string | number;
  label: string;
  color?: 'red' | 'crimson' | 'blue' | 'cosmos' | 'cream' | 'yellow' | 'white';
}) => {
  const cardColors = {
    red: Colors.card.red,
    crimson: Colors.card.crimson,
    blue: Colors.card.blue,
    cosmos: Colors.card.cosmos,
    cream: Colors.card.cream,
    yellow: Colors.card.yellow,
    white: Colors.card.white,
  };

  // Use white text on dark backgrounds (red, crimson, cosmos)
  const isDarkBg = ['red', 'crimson', 'cosmos'].includes(color);
  const textColor = isDarkBg ? Colors.text.inverse : Colors.text.primary;
  const iconColor = isDarkBg ? Colors.text.inverse : Colors.text.primary;

  return (
    <View style={[styles.statCard, {backgroundColor: cardColors[color]}]}>
      <View style={styles.statCardIcon}>
        <Icon name={icon} size="sm" color={iconColor} />
      </View>
      <Text style={[styles.statCardValue, {color: textColor}]}>{value}</Text>
      <Text style={[styles.statCardLabel, {color: textColor}]}>{label}</Text>
    </View>
  );
};

// Menu Item Component
const MenuItem = ({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  rightElement,
  iconColor = 'blue',
  disabled = false,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  iconColor?: 'red' | 'crimson' | 'blue' | 'cosmos' | 'cream' | 'yellow' | 'white';
  disabled?: boolean;
}) => {
  const cardColors = {
    red: Colors.card.red,
    crimson: Colors.card.crimson,
    blue: Colors.card.blue,
    cosmos: Colors.card.cosmos,
    cream: Colors.card.cream,
    yellow: Colors.card.yellow,
    white: Colors.card.white,
  };

  // Use white icon on dark backgrounds (red, crimson, cosmos)
  const isDarkBg = ['red', 'crimson', 'cosmos'].includes(iconColor);
  const iconDisplayColor = isDarkBg ? Colors.text.inverse : Colors.text.primary;

  return (
    <TouchableOpacity
      style={[styles.menuItem, disabled && {opacity: 0.5}]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}>
      <View
        style={[
          styles.menuIconContainer,
          {backgroundColor: cardColors[iconColor]},
        ]}>
        <Icon name={icon} size="sm" color={iconDisplayColor} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement ||
        (showChevron && (
          <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
        ))}
    </TouchableOpacity>
  );
};

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, signOut, isAuthenticated} = useAuth();
  const {subscription, trialScansUsed} = useSubscription();
  const {profile, isLoading: profileLoading} = useUser();
  const [currentBudget, setCurrentBudget] = useState(0);
  const [rebuildingItems, setRebuildingItems] = useState(false);

  const [userStats, setUserStats] = useState({
    totalReceipts: 0,
    totalSavings: 0,
    loading: true,
    error: null as string | null,
  });

  const currentPlan = subscription?.planId
    ? SUBSCRIPTION_PLANS[subscription.planId]
    : SUBSCRIPTION_PLANS.free;

  const trialRemaining = Math.max(0, TRIAL_SCAN_LIMIT - trialScansUsed);
  const isPremium = subscription?.isSubscribed;

  // Debug logging for subscription status
  useEffect(() => {
    console.log('📊 Profile - Full subscription data:', {
      planId: subscription?.planId,
      status: subscription?.status,
      isSubscribed: subscription?.isSubscribed,
      trialScansUsed: subscription?.trialScansUsed,
      monthlyScansUsed: subscription?.monthlyScansUsed,
      subscriptionEndDate: subscription?.subscriptionEndDate?.toString?.() || subscription?.subscriptionEndDate,
      currentPlanName: currentPlan?.name,
    });
  }, [subscription, currentPlan]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    analyticsService.logScreenView('Profile', 'ProfileScreen');
  }, []);

  // Load current month budget
  useEffect(() => {
    const loadBudget = async () => {
      if (!profile?.userId) return;

      try {
        const budget = await getCurrentMonthBudget(
          profile.userId,
          profile.defaultMonthlyBudget || profile.monthlyBudget,
          profile.preferredCurrency || 'USD',
        );
        setCurrentBudget(budget.amount);
      } catch (error) {
        console.error('Error loading budget:', error);
        setCurrentBudget(profile.monthlyBudget || 0);
      }
    };

    loadBudget();
  }, [profile?.userId, profile?.defaultMonthlyBudget, profile?.monthlyBudget, profile?.preferredCurrency]);

  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        setUserStats(prev => ({...prev, loading: true, error: null}));
        // Call the getUserStats function in europe-west1 region
        const functionsInstance = firebase.app().functions('europe-west1');
        const getUserStatsCallable =
          functionsInstance.httpsCallable('getUserStats');
        const result = await getUserStatsCallable();
        const data = result.data as {
          totalReceipts: number;
          totalSavings: number;
        };

        setUserStats({
          totalReceipts: data.totalReceipts || 0,
          totalSavings: data.totalSavings || 0,
          loading: false,
          error: null,
        });
      } catch (error: any) {
        // NOT_FOUND is expected for new users with no data yet
        const errorCode = error?.code || error?.message || '';
        if (errorCode.includes('NOT_FOUND') || errorCode.includes('not-found')) {
          console.log('📊 New user - no stats available yet');
          setUserStats({
            totalReceipts: 0,
            totalSavings: 0,
            loading: false,
            error: null,
          });
        } else {
          console.error('Failed to fetch user stats:', error);
          setUserStats(prev => ({
            ...prev,
            loading: false,
            error: 'Erreur de chargement',
          }));
        }
      }
    };

    if (user) {
      fetchUserStats();
    }
  }, [user]);

  // Don't render anything if not authenticated or profile is loading
  if (!isAuthenticated || profileLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {profileLoading ? 'Chargement du profil...' : 'Chargement...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      // Navigate to Home tab after sign out by resetting to Main
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleRebuildItems = async () => {
    try {
      setRebuildingItems(true);
      console.log('🔄 Starting items aggregation rebuild...');
      
      const functionsInstance = firebase.app().functions('europe-west1');
      const rebuildCallable = functionsInstance.httpsCallable('rebuildItemsAggregation');
      
      const result = await rebuildCallable();
      const data = result.data as {
        success: boolean;
        itemsProcessed: number;
        receiptsProcessed: number;
      };
      
      console.log('✅ Items rebuilt:', data);
      Alert.alert(
        'Succès',
        `Articles reconstruits avec succès!\n${data.itemsProcessed} articles de ${data.receiptsProcessed} reçus`
      );
    } catch (error: any) {
      console.error('❌ Error rebuilding items:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible de reconstruire les articles'
      );
    } finally {
      setRebuildingItems(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.name?.charAt(0)?.toUpperCase() ||
                 profile?.surname?.charAt(0)?.toUpperCase() ||
                 user?.displayName?.charAt(0)?.toUpperCase() ||
                 'U'}
              </Text>
            </View>
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Icon name="star" size="xs" color={Colors.white} />
              </View>
            )}
          </View>
          <Text style={styles.userName}>
            {profile?.name && profile?.surname
              ? `${profile.name} ${profile.surname}`
              : profile?.name || profile?.surname || user?.displayName || 'Utilisateur'}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Stats Cards Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="receipt"
            value={userStats.loading ? '—' : trialScansUsed}
            label="Scans"
            color="blue"
          />
          <StatCard
            icon="wallet"
            value={formatCurrency(currentBudget, profile?.preferredCurrency || 'USD')}
            label="Budget"
            color="cosmos"
          />
        </View>

        {/* Subscription Card */}
        <TouchableOpacity
          style={[
            styles.subscriptionCard,
            isPremium
              ? styles.subscriptionCardPremium
              : styles.subscriptionCardFree,
          ]}
          onPress={() => navigation.push('Subscription')}
          activeOpacity={0.8}>
          <View style={styles.subscriptionLeft}>
            <View
              style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
              <Icon
                name={isPremium ? 'star' : 'gift'}
                size="xs"
                color={isPremium ? Colors.white : Colors.text.primary}
              />
              <Text
                style={[
                  styles.planBadgeText,
                  isPremium && styles.planBadgeTextPremium,
                ]}>
                {isPremium ? 'Premium' : 'Essai gratuit'}
              </Text>
            </View>
            <Text style={styles.subscriptionTitle}>{currentPlan.name}</Text>
            <Text style={styles.subscriptionStatus}>
              {isPremium
                ? `Actif jusqu'au ${
                    subscription?.expiryDate
                      ? formatDate(subscription.expiryDate)
                      : '—'
                  }`
                : `${trialRemaining} scans restants`}
            </Text>
          </View>
          <Icon name="chevron-right" size="md" color={Colors.text.secondary} />
        </TouchableOpacity>

        {/* Menu Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Compte</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="user"
              title="Modifier le profil"
              iconColor="red"
              onPress={() => {
                analyticsService.logCustomEvent('profile_update_started');
                navigation.push('UpdateProfile');
              }}
            />
            {!profile?.phoneVerified && profile?.phoneNumber && (
              <MenuItem
                icon="phone"
                title="Vérifier votre numéro"
                subtitle="Non vérifié"
                iconColor="yellow"
                onPress={() => {
                  analyticsService.logCustomEvent('phone_verification_started');
                  navigation.push('VerifyOtp', {
                    phoneNumber: profile.phoneNumber!,
                    isRegistration: false,
                    isPhoneVerification: true,
                  });
                }}
              />
            )}
            <MenuItem
              icon="map-pin"
              title="Ville par défaut"
              subtitle={profile?.defaultCity || 'Non définie'}
              iconColor="cosmos"
              onPress={() => navigation.push('CitySelection')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Application</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="wallet"
              title="Paramètres du Budget"
              subtitle={currentBudget > 0 ? `${formatCurrency(currentBudget, profile?.preferredCurrency)} / mois` : `${formatCurrency(0, profile?.preferredCurrency || 'USD')} / mois`}
              iconColor="crimson"
              onPress={() => {
                analyticsService.logCustomEvent('budget_settings_opened');
                navigation.push('BudgetSettings');
              }}
            />
            <MenuItem
              icon="settings"
              title="Paramètres"
              iconColor="cosmos"
              onPress={() => navigation.push('Settings')}
            />
            <MenuItem
              icon="help"
              title="Aide et support"
              iconColor="cream"
              onPress={() => {
                analyticsService.logCustomEvent('support_opened');
                navigation.push('Support');
              }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Plus</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="trophy"
              title="Mes succès"
              iconColor="red"
              onPress={() => navigation.push('Achievements')}
            />
            <MenuItem
              icon="file-text"
              title="Conditions d'utilisation"
              iconColor="blue"
              onPress={() => {
                analyticsService.logCustomEvent('terms_opened');
                navigation.push('Terms');
              }}
            />
          </View>
        </View>

        {/* Developer Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Outils de développement</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="refresh-cw"
              title="Reconstruire les articles"
              subtitle={rebuildingItems ? "En cours..." : "Réagrége tous les articles des reçus"}
              iconColor="blue"
              onPress={handleRebuildItems}
              disabled={rebuildingItems}
            />
          </View>
        </View>

        {/* Sign Out */}
        <Button
          title="Se déconnecter"
          onPress={handleSignOut}
          variant="danger"
          size="lg"
          icon={<Icon name="logout" size="sm" color={Colors.white} />}
          style={{marginTop: Spacing.lg, marginBottom: Spacing.xl}}
        />

        {/* App Footer */}
        <AppFooter compact />
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
    paddingBottom: 100,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
  },
  avatarContainer: {
    marginBottom: Spacing.base,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card.red,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    ...Shadows.md,
  },
  avatarText: {
    fontSize: 36,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  premiumBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  userName: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },

  // Stats Cards
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.base,
    marginTop: Spacing.base,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statCardValue: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  statCardLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },

  // Subscription Card
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  subscriptionCardFree: {
    backgroundColor: Colors.card.cream,
  },
  subscriptionCardPremium: {
    backgroundColor: Colors.card.cosmos,
  },
  subscriptionLeft: {
    flex: 1,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  planBadgePremium: {
    backgroundColor: Colors.accent,
  },
  planBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  planBadgeTextPremium: {
    color: Colors.white,
  },
  subscriptionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subscriptionStatus: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },

  // Sections
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  menuGroup: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },

  // Menu Item
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.base,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  menuSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // Sign Out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing['2xl'],
    paddingVertical: Spacing.base,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  signOutText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.status.error,
  },

  // Version
  versionText: {
    textAlign: 'center',
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: Spacing.lg,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
});
