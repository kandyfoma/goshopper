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
  currency: 'USD' | 'CDF' = 'USD',
): string {
  if (amount == null || isNaN(amount)) {
    return currency === 'CDF' ? '0 FC' : '$0.00';
  }
  
  if (currency === 'CDF') {
    return `${Math.round(amount).toLocaleString('fr-CD')} FC`;
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * Currency conversion rate (USD to CDF)
 * Update this periodically based on current exchange rate
 */
export const USD_TO_CDF_RATE = 2200; // 1 USD = 2,200 CDF (Dec 2025)

/**
 * Convert between USD and CDF
 */
export function convertCurrency(
  amount: number,
  fromCurrency: 'USD' | 'CDF',
  toCurrency: 'USD' | 'CDF',
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  if (fromCurrency === 'USD' && toCurrency === 'CDF') {
    return Math.round(amount * USD_TO_CDF_RATE);
  }
  
  if (fromCurrency === 'CDF' && toCurrency === 'USD') {
    return Math.round((amount / USD_TO_CDF_RATE) * 100) / 100;
  }
  
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
