// App-wide constants

// App Info
export const APP_NAME = 'GoShopper';
export const APP_VERSION = '1.0.0';

// Trial Configuration
export const TRIAL_DURATION_DAYS = 30; // 1 month free trial
export const TRIAL_EXTENSION_DAYS = 30; // 1 month extension available
export const TRIAL_SCAN_LIMIT = 50; // Limited scans during trial

// API Limits
export const RATE_LIMIT_PER_MINUTE = 10;
export const RATE_LIMIT_PER_DAY_FREE = 50;
export const RATE_LIMIT_PER_DAY_PREMIUM = 500;

// Usage Limits by Plan
export const PLAN_SCAN_LIMITS = {
  freemium: 3, // Free tier - auto-assigned monthly
  free: 10, // Trial limit
  basic: 25,
  standard: 100,
  premium: 1000, // 1000 scans per month
} as const;

// Image Limits
export const MAX_IMAGE_WIDTH = 2000;
export const MAX_IMAGE_HEIGHT = 2500;
export const IMAGE_QUALITY = 0.7;
export const THUMBNAIL_SIZE = 200;

// Currency
export const DEFAULT_CURRENCY = 'USD' as const;
export const CDF_TO_USD_RATE = 2700; // Approximate rate

// Subscription Plans
export const MONTHLY_PRICE_USD = 2.99;
export const MONTHLY_PRICE_CDF = 8000;
export const YEARLY_PRICE_USD = 24.99;
export const YEARLY_PRICE_CDF = 67000;

// Subscription Duration Options (in months)
export const SUBSCRIPTION_DURATIONS = {
  1: {label: '1 Month', labelFr: '1 Mois', discount: 0},
  3: {label: '3 Months', labelFr: '3 Mois', discount: 10},
  6: {label: '6 Months', labelFr: '6 Mois', discount: 20},
} as const;

// Calculate discounted price
export const calculateDiscountedPrice = (
  basePrice: number,
  months: 1 | 3 | 6,
): {total: number; monthly: number; savings: number} => {
  const duration = SUBSCRIPTION_DURATIONS[months];
  const originalTotal = basePrice * months;
  const discount = duration.discount / 100;
  const discountedTotal = originalTotal * (1 - discount);
  const savings = originalTotal - discountedTotal;
  const monthly = discountedTotal / months;

  return {
    total: Math.round(discountedTotal * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
    savings: Math.round(savings * 100) / 100,
  };
};

// Subscription Plans Object (for UI)
export const SUBSCRIPTION_PLANS = {
  freemium: {
    id: 'freemium',
    name: 'Gratuit',
    price: 0,
    priceCDF: 0,
    scanLimit: 3,
    features: [
      '3 scans par mois',
      'Reconnaissance IA basique',
      'Historique 7 jours',
      '1 liste de courses',
    ],
  },
  free: {
    id: 'free',
    name: 'Essai Gratuit',
    price: 0,
    priceCDF: 0,
    scanLimit: 10, // 10 scans during trial
    trialDays: 30,
    features: [
      '1 mois gratuit',
      "10 scans pendant l'essai",
      'Toutes les fonctionnalités premium',
    ],
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 1.99,
    priceCDF: 8000,
    scanLimit: 25,
    features: [
      '25 scans par mois',
      'Listes de courses',
      'Historique 30 jours',
      'Localisation française',
    ],
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    price: 2.99,
    priceCDF: 12000,
    scanLimit: 100,
    features: [
      '100 scans par mois',
      'Comparaison de prix',
      'Historique 2 mois',
      'Rapports de dépenses',
      'Historique des prix',
      'Analyse par catégorie',
      'Mode hors ligne',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 4.99,
    priceCDF: 20000,
    scanLimit: 1000,
    features: [
      '1,000 scans par mois',
      'Statistiques avancées',
      'Comparaison de prix',
      'Historique illimité',
      'Rapports de dépenses',
      'Historique des prix',
      'Analyse par catégorie',
      'Mode hors ligne',
      'Alertes de prix',
      'Listes de courses illimitées',
      'Export des données',
    ],
  },
} as const;

// Mobile Money Providers
export const MOBILE_MONEY_PROVIDERS = [
  {id: 'mpesa', name: 'M-Pesa', icon: 'phone'},
  {id: 'orange', name: 'Orange Money', icon: 'circle', color: '#FF7F00'},
  {id: 'airtel', name: 'Airtel Money', icon: 'circle', color: '#C1121F'},
  {id: 'afrimoney', name: 'AfriMoney', icon: 'heart', color: '#00A86B'},
] as const;

// UI Constants
export const SCREEN_PADDING = 16;
export const BORDER_RADIUS = 12;
export const ANIMATION_DURATION = 300;

// Colors (matching NativeWind/Tailwind)
export const COLORS = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // Main green
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#3b82f6',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: '@goshopperai:preferences',
  ONBOARDING_COMPLETE: '@goshopperai:onboarding',
  LAST_SYNC: '@goshopperai:last_sync',
  CACHED_PRICES: '@goshopperai:cached_prices',
} as const;

// Common DRC Store Names (for normalization)
export const KNOWN_STORES = [
  'Shoprite',
  'Carrefour',
  'Peloustore',
  'Hasson & Frères',
  'City Market',
  'Kin Marché',
  'Super U',
] as const;

// Product Categories (French for DRC)
export const CATEGORIES = {
  FOOD: 'Alimentation',
  BEVERAGES: 'Boissons',
  DAIRY: 'Produits laitiers',
  MEAT_FISH: 'Viandes & Poissons',
  FRUITS_VEG: 'Fruits & Légumes',
  GROCERY: 'Épicerie',
  HYGIENE: 'Hygiène',
  HOUSEHOLD: 'Ménage',
  BABY: 'Bébé',
  OTHER: 'Autres',
} as const;
