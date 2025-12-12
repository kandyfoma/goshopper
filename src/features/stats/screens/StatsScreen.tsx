// Stats Screen - Spending analytics and insights
// Styled with GoShopperAI Design System (Blue + Gold)
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn} from '@/shared/components';
import {formatCurrency} from '@/shared/utils/helpers';
import {useAuth, useUser} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

interface MonthlySpending {
  month: string;
  amount: number;
}

interface CurrencyStats {
  totalSpending: number;
  totalSavings: number;
  categories: SpendingCategory[];
  monthlyData: MonthlySpending[];
}

export function StatsScreen() {
  const {user} = useAuth();
  const {profile} = useUser();

  const [totalSpending, setTotalSpending] = useState(0);
  const [totalSavings, setTotalSavings] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(500); // Default budget
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySpending[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryCurrency, setPrimaryCurrency] = useState<'USD' | 'CDF'>('USD');

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Stats', 'StatsScreen');
  }, []);

  useEffect(() => {
    loadStatsData();
  }, [user?.uid, profile?.preferredCurrency, profile?.monthlyBudget]);

  const loadStatsData = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get current month receipts (load all and filter in memory to avoid index issues)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const receiptsSnapshot = await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .collection('receipts')
        .orderBy('scannedAt', 'desc')
        .get();

      // Filter for current month receipts in memory
      const currentMonthReceipts = receiptsSnapshot.docs.filter(doc => {
        const data = doc.data();
        const scannedAt = data.scannedAt?.toDate();
        return scannedAt && scannedAt >= startOfMonth;
      });

      // Determine primary currency from receipts
      const currencyCount: Record<string, number> = {};
      currentMonthReceipts.forEach(doc => {
        const data = doc.data();
        const currency = data.currency || 'USD';
        currencyCount[currency] = (currencyCount[currency] || 0) + 1;
      });

      // Set primary currency from user profile or determine from receipts
      const userPreferredCurrency = profile?.preferredCurrency || 'USD';
      setPrimaryCurrency(userPreferredCurrency);

      // Set monthly budget from user profile
      const userBudget = profile?.monthlyBudget || 500;
      setMonthlyBudget(userBudget);

      // Calculate spending by category
      const categoryTotals: Record<string, number> = {};
      let totalSpent = 0;
      let totalSavings = 0;

      currentMonthReceipts.forEach(doc => {
        const data = doc.data();
        // Use the user's preferred currency for totals
        if (userPreferredCurrency === 'CDF') {
          totalSpent += data.totalCDF || 0;
        } else {
          totalSpent += data.totalUSD || 0;
        }

        // Calculate real savings from receipt data
        if (data.savings && typeof data.savings === 'number') {
          totalSavings += data.savings;
        }

        (data.items || []).forEach((item: any) => {
          const category = item.category || 'Autre';
          // Use the appropriate currency for category totals too
          const itemTotal = userPreferredCurrency === 'CDF' ? (item.totalPriceCDF || 0) : (item.totalPriceUSD || 0);
          categoryTotals[category] = (categoryTotals[category] || 0) + itemTotal;
        });
      });

      // Convert to category array with percentages
      const categoryColors = {
        Alimentation: Colors.primary,
        Boissons: Colors.status.success,
        Hygiène: '#8b5cf6',
        Ménage: Colors.accent,
        Bébé: '#ec4899',
        Autre: Colors.text.tertiary,
      };

      const categoryIcons = {
        Alimentation: 'cart',
        Boissons: 'trending-up',
        Hygiène: 'star',
        Ménage: 'home',
        Bébé: 'heart',
        Autre: 'grid',
      };

      const categoriesArray: SpendingCategory[] = Object.entries(categoryTotals)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage:
            totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
          color:
            categoryColors[name as keyof typeof categoryColors] ||
            Colors.text.tertiary,
          icon: categoryIcons[name as keyof typeof categoryIcons] || 'grid',
        }))
        .sort((a, b) => b.amount - a.amount);

      setTotalSpending(totalSpent);
      setTotalSavings(totalSavings);
      setCategories(categoriesArray);

      // Calculate monthly data (last 3 months)
      const monthlyTotals: Record<string, number> = {};
      const monthNames = [
        'Jan',
        'Fév',
        'Mar',
        'Avr',
        'Mai',
        'Jun',
        'Jul',
        'Aoû',
        'Sep',
        'Oct',
        'Nov',
        'Déc',
      ];

      for (let i = 2; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        monthlyTotals[monthKey] = 0;
      }

      // Get receipts for last 3 months (load all and filter in memory)
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const allReceiptsSnapshot = await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .collection('receipts')
        .orderBy('scannedAt', 'desc')
        .get();

      // Filter for last 3 months in memory
      const lastThreeMonthsReceipts = allReceiptsSnapshot.docs.filter(doc => {
        const data = doc.data();
        const scannedAt = data.scannedAt?.toDate();
        return scannedAt && scannedAt >= threeMonthsAgo;
      });

      lastThreeMonthsReceipts.forEach(doc => {
        const data = doc.data();
        const date = data.scannedAt?.toDate() || new Date();
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthlyTotals[monthKey] !== undefined) {
          // Use the user's preferred currency for monthly totals
          if (userPreferredCurrency === 'CDF') {
            monthlyTotals[monthKey] += data.totalCDF || 0;
          } else {
            monthlyTotals[monthKey] += data.totalUSD || 0;
          }
        }
      });

      const monthlyArray: MonthlySpending[] = Object.entries(monthlyTotals).map(
        ([key, amount]) => {
          const [, month] = key.split('-');
          return {
            month: monthNames[parseInt(month)],
            amount,
          };
        },
      );

      setMonthlyData(monthlyArray);
    } catch (error) {
      console.error('Error loading stats:', error);
      // Set empty data on error
      setTotalSpending(0);
      setTotalSavings(0);
      setCategories([]);
      setMonthlyData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const maxMonthlyAmount = Math.max(...monthlyData.map(d => d.amount));

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des statistiques...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FadeIn>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistiques</Text>
          <Text style={styles.headerSubtitle}>Ce mois-ci</Text>
        </View>
      </FadeIn>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <SlideIn delay={100}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.budgetCard]}>
              <View style={styles.summaryIconWrapper}>
                <Icon name="wallet" size="md" color={Colors.primary} />
              </View>
              <Text style={styles.summaryLabel}>Budget Mensuel</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(monthlyBudget, primaryCurrency)}
              </Text>
            </View>

            <View style={[styles.summaryCard, styles.spendingCard]}>
              <View style={styles.summaryIconWrapper}>
                <Icon name="credit-card" size="md" color={Colors.status.warning} />
              </View>
              <Text style={styles.summaryLabel}>Dépenses</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(totalSpending, primaryCurrency)}
              </Text>
              <Text style={styles.summarySubtitle}>
                {totalSpending > monthlyBudget ? 'Dépassement' : 'Dans le budget'}
              </Text>
            </View>
          </View>
        </SlideIn>

        {/* Monthly Trend */}
        <SlideIn delay={200}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget vs Dépenses</Text>
            <TouchableOpacity style={styles.chartCard} activeOpacity={0.9}>
              <View style={styles.budgetChartContainer}>
                {monthlyData.map((data, index) => (
                  <View key={index} style={styles.budgetBarContainer}>
                    <Text style={styles.barLabel}>{data.month}</Text>
                    <View style={styles.budgetBarBg}>
                      <View
                        style={[
                          styles.budgetBar,
                          {
                            width: `${
                              monthlyBudget > 0
                                ? Math.min((data.amount / monthlyBudget) * 100, 100)
                                : 0
                            }%`,
                            backgroundColor:
                              data.amount > monthlyBudget
                                ? Colors.status.error
                                : Colors.status.success,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barAmount}>
                      {formatCurrency(data.amount, primaryCurrency)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.budgetLegend}>
                <View style={styles.budgetLegendItem}>
                  <View
                    style={[
                      styles.budgetLegendColor,
                      { backgroundColor: Colors.accentLight },
                    ]}
                  />
                  <Text style={styles.budgetLegendText}>Budget</Text>
                </View>
                <View style={styles.budgetLegendItem}>
                  <View
                    style={[
                      styles.budgetLegendColor,
                      { backgroundColor: Colors.status.success },
                    ]}
                  />
                  <Text style={styles.budgetLegendText}>Dépenses (sous budget)</Text>
                </View>
                <View style={styles.budgetLegendItem}>
                  <View
                    style={[
                      styles.budgetLegendColor,
                      { backgroundColor: Colors.status.error },
                    ]}
                  />
                  <Text style={styles.budgetLegendText}>Dépenses (dépassement)</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </SlideIn>

        {/* Categories Breakdown */}
        <SlideIn delay={300}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Répartition par catégorie</Text>
            <View style={styles.categoriesCard}>
              {categories.length === 0 ? (
                <View style={styles.emptyCategories}>
                  <Icon name="chart" size="lg" color={Colors.text.tertiary} />
                  <Text style={styles.emptyCategoriesText}>
                    Aucune donnée disponible
                  </Text>
                </View>
              ) : (
                categories.map((category, index) => (
                  <View key={index} style={styles.categoryRow}>
                    <View style={styles.categoryLeft}>
                      <View
                        style={[
                          styles.categoryIcon,
                          {backgroundColor: category.color + '20'},
                        ]}>
                        <Icon
                          name={category.icon}
                          size="sm"
                          color={category.color}
                        />
                      </View>
                      <View>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <Text style={styles.categoryAmount}>
                          {formatCurrency(category.amount, primaryCurrency)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.categoryRight}>
                      <Text style={styles.categoryPercentage}>
                        {category.percentage}%
                      </Text>
                      <View style={styles.categoryBarBg}>
                        <View
                          style={[
                            styles.categoryBar,
                            {
                              width: `${category.percentage}%`,
                              backgroundColor: category.color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </SlideIn>

        {/* Insights */}
        <SlideIn delay={400}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conseils</Text>

            <View style={styles.insightCard}>
              <View style={styles.insightIconWrapper}>
                <Icon name="star" size="md" color={Colors.accent} />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>
                  Économisez sur l'alimentation
                </Text>
                <Text style={styles.insightDesc}>
                  Vous pourriez économiser{' '}
                  {formatCurrency(15.5, primaryCurrency)} en achetant certains
                  produits à Carrefour plutôt qu'à Shoprite.
                </Text>
              </View>
            </View>

            <View style={styles.insightCard}>
              <View style={[styles.insightIconWrapper, styles.insightIconInfo]}>
                <Icon name="trending-up" size="md" color={Colors.status.info} />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Tendance en hausse</Text>
                <Text style={styles.insightDesc}>
                  Vos dépenses ont augmenté de 12% ce mois-ci par rapport au
                  mois dernier.
                </Text>
              </View>
            </View>
          </View>
        </SlideIn>
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
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  spendingCard: {
    backgroundColor: Colors.white,
    ...Shadows.md,
  },
  savingsCard: {
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  summaryGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    opacity: 0.2,
  },
  summaryIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryIconWrapperAccent: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  summaryLabelWhite: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: Spacing.xs,
  },
  summaryAmount: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  summaryAmountWhite: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 160,
    alignItems: 'flex-end',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    height: 100,
    width: 40,
    justifyContent: 'flex-end',
    marginBottom: Spacing.sm,
  },
  bar: {
    width: '100%',
    borderRadius: BorderRadius.md,
    minHeight: 10,
  },
  barLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  barAmount: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: Typography.fontWeight.medium,
  },
  categoriesCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  emptyCategories: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyCategoriesText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.tertiary,
    marginTop: Spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  categoryName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  categoryAmount: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
  },
  categoryRight: {
    width: 100,
    alignItems: 'flex-end',
  },
  categoryPercentage: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  categoryBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border.light,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  insightIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.accentLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  insightIconInfo: {
    backgroundColor: Colors.status.infoLight,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  insightDesc: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.relaxed,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },
  budgetChartContainer: {
    marginTop: Spacing.lg,
  },
  budgetBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  budgetBarBg: {
    flex: 1,
    height: 24,
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    overflow: 'hidden',
  },
  budgetBar: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
  },
  budgetLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  budgetLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  budgetLegendColor: {
    width: 12,
    height: 12,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
  },
  budgetLegendText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  budgetCard: {
    backgroundColor: Colors.card.blue,
  },
  summarySubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
});
