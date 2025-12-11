// Achievements Screen - Gamification and user progress
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth} from '@/shared/contexts';
import {
  savingsTrackerService,
  UserStats,
  Achievement,
} from '@/shared/services/firebase';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Spinner} from '@/shared/components';

// Urbanist Design Colors
const URBANIST_COLORS = {
  background: '#F6F5FA',     // Ghost White
  cardBg: '#FFFFFF',
  primaryAccent: '#D8DFE9',  // Alice Blue
  secondaryAccent: '#CFDECA', // Honeydew
  highlightAccent: '#EFF0A3', // Vanilla
  textPrimary: '#212121',    // Eerie Black
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  gold: '#F59E0B',
  border: '#E5E7EB',
};

export function AchievementsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Don't render anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const levelCardScale = useRef(new Animated.Value(0.9)).current;
  const statsAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    loadData();
  }, [user?.uid]);

  useEffect(() => {
    if (!isLoading) {
      // Entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(levelCardScale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Stagger stats animations
      Animated.stagger(
        100,
        statsAnimations.map(anim =>
          Animated.spring(anim, {
            toValue: 1,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }),
        ),
      ).start();
    }
  }, [isLoading]);

  const loadData = async () => {
    if (!user?.uid) return;

    try {
      const [userStats, userAchievements] = await Promise.all([
        savingsTrackerService.getStats(user.uid),
        savingsTrackerService.getAchievements(user.uid),
      ]);

      setStats(userStats);
      setAchievements(userAchievements);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, {paddingTop: insets.top}]}>
        <StatusBar barStyle="dark-content" backgroundColor={URBANIST_COLORS.background} />
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingSpinner,
              {
                transform: [
                  {
                    rotate: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}>
            <Spinner size={48} color={URBANIST_COLORS.purple} />
          </Animated.View>
          <Text style={styles.loadingText}>Chargement de vos succès...</Text>
        </View>
      </View>
    );
  }

  const levelInfo = stats
    ? savingsTrackerService.getLevelInfo(stats.level)
    : null;
  const xpProgress = stats ? (stats.xp / stats.xpToNextLevel) * 100 : 0;
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  const statItems = [
    {
      icon: 'scan-line' as const,
      value: stats?.totalScans || 0,
      label: 'Scans',
      color: URBANIST_COLORS.blue,
      bgColor: URBANIST_COLORS.primaryAccent,
    },
    {
      icon: 'money-dollar-circle-line' as const,
      value: `$${(stats?.totalSavings || 0).toFixed(0)}`,
      label: 'Économisé',
      color: URBANIST_COLORS.success,
      bgColor: URBANIST_COLORS.secondaryAccent,
    },
    {
      icon: 'fire-line' as const,
      value: stats?.currentStreak || 0,
      label: 'Série',
      color: URBANIST_COLORS.warning,
      bgColor: URBANIST_COLORS.highlightAccent,
    },
  ];

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor={URBANIST_COLORS.background} />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
          },
        ]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Icon name="arrow-left-line" size={24} color={URBANIST_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Succès</Text>
        <View style={styles.headerBadge}>
          <Icon name="trophy-line" size={18} color={URBANIST_COLORS.gold} />
          <Text style={styles.headerBadgeText}>{unlockedCount}/{achievements.length}</Text>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, {paddingBottom: insets.bottom + 24}]}
        showsVerticalScrollIndicator={false}>
        
        {/* Level Card */}
        {stats && levelInfo && (
          <Animated.View
            style={[
              styles.levelCard,
              {
                opacity: fadeAnim,
                transform: [{scale: levelCardScale}],
              },
            ]}>
            <View style={[styles.levelGlow, {backgroundColor: levelInfo.color + '20'}]} />
            <View style={styles.levelHeader}>
              <View style={[styles.levelIconContainer, {backgroundColor: levelInfo.color + '20'}]}>
                <Text style={styles.levelIcon}>{levelInfo.icon}</Text>
              </View>
              <View style={styles.levelInfo}>
                <Text style={styles.levelTitle}>{levelInfo.title}</Text>
                <Text style={styles.levelTitleLingala}>
                  {levelInfo.titleLingala}
                </Text>
              </View>
              <View style={[styles.levelBadge, {backgroundColor: levelInfo.color + '15'}]}>
                <Text style={[styles.levelNumber, {color: levelInfo.color}]}>
                  Niv. {stats.level}
                </Text>
              </View>
            </View>

            {/* XP Progress Bar */}
            <View style={styles.xpContainer}>
              <View style={styles.xpLabels}>
                <Text style={styles.xpLabel}>Progression</Text>
                <Text style={styles.xpText}>
                  {stats.xp} / {stats.xpToNextLevel} XP
                </Text>
              </View>
              <View style={styles.xpBar}>
                <Animated.View
                  style={[
                    styles.xpProgress,
                    {
                      width: `${xpProgress}%`,
                      backgroundColor: levelInfo.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.xpHint}>
                {stats.xpToNextLevel - stats.xp} XP pour le niveau suivant
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Stats Overview */}
        {stats && (
          <View style={styles.statsGrid}>
            {statItems.map((stat, index) => (
              <Animated.View
                key={stat.label}
                style={[
                  styles.statCard,
                  {backgroundColor: stat.bgColor},
                  {
                    opacity: statsAnimations[index],
                    transform: [
                      {
                        scale: statsAnimations[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                  },
                ]}>
                <View style={[styles.statIconContainer, {backgroundColor: stat.color + '20'}]}>
                  <Icon name={stat.icon} size={20} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Achievements Section */}
        <View style={styles.achievementsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="trophy-line" size={22} color={URBANIST_COLORS.gold} />
              <Text style={styles.sectionTitle}>Accomplissements</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionCount}>
                {unlockedCount} / {achievements.length}
              </Text>
            </View>
          </View>

          {/* Unlocked Achievements */}
          <View style={styles.achievementGroup}>
            <View style={styles.groupHeader}>
              <Icon name="checkbox-circle-line" size={18} color={URBANIST_COLORS.success} />
              <Text style={styles.groupTitle}>Débloqués</Text>
            </View>
            {achievements.filter(a => a.isUnlocked).length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon name="gift-2-line" size={40} color={URBANIST_COLORS.textMuted} />
                <Text style={styles.emptyText}>
                  Continuez à scanner pour débloquer des succès !
                </Text>
              </View>
            ) : (
              achievements
                .filter(a => a.isUnlocked)
                .map((achievement, index) => (
                  <Animated.View
                    key={achievement.id}
                    style={[
                      styles.achievementCard,
                      {
                        opacity: fadeAnim,
                        transform: [
                          {
                            translateX: slideAnim.interpolate({
                              inputRange: [0, 30],
                              outputRange: [0, 50 * (index + 1)],
                            }),
                          },
                        ],
                      },
                    ]}>
                    <View style={styles.achievementIcon}>
                      <Text style={styles.achievementIconText}>
                        {achievement.icon}
                      </Text>
                    </View>
                    <View style={styles.achievementInfo}>
                      <Text style={styles.achievementTitle}>
                        {achievement.title}
                      </Text>
                      <Text style={styles.achievementTitleLingala}>
                        {achievement.titleLingala}
                      </Text>
                      <Text style={styles.achievementDesc}>
                        {achievement.description}
                      </Text>
                    </View>
                    <View style={styles.achievementXP}>
                      <Icon name="star-fill" size={14} color={URBANIST_COLORS.gold} />
                      <Text style={styles.achievementXPText}>
                        +{achievement.xpReward}
                      </Text>
                    </View>
                  </Animated.View>
                ))
            )}
          </View>

          {/* Locked Achievements */}
          <View style={styles.achievementGroup}>
            <View style={styles.groupHeader}>
              <Icon name="lock-line" size={18} color={URBANIST_COLORS.textMuted} />
              <Text style={[styles.groupTitle, {color: URBANIST_COLORS.textMuted}]}>À débloquer</Text>
            </View>
            {achievements
              .filter(a => !a.isUnlocked)
              .map((achievement, index) => (
                <Animated.View
                  key={achievement.id}
                  style={[
                    styles.achievementCard,
                    styles.achievementCardLocked,
                    {
                      opacity: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.8],
                      }),
                    },
                  ]}>
                  <View
                    style={[
                      styles.achievementIcon,
                      styles.achievementIconLocked,
                    ]}>
                    <Icon name="lock-line" size={22} color={URBANIST_COLORS.textMuted} />
                  </View>
                  <View style={styles.achievementInfo}>
                    <Text
                      style={[
                        styles.achievementTitle,
                        styles.achievementTitleLocked,
                      ]}>
                      {achievement.title}
                    </Text>
                    <Text style={styles.achievementDescLocked}>
                      {achievement.description}
                    </Text>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <Animated.View
                          style={[
                            styles.progressFill,
                            {
                              width: `${
                                (achievement.progress / achievement.target) *
                                100
                              }%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {achievement.progress} / {achievement.target}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.achievementXPLocked}>
                    <Icon name="star-line" size={14} color={URBANIST_COLORS.textMuted} />
                    <Text style={styles.achievementXPTextLocked}>
                      +{achievement.xpReward}
                    </Text>
                  </View>
                </Animated.View>
              ))}
          </View>
        </View>

        {/* Streak Info */}
        {stats && stats.longestStreak > 0 && (
          <Animated.View
            style={[
              styles.streakCard,
              {
                opacity: fadeAnim,
                transform: [{translateY: slideAnim}],
              },
            ]}>
            <View style={styles.streakIconContainer}>
              <Icon name="fire-fill" size={28} color={URBANIST_COLORS.warning} />
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakTitle}>Plus longue série</Text>
              <Text style={styles.streakValue}>
                {stats.longestStreak} jours
              </Text>
            </View>
            <View style={styles.streakBadge}>
              <Icon name="medal-line" size={20} color={URBANIST_COLORS.gold} />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: URBANIST_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingSpinner: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: URBANIST_COLORS.textSecondary,
    letterSpacing: 0.3,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: URBANIST_COLORS.background,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: URBANIST_COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: URBANIST_COLORS.highlightAccent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
  },

  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },

  // Level Card
  levelCard: {
    backgroundColor: URBANIST_COLORS.cardBg,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  levelGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.5,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  levelIcon: {
    fontSize: 36,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  levelTitleLingala: {
    fontSize: 14,
    color: URBANIST_COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  levelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  levelNumber: {
    fontSize: 15,
    fontWeight: '700',
  },

  // XP Progress
  xpContainer: {
    gap: 8,
  },
  xpLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: URBANIST_COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  xpBar: {
    height: 10,
    backgroundColor: URBANIST_COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  xpProgress: {
    height: '100%',
    borderRadius: 5,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
  },
  xpHint: {
    fontSize: 12,
    color: URBANIST_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: URBANIST_COLORS.textSecondary,
  },

  // Achievements Section
  achievementsSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  sectionBadge: {
    backgroundColor: URBANIST_COLORS.primaryAccent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '700',
    color: URBANIST_COLORS.textSecondary,
  },

  // Achievement Groups
  achievementGroup: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: URBANIST_COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyCard: {
    backgroundColor: URBANIST_COLORS.cardBg,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: URBANIST_COLORS.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    color: URBANIST_COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Achievement Cards
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: URBANIST_COLORS.cardBg,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  achievementCardLocked: {
    backgroundColor: URBANIST_COLORS.background,
    borderWidth: 1,
    borderColor: URBANIST_COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  achievementIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: URBANIST_COLORS.secondaryAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  achievementIconLocked: {
    backgroundColor: URBANIST_COLORS.border,
  },
  achievementIconText: {
    fontSize: 26,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  achievementTitleLocked: {
    color: URBANIST_COLORS.textMuted,
  },
  achievementTitleLingala: {
    fontSize: 12,
    color: URBANIST_COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 1,
  },
  achievementDesc: {
    fontSize: 13,
    color: URBANIST_COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  achievementDescLocked: {
    fontSize: 13,
    color: URBANIST_COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  // Progress Bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: URBANIST_COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: URBANIST_COLORS.purple,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: URBANIST_COLORS.textMuted,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },

  // XP Badge
  achievementXP: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: URBANIST_COLORS.highlightAccent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  achievementXPText: {
    fontSize: 13,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
  },
  achievementXPLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: URBANIST_COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  achievementXPTextLocked: {
    fontSize: 13,
    fontWeight: '600',
    color: URBANIST_COLORS.textMuted,
  },

  // Streak Card
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: URBANIST_COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: URBANIST_COLORS.warning,
  },
  streakIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: URBANIST_COLORS.highlightAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  streakInfo: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: URBANIST_COLORS.textSecondary,
    marginBottom: 4,
  },
  streakValue: {
    fontSize: 26,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  streakBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: URBANIST_COLORS.highlightAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
