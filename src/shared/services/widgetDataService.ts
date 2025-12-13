/**
 * Widget Data Service
 * 
 * Manages data for widgets using AsyncStorage.
 * Native widget communication can be added later via native modules.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for widget data
export interface WidgetSpendingData {
  monthlyTotal: number;
  monthlyBudget: number;
  currency: string;
  lastUpdated: string;
  percentUsed: number;
}

export interface WidgetQuickStats {
  totalReceipts: number;
  totalSaved: number;
  lastScanDate: string | null;
  favoriteStore: string | null;
}

export interface WidgetShoppingList {
  items: Array<{
    id: string;
    name: string;
    checked: boolean;
  }>;
  totalItems: number;
  checkedItems: number;
}

// Widget data keys
const WIDGET_KEYS = {
  SPENDING: '@widget_spending_data',
  QUICK_STATS: '@widget_quick_stats',
  SHOPPING_LIST: '@widget_shopping_list',
};

class WidgetDataService {
  /**
   * Initialize the widget data service
   */
  async initialize(): Promise<void> {
    // No initialization needed for AsyncStorage
  }

  /**
   * Check if widget data sharing is available
   */
  isWidgetDataAvailable(): boolean {
    return true;
  }

  /**
   * Save data to storage
   */
  private async saveData(key: string, data: any): Promise<void> {
    try {
      const jsonData = JSON.stringify(data);
      await AsyncStorage.setItem(key, jsonData);
    } catch (error) {
      // Silently fail - widget data is not critical
    }
  }

  /**
   * Read data from storage
   */
  private async getData<T>(key: string): Promise<T | null> {
    try {
      const jsonData = await AsyncStorage.getItem(key);
      if (jsonData) {
        return JSON.parse(jsonData) as T;
      }
    } catch (error) {
      // Silently fail
    }
    return null;
  }

  /**
   * Update spending widget data
   */
  async updateSpendingWidget(data: WidgetSpendingData): Promise<void> {
    await this.saveData(WIDGET_KEYS.SPENDING, {
      ...data,
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Update quick stats widget data
   */
  async updateQuickStatsWidget(data: WidgetQuickStats): Promise<void> {
    await this.saveData(WIDGET_KEYS.QUICK_STATS, {
      ...data,
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Update shopping list widget data
   */
  async updateShoppingListWidget(data: WidgetShoppingList): Promise<void> {
    await this.saveData(WIDGET_KEYS.SHOPPING_LIST, data);
  }

  /**
   * Get spending widget data
   */
  async getSpendingWidgetData(): Promise<WidgetSpendingData | null> {
    return this.getData<WidgetSpendingData>(WIDGET_KEYS.SPENDING);
  }

  /**
   * Get quick stats widget data
   */
  async getQuickStatsWidgetData(): Promise<WidgetQuickStats | null> {
    return this.getData<WidgetQuickStats>(WIDGET_KEYS.QUICK_STATS);
  }

  /**
   * Get shopping list widget data
   */
  async getShoppingListWidgetData(): Promise<WidgetShoppingList | null> {
    return this.getData<WidgetShoppingList>(WIDGET_KEYS.SHOPPING_LIST);
  }

  /**
   * Update all widget data at once
   */
  async updateAllWidgets(data: {
    spending?: WidgetSpendingData;
    quickStats?: WidgetQuickStats;
    shoppingList?: WidgetShoppingList;
  }): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (data.spending) {
      promises.push(this.saveData(WIDGET_KEYS.SPENDING, data.spending));
    }
    if (data.quickStats) {
      promises.push(this.saveData(WIDGET_KEYS.QUICK_STATS, data.quickStats));
    }
    if (data.shoppingList) {
      promises.push(this.saveData(WIDGET_KEYS.SHOPPING_LIST, data.shoppingList));
    }
    
    await Promise.all(promises);
  }

  /**
   * Clear all widget data
   */
  async clearAllWidgetData(): Promise<void> {
    try {
      const keys = Object.values(WIDGET_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      // Silently fail
    }
  }
}

export const widgetDataService = new WidgetDataService();
