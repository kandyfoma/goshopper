// Safe Firestore Data Access Helpers
// Prevents crashes from null/undefined Firestore documents

import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

/**
 * Safely extracts data from a Firestore document
 * Returns null if document doesn't exist or has no data
 * 
 * @example
 * const userData = safeDocData(userDoc);
 * const name = userData?.name || 'Unknown';
 */
export function safeDocData<T = any>(
  doc: FirebaseFirestoreTypes.DocumentSnapshot
): T | null {
  if (!doc || !doc.exists) {
    return null;
  }

  try {
    const data = doc.data();
    return data as T | null;
  } catch (error) {
    console.error('Error extracting document data:', error);
    return null;
  }
}

/**
 * Safely gets a specific field from a Firestore document
 * Returns fallback value if field doesn't exist
 * 
 * @example
 * const storeName = safeDocField(receiptDoc, 'storeName', 'Unknown Store');
 */
export function safeDocField<T = any>(
  doc: FirebaseFirestoreTypes.DocumentSnapshot,
  fieldName: string,
  fallback: T
): T {
  const data = safeDocData(doc);
  if (!data) return fallback;

  const value = data[fieldName];
  return value !== undefined && value !== null ? value : fallback;
}

/**
 * Safely extracts data from multiple documents
 * Filters out documents that don't exist or have errors
 * 
 * @example
 * const receipts = safeQueryData(snapshot);
 */
export function safeQueryData<T = any>(
  snapshot: FirebaseFirestoreTypes.QuerySnapshot
): Array<T & { id: string }> {
  if (!snapshot || !snapshot.docs) {
    return [];
  }

  return snapshot.docs
    .map((doc: FirebaseFirestoreTypes.DocumentSnapshot) => {
      const data = safeDocData<T>(doc);
      if (!data) return null;

      return {
        ...data,
        id: doc.id,
      };
    })
    .filter((item: any): item is T & { id: string } => item !== null);
}

/**
 * Safely checks if a document exists before accessing data
 * Throws descriptive error if document doesn't exist
 * 
 * @example
 * const userData = requireDocData(userDoc, 'User profile');
 */
export function requireDocData<T = any>(
  doc: FirebaseFirestoreTypes.DocumentSnapshot,
  documentName: string = 'Document'
): T {
  if (!doc) {
    throw new Error(`${documentName} snapshot is null or undefined`);
  }

  if (!doc.exists) {
    throw new Error(`${documentName} does not exist`);
  }

  const data = doc.data();
  if (!data) {
    throw new Error(`${documentName} has no data`);
  }

  return data as T;
}

/**
 * Safely accesses nested Firestore data with type safety
 * 
 * @example
 * const price = safeNestedField(data, ['receipt', 'items', 0, 'price'], 0);
 */
export function safeNestedField<T = any>(
  obj: any,
  path: Array<string | number>,
  fallback: T
): T {
  try {
    let current = obj;

    for (const key of path) {
      if (current == null || typeof current !== 'object') {
        return fallback;
      }

      current = current[key];
    }

    return current !== undefined && current !== null ? current : fallback;
  } catch (error) {
    console.warn('Error accessing nested field:', path, error);
    return fallback;
  }
}

/**
 * Type guard for checking if Firestore data is valid
 * 
 * @example
 * if (isValidDocData(receiptData, ['storeName', 'total'])) {
 *   // Safe to access receiptData.storeName and receiptData.total
 * }
 */
export function isValidDocData(
  data: any,
  requiredFields: string[] = []
): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  for (const field of requiredFields) {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      return false;
    }
  }

  return true;
}

/**
 * Converts Firestore timestamp to Date with fallback
 * Handles various date formats (Timestamp, ISO string, Date object)
 * 
 * @example
 * const createdAt = safeTimestampToDate(data.createdAt, new Date());
 */
export function safeTimestampToDate(
  value: any,
  fallback: Date = new Date()
): Date {
  if (!value) return fallback;

  try {
    // Firestore Timestamp
    if (value && typeof value.toDate === 'function') {
      return value.toDate();
    }

    // ISO string or timestamp number
    const date = new Date(value);
    
    // Check if valid date
    if (isNaN(date.getTime())) {
      console.warn('Invalid date value:', value);
      return fallback;
    }

    // Check reasonable bounds (1900 - future)
    const minDate = new Date('1900-01-01');
    if (date < minDate) {
      console.warn('Date too old:', date);
      return fallback;
    }

    return date;
  } catch (error) {
    console.warn('Error converting timestamp:', error);
    return fallback;
  }
}

/**
 * Batch safe data extraction from multiple documents
 * Returns Map of document ID to data
 * 
 * @example
 * const receiptsMap = safeBatchData(snapshot);
 * const receipt1 = receiptsMap.get('receipt-id-123');
 */
export function safeBatchData<T = any>(
  snapshot: FirebaseFirestoreTypes.QuerySnapshot
): Map<string, T> {
  const dataMap = new Map<string, T>();

  if (!snapshot || !snapshot.docs) {
    return dataMap;
  }

  for (const doc of snapshot.docs) {
    const data = safeDocData<T>(doc);
    if (data) {
      dataMap.set(doc.id, data);
    }
  }

  return dataMap;
}

// Export all helpers
export const FirestoreHelpers = {
  safeDocData,
  safeDocField,
  safeQueryData,
  requireDocData,
  safeNestedField,
  isValidDocData,
  safeTimestampToDate,
  safeBatchData,
};

export default FirestoreHelpers;
