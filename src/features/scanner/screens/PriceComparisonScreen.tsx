// Price Comparison Screen - Compare prices across stores
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, RouteProp} from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import {RootStackParamList, PriceComparison} from '@/shared/types';
import {COLORS} from '@/shared/utils/constants';
import {formatCurrency} from '@/shared/utils/helpers';
import {Icon} from '@/shared/components';

type PriceComparisonRouteProp = RouteProp<
  RootStackParamList,
  'PriceComparison'
>;

export function PriceComparisonScreen() {
  const route = useRoute<PriceComparisonRouteProp>();
  const {receiptId} = route.params;

  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPriceComparisons();
  }, [receiptId]);

  const loadPriceComparisons = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Call Cloud Function to get price comparisons
      const functionsInstance = functions();

      // Only use emulator in development
      if (__DEV__) {
        functionsInstance.useFunctionsEmulator('http://localhost:5001');
      }

      type PriceComparisonResponse = {
        success: boolean;
        comparisons?: PriceComparison[];
        totalPotentialSavings?: number;
        error?: string;
      };

      const result = await functionsInstance.httpsCallable(
        'getPriceComparison',
      )({
        receiptId,
      });

      const data = result.data as PriceComparisonResponse;

      if (data.success && data.comparisons) {
        setComparisons(data.comparisons);
        setTotalSavings(data.totalPotentialSavings || 0);
      } else {
        setError('Aucune comparaison de prix disponible');
        setComparisons([]);
        setTotalSavings(0);
      }
    } catch (err: any) {
      console.error('Error loading price comparisons:', err);

      let errorMessage = 'Erreur lors du chargement des comparaisons';

      if (err.code === 'functions/deadline-exceeded') {
        errorMessage =
          'La comparaison prend trop de temps. Réessayez plus tard.';
      } else if (err.code === 'functions/cancelled') {
        errorMessage = 'Comparaison annulée. Veuillez réessayer.';
      } else if (err.code === 'functions/failed-precondition') {
        errorMessage =
          'Service temporairement indisponible. Réessayez plus tard.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setComparisons([]);
      setTotalSavings(0);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriceStatus = (comparison: PriceComparison) => {
    if (comparison.potentialSavings === 0) {
      return {label: 'Meilleur prix ! 🎉', color: COLORS.primary[500]};
    }
    if (comparison.savingsPercentage > 10) {
      return {label: 'Moins cher ailleurs', color: COLORS.error};
    }
    return {label: 'Prix correct', color: COLORS.warning};
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary[500]} />
          <Text style={styles.loadingText}>Comparaison des prix...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* Savings Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconContainer}>
            {totalSavings > 0 ? (
              <Icon 
                name="help-circle" 
                size="2xl" 
                color={COLORS.primary[500]}
                variant="filled"
              />
            ) : (
              <Icon 
                name="gift" 
                size="2xl" 
                color={COLORS.info}
                variant="filled"
              />
            )}
          </View>
          {totalSavings > 0 ? (
            <>
              <Text style={styles.summaryTitle}>Économie potentielle</Text>
              <Text style={styles.savingsAmount}>
                {formatCurrency(totalSavings)}
              </Text>
              <Text style={styles.summaryDesc}>
                sur cette facture en achetant aux meilleurs prix
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.summaryTitle}>Excellent choix !</Text>
              <Text style={styles.summaryDesc}>
                Vous avez payé les meilleurs prix disponibles
              </Text>
            </>
          )}
        </View>

        {/* Comparisons List */}
        <Text style={styles.sectionTitle}>Détail par article</Text>

        {comparisons.map((comparison, index) => {
          const status = getPriceStatus(comparison);

          return (
            <View key={index} style={styles.comparisonCard}>
              <View style={styles.comparisonHeader}>
                <Text style={styles.productName}>{comparison.productName}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {backgroundColor: status.color + '15'},
                  ]}>
                  <Text style={[styles.statusText, {color: status.color}]}>
                    {status.label}
                  </Text>
                </View>
              </View>

              <View style={styles.priceRow}>
                <View style={styles.priceColumn}>
                  <Text style={styles.priceLabel}>Vous avez payé</Text>
                  <Text style={styles.currentPrice}>
                    {formatCurrency(comparison.currentPrice)}
                  </Text>
                  <Text style={styles.storeLabel}>
                    à {comparison.currentStore}
                  </Text>
                </View>

                <View style={styles.priceDivider} />

                <View style={styles.priceColumn}>
                  <Text style={styles.priceLabel}>Meilleur prix</Text>
                  <Text
                    style={[
                      styles.bestPrice,
                      comparison.potentialSavings > 0 && styles.betterPrice,
                    ]}>
                    {formatCurrency(comparison.bestPrice)}
                  </Text>
                  <Text style={styles.storeLabel}>
                    à {comparison.bestStore}
                  </Text>
                </View>
              </View>

              {comparison.potentialSavings > 0 && (
                <View style={styles.savingsRow}>
                  <Text style={styles.savingsText}>
                    💰 Économie possible:{' '}
                    {formatCurrency(comparison.potentialSavings)} (-
                    {comparison.savingsPercentage.toFixed(0)}%)
                  </Text>
                </View>
              )}

              <View style={styles.statsRow}>
                <Text style={styles.statsText}>
                  📊 Prix moyen: {formatCurrency(comparison.averagePrice)} •{' '}
                  {comparison.priceCount} relevés
                </Text>
              </View>
            </View>
          );
        })}
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
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryIconContainer: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: 8,
  },
  savingsAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.primary[500],
    marginBottom: 4,
  },
  summaryDesc: {
    fontSize: 14,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  comparisonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[900],
    flex: 1,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceColumn: {
    flex: 1,
    alignItems: 'center',
  },
  priceDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.gray[200],
    marginHorizontal: 16,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.gray[500],
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  bestPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  betterPrice: {
    color: COLORS.primary[500],
  },
  storeLabel: {
    fontSize: 12,
    color: COLORS.gray[500],
  },
  savingsRow: {
    backgroundColor: COLORS.primary[50],
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  savingsText: {
    fontSize: 13,
    color: COLORS.primary[700],
    fontWeight: '600',
    textAlign: 'center',
  },
  statsRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    paddingTop: 10,
  },
  statsText: {
    fontSize: 12,
    color: COLORS.gray[500],
    textAlign: 'center',
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
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.gray[600],
    textAlign: 'center',
    marginBottom: 20,
  },
});
