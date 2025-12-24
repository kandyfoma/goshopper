// Shopping List Optimizer Service
// Smart shopping lists with price optimization
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {APP_ID} from './config';
import {safeToDate} from '@/shared/utils/helpers';

const SHOPPING_LISTS_COLLECTION = (userId: string) =>
  `artifacts/${APP_ID}/users/${userId}/shoppingLists`;

const PRICES_COLLECTION = `artifacts/${APP_ID}/prices`;

export interface ShoppingListItem {
  id: string;
  name: string;
  nameNormalized: string;
  quantity: number;
  unit?: string;
  category?: string;
  isChecked: boolean;
  estimatedPrice?: number;
  bestPrice?: number;
  bestStore?: string;
  addedAt: Date;
  checkedAt?: Date;
}

export interface ShoppingList {
  id: string;
  userId: string;
  name: string;
  items: ShoppingListItem[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Optimization data
  totalEstimated: number;
  totalOptimized: number;
  potentialSavings: number;
  optimizedStores: StoreRecommendation[];
}

export interface StoreRecommendation {
  storeName: string;
  storeNameNormalized: string;
  itemCount: number;
  totalPrice: number;
  items: string[];
  isBestOverall: boolean;
}

export interface OptimizationResult {
  singleStoreStrategy: {
    bestStore: string;
    totalPrice: number;
    itemPrices: {item: string; price: number}[];
  };
  multiStoreStrategy: {
    stores: StoreRecommendation[];
    totalPrice: number;
    savings: number;
  };
  recommendation: 'single' | 'multi';
  reasonFr: string;
  reasonLingala: string;
}

class ShoppingListService {
  /**
   * Normalize product name for matching
   */
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Create a new shopping list
   */
  async createList(
    userId: string,
    name: string,
    items?: Partial<ShoppingListItem>[],
  ): Promise<ShoppingList> {
    const listRef = firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc();

    const now = new Date();
    const processedItems: ShoppingListItem[] = (items || []).map(
      (item, index) => ({
        id: `item_${Date.now()}_${index}`,
        name: item.name || '',
        nameNormalized: this.normalizeProductName(item.name || ''),
        quantity: item.quantity || 1,
        unit: item.unit,
        category: item.category,
        isChecked: false,
        addedAt: now,
      }),
    );

    const list: Omit<ShoppingList, 'id'> = {
      userId,
      name,
      items: processedItems,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      totalEstimated: 0,
      totalOptimized: 0,
      potentialSavings: 0,
      optimizedStores: [],
    };

    await listRef.set({
      ...list,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Optimize the list
    const optimized = await this.optimizeList(userId, listRef.id);

    return {
      ...list,
      id: listRef.id,
      ...optimized,
    };
  }

  /**
   * Get all shopping lists for user
   */
  async getLists(userId: string, activeOnly = true): Promise<ShoppingList[]> {
    let query = firestore().collection(
      SHOPPING_LISTS_COLLECTION(userId),
    ) as any;

    if (activeOnly) {
      query = query.where('isActive', '==', true);
    }

    const snapshot = await query.orderBy('updatedAt', 'desc').get();

    return snapshot.docs.map((doc: any) => this.docToList(doc));
  }

  /**
   * Get a single shopping list
   */
  async getList(userId: string, listId: string): Promise<ShoppingList | null> {
    const doc = await firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc(listId)
      .get();

    if (!doc.exists) {
      return null;
    }
    return this.docToList(doc);
  }

  /**
   * Update shopping list name
   */
  async updateListName(
    userId: string,
    listId: string,
    name: string,
  ): Promise<void> {
    await firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc(listId)
      .update({
        name,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Convert Firestore doc to ShoppingList
   */
  private docToList(doc: any): ShoppingList {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: safeToDate(data.createdAt) || new Date(),
      updatedAt: safeToDate(data.updatedAt) || new Date(),
      completedAt: data.completedAt ? safeToDate(data.completedAt) : undefined,
      items: (data.items || []).map((item: any) => ({
        ...item,
        addedAt: safeToDate(item.addedAt) || new Date(),
        checkedAt: item.checkedAt ? safeToDate(item.checkedAt) : undefined,
      })),
    };
  }

  /**
   * Add item to shopping list
   */
  async addItem(
    userId: string,
    listId: string,
    item: Partial<ShoppingListItem>,
  ): Promise<ShoppingListItem> {
    const list = await this.getList(userId, listId);
    if (!list) {
      throw new Error('List not found');
    }

    // Build item object, excluding undefined values (Firestore doesn't accept undefined)
    const newItem: ShoppingListItem = {
      id: `item_${Date.now()}`,
      name: item.name || '',
      nameNormalized: this.normalizeProductName(item.name || ''),
      quantity: item.quantity || 1,
      isChecked: false,
      addedAt: new Date(),
    };
    
    // Only add optional fields if they have values
    if (item.unit) {
      newItem.unit = item.unit;
    }
    if (item.category) {
      newItem.category = item.category;
    }
    
    // Use user-selected price/store if provided, otherwise get from price data
    if (item.bestPrice !== undefined && item.bestStore) {
      newItem.bestPrice = item.bestPrice;
      newItem.bestStore = item.bestStore;
    } else {
      // Get price data for item
      const priceData = await this.getItemPriceData(newItem.nameNormalized);
      if (priceData) {
        newItem.bestPrice = priceData.bestPrice;
        newItem.bestStore = priceData.bestStore;
        newItem.estimatedPrice = priceData.averagePrice;
      }
    }

    const updatedItems = [...list.items, newItem];

    await firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc(listId)
      .update({
        items: updatedItems,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

    // Re-optimize
    await this.optimizeList(userId, listId);

    return newItem;
  }

  /**
   * Remove item from shopping list
   */
  async removeItem(
    userId: string,
    listId: string,
    itemId: string,
  ): Promise<void> {
    const list = await this.getList(userId, listId);
    if (!list) {
      throw new Error('List not found');
    }

    const updatedItems = list.items.filter(item => item.id !== itemId);

    await firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc(listId)
      .update({
        items: updatedItems,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

    // Re-optimize
    await this.optimizeList(userId, listId);
  }

  /**
   * Toggle item checked status
   */
  async toggleItem(
    userId: string,
    listId: string,
    itemId: string,
  ): Promise<void> {
    const list = await this.getList(userId, listId);
    if (!list) {
      throw new Error('List not found');
    }

    const updatedItems = list.items.map(item => {
      if (item.id === itemId) {
        const newIsChecked = !item.isChecked;
        const updatedItem: typeof item = {
          ...item,
          isChecked: newIsChecked,
        };
        // Only set checkedAt if checking the item, remove it if unchecking
        if (newIsChecked) {
          updatedItem.checkedAt = new Date();
        } else {
          delete updatedItem.checkedAt;
        }
        return updatedItem;
      }
      return item;
    });

    await firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc(listId)
      .update({
        items: updatedItems,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(
    userId: string,
    listId: string,
    itemId: string,
    quantity: number,
  ): Promise<void> {
    const list = await this.getList(userId, listId);
    if (!list) {
      throw new Error('List not found');
    }

    const updatedItems = list.items.map(item => {
      if (item.id === itemId) {
        return {...item, quantity};
      }
      return item;
    });

    await firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc(listId)
      .update({
        items: updatedItems,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Get price data for an item
   */
  private async getItemPriceData(nameNormalized: string): Promise<{
    bestPrice: number;
    bestStore: string;
    averagePrice: number;
  } | null> {
    const snapshot = await firestore()
      .collection(PRICES_COLLECTION)
      .where('productNameNormalized', '==', nameNormalized)
      .orderBy('recordedAt', 'desc')
      .limit(20)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const prices = snapshot.docs.map(doc => ({
      price: doc.data().price as number,
      storeName: doc.data().storeName as string,
    }));

    const bestPrice = Math.min(...prices.map(p => p.price));
    const bestStore = prices.find(p => p.price === bestPrice)!.storeName;
    const averagePrice =
      prices.reduce((sum, p) => sum + p.price, 0) / prices.length;

    return {bestPrice, bestStore, averagePrice};
  }

  /**
   * Optimize shopping list - find best prices
   */
  async optimizeList(
    userId: string,
    listId: string,
  ): Promise<OptimizationResult | null> {
    const list = await this.getList(userId, listId);
    if (!list || list.items.length === 0) {
      return null;
    }

    // Get prices for all items
    const itemPrices = await Promise.all(
      list.items.map(async item => {
        const snapshot = await firestore()
          .collection(PRICES_COLLECTION)
          .where('productNameNormalized', '==', item.nameNormalized)
          .orderBy('recordedAt', 'desc')
          .limit(10)
          .get();

        const prices = snapshot.docs.map(doc => ({
          storeName: doc.data().storeName as string,
          storeNameNormalized: doc.data().storeNameNormalized as string,
          price: doc.data().price as number,
        }));

        return {
          item: item.name,
          nameNormalized: item.nameNormalized,
          quantity: item.quantity,
          prices,
        };
      }),
    );

    // Build store-item matrix
    const storeItems: Map<
      string,
      {
        storeName: string;
        items: {name: string; price: number; quantity: number}[];
        total: number;
      }
    > = new Map();

    itemPrices.forEach(({item, quantity, prices}) => {
      prices.forEach(({storeName, storeNameNormalized, price}) => {
        if (!storeItems.has(storeNameNormalized)) {
          storeItems.set(storeNameNormalized, {
            storeName,
            items: [],
            total: 0,
          });
        }

        const store = storeItems.get(storeNameNormalized)!;
        store.items.push({name: item, price, quantity});
        store.total += price * quantity;
      });
    });

    // Single store strategy - find store with most items at best total
    let bestSingleStore = '';
    let bestSingleTotal = Infinity;
    const singleStorePrices: {item: string; price: number}[] = [];

    storeItems.forEach((store, key) => {
      if (
        store.items.length >= list.items.length * 0.7 &&
        store.total < bestSingleTotal
      ) {
        bestSingleStore = store.storeName;
        bestSingleTotal = store.total;
      }
    });

    // Multi-store strategy - best price for each item
    const multiStoreMap: Map<string, StoreRecommendation> = new Map();
    let multiStoreTotal = 0;

    itemPrices.forEach(({item, nameNormalized, quantity, prices}) => {
      if (prices.length === 0) {
        return;
      }

      const best = prices.reduce((a, b) => (a.price < b.price ? a : b));
      multiStoreTotal += best.price * quantity;

      const storeKey = best.storeNameNormalized;
      if (!multiStoreMap.has(storeKey)) {
        multiStoreMap.set(storeKey, {
          storeName: best.storeName,
          storeNameNormalized: storeKey,
          itemCount: 0,
          totalPrice: 0,
          items: [],
          isBestOverall: false,
        });
      }

      const rec = multiStoreMap.get(storeKey)!;
      rec.itemCount++;
      rec.totalPrice += best.price * quantity;
      rec.items.push(item);
    });

    const multiStoreRecommendations = Array.from(multiStoreMap.values());

    // Determine recommendation
    const singleStoreSavings = bestSingleTotal - multiStoreTotal;
    const isMultiWorthIt =
      singleStoreSavings > 5 && multiStoreRecommendations.length <= 3;

    // Calculate totals
    let totalEstimated = 0;
    list.items.forEach(item => {
      totalEstimated += (item.estimatedPrice || 0) * item.quantity;
    });

    const potentialSavings = totalEstimated - multiStoreTotal;

    // Update list with optimization data
    const updateData: any = {
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    
    // Only add fields if they have valid values (not undefined)
    if (totalEstimated !== undefined && !isNaN(totalEstimated)) {
      updateData.totalEstimated = totalEstimated;
    }
    if (multiStoreTotal !== undefined && !isNaN(multiStoreTotal)) {
      updateData.totalOptimized = multiStoreTotal;
    }
    if (potentialSavings !== undefined && !isNaN(potentialSavings)) {
      updateData.potentialSavings = Math.max(0, potentialSavings);
    }
    if (multiStoreRecommendations && multiStoreRecommendations.length > 0) {
      updateData.optimizedStores = multiStoreRecommendations;
    }
    
    await firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc(listId)
      .update(updateData);

    return {
      singleStoreStrategy: {
        bestStore: bestSingleStore || 'Non trouvé',
        totalPrice: bestSingleTotal === Infinity ? 0 : bestSingleTotal,
        itemPrices: singleStorePrices,
      },
      multiStoreStrategy: {
        stores: multiStoreRecommendations,
        totalPrice: multiStoreTotal,
        savings: Math.max(0, bestSingleTotal - multiStoreTotal),
      },
      recommendation: isMultiWorthIt ? 'multi' : 'single',
      reasonFr: isMultiWorthIt
        ? `Économisez $${singleStoreSavings.toFixed(2)} en visitant ${
            multiStoreRecommendations.length
          } magasins`
        : `Achetez tout chez ${bestSingleStore} pour plus de commodité`,
      reasonLingala: isMultiWorthIt
        ? `Bobatela $${singleStoreSavings.toFixed(2)} soki okei na magazini ${
            multiStoreRecommendations.length
          }`
        : `Somba nyonso na ${bestSingleStore}`,
    };
  }

  /**
   * Delete a shopping list
   */
  async deleteList(userId: string, listId: string): Promise<void> {
    await firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc(listId)
      .delete();
  }

  /**
   * Archive a completed list
   */
  async completeList(userId: string, listId: string): Promise<void> {
    await firestore()
      .collection(SHOPPING_LISTS_COLLECTION(userId))
      .doc(listId)
      .update({
        isActive: false,
        completedAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Create list from recent receipt
   */
  async createFromReceipt(
    userId: string,
    receiptId: string,
    listName: string,
  ): Promise<ShoppingList> {
    // Get receipt
    const receiptDoc = await firestore()
      .doc(`artifacts/${APP_ID}/users/${userId}/receipts/${receiptId}`)
      .get();

    if (!receiptDoc.exists) {
      throw new Error('Receipt not found');
    }

    const receipt = receiptDoc.data()!;

    // Convert receipt items to shopping list items
    const items: Partial<ShoppingListItem>[] = receipt.items.map(
      (item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
      }),
    );

    return this.createList(userId, listName, items);
  }

  /**
   * Get quick suggestions based on history
   */
  async getQuickSuggestions(userId: string, limit = 10): Promise<string[]> {
    try {
      // Get recent receipts to find frequently bought items
      const receiptsSnapshot = await firestore()
        .collection(`artifacts/${APP_ID}/users/${userId}/receipts`)
        .orderBy('date', 'desc')
        .limit(20)
        .get();

      const itemCounts: Map<string, number> = new Map();

      receiptsSnapshot.docs.forEach(doc => {
        const items = doc.data().items || [];
        items.forEach((item: any) => {
          const name = item.name;
          itemCounts.set(name, (itemCounts.get(name) || 0) + 1);
        });
      });

      // Sort by frequency
      const sorted = Array.from(itemCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name]) => name);

      return sorted;
    } catch (error) {
      console.error('[ShoppingList] Get suggestions error:', error);
      return [];
    }
  }
}

export const shoppingListService = new ShoppingListService();
