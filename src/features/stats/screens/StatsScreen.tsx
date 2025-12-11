// Stats Screen - Spending analytics and insights
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {COLORS} from '@/shared/utils/constants';
import {formatCurrency} from '@/shared/utils/helpers';
import {useAuth} from '@/shared/contexts';
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
  
  const [totalSpending, setTotalSpending] = useState(0);
  const [totalSavings, setTotalSavings] = useState(0);
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySpending[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryCurrency, setPrimaryCurrency] = useState<'USD' | 'CDF'>('USD');

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Stats', 'StatsScreen');
  }, []);

  const loadStatsData = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Get current month receipts
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const receiptsSnapshot = await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .collection('receipts')
        .where('scannedAt', '>=', startOfMonth)
        .orderBy('scannedAt', 'desc')
        .get();

      // Determine primary currency from receipts
      const currencyCount: Record<string, number> = {};
      receiptsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const currency = data.currency || 'USD';
        currencyCount[currency] = (currencyCount[currency] || 0) + 1;
      });
      
      // Set primary currency (most common)
      const primaryCurrency = Object.entries(currencyCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] as 'USD' | 'CDF' || 'USD';
      setPrimaryCurrency(primaryCurrency);

      // Calculate spending by category
      const categoryTotals: Record<string, number> = {};
      let totalSpent = 0;
      let totalSavings = 0;
      
      receiptsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Only include receipts with the primary currency
        if ((data.currency || 'USD') === primaryCurrency) {
          totalSpent += data.total || 0;
          
          // Calculate real savings from receipt data
          if (data.savings && typeof data.savings === 'number') {
            totalSavings += data.savings;
          }
          
          (data.items || []).forEach((item: any) => {
            const category = item.category || 'Autre';
            categoryTotals[category] = (categoryTotals[category] || 0) + (item.totalPrice || 0);
          });
        }
      });

      // Convert to category array with percentages
      const categoryColors = {
        'Alimentation': COLORS.primary[500],
        'Boissons': '#10b981',
        'Hygiène': '#8b5cf6',
        'Ménage': '#f59e0b',
        'Bébé': '#ec4899',
        'Autre': COLORS.gray[400],
      };

      const categoryIcons = {
        'Alimentation': '🛒',
        'Boissons': '🥤',
        'Hygiène': '🧴',
        'Ménage': '🏠',
        'Bébé': '👶',
        'Autre': '📦',
      };

      const categoriesArray: SpendingCategory[] = Object.entries(categoryTotals)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
          color: categoryColors[name as keyof typeof categoryColors] || COLORS.gray[400],
          icon: categoryIcons[name as keyof typeof categoryIcons] || '📦',
        }))
        .sort((a, b) => b.amount - a.amount);

      setTotalSpending(totalSpent);
      setTotalSavings(totalSavings);
      setCategories(categoriesArray);

      // Calculate monthly data (last 3 months)
      const monthlyTotals: Record<string, number> = {};
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      
      for (let i = 2; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        monthlyTotals[monthKey] = 0;
      }

      // Get receipts for last 3 months
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const allReceiptsSnapshot = await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .collection('receipts')
        .where('scannedAt', '>=', threeMonthsAgo)
        .get();

      allReceiptsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.scannedAt?.toDate() || new Date();
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthlyTotals[monthKey] !== undefined) {
          monthlyTotals[monthKey] += data.total || 0;
        }
      });

      const monthlyArray: MonthlySpending[] = Object.entries(monthlyTotals)
        .map(([key, amount]) => {
          const [, month] = key.split('-');
          return {
            month: monthNames[parseInt(month)],
            amount,
          };
        });

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
          <ActivityIndicator size="large" color={COLORS.primary[500]} />
          <Text style={styles.loadingText}>Chargement des statistiques...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistiques</Text>
          <Text style={styles.headerSubtitle}>Ce mois-ci</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.spendingCard]}>
            <Text style={styles.summaryIcon}>💰</Text>
            <Text style={styles.summaryLabel}>Dépenses</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(totalSpending, primaryCurrency)}
            </Text>
          </View>
          
          <View style={[styles.summaryCard, styles.savingsCard]}>
            <Text style={styles.summaryIcon}>🎉</Text>
            <Text style={styles.summaryLabelWhite}>Économies</Text>
            <Text style={styles.summaryAmountWhite}>
              {formatCurrency(totalSavings, primaryCurrency)}
            </Text>
          </View>
        </View>

        {/* Monthly Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tendance mensuelle</Text>
          <View style={styles.chartCard}>
            <View style={styles.barChart}>
              {monthlyData.map((data, index) => (
                <View key={index} style={styles.barColumn}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${(data.amount / maxMonthlyAmount) * 100}%`,
                          backgroundColor: 
                            index === monthlyData.length - 1 
                              ? COLORS.primary[500] 
                              : COLORS.primary[200],
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{data.month}</Text>
                  <Text style={styles.barAmount}>
                    {formatCurrency(data.amount, primaryCurrency)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Categories Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Répartition par catégorie</Text>
          <View style={styles.categoriesCard}>
            {categories.map((category, index) => (
              <View key={index} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryIcon, {backgroundColor: category.color + '20'}]}>
                    <Text style={styles.categoryEmoji}>{category.icon}</Text>
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
            ))}
          </View>
        </View>

        {/* Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conseils</Text>
          
          <View style={styles.insightCard}>
            <Text style={styles.insightIcon}>💡</Text>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>
                Économisez sur l'alimentation
              </Text>
              <Text style={styles.insightDesc}>
                Vous pourriez économiser {formatCurrency(15.50, primaryCurrency)} en achetant 
                certains produits à Carrefour plutôt qu'à Shoprite.
              </Text>
            </View>
          </View>

          <View style={styles.insightCard}>
            <Text style={styles.insightIcon}>📈</Text>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>
                Tendance en hausse
              </Text>
              <Text style={styles.insightDesc}>
                Vos dépenses ont augmenté de 12% ce mois-ci par rapport 
                au mois dernier.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.gray[500],
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  spendingCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  savingsCard: {
    backgroundColor: COLORS.primary[500],
  },
  summaryIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.gray[500],
    marginBottom: 4,
  },
  summaryLabelWhite: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gray[900],
  },
  summaryAmountWhite: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
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
    marginBottom: 8,
  },
  bar: {
    width: '100%',
    borderRadius: 6,
    minHeight: 10,
  },
  barLabel: {
    fontSize: 13,
    color: COLORS.gray[600],
    marginBottom: 2,
  },
  barAmount: {
    fontSize: 12,
    color: COLORS.gray[400],
    fontWeight: '500',
  },
  categoriesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  categoryAmount: {
    fontSize: 13,
    color: COLORS.gray[500],
  },
  categoryRight: {
    width: 100,
    alignItems: 'flex-end',
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: 4,
  },
  categoryBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.gray[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    borderRadius: 3,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  insightIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  insightDesc: {
    fontSize: 13,
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.gray[600],
  },
});
