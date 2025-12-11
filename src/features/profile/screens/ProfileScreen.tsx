// Profile Screen - User profile and settings access
// Optimized for Congolese users with French + Lingala translations
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAuth, useSubscription} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {COLORS, SUBSCRIPTION_PLANS, TRIAL_SCAN_LIMIT} from '@/shared/utils/constants';
import {formatCurrency, formatDate} from '@/shared/utils/helpers';
import functions from '@react-native-firebase/functions';
import {analyticsService} from '@/shared/services/analytics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAuth();
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
  const isFreeTier = !subscription || subscription.planId === 'free';

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Profile', 'ProfileScreen');
  }, []);

  // Fetch user stats from Cloud Function
  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        setUserStats(prev => ({ ...prev, loading: true, error: null }));
        
        const getUserStatsCallable = functions().httpsCallable('getUserStats');
        const result = await getUserStatsCallable();
        const data = result.data as {
          totalReceipts: number;
          totalSavings: number;
          totalSpent: number;
          subscriptionStatus: string;
          monthlyScansUsed: number;
          monthlyScansLimit: number;
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
          error: 'Failed to load stats',
        }));
      }
    };

    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const stats = {
    totalReceipts: userStats.totalReceipts,
    totalSavings: userStats.totalSavings,
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Profile Header - Simple and friendly */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>👩‍👩‍👧</Text>
            </View>
          </View>
          <Text style={styles.welcomeText}>Bienvenue!</Text>
          <Text style={styles.welcomeSubtext}>Boyei malamu! 🇨🇩</Text>
        </View>

        {/* Stats Cards - Large and clear */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Votre Activité</Text>
          <Text style={styles.sectionSubtitle}>Misala na yo</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>📄</Text>
              <Text style={styles.statValue}>
                {userStats.loading ? '...' : stats.totalReceipts}
              </Text>
              <Text style={styles.statLabel}>Factures scannées</Text>
              <Text style={styles.statLabelLingala}>Bafacture</Text>
            </View>
            
            <View style={[styles.statCard, styles.statCardHighlight]}>
              <Text style={styles.statEmoji}>💰</Text>
              <Text style={[styles.statValue, styles.statValueHighlight]}>
                {userStats.loading ? '...' : formatCurrency(stats.totalSavings)}
              </Text>
              <Text style={[styles.statLabel, styles.statLabelHighlight]}>Économisés</Text>
              <Text style={[styles.statLabelLingala, styles.statLabelHighlight]}>Obombi!</Text>
            </View>
          </View>
          
          {userStats.error && (
            <Text style={styles.errorText}>{userStats.error}</Text>
          )}
        </View>

        {/* Subscription Card - Clear status */}
        <TouchableOpacity
          style={styles.subscriptionCard}
          onPress={() => navigation.navigate('Subscription')}
          activeOpacity={0.8}>
          <View style={styles.subscriptionContent}>
            <View style={styles.subscriptionIcon}>
              <Text style={styles.subscriptionIconText}>
                {isFreeTier ? '🆓' : '⭐'}
              </Text>
            </View>
            <View style={styles.subscriptionInfo}>
              <Text style={styles.subscriptionPlan}>{currentPlan.name}</Text>
              {isFreeTier ? (
                <>
                  <Text style={styles.subscriptionStatus}>
                    {trialRemaining} scans gratuits restants
                  </Text>
                  <Text style={styles.subscriptionStatusLingala}>
                    {trialRemaining} scans ofele etikali
                  </Text>
                </>
              ) : (
                <Text style={styles.subscriptionStatus}>
                  Expire: {subscription?.expiryDate 
                    ? formatDate(subscription.expiryDate)
                    : 'Jamais'}
                </Text>
              )}
            </View>
            <Text style={styles.subscriptionArrow}>→</Text>
          </View>
          
          {isFreeTier && trialRemaining < 3 && (
            <View style={styles.upgradePrompt}>
              <Text style={styles.upgradeText}>
                ⚠️ Plus que {trialRemaining} essais !
              </Text>
              <Text style={styles.upgradeButton}>Passer Premium →</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Quick Actions - Big buttons */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions Rapides</Text>
          <Text style={styles.sectionSubtitle}>Misala ya noki</Text>
          
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardPrimary]}
              onPress={() => navigation.navigate('Scanner')}
              activeOpacity={0.8}>
              <Text style={styles.actionEmoji}>📸</Text>
              <Text style={styles.actionLabel}>Scanner</Text>
              <Text style={styles.actionLabelLingala}>Zwa foto</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Subscription')}
              activeOpacity={0.8}>
              <Text style={styles.actionEmoji}>⭐</Text>
              <Text style={styles.actionLabel}>Premium</Text>
              <Text style={styles.actionLabelLingala}>Mingi koleka</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.8}>
              <Text style={styles.actionEmoji}>⚙️</Text>
              <Text style={styles.actionLabel}>Paramètres</Text>
              <Text style={styles.actionLabelLingala}>Kobongisa</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {/* Navigate to help */}}
              activeOpacity={0.8}>
              <Text style={styles.actionEmoji}>❓</Text>
              <Text style={styles.actionLabel}>Aide</Text>
              <Text style={styles.actionLabelLingala}>Lisungi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                analyticsService.logCustomEvent('profile_update_started');
                navigation.navigate('UpdateProfile');
              }}
              activeOpacity={0.8}>
              <Text style={styles.actionEmoji}>👤</Text>
              <Text style={styles.actionLabel}>Modifier Profil</Text>
              <Text style={styles.actionLabelLingala}>Bongisa profil</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Badges - Gamification */}
        <View style={styles.badgesSection}>
          <Text style={styles.sectionTitle}>Vos Badges</Text>
          <Text style={styles.sectionSubtitle}>Medailles na yo</Text>
          
          <View style={styles.badgesRow}>
            <View style={styles.badgeItem}>
              <Text style={styles.badgeEmoji}>🎯</Text>
              <Text style={styles.badgeLabel}>Premier scan</Text>
              <Text style={styles.badgeStatus}>✓</Text>
            </View>
            
            <View style={styles.badgeItem}>
              <Text style={styles.badgeEmoji}>💰</Text>
              <Text style={styles.badgeLabel}>10$ économisés</Text>
              <Text style={styles.badgeStatus}>✓</Text>
            </View>
            
            <View style={[styles.badgeItem, styles.badgeLocked]}>
              <Text style={styles.badgeEmoji}>🏆</Text>
              <Text style={styles.badgeLabelLocked}>100 factures</Text>
              <Text style={styles.badgeStatusLocked}>🔒</Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>GoShopper AI v1.0.0</Text>
          <Text style={styles.appInfoSubtext}>Fait avec ❤️ pour le Congo</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  
  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarEmoji: {
    fontSize: 50,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 18,
    color: COLORS.primary[600],
  },
  
  // Section Titles
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.primary[600],
    marginBottom: 16,
    fontStyle: 'italic',
  },
  
  // Stats Section
  statsSection: {
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardHighlight: {
    backgroundColor: COLORS.primary[500],
  },
  statEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  statValueHighlight: {
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.gray[600],
    textAlign: 'center',
  },
  statLabelHighlight: {
    color: 'rgba(255,255,255,0.9)',
  },
  statLabelLingala: {
    fontSize: 12,
    color: COLORS.gray[400],
    fontStyle: 'italic',
    marginTop: 2,
  },
  
  // Subscription Card
  subscriptionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.primary[200],
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  subscriptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  subscriptionIconText: {
    fontSize: 30,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionPlan: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  subscriptionStatus: {
    fontSize: 14,
    color: COLORS.gray[600],
  },
  subscriptionStatusLingala: {
    fontSize: 12,
    color: COLORS.primary[500],
    fontStyle: 'italic',
    marginTop: 2,
  },
  subscriptionArrow: {
    fontSize: 24,
    color: COLORS.primary[500],
    fontWeight: 'bold',
  },
  upgradePrompt: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upgradeText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '600',
  },
  upgradeButton: {
    fontSize: 14,
    color: COLORS.primary[600],
    fontWeight: 'bold',
  },
  
  // Actions Section
  actionsSection: {
    marginBottom: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionCardPrimary: {
    backgroundColor: COLORS.primary[500],
  },
  actionEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[800],
    textAlign: 'center',
  },
  actionLabelLingala: {
    fontSize: 12,
    color: COLORS.gray[500],
    fontStyle: 'italic',
    marginTop: 4,
  },
  
  // Badges Section
  badgesSection: {
    marginBottom: 24,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  badgeItem: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeLocked: {
    backgroundColor: COLORS.gray[100],
    opacity: 0.7,
  },
  badgeEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray[700],
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeLabelLocked: {
    color: COLORS.gray[500],
  },
  badgeStatus: {
    fontSize: 16,
    color: COLORS.primary[500],
    fontWeight: 'bold',
  },
  badgeStatusLocked: {
    fontSize: 14,
  },
  
  // App Info
  appInfo: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  appInfoText: {
    fontSize: 12,
    color: COLORS.gray[400],
    marginBottom: 4,
  },
  appInfoSubtext: {
    fontSize: 12,
    color: COLORS.gray[500],
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8,
  },
});
