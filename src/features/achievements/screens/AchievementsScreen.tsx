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
  SafeAreaView,
} from 'react-native';
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

export function AchievementsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
    if (!user?.uid) {
      return;
    }

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
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFFFFF"
          translucent={false}
        />
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
            <Spinner size="large" color={Colors.card.cosmos} />
          </Animated.View>
          <Text style={styles.loadingText}>Chargement de vos succès...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const levelInfo = stats
    ? savingsTrackerService.getLevelInfo(stats.level)
    : null;
  const xpProgress = stats ? (stats.xp / stats.xpToNextLevel) * 100 : 0;
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  const statItems = [
    {
      icon: 'camera' as const,
      value: stats?.totalScans || 0,
      label: 'Scans',
      color: Colors.card.cosmos,
      bgColor: Colors.background.secondary,
    },
    {
      icon: 'dollar-sign' as const,
      value: `$${(stats?.totalSavings || 0).toFixed(0)}`,
      label: 'Économisé',
      color: Colors.card.crimson,
      bgColor: Colors.card.cream,
    },
    {
      icon: 'zap' as const,
      value: stats?.currentStreak || 0,
      label: 'Série',
      color: Colors.accent,
      bgColor: Colors.card.yellow,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Icon name="arrow-left" size="md" color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Succès</Text>
        <View style={styles.headerBadge}>
          <Icon name="trophy" size="sm" color={Colors.accent} />
          <Text style={styles.headerBadgeText}>
            {unlockedCount}/{achievements.length}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            <View
              style={[
                styles.levelGlow,
                {backgroundColor: levelInfo.color + '20'},
              ]}
            />
            <View style={styles.levelHeader}>
              <View
                style={[
                  styles.levelIconContainer,
                  {backgroundColor: levelInfo.color + '20'},
                ]}>
                <Text style={styles.levelIcon}>{levelInfo.icon}</Text>
              </View>
              <View style={styles.levelInfo}>
                <Text style={styles.levelTitle}>{levelInfo.title}</Text>
                <Text style={styles.levelTitleLingala}>
                  {levelInfo.titleLingala}
                </Text>
              </View>
              <View
                style={[
                  styles.levelBadge,
                  {backgroundColor: levelInfo.color + '15'},
                ]}>
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
                <View
                  style={[
                    styles.statIconContainer,
                    {backgroundColor: stat.color + '20'},
                  ]}>
                  <Icon name={stat.icon} size="md" color={stat.color} />
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
              <Icon name="trophy" size="md" color={Colors.accent} />
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
              <Icon
                name="check-circle"
                size="sm"
                color={Colors.card.cosmos}
              />
              <Text style={styles.groupTitle}>Débloqués</Text>
            </View>
            {achievements.filter(a => a.isUnlocked).length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon name="gift" size="xl" color={Colors.text.tertiary} />
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
                      <Icon
                        name="star"
                        size="xs"
                        color={Colors.accent}
                      />
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
              <Icon name="lock" size="sm" color={Colors.text.tertiary} />
              <Text
                style={[styles.groupTitle, {color: Colors.text.secondary}]}>
                À débloquer
              </Text>
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
                    <Icon
                      name="lock"
                      size="md"
                      color={Colors.text.tertiary}
                    />
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
                    <Icon
                      name="star"
                      size="xs"
                      color={Colors.text.tertiary}
                    />
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
              <Icon name="zap" size="lg" color={Colors.accent} />
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakTitle}>Plus longue série</Text>
              <Text style={styles.streakValue}>
                {stats.longestStreak} jours
              </Text>
            </View>
            <View style={styles.streakBadge}>
              <Icon name="trophy" size="md" color={Colors.accent} />
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
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  loadingSpinner: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.card.yellow,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  headerBadgeText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  // Level Card
  levelCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.md,
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
    marginBottom: Spacing.lg,
  },
  levelIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  levelIcon: {
    fontSize: 36,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  levelTitleLingala: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  levelBadge: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  levelNumber: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
  },

  // XP Progress
  xpContainer: {
    gap: Spacing.sm,
  },
  xpLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
  },
  xpBar: {
    height: 10,
    backgroundColor: Colors.border.light,
    borderRadius: 5,
    overflow: 'hidden',
  },
  xpProgress: {
    height: '100%',
    borderRadius: 5,
  },
  xpText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  xpHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
  },

  // Achievements Section
  achievementsSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  sectionBadge: {
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  sectionCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.secondary,
  },

  // Achievement Groups
  achievementGroup: {
    marginBottom: Spacing.xl,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  groupTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.base,
    borderWidth: 2,
    borderColor: Colors.border.light,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },

  // Achievement Cards
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.base,
    ...Shadows.sm,
  },
  achievementCardLocked: {
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.light,
    shadowOpacity: 0,
    elevation: 0,
  },
  achievementIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.base,
  },
  achievementIconLocked: {
    backgroundColor: Colors.border.light,
  },
  achievementIconText: {
    fontSize: 26,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  achievementTitleLocked: {
    color: Colors.text.tertiary,
  },
  achievementTitleLingala: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  achievementDesc: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  achievementDescLocked: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },

  // Progress Bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border.light,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.card.cosmos,
    borderRadius: 3,
  },
  progressText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    fontFamily: Typography.fontFamily.semiBold,
    minWidth: 50,
    textAlign: 'right',
  },

  // XP Badge
  achievementXP: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.card.yellow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.sm,
  },
  achievementXPText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  achievementXPLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.border.light,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.sm,
  },
  achievementXPTextLocked: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.tertiary,
  },

  // Streak Card
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  streakIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  streakInfo: {
    flex: 1,
  },
  streakTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  streakValue: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  streakBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card.yellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
