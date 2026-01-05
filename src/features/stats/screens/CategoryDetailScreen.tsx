// Category Detail Screen - Shows all items in a specific category
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Animated,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import {StatsStackParamList} from '../navigation/StatsStackNavigator';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, EmptyState, BackButton, FadeIn} from '@/shared/components';
import {formatCurrency, safeToDate, convertCurrency} from '@/shared/utils/helpers';
import {useAuth, useUser} from '@/shared/contexts';
import {translationService} from '@/shared/services/translation';
import {APP_ID} from '@/shared/services/firebase/config';

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

type NavigationProp = NativeStackNavigationProp<StatsStackParamList, 'CategoryDetail'>;
type CategoryDetailRouteProp = RouteProp<StatsStackParamList, 'CategoryDetail'>;

interface CategoryItem {
  id: string;
  name: string;
  totalSpent: number;
  quantity: number;
  averagePrice: number;
  currency: 'USD' | 'CDF';
  shops: Array<{
    name: string;
    count: number;
    totalSpent: number;
  }>;
  lastPurchaseDate: Date;
}

export function CategoryDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CategoryDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const {categoryName, categoryColor} = route.params;
  const {user} = useAuth();
  const {profile} = useUser();

  const [items, setItems] = useState<CategoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CategoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [primaryCurrency, setPrimaryCurrency] = useState<'USD' | 'CDF'>('CDF');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = React.useRef<TextInput>(null);

  useEffect(() => {
    loadCategoryItems();
  }, [user, categoryName]);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery]);

  const filterItems = async () => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = [];
    
    for (const item of items) {
      // Use bilingual matching for cross-language search (with API fallback)
      if (await translationService.bilingualMatchAsync(item.name, searchQuery)) {
        filtered.push(item);
        continue;
      }
      // Fallback to simple contains match
      if (item.name.toLowerCase().includes(query)) {
        filtered.push(item);
      }
    }
    
    setFilteredItems(filtered);
  };

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (isSearchOpen) {
      setSearchQuery('');
    } else {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const loadCategoryItems = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get user's currency preference (but we'll override with receipt currency)
      const userDoc = await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(user.uid)
        .get();
      
      // Get all receipts
      const receiptsSnapshot = await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(user.uid)
        .collection('receipts')
        .orderBy('scannedAt', 'desc')
        .get();

      // Determine primary currency from receipts (most common currency)
      const receiptCurrencies = receiptsSnapshot.docs.map(doc => doc.data().currency || 'CDF');
      const currencyCount: Record<string, number> = {};
      receiptCurrencies.forEach(c => { currencyCount[c] = (currencyCount[c] || 0) + 1; });
      const mostCommonCurrency = Object.entries(currencyCount)
        .sort(([, a], [, b]) => b - a)[0]?.[0] as 'USD' | 'CDF' || 'CDF';
      setPrimaryCurrency(mostCommonCurrency);

      // Process items by category
      const itemsMap = new Map<string, CategoryItem>();
      let categoryTotal = 0;

      receiptsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const items = data.items || [];
        const storeName = data.storeName || 'Magasin inconnu';
        const receiptDate = safeToDate(data.scannedAt);
        const receiptCurrency = data.currency || 'CDF';

        items.forEach((item: any) => {
          // Re-detect category for better accuracy
          const detectedCategory = detectItemCategory(item.name || '');
          const itemCategory = detectedCategory || item.category || 'Autres';
          
          // Only process items in the selected category
          if (itemCategory !== categoryName) return;

          const itemName = item.name || 'Article inconnu';
          const normalizedName = itemName.toLowerCase().trim();
          const totalPrice = item.totalPrice || 0;
          const quantity = item.quantity || 1;

          // Debug logging for sugar items
          if (normalizedName.includes('sugar') || normalizedName.includes('sucre')) {
            console.log('🔍 Sugar item found:', {
              receiptId: doc.id,
              itemName,
              quantity,
              totalPrice,
              category: item.category,
              detectedCategory,
              receiptCurrency
            });
          }

          // Create unique key (combine items regardless of currency)
          const itemKey = normalizedName;

          // Convert to common currency if needed
          const convertedTotalPrice = convertCurrency(totalPrice, receiptCurrency, mostCommonCurrency);
          categoryTotal += convertedTotalPrice;

          if (itemsMap.has(itemKey)) {
            const existing = itemsMap.get(itemKey)!;
            existing.totalSpent += convertedTotalPrice;
            existing.quantity += quantity;
            existing.averagePrice = existing.totalSpent / existing.quantity;

            // Update shops
            const shopIndex = existing.shops.findIndex(s => s.name === storeName);
            if (shopIndex >= 0) {
              existing.shops[shopIndex].count++;
              existing.shops[shopIndex].totalSpent += convertedTotalPrice;
            } else {
              existing.shops.push({
                name: storeName,
                count: 1,
                totalSpent: convertedTotalPrice,
              });
            }

            // Update last purchase date
            if (receiptDate > existing.lastPurchaseDate) {
              existing.lastPurchaseDate = receiptDate;
            }
          } else {
            itemsMap.set(itemKey, {
              id: itemKey,
              name: itemName,
              totalSpent: convertedTotalPrice,
              quantity: quantity,
              averagePrice: convertedTotalPrice / quantity,
              currency: mostCommonCurrency,
              shops: [{
                name: storeName,
                count: 1,
                totalSpent: convertedTotalPrice,
              }],
              lastPurchaseDate: receiptDate,
            });
          }
        });
      });

      // Convert map to array and sort by total spent
      const itemsArray = Array.from(itemsMap.values()).sort(
        (a, b) => b.totalSpent - a.totalSpent
      );

      setItems(itemsArray);
      setFilteredItems(itemsArray);
      setTotalSpent(categoryTotal);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading category items:', error);
      setIsLoading(false);
    }
  };

  const renderItemCard = ({item}: {item: CategoryItem}) => {
    // Sort shops by purchase count
    const topShops = [...item.shops].sort((a, b) => b.count - a.count).slice(0, 3);

    return (
      <FadeIn>
        <View style={styles.itemCard}>
          {/* Item Header */}
          <View style={styles.itemHeader}>
            <View style={[styles.itemIcon, {backgroundColor: categoryColor + '30'}]}>
              <Icon name="shopping-cart" size="md" color={categoryColor} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.itemQuantity}>
                Acheté {item.quantity} fois
              </Text>
            </View>
          </View>

          {/* Item Stats */}
          <View style={styles.itemStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total dépensé</Text>
              <Text style={styles.statValue}>
                {formatCurrency(item.totalSpent, item.currency)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Prix moyen</Text>
              <Text style={styles.statValue}>
                {formatCurrency(item.averagePrice, item.currency)}
              </Text>
            </View>
          </View>

          {/* Shops */}
          {topShops.length > 0 && (
            <View style={styles.shopsSection}>
              <Text style={styles.shopsTitle}>Magasins</Text>
              {topShops.map((shop, index) => (
                <View key={index} style={styles.shopRow}>
                  <View style={styles.shopLeft}>
                    <View style={styles.shopDot} />
                    <Text style={styles.shopName} numberOfLines={1}>
                      {shop.name}
                    </Text>
                  </View>
                  <Text style={styles.shopCount}>
                    {shop.count}x · {formatCurrency(shop.totalSpent, primaryCurrency)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </FadeIn>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Modern Header */}
        <FadeIn duration={400}>
          <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
            <BackButton />
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{categoryName}</Text>
            </View>
            
            <View style={styles.headerRight} />
          </View>
        </FadeIn>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <FadeIn duration={400}>
        <View style={[styles.header, {paddingTop: insets.top + Spacing.md}]}>
          <BackButton />
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{categoryName}</Text>
            <Text style={styles.headerSubtitle}>
              {items.length} article{items.length !== 1 ? 's' : ''}
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.searchButton}
            onPress={toggleSearch}
            activeOpacity={0.7}>
            <Icon
              name={isSearchOpen ? 'x' : 'search'}
              size="sm"
              color={Colors.primary}
            />
          </TouchableOpacity>
        </View>
      </FadeIn>

      {/* Search Bar */}
      {isSearchOpen && (
        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <Icon name="search" size="sm" color={Colors.text.tertiary} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Rechercher un article..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.text.tertiary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x-circle" size="sm" color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Results Badge */}
      {searchQuery && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsBadge}>
            <Icon name="filter" size="xs" color={Colors.primary} />
            <Text style={styles.resultsText}>
              {filteredItems.length} résultat{filteredItems.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}>
            <Text style={styles.clearText}>Tout afficher</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary Card */}
      {items.length > 0 && !searchQuery && (
        <FadeIn delay={100}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total dépensé</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(totalSpent, primaryCurrency)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Articles uniques</Text>
              <Text style={styles.summaryValue}>{items.length}</Text>
            </View>
          </View>
        </FadeIn>
      )}

      {/* Items List */}
      <FlatList
        data={filteredItems}
        renderItem={renderItemCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="shopping-cart"
            title="Aucun article"
            description={searchQuery ? "Aucun résultat trouvé" : "Aucun article trouvé dans cette catégorie"}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
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

  // Modern Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background.primary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  headerRight: {
    width: 44,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.fontSize.md,
    color: Colors.text.primary,
    paddingVertical: Spacing.xs,
  },

  // Results
  resultsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  resultsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  resultsText: {
    marginLeft: Spacing.xs,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semiBold,
  },
  clearButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  clearText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.medium,
  },

  // Summary Card
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.border.light,
    marginHorizontal: Spacing.md,
  },

  // List
  listContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: Spacing.lg,
  },

  // Item Card
  itemCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  itemQuantity: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
  },

  // Stats
  itemStats: {
    flexDirection: 'row',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },

  // Shops
  shopsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingTop: Spacing.md,
  },
  shopsTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  shopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  shopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginRight: Spacing.sm,
  },
  shopName: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
    flex: 1,
  },
  shopCount: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: Typography.fontWeight.medium,
  },
});
