// Profile Screen - Urbanist Design System
// GoShopperAI - Soft Pastel Colors with Clean Typography
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAuth, useSubscription} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {SUBSCRIPTION_PLANS, TRIAL_SCAN_LIMIT} from '@/shared/utils/constants';
import {formatCurrency, formatDate} from '@/shared/utils/helpers';
import {firebase} from '@react-native-firebase/functions';
import {analyticsService} from '@/shared/services/analytics';

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
  color?: 'blue' | 'green' | 'yellow';
}) => {
  const cardColors = {
    blue: Colors.card.blue,
    green: Colors.card.green,
    yellow: Colors.card.yellow,
  };

  return (
    <View style={[styles.statCard, {backgroundColor: cardColors[color]}]}>
      <View style={styles.statCardIcon}>
        <Icon name={icon} size="sm" color={Colors.text.primary} />
      </View>
      <Text style={styles.statCardValue}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
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
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  iconColor?: 'blue' | 'green' | 'yellow';
}) => {
  const cardColors = {
    blue: Colors.card.blue,
    green: Colors.card.green,
    yellow: Colors.card.yellow,
  };

  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconContainer, {backgroundColor: cardColors[iconColor]}]}>
        <Icon name={icon} size="sm" color={Colors.text.primary} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (showChevron && (
        <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} />
      ))}
    </TouchableOpacity>
  );
};

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, signOut} = useAuth();
  const {subscription, trialScansUsed} = useSubscription();

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

  useEffect(() => {
    analyticsService.logScreenView('Profile', 'ProfileScreen');
  }, []);

  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        setUserStats(prev => ({...prev, loading: true, error: null}));
        // Call the getUserStats function in europe-west1 region
        const functionsInstance = firebase.app().functions('europe-west1');
        const getUserStatsCallable = functionsInstance.httpsCallable('getUserStats');
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
      } catch (error) {
        console.error('Failed to fetch user stats:', error);
        setUserStats(prev => ({
          ...prev,
          loading: false,
          error: 'Erreur de chargement',
        }));
      }
    };

    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Icon name="star" size="xs" color={Colors.white} />
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user?.displayName || 'Utilisateur'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Stats Cards Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="receipt"
            value={userStats.loading ? '—' : userStats.totalReceipts}
            label="Scans"
            color="blue"
          />
          <StatCard
            icon="trending-down"
            value={userStats.loading ? '—' : formatCurrency(userStats.totalSavings)}
            label="Économies"
            color="green"
          />
        </View>

        {/* Subscription Card */}
        <TouchableOpacity 
          style={[
            styles.subscriptionCard,
            isPremium ? styles.subscriptionCardPremium : styles.subscriptionCardFree
          ]}
          onPress={() => navigation.navigate('Subscription')}
          activeOpacity={0.8}>
          <View style={styles.subscriptionLeft}>
            <View style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
              <Icon 
                name={isPremium ? 'star' : 'gift'} 
                size="xs" 
                color={isPremium ? Colors.white : Colors.text.primary} 
              />
              <Text style={[styles.planBadgeText, isPremium && styles.planBadgeTextPremium]}>
                {isPremium ? 'Premium' : 'Essai gratuit'}
              </Text>
            </View>
            <Text style={styles.subscriptionTitle}>{currentPlan.name}</Text>
            <Text style={styles.subscriptionStatus}>
              {isPremium 
                ? `Actif jusqu'au ${subscription?.expiryDate ? formatDate(subscription.expiryDate) : '—'}`
                : `${trialRemaining} scans restants`
              }
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
              iconColor="blue"
              onPress={() => {
                analyticsService.logCustomEvent('profile_update_started');
                navigation.navigate('UpdateProfile');
              }}
            />
            <MenuItem
              icon="map-pin"
              title="Ville par défaut"
              subtitle="Kinshasa"
              iconColor="green"
              onPress={() => navigation.navigate('CitySelection')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Application</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="bell"
              title="Notifications"
              iconColor="yellow"
              onPress={() => navigation.navigate('Settings')}
            />
            <MenuItem
              icon="settings"
              title="Paramètres"
              iconColor="blue"
              onPress={() => navigation.navigate('Settings')}
            />
            <MenuItem
              icon="help"
              title="Aide et support"
              iconColor="green"
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Plus</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="trophy"
              title="Mes succès"
              iconColor="yellow"
              onPress={() => navigation.navigate('Achievements')}
            />
            <MenuItem
              icon="file-text"
              title="Conditions d'utilisation"
              iconColor="blue"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Icon name="logout" size="sm" color={Colors.status.error} />
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>GoShopper AI v1.0.0</Text>

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
    paddingBottom: 120,
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
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    ...Shadows.md,
  },
  avatarText: {
    fontSize: 36,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
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
    backgroundColor: Colors.card.yellow,
  },
  subscriptionCardPremium: {
    backgroundColor: Colors.card.green,
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
});
