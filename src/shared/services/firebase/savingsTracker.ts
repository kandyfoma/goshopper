// Savings Tracker & Gamification Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from './config';
import {pushNotificationService} from './pushNotifications';
import {safeToDate} from '@/shared/utils/helpers';

const SAVINGS_COLLECTION = (userId: string) =>
  `artifacts/${APP_ID}/users/${userId}/savings`;

const ACHIEVEMENTS_COLLECTION = (userId: string) =>
  `artifacts/${APP_ID}/users/${userId}/achievements`;

const USER_STATS_KEY = '@goshopperai/user_stats';

export interface SavingsRecord {
  id: string;
  receiptId: string;
  date: Date;
  totalSpent: number;
  potentialSavings: number;
  actualSavings: number;
  currency: 'USD' | 'CDF';
  storeName: string;
  itemCount: number;
  bestPricesFound: number;
}

export interface Achievement {
  id: string;
  type: AchievementType;
  title: string;
  titleLingala: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  progress: number;
  target: number;
  isUnlocked: boolean;
  xpReward: number;
}

export type AchievementType =
  | 'first_scan'
  | 'scans_5'
  | 'scans_25'
  | 'scans_100'
  | 'savings_100'
  | 'savings_500'
  | 'savings_1000'
  | 'shops_3'
  | 'shops_10'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'price_hunter'
  | 'budget_master';

export interface UserStats {
  totalScans: number;
  totalSpent: number;
  totalSavings: number;
  currentStreak: number;
  longestStreak: number;
  lastScanDate?: Date;
  level: number;
  xp: number;
  xpToNextLevel: number;
  shopsVisited: number;
  itemsScanned: number;
  bestPricesFound: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalSavings: number;
  rank: number;
}

// Achievement definitions
const ACHIEVEMENTS: Omit<
  Achievement,
  'progress' | 'isUnlocked' | 'unlockedAt'
>[] = [
  {
    id: 'first_scan',
    type: 'first_scan',
    title: 'Premier Pas',
    titleLingala: 'Etape ya liboso',
    description: 'Scanner votre première facture',
    icon: '🎯',
    target: 1,
    xpReward: 10,
  },
  {
    id: 'scans_5',
    type: 'scans_5',
    title: 'Débutant',
    titleLingala: 'Mobandi',
    description: 'Scanner 5 factures',
    icon: '📝',
    target: 5,
    xpReward: 25,
  },
  {
    id: 'scans_25',
    type: 'scans_25',
    title: 'Habitué',
    titleLingala: 'Moto ya mboka',
    description: 'Scanner 25 factures',
    icon: '🌟',
    target: 25,
    xpReward: 50,
  },
  {
    id: 'scans_100',
    type: 'scans_100',
    title: 'Expert',
    titleLingala: 'Moyebi',
    description: 'Scanner 100 factures',
    icon: '👑',
    target: 100,
    xpReward: 100,
  },
  {
    id: 'savings_100',
    type: 'savings_100',
    title: 'Économe',
    titleLingala: 'Mosombisi malamu',
    description: 'Économiser $100 au total',
    icon: '💰',
    target: 100,
    xpReward: 50,
  },
  {
    id: 'savings_500',
    type: 'savings_500',
    title: 'Chasseur de Prix',
    titleLingala: 'Moluki ya ntalo',
    description: 'Économiser $500 au total',
    icon: '💎',
    target: 500,
    xpReward: 100,
  },
  {
    id: 'savings_1000',
    type: 'savings_1000',
    title: 'Maître des Économies',
    titleLingala: 'Mokonzi ya mbongo',
    description: 'Économiser $1000 au total',
    icon: '🏆',
    target: 1000,
    xpReward: 200,
  },
  {
    id: 'shops_3',
    type: 'shops_3',
    title: 'Explorateur',
    titleLingala: 'Moluki',
    description: 'Visiter 3 magasins différents',
    icon: '🏪',
    target: 3,
    xpReward: 25,
  },
  {
    id: 'shops_10',
    type: 'shops_10',
    title: 'Globe-Trotter',
    titleLingala: 'Motamboli',
    description: 'Visiter 10 magasins différents',
    icon: '🌍',
    target: 10,
    xpReward: 75,
  },
  {
    id: 'streak_3',
    type: 'streak_3',
    title: 'Régulier',
    titleLingala: 'Moto ya ntango',
    description: 'Scanner 3 jours de suite',
    icon: '🔥',
    target: 3,
    xpReward: 30,
  },
  {
    id: 'streak_7',
    type: 'streak_7',
    title: 'Assidu',
    titleLingala: 'Moto ya molende',
    description: 'Scanner 7 jours de suite',
    icon: '⚡',
    target: 7,
    xpReward: 75,
  },
  {
    id: 'streak_30',
    type: 'streak_30',
    title: 'Légende',
    titleLingala: 'Mokonzi',
    description: 'Scanner 30 jours de suite',
    icon: '🌟',
    target: 30,
    xpReward: 200,
  },
  {
    id: 'price_hunter',
    type: 'price_hunter',
    title: 'Chasseur de Prix',
    titleLingala: 'Moluki ya ntalo',
    description: 'Trouver 50 meilleurs prix',
    icon: '🎯',
    target: 50,
    xpReward: 75,
  },
  {
    id: 'budget_master',
    type: 'budget_master',
    title: 'Maître du Budget',
    titleLingala: 'Mokonzi ya budget',
    description: 'Rester sous le budget 4 semaines de suite',
    icon: '📊',
    target: 4,
    xpReward: 100,
  },
];

class SavingsTrackerService {
  /**
   * Record savings from a receipt
   */
  async recordSavings(
    userId: string,
    receiptId: string,
    data: {
      totalSpent: number;
      potentialSavings: number;
      actualSavings: number;
      currency: 'USD' | 'CDF';
      storeName: string;
      itemCount: number;
      bestPricesFound: number;
    },
  ): Promise<SavingsRecord> {
    const savingsRef = firestore()
      .collection(SAVINGS_COLLECTION(userId))
      .doc(receiptId);

    const record: Omit<SavingsRecord, 'id'> = {
      receiptId,
      date: new Date(),
      ...data,
    };

    await savingsRef.set({
      ...record,
      date: firestore.FieldValue.serverTimestamp(),
    });

    // Update user stats
    await this.updateStats(userId, data);

    // Check for new achievements
    await this.checkAchievements(userId);

    return {
      ...record,
      id: receiptId,
    };
  }

  /**
   * Get user stats
   */
  async getStats(userId: string): Promise<UserStats> {
    try {
      // Try local cache first
      const cached = await AsyncStorage.getItem(`${USER_STATS_KEY}_${userId}`);

      if (cached) {
        const stats = JSON.parse(cached);
        return {
          ...stats,
          lastScanDate: stats.lastScanDate
            ? new Date(stats.lastScanDate)
            : undefined,
        };
      }

      // Calculate real stats from receipts
      const stats = await this.calculateStatsFromReceipts(userId);

      // Cache the stats
      await AsyncStorage.setItem(
        `${USER_STATS_KEY}_${userId}`,
        JSON.stringify({
          ...stats,
          lastScanDate: stats.lastScanDate?.toISOString(),
        }),
      );

      return stats;
    } catch (error) {
      console.error('[SavingsTracker] Get stats error:', error);
      return this.getDefaultStats();
    }
  }

  /**
   * Calculate stats from user's receipts
   */
  private async calculateStatsFromReceipts(userId: string): Promise<UserStats> {
    try {
      const receiptsRef = firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(userId)
        .collection('receipts');

      const receiptsSnapshot = await receiptsRef
        .orderBy('scannedAt', 'desc')
        .get();

      let totalScans = 0;
      let totalSpent = 0;
      let totalSavings = 0;
      let currentStreak = 0;
      let longestStreak = 0;
      let lastScanDate: Date | undefined;
      const shopsVisited = new Set<string>();
      let itemsScanned = 0;
      let bestPricesFound = 0;

      // Process receipts
      const scanDates: Date[] = [];
      receiptsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        totalScans++;

        if (data.total) {
          totalSpent += data.total;
        }
        if (data.savings) {
          totalSavings += data.savings;
        }

        if (data.storeName) {
          shopsVisited.add(data.storeName);
        }

        if (data.items && Array.isArray(data.items)) {
          itemsScanned += data.items.length;
          // Count items where price was found (simplified logic)
          data.items.forEach((item: any) => {
            if (item.price && item.price > 0) {
              bestPricesFound++;
            }
          });
        }

        if (data.scannedAt) {
          const scanDate = safeToDate(data.scannedAt);
          scanDates.push(scanDate);
          if (!lastScanDate || scanDate > lastScanDate) {
            lastScanDate = scanDate;
          }
        }
      });

      // Calculate streak
      if (scanDates.length > 0) {
        scanDates.sort((a, b) => b.getTime() - a.getTime()); // Most recent first

        let streak = 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if scanned today or yesterday
        const mostRecent = new Date(scanDates[0]);
        mostRecent.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (
          mostRecent.getTime() === today.getTime() ||
          mostRecent.getTime() === yesterday.getTime()
        ) {
          currentStreak = 1;

          // Count consecutive days
          for (let i = 1; i < scanDates.length; i++) {
            const current = new Date(scanDates[i - 1]);
            current.setHours(0, 0, 0, 0);
            const previous = new Date(scanDates[i]);
            previous.setHours(0, 0, 0, 0);

            const diffTime = current.getTime() - previous.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            if (diffDays === 1) {
              currentStreak++;
            } else {
              break;
            }
          }
        }

        longestStreak = Math.max(currentStreak, longestStreak);
      }

      // Calculate level and XP
      const xp =
        totalScans * 10 + Math.floor(totalSavings) * 5 + shopsVisited.size * 15;
      const level = Math.floor(xp / 100) + 1;
      const xpToNextLevel = level * 100 - (xp % 100);

      return {
        totalScans,
        totalSpent,
        totalSavings,
        currentStreak,
        longestStreak,
        lastScanDate,
        level,
        xp,
        xpToNextLevel,
        shopsVisited: shopsVisited.size,
        itemsScanned,
        bestPricesFound,
      };
    } catch (error) {
      console.error('[SavingsTracker] Calculate stats error:', error);
      return this.getDefaultStats();
    }
  }

  /**
   * Get default stats
   */
  private getDefaultStats(): UserStats {
    return {
      totalScans: 0,
      totalSpent: 0,
      totalSavings: 0,
      currentStreak: 0,
      longestStreak: 0,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      shopsVisited: 0,
      itemsScanned: 0,
      bestPricesFound: 0,
    };
  }

  /**
   * Record a receipt scan and update stats
   */
  async recordReceiptScan(
    userId: string,
    receiptData: {
      total: number;
      savings: number;
      itemCount: number;
      storeName: string;
      bestPricesFound: number;
    },
  ): Promise<void> {
    try {
      await this.updateStats(userId, {
        totalSpent: receiptData.total,
        actualSavings: receiptData.savings,
        itemCount: receiptData.itemCount,
        storeName: receiptData.storeName,
        bestPricesFound: receiptData.bestPricesFound,
      });

      // Check for new achievements
      await this.checkAndUnlockAchievements(userId);
    } catch (error) {
      console.error('[SavingsTracker] Record receipt scan error:', error);
    }
  }

  /**
   * Update user stats
   */
  private async updateStats(
    userId: string,
    data: {
      totalSpent: number;
      actualSavings: number;
      itemCount: number;
      storeName: string;
      bestPricesFound: number;
    },
  ): Promise<void> {
    const stats = await this.getStats(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate streak
    let newStreak = stats.currentStreak;
    if (stats.lastScanDate) {
      const lastScan = new Date(stats.lastScanDate);
      lastScan.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (today.getTime() - lastScan.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        newStreak++;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
      // If same day, keep streak
    } else {
      newStreak = 1;
    }

    // Update stats
    const updatedStats: UserStats = {
      ...stats,
      totalScans: stats.totalScans + 1,
      totalSpent: stats.totalSpent + data.totalSpent,
      totalSavings: stats.totalSavings + data.actualSavings,
      currentStreak: newStreak,
      longestStreak: Math.max(stats.longestStreak, newStreak),
      lastScanDate: today,
      itemsScanned: stats.itemsScanned + data.itemCount,
      bestPricesFound: stats.bestPricesFound + data.bestPricesFound,
    };

    // Calculate XP and level
    const xpEarned = this.calculateXP(data);
    updatedStats.xp = stats.xp + xpEarned;

    // Level up check
    while (updatedStats.xp >= updatedStats.xpToNextLevel) {
      updatedStats.xp -= updatedStats.xpToNextLevel;
      updatedStats.level++;
      updatedStats.xpToNextLevel = this.getXPForLevel(updatedStats.level);
    }

    // Save to Firestore
    await firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .set({stats: updatedStats}, {merge: true});

    // Cache locally
    await AsyncStorage.setItem(
      `${USER_STATS_KEY}_${userId}`,
      JSON.stringify(updatedStats),
    );
  }

  /**
   * Calculate XP earned from a scan
   */
  private calculateXP(data: {
    totalSpent: number;
    actualSavings: number;
    itemCount: number;
    bestPricesFound: number;
  }): number {
    let xp = 5; // Base XP for scan

    // Bonus for items
    xp += Math.min(data.itemCount, 10);

    // Bonus for savings
    if (data.actualSavings > 0) {
      xp += Math.min(Math.floor(data.actualSavings), 20);
    }

    // Bonus for best prices
    xp += data.bestPricesFound * 2;

    return xp;
  }

  /**
   * Get XP required for a level
   */
  private getXPForLevel(level: number): number {
    // Exponential growth: base 100 XP, increases by 25% each level
    return Math.floor(100 * Math.pow(1.25, level - 1));
  }

  /**
   * Check and unlock achievements
   */
  private async checkAndUnlockAchievements(userId: string): Promise<void> {
    try {
      const stats = await this.getStats(userId);
      const currentAchievements = await this.getAchievements(userId);

      const newlyUnlocked: Achievement[] = [];

      for (const achievement of ACHIEVEMENTS) {
        const existing = currentAchievements.find(a => a.id === achievement.id);
        if (!existing || !existing.isUnlocked) {
          const progress = this.getAchievementProgress(achievement.type, stats);
          if (progress >= achievement.target) {
            newlyUnlocked.push({
              ...achievement,
              progress,
              isUnlocked: true,
              unlockedAt: new Date(),
            });

            // Send notification for newly unlocked achievement
            try {
              await pushNotificationService.triggerAchievementNotification(
                achievement.title,
                'fr',
              );
            } catch (error) {
              console.warn(
                '[SavingsTracker] Failed to send achievement notification:',
                error,
              );
            }
          }
        }
      }

      // Save unlocked achievements to Firestore
      if (newlyUnlocked.length > 0) {
        const batch = firestore().batch();
        newlyUnlocked.forEach(achievement => {
          const achievementRef = firestore()
            .collection('artifacts')
            .doc(APP_ID)
            .collection('users')
            .doc(userId)
            .collection('achievements')
            .doc(achievement.id);

          batch.set(achievementRef, {
            ...achievement,
            unlockedAt: firestore.FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
        console.log(
          `[SavingsTracker] Unlocked ${newlyUnlocked.length} achievements for user ${userId}`,
        );
      }
    } catch (error) {
      console.error('[SavingsTracker] Check achievements error:', error);
    }
  }

  /**
   * Get all achievements for user
   */
  async getAchievements(userId: string): Promise<Achievement[]> {
    const stats = await this.getStats(userId);

    return ACHIEVEMENTS.map(achievement => {
      const progress = this.getAchievementProgress(achievement.type, stats);
      const isUnlocked = progress >= achievement.target;

      return {
        ...achievement,
        progress,
        isUnlocked,
        unlockedAt: isUnlocked ? new Date() : undefined,
      };
    });
  }

  /**
   * Get progress for an achievement type
   */
  private getAchievementProgress(
    type: AchievementType,
    stats: UserStats,
  ): number {
    switch (type) {
      case 'first_scan':
        return stats.totalScans > 0 ? 1 : 0;
      case 'scans_5':
        return Math.min(stats.totalScans, 5);
      case 'scans_25':
        return Math.min(stats.totalScans, 25);
      case 'scans_100':
        return Math.min(stats.totalScans, 100);
      case 'savings_100':
        return Math.min(stats.totalSavings, 100);
      case 'savings_500':
        return Math.min(stats.totalSavings, 500);
      case 'savings_1000':
        return Math.min(stats.totalSavings, 1000);
      case 'shops_3':
        return Math.min(stats.shopsVisited, 3);
      case 'shops_10':
        return Math.min(stats.shopsVisited, 10);
      case 'streak_3':
        return Math.min(stats.longestStreak, 3);
      case 'streak_7':
        return Math.min(stats.longestStreak, 7);
      case 'streak_30':
        return Math.min(stats.longestStreak, 30);
      case 'price_hunter':
        return Math.min(stats.bestPricesFound, 50);
      case 'budget_master':
        return 0; // Requires budget feature
      default:
        return 0;
    }
  }

  /**
   * Check and unlock achievements
   */
  private async checkAchievements(userId: string): Promise<Achievement[]> {
    const stats = await this.getStats(userId);
    const newlyUnlocked: Achievement[] = [];

    // Get previously unlocked achievements
    const unlockedSnapshot = await firestore()
      .collection(ACHIEVEMENTS_COLLECTION(userId))
      .get();

    const unlockedIds = new Set(unlockedSnapshot.docs.map(d => d.id));

    for (const achievement of ACHIEVEMENTS) {
      if (unlockedIds.has(achievement.id)) {
        continue;
      }

      const progress = this.getAchievementProgress(achievement.type, stats);

      if (progress >= achievement.target) {
        // Unlock achievement
        await firestore()
          .collection(ACHIEVEMENTS_COLLECTION(userId))
          .doc(achievement.id)
          .set({
            ...achievement,
            progress,
            isUnlocked: true,
            unlockedAt: firestore.FieldValue.serverTimestamp(),
          });

        // Add XP reward
        await this.addXP(userId, achievement.xpReward);

        newlyUnlocked.push({
          ...achievement,
          progress,
          isUnlocked: true,
          unlockedAt: new Date(),
        });
      }
    }

    return newlyUnlocked;
  }

  /**
   * Add XP to user
   */
  private async addXP(userId: string, xp: number): Promise<void> {
    const stats = await this.getStats(userId);

    let newXP = stats.xp + xp;
    let newLevel = stats.level;
    let xpToNext = stats.xpToNextLevel;

    while (newXP >= xpToNext) {
      newXP -= xpToNext;
      newLevel++;
      xpToNext = this.getXPForLevel(newLevel);
    }

    await firestore().doc(`artifacts/${APP_ID}/users/${userId}`).update({
      'stats.xp': newXP,
      'stats.level': newLevel,
      'stats.xpToNextLevel': xpToNext,
    });
  }

  /**
   * Get savings summary for a period
   */
  async getSavingsSummary(
    userId: string,
    period: 'week' | 'month' | 'year' = 'month',
  ): Promise<{
    totalSpent: number;
    totalSavings: number;
    receiptCount: number;
    averageSavings: number;
    topCategories: {category: string; savings: number}[];
  }> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const snapshot = await firestore()
      .collection(SAVINGS_COLLECTION(userId))
      .where('date', '>=', startDate)
      .get();

    if (snapshot.empty) {
      return {
        totalSpent: 0,
        totalSavings: 0,
        receiptCount: 0,
        averageSavings: 0,
        topCategories: [],
      };
    }

    let totalSpent = 0;
    let totalSavings = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      totalSpent += data.totalSpent || 0;
      totalSavings += data.actualSavings || 0;
    });

    return {
      totalSpent,
      totalSavings,
      receiptCount: snapshot.size,
      averageSavings: snapshot.size > 0 ? totalSavings / snapshot.size : 0,
      topCategories: [], // Would need category data
    };
  }

  /**
   * Get level info
   */
  getLevelInfo(level: number): {
    title: string;
    titleLingala: string;
    icon: string;
    color: string;
  } {
    const levels = [
      {
        title: 'Débutant',
        titleLingala: 'Mobandi',
        icon: '🌱',
        color: '#10b981',
      },
      {
        title: 'Apprenti',
        titleLingala: 'Mwana école',
        icon: '🌿',
        color: '#22c55e',
      },
      {title: 'Amateur', titleLingala: 'Molandi', icon: '🌳', color: '#84cc16'},
      {title: 'Confirmé', titleLingala: 'Moyebi', icon: '⭐', color: '#eab308'},
      {title: 'Expert', titleLingala: 'Mokonzi', icon: '🌟', color: '#f59e0b'},
      {title: 'Maître', titleLingala: 'Mokambi', icon: '💫', color: '#f97316'},
      {title: 'Champion', titleLingala: 'Molong', icon: '👑', color: '#ef4444'},
      {title: 'Légende', titleLingala: 'Likambo', icon: '🏆', color: '#dc2626'},
    ];

    const levelIndex = Math.min(level - 1, levels.length - 1);
    return levels[Math.max(0, levelIndex)];
  }

  /**
   * Get user achievements
   */
  async getUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      const snapshot = await firestore()
        .collection(ACHIEVEMENTS_COLLECTION(userId))
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          unlockedAt: data.unlockedAt ? safeToDate(data.unlockedAt) : undefined,
        } as Achievement;
      });
    } catch (error) {
      console.error('[SavingsTracker] Get achievements error:', error);
      return [];
    }
  }
}

export const savingsTrackerService = new SavingsTrackerService();
