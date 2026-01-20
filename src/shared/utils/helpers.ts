// Utility helper functions

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format currency for display
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'USD',
): string {
  if (amount == null || isNaN(amount)) {
    return currency === 'CDF' ? '0 FC' : '$0.00';
  }
  
  // Common currency symbols and formatting rules
  const currencyConfig: Record<string, { symbol: string; decimals: number; position: 'before' | 'after' }> = {
    // Major currencies
    'USD': { symbol: '$', decimals: 2, position: 'before' },
    'EUR': { symbol: '€', decimals: 2, position: 'after' },
    'GBP': { symbol: '£', decimals: 2, position: 'before' },
    'INR': { symbol: '₹', decimals: 2, position: 'before' },
    'ZAR': { symbol: 'R ', decimals: 2, position: 'before' },
    'CDF': { symbol: ' FC', decimals: 0, position: 'after' },
    
    // Other common currencies
    'JPY': { symbol: '¥', decimals: 0, position: 'before' },
    'CNY': { symbol: '¥', decimals: 2, position: 'before' },
    'KRW': { symbol: '₩', decimals: 0, position: 'before' },
    'AUD': { symbol: 'A$', decimals: 2, position: 'before' },
    'CAD': { symbol: 'C$', decimals: 2, position: 'before' },
    'NGN': { symbol: '₦', decimals: 2, position: 'before' },
    'KES': { symbol: 'KSh ', decimals: 2, position: 'before' },
    'GHS': { symbol: 'GH₵', decimals: 2, position: 'after' },
    'TZS': { symbol: 'TSh ', decimals: 2, position: 'before' },
    'UGX': { symbol: 'USh ', decimals: 0, position: 'before' },
    'XAF': { symbol: 'FCFA ', decimals: 0, position: 'after' },
    'XOF': { symbol: 'CFA ', decimals: 0, position: 'after' },
  };
  
  const config = currencyConfig[currency.toUpperCase()];
  
  if (config) {
    const formattedAmount = amount.toFixed(config.decimals);
    return config.position === 'before' 
      ? `${config.symbol}${formattedAmount}`
      : `${formattedAmount}${config.symbol}`;
  }
  
  // Fallback for unknown currencies: show amount with currency code
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * Currency conversion rate (USD to CDF)
 * Default rate - will be overridden by globalSettingsService when available
 */
export let USD_TO_CDF_RATE = 2800; // 1 USD = 2,800 CDF (Jan 2026) - updated default

/**
 * Update the exchange rate (called by globalSettingsService)
 */
export function setExchangeRate(rate: number): void {
  if (rate > 0) {
    USD_TO_CDF_RATE = rate;
  }
}

/**
 * Get current exchange rate
 */
export function getExchangeRate(): number {
  return USD_TO_CDF_RATE;
}

/**
 * Convert between currencies (currently supports USD ↔ CDF conversions)
 * For international currencies, this only handles USD/CDF conversions
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  customRate?: number,
): number {
  // Only handle USD ↔ CDF conversions for now
  if ((fromCurrency === 'USD' && toCurrency === 'CDF') || 
      (fromCurrency === 'CDF' && toCurrency === 'USD')) {
    const rate = customRate || USD_TO_CDF_RATE;
    
    if (fromCurrency === 'USD' && toCurrency === 'CDF') {
      return Math.round(amount * rate);
    }
    
    if (fromCurrency === 'CDF' && toCurrency === 'USD') {
      return Math.round((amount / rate) * 100) / 100;
    }
  }
  
  // For same currency or unsupported conversions, return original amount
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  // For unsupported currency pairs, return original amount
  // TODO: Add support for international currency conversions with real-time rates
  console.warn(`Currency conversion from ${fromCurrency} to ${toCurrency} not supported yet`);
  return amount;
}

/**
 * Format date for display (French locale)
 */
export function formatDate(
  date: Date | string,
  format: 'short' | 'long' = 'short',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Check if the date is invalid or epoch (1970)
  if (!d || isNaN(d.getTime()) || d.getTime() === 0) {
    const today = new Date();
    return today.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  if (format === 'long') {
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format relative time (e.g., "il y a 2 heures")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "À l'instant";
  }
  if (diffMins < 60) {
    return `Il y a ${diffMins} min`;
  }
  if (diffHours < 24) {
    return `Il y a ${diffHours}h`;
  }
  if (diffDays < 7) {
    return `Il y a ${diffDays}j`;
  }

  return formatDate(d);
}

/**
 * Calculate percentage difference
 */
export function calculatePercentageDiff(
  currentPrice: number,
  comparePrice: number,
): number {
  if (comparePrice === 0) {
    return 0;
  }
  return ((currentPrice - comparePrice) / comparePrice) * 100;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalizeFirst(text: string): string {
  if (!text) {
    return '';
  }
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Sleep/delay function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if value is empty (null, undefined, empty string, empty array/object)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Safely convert Firestore timestamp or other date formats to Date
 * Handles: Firestore Timestamp, serialized timestamps from Cloud Functions, Date objects, strings, numbers
 */
export function safeToDate(value: any): Date {
  if (!value) {
    return new Date();
  }

  // Firestore Timestamp with toDate method
  if (value.toDate && typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch (error) {
      return new Date();
    }
  }

  // Serialized Firestore timestamp (from Cloud Functions response)
  if (value._type === 'timestamp' || value._seconds !== undefined) {
    try {
      const seconds = value._seconds || value.seconds || 0;
      const nanoseconds = value._nanoseconds || value.nanoseconds || 0;
      // Only convert if seconds is valid (not 0 or undefined)
      if (seconds > 0) {
        return new Date(seconds * 1000 + nanoseconds / 1000000);
      }
    } catch (error) {
      return new Date();
    }
  }

  // Firestore Timestamp-like object with seconds/nanoseconds
  if (typeof value.seconds === 'number' && value.seconds > 0) {
    try {
      return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    } catch (error) {
      return new Date();
    }
  }

  // Already a Date object
  if (value instanceof Date) {
    return value;
  }

  // String or number
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Fallback
  return new Date();
}

/**
 * Get currency code based on country code
 * Maps country codes to their primary currencies
 */
export function getCurrencyForCountry(countryCode: string): string {
  const currencyMap: Record<string, string> = {
    // Africa
    'CD': 'CDF', // Democratic Republic of Congo
    'CG': 'XAF', // Republic of Congo
    'CM': 'XAF', // Cameroon
    'CI': 'XOF', // Côte d'Ivoire
    'SN': 'XOF', // Senegal
    'BF': 'XOF', // Burkina Faso
    'ML': 'XOF', // Mali
    'NE': 'XOF', // Niger
    'TG': 'XOF', // Togo
    'BJ': 'XOF', // Benin
    'GA': 'XAF', // Gabon
    'TD': 'XAF', // Chad
    'CF': 'XAF', // Central African Republic
    'GQ': 'XAF', // Equatorial Guinea
    'NG': 'NGN', // Nigeria
    'KE': 'KES', // Kenya
    'TZ': 'TZS', // Tanzania
    'UG': 'UGX', // Uganda
    'GH': 'GHS', // Ghana
    'ZA': 'ZAR', // South Africa
    'EG': 'EGP', // Egypt
    'MA': 'MAD', // Morocco
    'TN': 'TND', // Tunisia
    'DZ': 'DZD', // Algeria
    
    // Europe
    'FR': 'EUR', // France
    'DE': 'EUR', // Germany
    'IT': 'EUR', // Italy
    'ES': 'EUR', // Spain
    'NL': 'EUR', // Netherlands
    'BE': 'EUR', // Belgium
    'AT': 'EUR', // Austria
    'PT': 'EUR', // Portugal
    'FI': 'EUR', // Finland
    'IE': 'EUR', // Ireland
    'LU': 'EUR', // Luxembourg
    'MT': 'EUR', // Malta
    'CY': 'EUR', // Cyprus
    'SK': 'EUR', // Slovakia
    'SI': 'EUR', // Slovenia
    'EE': 'EUR', // Estonia
    'LV': 'EUR', // Latvia
    'LT': 'EUR', // Lithuania
    'GR': 'EUR', // Greece
    'GB': 'GBP', // United Kingdom
    'CH': 'CHF', // Switzerland
    'NO': 'NOK', // Norway
    'SE': 'SEK', // Sweden
    'DK': 'DKK', // Denmark
    'PL': 'PLN', // Poland
    'CZ': 'CZK', // Czech Republic
    'HU': 'HUF', // Hungary
    'RO': 'RON', // Romania
    'BG': 'BGN', // Bulgaria
    'HR': 'HRK', // Croatia
    'RS': 'RSD', // Serbia
    
    // Americas
    'US': 'USD', // United States
    'CA': 'CAD', // Canada
    'MX': 'MXN', // Mexico
    'BR': 'BRL', // Brazil
    'AR': 'ARS', // Argentina
    'CL': 'CLP', // Chile
    'CO': 'COP', // Colombia
    'PE': 'PEN', // Peru
    
    // Asia
    'IN': 'INR', // India
    'JP': 'JPY', // Japan
    'CN': 'CNY', // China
    'KR': 'KRW', // South Korea
    'SG': 'SGD', // Singapore
    'MY': 'MYR', // Malaysia
    'TH': 'THB', // Thailand
    'ID': 'IDR', // Indonesia
    'PH': 'PHP', // Philippines
    'VN': 'VND', // Vietnam
    'PK': 'PKR', // Pakistan
    'BD': 'BDT', // Bangladesh
    'LK': 'LKR', // Sri Lanka
    
    // Middle East
    'AE': 'AED', // United Arab Emirates
    'SA': 'SAR', // Saudi Arabia
    'QA': 'QAR', // Qatar
    'KW': 'KWD', // Kuwait
    'BH': 'BHD', // Bahrain
    'OM': 'OMR', // Oman
    'JO': 'JOD', // Jordan
    'LB': 'LBP', // Lebanon
    'IL': 'ILS', // Israel
    'TR': 'TRY', // Turkey
    'IR': 'IRR', // Iran
    
    // Oceania
    'AU': 'AUD', // Australia
    'NZ': 'NZD', // New Zealand
  };
  
  return currencyMap[countryCode.toUpperCase()] || 'USD';
}

/**
 * Detect country code from phone number
 */
export function detectCountryCodeFromPhone(phoneNumber: string): string | null {
  if (!phoneNumber.startsWith('+')) return null;
  
  const match = phoneNumber.match(/^\+(\d{1,4})/);
  if (!match) return null;
  
  const code = match[1];
  
  // Country code to country mapping
  const phoneCodeMap: Record<string, string> = {
    // Africa
    '243': 'CD', // DRC
    '27': 'ZA', // South Africa
    '234': 'NG', // Nigeria
    '254': 'KE', // Kenya
    '255': 'TZ', // Tanzania
    '256': 'UG', // Uganda
    '233': 'GH', // Ghana
    '225': 'CI', // Côte d'Ivoire
    '237': 'CM', // Cameroon
    '235': 'TD', // Chad
    '236': 'CF', // Central African Republic
    '240': 'GQ', // Equatorial Guinea
    '241': 'GA', // Gabon
    '242': 'CG', // Republic of Congo
    '223': 'ML', // Mali
    '227': 'NE', // Niger
    '228': 'TG', // Togo
    '229': 'BJ', // Benin
    '226': 'BF', // Burkina Faso
    '221': 'SN', // Senegal
    // Europe
    '33': 'FR', // France
    '49': 'DE', // Germany
    '39': 'IT', // Italy
    '34': 'ES', // Spain
    '31': 'NL', // Netherlands
    '32': 'BE', // Belgium
    '44': 'GB', // United Kingdom
    '41': 'CH', // Switzerland
    // Americas
    '1': 'US', // United States/Canada
    '52': 'MX', // Mexico
    '55': 'BR', // Brazil
    '54': 'AR', // Argentina
    '56': 'CL', // Chile
    '57': 'CO', // Colombia
    // Asia
    '91': 'IN', // India
    '81': 'JP', // Japan
    '86': 'CN', // China
    '82': 'KR', // South Korea
    '65': 'SG', // Singapore
    '60': 'MY', // Malaysia
    '66': 'TH', // Thailand
    '62': 'ID', // Indonesia
    '63': 'PH', // Philippines
    '84': 'VN', // Vietnam
    '92': 'PK', // Pakistan
    '880': 'BD', // Bangladesh
    '94': 'LK', // Sri Lanka
    // Middle East
    '971': 'AE', // UAE
    '966': 'SA', // Saudi Arabia
    '974': 'QA', // Qatar
    '965': 'KW', // Kuwait
    '973': 'BH', // Bahrain
    '968': 'OM', // Oman
    '962': 'JO', // Jordan
    '961': 'LB', // Lebanon
    '972': 'IL', // Israel
    '90': 'TR', // Turkey
    '98': 'IR', // Iran
    // Oceania
    '61': 'AU', // Australia
    '64': 'NZ', // New Zealand
  };
  
  return phoneCodeMap[code] || null;
}
