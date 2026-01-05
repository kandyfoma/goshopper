// Global Settings Service
// Manages app-wide configurable settings like exchange rates

import firestore from '@react-native-firebase/firestore';
import {firebaseFirestore, APP_ID} from '@/shared/services/firebase/config';
import {safeToDate, setExchangeRate as setHelperExchangeRate} from '@/shared/utils/helpers';

export interface ExchangeRateSettings {
  usdToCdf: number; // Exchange rate: 1 USD = X CDF
  lastUpdated: Date;
  updatedBy?: string; // User ID who last updated
}

export interface GlobalSettings {
  exchangeRates: ExchangeRateSettings;
  // Add other global settings here as needed
}

// Default settings - Updated to current rate (Jan 2026)
const DEFAULT_EXCHANGE_RATE = 2800; // 1 USD = 2,800 CDF (Jan 2026)

const DEFAULT_SETTINGS: GlobalSettings = {
  exchangeRates: {
    usdToCdf: DEFAULT_EXCHANGE_RATE,
    lastUpdated: new Date(),
  },
};

class GlobalSettingsService {
  private settings: GlobalSettings = DEFAULT_SETTINGS;
  private listeners: ((settings: GlobalSettings) => void)[] = [];
  private unsubscribeFirestore?: () => void;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Set up real-time listener for global settings
    const settingsRef = firebaseFirestore()
      .collection('config')
      .doc('globalSettings');

    this.unsubscribeFirestore = settingsRef.onSnapshot(
      (docSnapshot) => {
        if (docSnapshot.exists) {
          const data = docSnapshot.data();
          const rate = data?.exchangeRates?.usdToCdf || DEFAULT_EXCHANGE_RATE;
          this.settings = {
            exchangeRates: {
              usdToCdf: rate,
              lastUpdated: safeToDate(data?.exchangeRates?.lastUpdated),
              updatedBy: data?.exchangeRates?.updatedBy,
            },
          };
          // Sync exchange rate to helpers.ts for convertCurrency function
          setHelperExchangeRate(rate);
        } else {
          // Settings don't exist in Firestore - use in-memory defaults
          // (Only admins/Cloud Functions can create config documents)
          console.log('Global settings not found in Firestore, using defaults');
          this.settings = DEFAULT_SETTINGS;
          setHelperExchangeRate(DEFAULT_EXCHANGE_RATE);
        }

        // Notify all listeners
        this.listeners.forEach(listener => listener(this.settings));
      },
      (error) => {
        console.error('Error listening to global settings:', error);
        // Fall back to defaults on error
        this.listeners.forEach(listener => listener(DEFAULT_SETTINGS));
      }
    );
  }

  // Get current exchange rate
  getExchangeRate(): number {
    return this.settings.exchangeRates.usdToCdf;
  }

  // Convert USD to CDF
  usdToCdf(usdAmount: number): number {
    return usdAmount * this.settings.exchangeRates.usdToCdf;
  }

  // Convert CDF to USD
  cdfToUsd(cdfAmount: number): number {
    return cdfAmount / this.settings.exchangeRates.usdToCdf;
  }

  // Subscribe to settings changes
  subscribe(callback: (settings: GlobalSettings) => void): () => void {
    this.listeners.push(callback);

    // Immediately call with current settings
    callback(this.settings);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Update exchange rate (admin function)
  async updateExchangeRate(newRate: number, updatedBy?: string): Promise<void> {
    try {
      const settingsRef = firebaseFirestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('public')
        .doc('data')
        .collection('settings')
        .doc('global');

      await settingsRef.set({
        exchangeRates: {
          usdToCdf: newRate,
          lastUpdated: new Date(),
          updatedBy,
        },
      }, {merge: true});
    } catch (error) {
      console.error('Error updating exchange rate:', error);
      throw error;
    }
  }

  // Cleanup
  destroy() {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
    }
    this.listeners = [];
  }
}

// Export singleton instance
export const globalSettingsService = new GlobalSettingsService();