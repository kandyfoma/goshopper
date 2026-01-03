// Stats Screen - Spending analytics and insights
// Styled with GoShopperAI Design System (Blue + Gold)
import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {CompositeNavigationProp} from '@react-navigation/native';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
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
import {formatCurrency, safeToDate} from '@/shared/utils/helpers';
import {useAuth, useUser, useSubscription} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';
import {hasFeatureAccess} from '@/shared/utils/featureAccess';
import {SubscriptionLimitModal} from '@/shared/components';
import {globalSettingsService} from '@/shared/services/globalSettingsService';
import {networkAwareCache, CachePriority} from '@/shared/services/caching';
import {APP_ID} from '@/shared/services/firebase/config';
import {getCurrentMonthBudget} from '@/shared/services/firebase/budgetService';
import {RootStackParamList, MainTabParamList} from '@/shared/types';
import {StatsStackParamList} from '../navigation/StatsStackNavigator';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// Category detection keywords - mirrors backend logic for consistent categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Boissons': ['eau', 'water', 'jus', 'juice', 'soda', 'coca', 'fanta', 'sprite', 'pepsi', 'limonade', 
               'biere', 'beer', 'vin', 'wine', 'merlot', 'cabernet', 'chardonnay', 'medco', 'sauvignon',
               'whisky', 'vodka', 'rhum', 'rum', 'champagne', 'cafe', 'coffee', 'the', 'tea', 'lait', 'milk',
               'yaourt', 'yogurt', 'primus', 'heineken', 'skol', 'tembo', 'castel', 'ngok', 'nkoyi',
               'simba', 'mutzig', 'masanga', 'malavu', 'lotoko', 'maziwa'],
  'Alimentation': ['riz', 'rice', 'pain', 'bread', 'farine', 'flour', 'pate', 'pasta', 'spaghetti', 'macaroni',
               'cereale', 'cereal', 'biscuit', 'cookie', 'chocolat', 'chocolate', 'sucre', 'sugar',
               'sel', 'salt', 'huile', 'oil', 'miel', 'honey', 'confiture', 'jam', 'beurre', 'butter',
               'fromage', 'cheese', 'oeuf', 'egg', 'viande', 'meat', 'poulet', 'chicken', 'boeuf', 'beef',
               'poisson', 'fish', 'sardine', 'thon', 'tuna', 'mafuta', 'mungwa', 'fufu', 'pondu', 'saka',
               'makayabu', 'mbisi', 'ngolo', 'kapiteni', 'sombe', 'matembele', 'biteku', 'ngai ngai', 'ndunda',
               'bonbon', 'candy', 'chips', 'snack', 'gateaux', 'cake', 'creme', 'cream', 'nutella'],
  'Fruits & Légumes': ['pomme', 'apple', 'banane', 'banana', 'orange', 'citron', 'lemon', 'mangue', 'mango',
               'ananas', 'pineapple', 'avocat', 'avocado', 'tomate', 'tomato', 'carotte', 'carrot',
               'oignon', 'onion', 'ail', 'garlic', 'salade', 'lettuce', 'chou', 'cabbage', 'haricot', 'bean',
               'pomme de terre', 'potato', 'patate', 'epinard', 'spinach', 'concombre', 'cucumber'],
  'Hygiène': ['savon', 'soap', 'shampooing', 'shampoo', 'dentifrice', 'toothpaste', 'brosse', 'brush',
               'papier toilette', 'toilet paper', 'serviette', 'towel', 'deodorant', 'gel douche', 'shower gel',
               'lotion', 'parfum', 'perfume', 'coton', 'cotton', 'rasoir', 'razor', 'lingette', 'wipe'],
  'Ménage': ['javel', 'bleach', 'detergent', 'lessive', 'laundry', 'eponge', 'sponge', 'balai', 'broom',
               'seau', 'bucket', 'serpilliere', 'mop', 'torchon', 'cloth', 'poubelle', 'trash', 'sac poubelle',
               'insecticide', 'desodorisant', 'air freshener', 'makala', 'charbon', 'charcoal'],
  'Bébé': ['couche', 'diaper', 'nappy', 'pampers', 'biberon', 'bottle', 'lait bebe', 'baby formula',
               'lingette bebe', 'baby wipe', 'sucette', 'pacifier', 'tetine', 'huggies', 'molfix'],
  'Électronique': ['pile', 'battery', 'chargeur', 'charger', 'cable', 'ecouteur', 'earphone', 'lampe', 'lamp',
               'ampoule', 'bulb', 'torch', 'torche', 'flashlight', 'radio', 'telephone', 'phone'],
};

/**
 * Detect category from item name using keyword matching
 * Returns null if no category detected (will fall back to item's original category)
 */
function detectItemCategory(itemName: string): string | null {
  const normalizedName = itemName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword) || keyword.includes(normalizedName)) {
        return category;
      }
    }
  }
  
  return null;
}

type StatsScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<StatsStackParamList, 'StatsMain'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList>,
    NativeStackNavigationProp<RootStackParamList>
  >
>;

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

export function StatsScreen() {
  const navigation = useNavigation<StatsScreenNavigationProp>();
  const {user, isAuthenticated} = useAuth();
  const {profile, isLoading: profileLoading} = useUser();
  const {subscription} = useSubscription();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Check if user has access to stats (Standard+ feature)
  const hasAccess = hasFeatureAccess('stats', subscription);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Show modal if no access
  useEffect(() => {
    if (isAuthenticated && !profileLoading && !hasAccess) {
      setShowLimitModal(true);
    }
  }, [isAuthenticated, profileLoading, hasAccess]);

  // Don't render content if no access
  if (!hasAccess && !showLimitModal) {
    return null;
  }

  const [totalSpending, setTotalSpending] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0); // Will be set from profile
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySpending[]>([]);
  const [currentMonthReceipts, setCurrentMonthReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryCurrency, setPrimaryCurrency] = useState<'USD' | 'CDF'>('USD');
  const [exchangeRate, setExchangeRate] = useState(2200); // Default rate

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Stats', 'StatsScreen');
  }, []);

  // Separate effect to update budget when profile changes
  useEffect(() => {
    const loadBudget = async () => {
      if (profile?.userId) {
        try {
          const budget = await getCurrentMonthBudget(
            profile.userId,
            profile.defaultMonthlyBudget || profile.monthlyBudget,
            profile.preferredCurrency || 'USD',
          );
          setMonthlyBudget(budget.amount);
        } catch (error) {
          // Silently fallback to legacy budget if Firestore access fails
          if (profile.monthlyBudget !== undefined) {
            setMonthlyBudget(profile.monthlyBudget);
          }
        }
      }
    };

    loadBudget();
  }, [profile?.userId, profile?.defaultMonthlyBudget, profile?.monthlyBudget, profile?.preferredCurrency]);

  // Subscribe to exchange rate changes
  useEffect(() => {
    const unsubscribe = globalSettingsService.subscribe((settings) => {
      setExchangeRate(settings.exchangeRates.usdToCdf);
    });

    return unsubscribe;
  }, []);

  const loadStatsData = useCallback(async (forceRefresh: boolean = false) => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Always clear cache to ensure fresh data
      const cacheKey = `stats-data-${user.uid}-${new Date().getMonth()}`;
      
      // Use network-aware cache for stats data
      const cachedData = await networkAwareCache.fetchWithCache({
        key: cacheKey,
        namespace: 'stats',
        ttl: 5 * 60 * 1000, // 5 minutes
        priority: CachePriority.HIGH,
        fetchFn: async () => {

      // Get current month receipts (load all and filter in memory to avoid index issues)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let receiptsSnapshot;
      try {
        receiptsSnapshot = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('receipts')
          .orderBy('scannedAt', 'desc')
          .get();
      } catch (indexError) {
        // Fallback: get all without ordering
        receiptsSnapshot = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('receipts')
          .get();
      }

      // Filter for current month receipts in memory
      const currentMonthReceipts = receiptsSnapshot.docs.filter(doc => {
        const data = doc.data();
        
        // Try multiple date fields for compatibility with old receipts
        let receiptDate = safeToDate(data.scannedAt);
        
        // If scannedAt is invalid (1970), try other date fields
        if (receiptDate.getFullYear() === 1970) {
          receiptDate = safeToDate(data.createdAt) || safeToDate(data.date) || new Date();
        }
        
        const isCurrentMonth = receiptDate >= startOfMonth;
        
        return isCurrentMonth;
      });

      console.log('📊 Stats Debug:', {
        totalReceipts: receiptsSnapshot.docs.length,
        currentMonthReceipts: currentMonthReceipts.length,
        startOfMonth: startOfMonth.toISOString(),
        sampleReceiptDates: receiptsSnapshot.docs.slice(0, 3).map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            scannedAt: data.scannedAt,
            scannedAtConverted: safeToDate(data.scannedAt).toISOString(),
            createdAt: data.createdAt,
            total: data.total,
            currency: data.currency,
          };
        }),
      });

      // Store current month receipts in state for behavior analysis
      setCurrentMonthReceipts(currentMonthReceipts.map(doc => ({id: doc.id, ...doc.data()})));

      // Determine primary currency from receipts
      const currencyCount: Record<string, number> = {};
      currentMonthReceipts.forEach(doc => {
        const data = doc.data();
        const currency = data.currency || 'USD';
        currencyCount[currency] = (currencyCount[currency] || 0) + 1;
      });

      // Set primary currency from receipts (most common currency)
      // This ensures stats display in the same currency as the receipts
      const mostCommonCurrency = Object.entries(currencyCount)
        .sort(([, a], [, b]) => b - a)[0]?.[0] as 'USD' | 'CDF' || 'CDF';
      setPrimaryCurrency(mostCommonCurrency);

      // Note: monthlyBudget is now set by separate useEffect for real-time updates

      // Calculate spending by category
      const categoryTotals: Record<string, number> = {};
      let totalSpent = 0;
      let categoryRawTotal = 0; // For calculating percentages

      currentMonthReceipts.forEach(doc => {
        const data = doc.data();
        // Calculate total based on currency using standardized fields
        let receiptTotal = 0;
        if (mostCommonCurrency === 'CDF') {
          // For CDF: prioritize totalCDF field
          if (data.totalCDF != null) {
            receiptTotal = Number(data.totalCDF) || 0;
          } else if (data.currency === 'CDF' && data.total != null) {
            receiptTotal = Number(data.total) || 0;
          } else if (data.totalUSD != null) {
            receiptTotal = (Number(data.totalUSD) || 0) * exchangeRate;
          } else if (data.currency === 'USD' && data.total != null) {
            receiptTotal = (Number(data.total) || 0) * exchangeRate;
          }
        } else {
          // For USD: prioritize totalUSD field
          if (data.totalUSD != null) {
            receiptTotal = Number(data.totalUSD) || 0;
          } else if (data.currency === 'USD' && data.total != null) {
            receiptTotal = Number(data.total) || 0;
          } else if (data.totalCDF != null) {
            receiptTotal = (Number(data.totalCDF) || 0) / exchangeRate;
          } else if (data.currency === 'CDF' && data.total != null) {
            receiptTotal = (Number(data.total) || 0) / exchangeRate;
          }
        }
        totalSpent += receiptTotal;

        // Calculate real savings from receipt data
        // Note: Savings calculation removed as it's not displayed in UI

        // Calculate category totals from items using the SAME conversion as receipt total
        // This ensures category breakdown matches the monthly total exactly
        if (receiptTotal > 0 && data.items && data.items.length > 0) {
          // Calculate the receipt's item sum to get the conversion ratio
          let receiptItemSum = 0;
          data.items.forEach((item: any) => {
            receiptItemSum += item.totalPrice || 0;
          });

          // If items sum to something, distribute the receipt total proportionally
          if (receiptItemSum > 0) {
            data.items.forEach((item: any) => {
              // Re-detect category client-side for better accuracy
              const detectedCategory = detectItemCategory(item.name || '');
              const category = detectedCategory || item.category || 'Autres';
              const itemTotal = item.totalPrice || 0;
              
              // Calculate this item's share of the receipt total (in receipt's currency)
              const itemShare = (itemTotal / receiptItemSum) * receiptTotal;
              
              categoryTotals[category] = (categoryTotals[category] || 0) + itemShare;
              categoryRawTotal += itemShare;
            });
          }
        } else if (receiptTotal > 0) {
          // If receipt has no items or items don't sum up, put entire receipt in "Autres"
          categoryTotals['Autres'] = (categoryTotals['Autres'] || 0) + receiptTotal;
          categoryRawTotal += receiptTotal;
        }
      });

      console.log('📊 Stats items debug:', {
        sampleReceiptItems: currentMonthReceipts.slice(0, 1).map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            hasItems: !!data.items,
            itemCount: data.items?.length || 0,
            sampleItems: (data.items || []).slice(0, 3).map((item: any) => ({
              name: item.name,
              category: item.category,
              totalPrice: item.totalPrice,
            })),
          };
        }),
        categoryTotals,
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
            categoryRawTotal > 0
              ? Math.round((amount / categoryRawTotal) * 100)
              : 0,
          color:
            categoryColors[name as keyof typeof categoryColors] ||
            Colors.text.tertiary,
          icon: categoryIcons[name as keyof typeof categoryIcons] || 'grid',
        }))
        .sort((a, b) => b.amount - a.amount);

      console.log('📊 Stats calculated:', {
        totalSpent,
        categoryRawTotal,
        categoriesCount: categoriesArray.length,
        topCategories: categoriesArray.slice(0, 3).map(c => ({name: c.name, amount: c.amount})),
      });

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
      let allReceiptsSnapshot;
      try {
        allReceiptsSnapshot = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('receipts')
          .orderBy('scannedAt', 'desc')
          .get();
      } catch (indexError) {
        // Fallback: get all without ordering
        allReceiptsSnapshot = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .collection('receipts')
          .get();
      }

      // Filter for last 3 months in memory
      const lastThreeMonthsReceipts = allReceiptsSnapshot.docs.filter(doc => {
        const data = doc.data();
        const scannedAt = safeToDate(data.scannedAt);
        return scannedAt && scannedAt >= threeMonthsAgo;
      });

      lastThreeMonthsReceipts.forEach(doc => {
        const data = doc.data();
        const date = safeToDate(data.scannedAt);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthlyTotals[monthKey] !== undefined) {
          // Calculate amount based on currency using standardized fields
          let amount = 0;
          if (mostCommonCurrency === 'CDF') {
            // For CDF: prioritize totalCDF field
            if (data.totalCDF != null) {
              amount = Number(data.totalCDF) || 0;
            } else if (data.currency === 'CDF' && data.total != null) {
              amount = Number(data.total) || 0;
            } else if (data.totalUSD != null) {
              amount = (Number(data.totalUSD) || 0) * exchangeRate;
            } else if (data.currency === 'USD' && data.total != null) {
              amount = (Number(data.total) || 0) * exchangeRate;
            }
          } else {
            // For USD: prioritize totalUSD field
            if (data.totalUSD != null) {
              amount = Number(data.totalUSD) || 0;
            } else if (data.currency === 'USD' && data.total != null) {
              amount = Number(data.total) || 0;
            } else if (data.totalCDF != null) {
              amount = (Number(data.totalCDF) || 0) / exchangeRate;
            } else if (data.currency === 'CDF' && data.total != null) {
              amount = (Number(data.total) || 0) / exchangeRate;
            }
          }
          monthlyTotals[monthKey] += amount;
        }
      });

      const monthlyArray: MonthlySpending[] = Object.entries(monthlyTotals).map(
        ([key, amount]) => {
          const [, month] = key.split('-');
          return {
            month: monthNames[parseInt(month, 10)],
            amount: amount || 0, // Ensure amount is never undefined
          };
        },
      );

          return {
            totalSpending: totalSpent,
            categories: categoriesArray,
            monthlyData: monthlyArray,
            currentMonthReceipts: currentMonthReceipts.map(doc => ({id: doc.id, ...doc.data()}))
          };
        },
        forceRefresh,
        onStaleData: (staleData) => {
          // Show stale data immediately for instant display
          if (staleData && staleData.data) {
            console.log('📊 Using stale data:', staleData);
            setTotalSpending(staleData.data.totalSpending || 0);
            setCategories(staleData.data.categories || []);
            setMonthlyData(staleData.data.monthlyData || []);
            setCurrentMonthReceipts(staleData.data.currentMonthReceipts || []);
          }
        }
      });

      // Update with fresh or cached data
      console.log('📊 Updating state with fresh data:', cachedData);
      if (cachedData && cachedData.data) {
        setTotalSpending(cachedData.data.totalSpending || 0);
        setCategories(cachedData.data.categories || []);
        setMonthlyData(cachedData.data.monthlyData || []);
        setCurrentMonthReceipts(cachedData.data.currentMonthReceipts || []);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      // Set empty data on error
      setTotalSpending(0);
      setCategories([]);
      setMonthlyData([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, profile?.preferredCurrency]);

  // Set up real-time listener for receipts collection
  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    // Subscribe to receipts collection for real-time updates
    const unsubscribe = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(user.uid)
      .collection('receipts')
      .onSnapshot(
        (snapshot) => {
          loadStatsData();
        },
        (error) => {
          console.error('📊 Stats: Error in receipts listener:', error);
        }
      );

    // Initial load
    loadStatsData();

    return () => {
      unsubscribe();
    };
  }, [user?.uid, loadStatsData]);

  // Reload data when screen comes into focus - always fetch fresh data for real-time updates
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadStatsData(true); // Always force refresh for real-time data
      }
    }, [user?.uid, loadStatsData])
  );

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatsData(true); // Force refresh with cache clear
    setRefreshing(false);
  };

  const maxMonthlyAmount = Math.max(
    ...monthlyData.map(d => d.amount),
    monthlyBudget,
  );

  // Donut chart calculations
  const donutChartData = useMemo(() => {
    if (categories.length === 0) {
      return [];
    }

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

  // Don't render content if not authenticated or profile is loading
  if (!isAuthenticated || profileLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {profileLoading ? 'Chargement du profil...' : 'Chargement...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
    <>
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
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
              title="Actualiser les statistiques..."
              titleColor={Colors.text.secondary}
            />
          }>
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
                        strokeDasharray={i > 0 ? '5,5' : '0'}
                      />
                      <SvgText
                        x="35"
                        y={165 - ratio * 130}
                        fontSize="10"
                        fill={Colors.text.tertiary}
                        textAnchor="end">
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
                    const gap =
                      (SCREEN_WIDTH - 120 - monthlyData.length * barWidth) /
                      (monthlyData.length + 1);
                    const x = 50 + gap * (index + 1) + barWidth * index;
                    const barHeight =
                      maxMonthlyAmount > 0
                        ? (data.amount / maxMonthlyAmount) * 130
                        : 0;
                    const isOverBudget = data.amount > monthlyBudget;

                    return (
                      <G key={index}>
                        {/* Bar background */}
                        <Path
                          d={`M ${x} 160 L ${x} ${160 - barHeight + 8} Q ${x} ${
                            160 - barHeight
                          } ${x + 8} ${160 - barHeight} L ${x + barWidth - 8} ${
                            160 - barHeight
                          } Q ${x + barWidth} ${160 - barHeight} ${
                            x + barWidth
                          } ${160 - barHeight + 8} L ${x + barWidth} 160 Z`}
                          fill={
                            isOverBudget ? Colors.status.error : Colors.primary
                          }
                        />
                        {/* Gradient overlay */}
                        <Path
                          d={`M ${x} 160 L ${x} ${160 - barHeight + 8} Q ${x} ${
                            160 - barHeight
                          } ${x + 8} ${160 - barHeight} L ${x + barWidth - 8} ${
                            160 - barHeight
                          } Q ${x + barWidth} ${160 - barHeight} ${
                            x + barWidth
                          } ${160 - barHeight + 8} L ${x + barWidth} 160 Z`}
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
                          fontWeight="500">
                          {data.month}
                        </SvgText>
                        {/* Amount on top of bar */}
                        <SvgText
                          x={x + barWidth / 2}
                          y={155 - barHeight}
                          fontSize="11"
                          fill={Colors.text.primary}
                          textAnchor="middle"
                          fontWeight="600">
                          {primaryCurrency === 'CDF'
                            ? `${(Number(data.amount || 0) / 1000).toFixed(0)}k`
                            : `$${Number(data.amount || 0).toFixed(0)}`}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </View>

              {/* Legend */}
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      {backgroundColor: Colors.primary},
                    ]}
                  />
                  <Text style={styles.legendText}>Dépenses</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      {backgroundColor: Colors.status.error},
                    ]}
                  />
                  <Text style={styles.legendText}>Dépassement</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendLine,
                      {backgroundColor: Colors.accent},
                    ]}
                  />
                  <Text style={styles.legendText}>
                    Budget ({formatCurrency(monthlyBudget, primaryCurrency)})
                  </Text>
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
                              d={createArcPath(
                                0,
                                0,
                                70,
                                item.startAngle,
                                item.endAngle,
                              )}
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
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.categoryRow,
                          index === categories.length - 1 &&
                            styles.categoryRowLast,
                        ]}
                        onPress={() => navigation.navigate('CategoryDetail', {
                          categoryName: category.name,
                          categoryColor: category.color,
                        })}
                        activeOpacity={0.7}>
                        <View style={styles.categoryLeft}>
                          <View
                            style={[
                              styles.categoryDot,
                              {backgroundColor: category.color},
                            ]}
                          />
                          <Text style={styles.categoryName}>
                            {category.name}
                          </Text>
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
                          <Icon name="chevron-right" size="sm" color={Colors.text.tertiary} style={styles.categoryChevron} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        </SlideIn>

        {/* Shopping Behavior Analysis */}
        <SlideIn delay={500}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analyse de Comportement</Text>

            <View style={styles.behaviorCard}>
              <View style={styles.behaviorRow}>
                <View style={styles.behaviorItem}>
                  <Icon name="calendar" size="sm" color={Colors.primary} />
                  <Text style={styles.behaviorLabel}>Achats ce mois</Text>
                  <Text style={styles.behaviorValue}>
                    {currentMonthReceipts.length}
                  </Text>
                </View>
                <View style={styles.behaviorItem}>
                  <Icon name="credit-card" size="sm" color={Colors.accent} />
                  <Text style={styles.behaviorLabel}>Dépense moyenne</Text>
                  <Text style={styles.behaviorValue}>
                    {currentMonthReceipts.length > 0 
                      ? formatCurrency(totalSpending / currentMonthReceipts.length, primaryCurrency)
                      : formatCurrency(0, primaryCurrency)}
                  </Text>
                </View>
              </View>

              <View style={styles.behaviorRow}>
                <View style={styles.behaviorItem}>
                  <Icon name="shopping-bag" size="sm" color={Colors.status.success} />
                  <Text style={styles.behaviorLabel}>Catégories</Text>
                  <Text style={styles.behaviorValue}>{categories.length}</Text>
                </View>
                <View style={styles.behaviorItem}>
                  <Icon name="trending-down" size="sm" color={Colors.status.info} />
                  <Text style={styles.behaviorLabel}>Budget restant</Text>
                  <Text style={styles.behaviorValue}>
                    {formatCurrency(Math.max(0, monthlyBudget - totalSpending), primaryCurrency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Top stores if available */}
            {currentMonthReceipts.length > 0 && (
              <View style={[styles.behaviorCard, {marginTop: Spacing.md}]}>
                <Text style={styles.behaviorCardTitle}>Magasins les plus visités</Text>
                {(() => {
                  const storeCounts: Record<string, number> = {};
                  currentMonthReceipts.forEach(doc => {
                    const storeName = doc.storeName || 'Magasin inconnu';
                    storeCounts[storeName] = (storeCounts[storeName] || 0) + 1;
                  });
                  const topStores = Object.entries(storeCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3);
                  
                  return topStores.map(([store, count], index) => (
                    <View key={index} style={styles.storeRow}>
                      <View style={styles.storeRank}>
                        <Text style={styles.storeRankText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.storeName}>{store}</Text>
                      <Text style={styles.storeCount}>{count} achats</Text>
                    </View>
                  ));
                })()}
              </View>
            )}
          </View>
        </SlideIn>

        {/* Insights - Moved to bottom */}
        <SlideIn delay={600}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conseils Personnalisés</Text>

            {/* Dynamic budget alert */}
            {totalSpending > monthlyBudget * 0.9 && (
              <View style={[styles.insightCard, styles.insightWarning]}>
                <View style={styles.insightIconWrapper}>
                  <Icon name="alert-circle" size="md" color={Colors.status.warning} />
                </View>
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>
                    Attention au budget!
                  </Text>
                  <Text style={styles.insightDesc}>
                    Vous avez utilisé {Math.round((totalSpending / monthlyBudget) * 100)}% de votre budget mensuel. 
                    Il vous reste {formatCurrency(Math.max(0, monthlyBudget - totalSpending), primaryCurrency)} pour ce mois.
                  </Text>
                </View>
              </View>
            )}

            {/* Top spending category insight */}
            {categories.length > 0 && categories[0].percentage > 40 && (
              <View style={styles.insightCard}>
                <View style={styles.insightIconWrapper}>
                  <Icon name="star" size="md" color={Colors.accent} />
                </View>
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>
                    Catégorie principale: {categories[0].name}
                  </Text>
                  <Text style={styles.insightDesc}>
                    {categories[0].percentage}% de vos dépenses vont vers {categories[0].name} ({formatCurrency(categories[0].amount, primaryCurrency)}). 
                    Comparez les prix entre magasins pour économiser jusqu'à 15%.
                  </Text>
                </View>
              </View>
            )}

            {/* Spending trend insight */}
            {monthlyData.length >= 2 && (
              <View style={styles.insightCard}>
                <View style={[styles.insightIconWrapper, styles.insightIconInfo]}>
                  <Icon name="trending-up" size="md" color={Colors.status.info} />
                </View>
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>
                    {monthlyData[monthlyData.length - 1].amount > monthlyData[monthlyData.length - 2].amount 
                      ? 'Dépenses en hausse' 
                      : 'Dépenses en baisse'}
                  </Text>
                  <Text style={styles.insightDesc}>
                    {monthlyData[monthlyData.length - 1].amount > monthlyData[monthlyData.length - 2].amount 
                      ? `Vos dépenses ont augmenté de ${Math.round(((monthlyData[monthlyData.length - 1].amount - monthlyData[monthlyData.length - 2].amount) / monthlyData[monthlyData.length - 2].amount) * 100)}% ce mois-ci.`
                      : `Félicitations! Vous avez réduit vos dépenses de ${Math.round(((monthlyData[monthlyData.length - 2].amount - monthlyData[monthlyData.length - 1].amount) / monthlyData[monthlyData.length - 2].amount) * 100)}% ce mois-ci.`}
                  </Text>
                </View>
              </View>
            )}

            {/* Low spending encouragement */}
            {totalSpending < monthlyBudget * 0.5 && totalSpending > 0 && (
              <View style={[styles.insightCard, styles.insightSuccess]}>
                <View style={styles.insightIconWrapper}>
                  <Icon name="check-circle" size="md" color={Colors.status.success} />
                </View>
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>
                    Excellent contrôle budgétaire!
                  </Text>
                  <Text style={styles.insightDesc}>
                    Vous n'avez dépensé que {Math.round((totalSpending / monthlyBudget) * 100)}% de votre budget. 
                    Continuez comme ça! Vous économisez {formatCurrency(monthlyBudget - totalSpending, primaryCurrency)}.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </SlideIn>
      </ScrollView>
    </SafeAreaView>

    {/* Subscription Limit Modal */}
    <SubscriptionLimitModal
      visible={showLimitModal}
      onClose={() => {
        setShowLimitModal(false);
        navigation.goBack();
      }}
      limitType="stats"
      requiredPlan="Premium"
      currentPlan={subscription?.planId === 'freemium' ? 'Gratuit' : subscription?.planId === 'basic' ? 'Basic' : subscription?.planId === 'standard' ? 'Standard' : undefined}
    />
    </>
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
  categoryChevron: {
    marginLeft: Spacing.xs,
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
  // Behavior analysis styles
  behaviorCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  behaviorCardTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  behaviorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  behaviorItem: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.xs,
  },
  behaviorLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  behaviorValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  storeRank: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  storeRankText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
  },
  storeName: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
  },
  storeCount: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.secondary,
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  // Insight variant styles
  insightWarning: {
    backgroundColor: Colors.status.warningLight,
  },
  insightSuccess: {
    backgroundColor: Colors.status.successLight,
  },
});
