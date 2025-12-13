// Stats Screen - Spending analytics and insights
// Styled with GoShopperAI Design System (Blue + Gold)
import React, {useState, useEffect, useMemo} from 'react';
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
import Svg, {Circle, G, Path, Line, Text as SvgText} from 'react-native-svg';
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
      let categoryRawTotal = 0; // For calculating percentages

      currentMonthReceipts.forEach(doc => {
        const data = doc.data();
        // Use the user's preferred currency for totals
        if (userPreferredCurrency === 'CDF') {
          totalSpent += data.totalCDF || data.total || 0;
        } else {
          totalSpent += data.totalUSD || data.total || 0;
        }

        // Calculate real savings from receipt data
        if (data.savings && typeof data.savings === 'number') {
          totalSavings += data.savings;
        }

        // Calculate category totals from items
        // Convert to user's preferred currency for consistency
        (data.items || []).forEach((item: any) => {
          const category = item.category || 'Autre';
          const itemTotal = item.totalPrice || 0;

          // Convert item total to user's preferred currency if needed
          let convertedItemTotal = itemTotal;
          if (userPreferredCurrency === 'CDF' && data.currency === 'USD') {
            // Convert USD to CDF (approximate rate)
            convertedItemTotal = itemTotal * 2800; // Using approximate USD to CDF rate
          } else if (userPreferredCurrency === 'USD' && data.currency === 'CDF') {
            // Convert CDF to USD
            convertedItemTotal = itemTotal / 2800;
          }

          categoryTotals[category] = (categoryTotals[category] || 0) + convertedItemTotal;
          categoryRawTotal += convertedItemTotal;
        });
      });

      // Convert to category array with percentages
      const categoryColors: Record<string, string> = {
        Alimentation: Colors.primary, // Crimson Blaze
        Boissons: Colors.status.success, // Green
        Hygiène: '#669BBC', // Blue Marble
        Hygiene: '#669BBC',
        Ménage: Colors.accent, // Cosmos Blue
        Menage: Colors.accent,
        Bébé: '#C1121F', // Crimson Blaze
        Bebe: '#C1121F',
        Électronique: '#003049', // Cosmos Blue
        Electronique: '#003049',
        Vêtements: '#F5E6C3', // Warm Beige
        Vetements: '#F5E6C3',
        Santé: '#780000', // Gochujang Red
        Sante: '#780000',
        Transport: '#669BBC', // Blue Marble
        Loisirs: '#FDF0D5', // Varden Cream
        Épicerie: Colors.primary,
        Epicerie: Colors.primary,
        Autre: Colors.text.tertiary,
        Autres: Colors.text.tertiary,
      };

      const categoryIcons: Record<string, string> = {
        Alimentation: 'cart',
        Boissons: 'trending-up',
        Hygiène: 'star',
        Hygiene: 'star',
        Ménage: 'home',
        Menage: 'home',
        Bébé: 'heart',
        Bebe: 'heart',
        Électronique: 'settings',
        Electronique: 'settings',
        Vêtements: 'user',
        Vetements: 'user',
        Santé: 'heart',
        Sante: 'heart',
        Transport: 'map-pin',
        Loisirs: 'star',
        Épicerie: 'cart',
        Epicerie: 'cart',
        Autre: 'grid',
        Autres: 'grid',
      };

      const categoriesArray: SpendingCategory[] = Object.entries(categoryTotals)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage:
            categoryRawTotal > 0 ? Math.round((amount / categoryRawTotal) * 100) : 0,
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

  const maxMonthlyAmount = Math.max(...monthlyData.map(d => d.amount), monthlyBudget);

  // Donut chart calculations
  const donutChartData = useMemo(() => {
    if (categories.length === 0) return [];
    
    const total = categories.reduce((sum, cat) => sum + cat.amount, 0);
    let startAngle = -90; // Start from top
    
    return categories.map(category => {
      const angle = (category.amount / total) * 360;
      const data = {
        ...category,
        startAngle,
        endAngle: startAngle + angle,
        sweepAngle: angle,
      };
      startAngle += angle;
      return data;
    });
  }, [categories]);

  // Create SVG arc path for donut chart
  const createArcPath = (
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

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

        {/* Monthly Trend - Improved Bar Chart */}
        <SlideIn delay={200}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Évolution Mensuelle</Text>
            <View style={styles.chartCard}>
              {/* Modern Bar Chart with SVG */}
              <View style={styles.modernChartContainer}>
                <Svg width={SCREEN_WIDTH - 80} height={200}>
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                    <G key={i}>
                      <Line
                        x1="40"
                        y1={160 - ratio * 130}
                        x2={SCREEN_WIDTH - 80}
                        y2={160 - ratio * 130}
                        stroke={Colors.border.light}
                        strokeWidth="1"
                        strokeDasharray={i > 0 ? "5,5" : "0"}
                      />
                      <SvgText
                        x="35"
                        y={165 - ratio * 130}
                        fontSize="10"
                        fill={Colors.text.tertiary}
                        textAnchor="end"
                      >
                        {Math.round(maxMonthlyAmount * ratio).toLocaleString()}
                      </SvgText>
                    </G>
                  ))}
                  
                  {/* Budget line */}
                  <Line
                    x1="40"
                    y1={160 - (monthlyBudget / maxMonthlyAmount) * 130}
                    x2={SCREEN_WIDTH - 80}
                    y2={160 - (monthlyBudget / maxMonthlyAmount) * 130}
                    stroke={Colors.accent}
                    strokeWidth="2"
                    strokeDasharray="8,4"
                  />
                  
                  {/* Bars */}
                  {monthlyData.map((data, index) => {
                    const barWidth = 50;
                    const gap = ((SCREEN_WIDTH - 120) - (monthlyData.length * barWidth)) / (monthlyData.length + 1);
                    const x = 50 + gap * (index + 1) + barWidth * index;
                    const barHeight = maxMonthlyAmount > 0 ? (data.amount / maxMonthlyAmount) * 130 : 0;
                    const isOverBudget = data.amount > monthlyBudget;
                    
                    return (
                      <G key={index}>
                        {/* Bar background */}
                        <Path
                          d={`M ${x} 160 L ${x} ${160 - barHeight + 8} Q ${x} ${160 - barHeight} ${x + 8} ${160 - barHeight} L ${x + barWidth - 8} ${160 - barHeight} Q ${x + barWidth} ${160 - barHeight} ${x + barWidth} ${160 - barHeight + 8} L ${x + barWidth} 160 Z`}
                          fill={isOverBudget ? Colors.status.error : Colors.primary}
                        />
                        {/* Gradient overlay */}
                        <Path
                          d={`M ${x} 160 L ${x} ${160 - barHeight + 8} Q ${x} ${160 - barHeight} ${x + 8} ${160 - barHeight} L ${x + barWidth - 8} ${160 - barHeight} Q ${x + barWidth} ${160 - barHeight} ${x + barWidth} ${160 - barHeight + 8} L ${x + barWidth} 160 Z`}
                          fill="url(#barGradient)"
                          opacity={0.3}
                        />
                        {/* Month label */}
                        <SvgText
                          x={x + barWidth / 2}
                          y={180}
                          fontSize="12"
                          fill={Colors.text.secondary}
                          textAnchor="middle"
                          fontWeight="500"
                        >
                          {data.month}
                        </SvgText>
                        {/* Amount on top of bar */}
                        <SvgText
                          x={x + barWidth / 2}
                          y={155 - barHeight}
                          fontSize="11"
                          fill={Colors.text.primary}
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {primaryCurrency === 'CDF' ? 
                            `${(data.amount / 1000).toFixed(0)}k` : 
                            `$${data.amount.toFixed(0)}`}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </View>
              
              {/* Legend */}
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, {backgroundColor: Colors.primary}]} />
                  <Text style={styles.legendText}>Dépenses</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, {backgroundColor: Colors.status.error}]} />
                  <Text style={styles.legendText}>Dépassement</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine, {backgroundColor: Colors.accent}]} />
                  <Text style={styles.legendText}>Budget ({formatCurrency(monthlyBudget, primaryCurrency)})</Text>
                </View>
              </View>
            </View>
          </View>
        </SlideIn>

        {/* Categories - Donut Chart + List */}
        <SlideIn delay={300}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Répartition par catégorie</Text>
            <View style={styles.categoriesCard}>
              {categories.length === 0 ? (
                <View style={styles.emptyCategories}>
                  <Icon name="chart" size="lg" color={Colors.text.tertiary} />
                  <Text style={styles.emptyCategoriesText}>
                    Scannez des reçus pour voir vos dépenses par catégorie
                  </Text>
                </View>
              ) : (
                <>
                  {/* Donut Chart */}
                  <View style={styles.donutContainer}>
                    <Svg width={180} height={180}>
                      <G transform="translate(90, 90)">
                        {donutChartData.map((item, index) => {
                          // Handle case where one category is 100%
                          if (item.sweepAngle >= 359.9) {
                            return (
                              <Circle
                                key={index}
                                cx={0}
                                cy={0}
                                r={70}
                                fill={item.color}
                              />
                            );
                          }
                          return (
                            <Path
                              key={index}
                              d={createArcPath(0, 0, 70, item.startAngle, item.endAngle)}
                              fill={item.color}
                            />
                          );
                        })}
                        {/* Inner circle for donut effect */}
                        <Circle cx={0} cy={0} r={45} fill={Colors.white} />
                      </G>
                    </Svg>
                    {/* Center text */}
                    <View style={styles.donutCenter}>
                      <Text style={styles.donutCenterLabel}>Total</Text>
                      <Text style={styles.donutCenterValue}>
                        {formatCurrency(totalSpending, primaryCurrency)}
                      </Text>
                    </View>
                  </View>

                  {/* Category List */}
                  <View style={styles.categoryList}>
                    {categories.map((category, index) => (
                      <View 
                        key={index} 
                        style={[
                          styles.categoryRow,
                          index === categories.length - 1 && styles.categoryRowLast
                        ]}
                      >
                        <View style={styles.categoryLeft}>
                          <View
                            style={[
                              styles.categoryDot,
                              {backgroundColor: category.color},
                            ]}
                          />
                          <Text style={styles.categoryName}>{category.name}</Text>
                        </View>
                        <View style={styles.categoryRight}>
                          <Text style={styles.categoryAmount}>
                            {formatCurrency(category.amount, primaryCurrency)}
                          </Text>
                          <View style={styles.categoryPercentBadge}>
                            <Text style={styles.categoryPercentText}>
                              {category.percentage}%
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
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
    backgroundColor: Colors.card.white,
    ...Shadows.sm,
  },
  savingsCard: {
    backgroundColor: Colors.card.cream,
    overflow: 'hidden',
    ...Shadows.sm,
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
    color: Colors.text.secondary,
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
    color: Colors.text.primary,
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
    backgroundColor: Colors.card.white,
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
    paddingVertical: Spacing['2xl'],
  },
  emptyCategoriesText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.tertiary,
    marginTop: Spacing.md,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
  },
  categoryAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
  // New modern chart styles
  modernChartContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.xs,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
    marginRight: Spacing.xs,
  },
  legendText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
  },
  // Donut chart styles
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
  },
  donutCenterValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  categoryList: {
    marginTop: Spacing.sm,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  categoryRowLast: {
    borderBottomWidth: 0,
  },
  categoryPercentBadge: {
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  categoryPercentText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.secondary,
  },
});
