/**
 * Spotlight Search Service
 * 
 * Indexes receipts, items, and shops for device search (iOS Spotlight / Android App Search).
 * Allows users to find their receipts directly from the device search.
 */

import {Platform} from 'react-native';

// Types for search items
export interface SearchableReceipt {
  id: string;
  shopName: string;
  date: Date;
  total: number;
  itemCount: number;
  thumbnailUrl?: string;
}

export interface SearchableItem {
  id: string;
  name: string;
  price: number;
  shopName: string;
  category?: string;
}

export interface SearchableShop {
  id: string;
  name: string;
  visitCount: number;
  lastVisited?: Date;
}

// Search item types for indexing
type SearchItemType = 'receipt' | 'item' | 'shop';

interface IndexedItem {
  uniqueIdentifier: string;
  title: string;
  contentDescription: string;
  keywords: string[];
  thumbnailUri?: string;
  domain?: string;
}

// Lazy load the search API to avoid crashes if not available
let SearchApi: any = null;

const loadSearchApi = async (): Promise<boolean> => {
  if (SearchApi !== null) {
    return SearchApi !== false;
  }
  
  try {
    SearchApi = require('react-native-search-api').default;
    return true;
  } catch (error) {
    console.log('Spotlight Search: react-native-search-api not available');
    SearchApi = false;
    return false;
  }
};

class SpotlightSearchService {
  private isAvailable: boolean = false;
  private indexedReceiptIds: Set<string> = new Set();
  private indexedItemIds: Set<string> = new Set();
  private indexedShopIds: Set<string> = new Set();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the search service
   */
  async initialize(): Promise<void> {
    this.isAvailable = await loadSearchApi();
    
    if (this.isAvailable && SearchApi) {
      // Set up listener for search result selections only if the method exists
      if (typeof SearchApi.addOnSpotlightItemPressedListener === 'function') {
        SearchApi.addOnSpotlightItemPressedListener(this.handleSearchItemPressed);
        console.log('Spotlight Search: Initialized successfully');
      } else {
        console.log('Spotlight Search: API loaded but listener not available');
      }
    }
  }

  /**
   * Handle when user taps a search result
   */
  private handleSearchItemPressed = (uniqueIdentifier: string): void => {
    console.log('Spotlight Search: Item pressed -', uniqueIdentifier);
    
    // Parse the identifier to determine type and ID
    const [type, id] = uniqueIdentifier.split(':');
    
    // Emit an event or store for navigation handling
    // The app can listen to this and navigate accordingly
    if (this.onItemPressed) {
      this.onItemPressed(type as SearchItemType, id);
    }
  };

  // Callback for item press - set by the app
  public onItemPressed?: (type: SearchItemType, id: string) => void;

  /**
   * Index a receipt for search
   */
  async indexReceipt(receipt: SearchableReceipt): Promise<void> {
    if (!this.isAvailable || !SearchApi) return;
    if (this.indexedReceiptIds.has(receipt.id)) return;

    try {
      const item: IndexedItem = {
        uniqueIdentifier: `receipt:${receipt.id}`,
        title: `${receipt.shopName} - ${this.formatCurrency(receipt.total)}`,
        contentDescription: `${receipt.itemCount} articles • ${this.formatDate(receipt.date)}`,
        keywords: [
          receipt.shopName.toLowerCase(),
          'facture',
          'receipt',
          'ticket',
          this.formatDate(receipt.date),
        ],
        domain: 'com.goshopperai.receipts',
      };

      if (receipt.thumbnailUrl) {
        item.thumbnailUri = receipt.thumbnailUrl;
      }

      await SearchApi.indexSpotlightItem(item);
      this.indexedReceiptIds.add(receipt.id);
      console.log('Spotlight Search: Indexed receipt -', receipt.shopName);
    } catch (error) {
      console.error('Spotlight Search: Failed to index receipt', error);
    }
  }

  /**
   * Index multiple receipts
   */
  async indexReceipts(receipts: SearchableReceipt[]): Promise<void> {
    if (!this.isAvailable) return;
    
    for (const receipt of receipts) {
      await this.indexReceipt(receipt);
    }
  }

  /**
   * Index an item for search
   */
  async indexItem(item: SearchableItem): Promise<void> {
    if (!this.isAvailable || !SearchApi) return;
    if (this.indexedItemIds.has(item.id)) return;

    try {
      const searchItem: IndexedItem = {
        uniqueIdentifier: `item:${item.id}`,
        title: item.name,
        contentDescription: `${this.formatCurrency(item.price)} chez ${item.shopName}`,
        keywords: [
          item.name.toLowerCase(),
          item.shopName.toLowerCase(),
          item.category?.toLowerCase() || '',
          'article',
          'produit',
        ].filter(Boolean),
        domain: 'com.goshopperai.items',
      };

      await SearchApi.indexSpotlightItem(searchItem);
      this.indexedItemIds.add(item.id);
    } catch (error) {
      console.error('Spotlight Search: Failed to index item', error);
    }
  }

  /**
   * Index a shop for search
   */
  async indexShop(shop: SearchableShop): Promise<void> {
    if (!this.isAvailable || !SearchApi) return;
    if (this.indexedShopIds.has(shop.id)) return;

    try {
      const searchItem: IndexedItem = {
        uniqueIdentifier: `shop:${shop.id}`,
        title: shop.name,
        contentDescription: `${shop.visitCount} visite${shop.visitCount > 1 ? 's' : ''}`,
        keywords: [
          shop.name.toLowerCase(),
          'magasin',
          'boutique',
          'shop',
        ],
        domain: 'com.goshopperai.shops',
      };

      await SearchApi.indexSpotlightItem(searchItem);
      this.indexedShopIds.add(shop.id);
    } catch (error) {
      console.error('Spotlight Search: Failed to index shop', error);
    }
  }

  /**
   * Remove a receipt from search index
   */
  async removeReceipt(receiptId: string): Promise<void> {
    if (!this.isAvailable || !SearchApi) return;

    try {
      if (typeof SearchApi.deleteSpotlightItem === 'function') {
        await SearchApi.deleteSpotlightItem(`receipt:${receiptId}`);
      }
      this.indexedReceiptIds.delete(receiptId);
    } catch (error) {
      console.error('Spotlight Search: Failed to remove receipt', error);
    }
  }

  /**
   * Remove an item from search index
   */
  async removeItem(itemId: string): Promise<void> {
    if (!this.isAvailable || !SearchApi) return;

    try {
      if (typeof SearchApi.deleteSpotlightItem === 'function') {
        await SearchApi.deleteSpotlightItem(`item:${itemId}`);
      }
      this.indexedItemIds.delete(itemId);
    } catch (error) {
      console.error('Spotlight Search: Failed to remove item', error);
    }
  }

  /**
   * Remove a shop from search index
   */
  async removeShop(shopId: string): Promise<void> {
    if (!this.isAvailable || !SearchApi) return;

    try {
      if (typeof SearchApi.deleteSpotlightItem === 'function') {
        await SearchApi.deleteSpotlightItem(`shop:${shopId}`);
      }
      this.indexedShopIds.delete(shopId);
    } catch (error) {
      console.error('Spotlight Search: Failed to remove shop', error);
    }
  }

  /**
   * Clear all indexed items by domain
   */
  async clearAllReceipts(): Promise<void> {
    if (!this.isAvailable || !SearchApi) return;

    try {
      if (typeof SearchApi.deleteAllSpotlightItems === 'function') {
        await SearchApi.deleteAllSpotlightItems();
      }
      this.indexedReceiptIds.clear();
      this.indexedItemIds.clear();
      this.indexedShopIds.clear();
      console.log('Spotlight Search: Cleared all indexed items');
    } catch (error) {
      console.error('Spotlight Search: Failed to clear index', error);
    }
  }

  /**
   * Check if search indexing is available
   */
  isSearchAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Get count of indexed items
   */
  getIndexedCounts(): {receipts: number; items: number; shops: number} {
    return {
      receipts: this.indexedReceiptIds.size,
      items: this.indexedItemIds.size,
      shops: this.indexedShopIds.size,
    };
  }

  // Helper functions
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}

export const spotlightSearchService = new SpotlightSearchService();
