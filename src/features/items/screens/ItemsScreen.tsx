// Items Screen - Browse and compare item prices across stores
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {COLORS} from '@/shared/utils/constants';
import {formatCurrency} from '@/shared/utils/helpers';
import {useAuth} from '@/shared/contexts';
import {analyticsService} from '@/shared/services/analytics';

interface ItemData {
  id: string;
  name: string;
  prices: {
    storeName: string;
    price: number;
    currency: 'USD' | 'CDF';
    date: Date;
    receiptId: string;
  }[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  currency: 'USD' | 'CDF'; // Primary currency for display
}

export function ItemsScreen() {
  const {user, userProfile} = useAuth();
  const [items, setItems] = useState<ItemData[]>([]);
  const [filteredItems, setFilteredItems] = useState<ItemData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Items', 'ItemsScreen');
  }, []);

  useEffect(() => {
    loadItemsData();
  }, [user, userProfile]);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery]);

  const loadItemsData = async () => {
    if (!user?.uid || !userProfile?.defaultCity) {
      setIsLoading(false);
      return;
    }

    try {
      // Get receipts for the user filtered by their city
      const receiptsSnapshot = await firestore()
        .collection(`artifacts/goshopperai/users/${user.uid}/receipts`)
        .where('city', '==', userProfile.defaultCity)
        .get();

      const itemsMap = new Map<string, ItemData>();

      receiptsSnapshot.docs.forEach(doc => {
        const receiptData = doc.data();
        const items = receiptData.items || [];

        items.forEach((item: any) => {
          const itemName = item.name?.toLowerCase().trim();
          if (!itemName) return;

          const price = item.unitPrice || 0;
          if (price <= 0) return;

          if (!itemsMap.has(itemName)) {
            itemsMap.set(itemName, {
              id: itemName,
              name: item.name,
              prices: [],
              minPrice: price,
              maxPrice: price,
              avgPrice: price,
              storeCount: 1,
              currency: receiptData.currency || 'USD',
            });
          }

          const itemData = itemsMap.get(itemName)!;
          itemData.prices.push({
            storeName: receiptData.storeName || 'Inconnu',
            price: price,
            currency: receiptData.currency || 'USD',
            date: receiptData.scannedAt?.toDate() || new Date(),
            receiptId: doc.id,
          });

          // Update statistics
          itemData.minPrice = Math.min(itemData.minPrice, price);
          itemData.maxPrice = Math.max(itemData.maxPrice, price);
          itemData.avgPrice = itemData.prices.reduce((sum, p) => sum + p.price, 0) / itemData.prices.length;
          itemData.storeCount = new Set(itemData.prices.map(p => p.storeName)).size;
          
          // Determine primary currency (most common)
          const currencyCounts = itemData.prices.reduce((acc, p) => {
            acc[p.currency] = (acc[p.currency] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          itemData.currency = Object.entries(currencyCounts)
            .sort(([,a], [,b]) => b - a)[0][0] as 'USD' | 'CDF';
        });
      });

      const itemsArray = Array.from(itemsMap.values())
        .sort((a, b) => b.prices.length - a.prices.length); // Sort by frequency

      setItems(itemsArray);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterItems = () => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(query)
    );
    setFilteredItems(filtered);

    // Track item search
    analyticsService.logCustomEvent('item_search', {
      query: query,
      results_count: filtered.length
    });
  };

  const renderItem = ({item}: {item: ItemData}) => (
    <TouchableOpacity style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemStats}>
          {item.prices.length} achats • {item.storeCount} magasin{item.storeCount > 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.priceInfo}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Prix min:</Text>
          <Text style={styles.priceValue}>{formatCurrency(item.minPrice, item.currency)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Prix max:</Text>
          <Text style={styles.priceValue}>{formatCurrency(item.maxPrice, item.currency)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Prix moyen:</Text>
          <Text style={[styles.priceValue, styles.avgPrice]}>
            {formatCurrency(item.avgPrice, item.currency)}
          </Text>
        </View>
      </View>

      <View style={styles.storesList}>
        <Text style={styles.storesTitle}>Prix par magasin:</Text>
        {item.prices
          .sort((a, b) => a.price - b.price)
          .slice(0, 3)
          .map((price, index) => (
            <View key={index} style={styles.storePrice}>
              <Text style={styles.storeName}>{price.storeName}</Text>
              <Text style={styles.storePriceValue}>{formatCurrency(price.price, price.currency)}</Text>
            </View>
          ))}
        {item.prices.length > 3 && (
          <Text style={styles.moreStores}>+{item.prices.length - 3} autres...</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary[500]} />
          <Text style={styles.loadingText}>Chargement des articles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Articles</Text>
        <Text style={styles.subtitle}>
          Comparez les prix de vos achats
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un article..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.gray[400]}
        />
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {filteredItems.length} article{filteredItems.length > 1 ? 's' : ''} trouvé{filteredItems.length > 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Aucun article trouvé' : 'Aucun article disponible'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray[600],
  },
  searchContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
  },
  searchInput: {
    backgroundColor: COLORS.gray[100],
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  statsText: {
    fontSize: 14,
    color: COLORS.gray[600],
    fontWeight: '500',
  },
  listContainer: {
    padding: 20,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  itemStats: {
    fontSize: 14,
    color: COLORS.gray[500],
  },
  priceInfo: {
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.gray[600],
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  avgPrice: {
    color: COLORS.primary[600],
  },
  storesList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    paddingTop: 12,
  },
  storesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  storePrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  storeName: {
    fontSize: 14,
    color: COLORS.gray[700],
    flex: 1,
  },
  storePriceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary[600],
  },
  moreStores: {
    fontSize: 12,
    color: COLORS.gray[500],
    fontStyle: 'italic',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.gray[600],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
});