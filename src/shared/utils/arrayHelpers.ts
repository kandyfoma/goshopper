// Safe Array Access Helpers
// Prevents crashes from accessing undefined array indices

/**
 * Safely access array element by index
 * Returns fallback if index is out of bounds
 * 
 * @example
 * const firstItem = safeArrayGet(items, 0, null);
 * const lastItem = safeArrayGet(items, -1, null);
 */
export function safeArrayGet<T>(
  array: T[] | null | undefined,
  index: number,
  fallback: T | null = null
): T | null {
  if (!array || !Array.isArray(array)) {
    return fallback;
  }

  // Handle negative indices (from end)
  const actualIndex = index < 0 ? array.length + index : index;

  if (actualIndex < 0 || actualIndex >= array.length) {
    return fallback;
  }

  const value = array[actualIndex];
  return value !== undefined ? value : fallback;
}

/**
 * Safely get first element of array
 * 
 * @example
 * const firstUser = safeArrayFirst(users);
 */
export function safeArrayFirst<T>(
  array: T[] | null | undefined,
  fallback: T | null = null
): T | null {
  return safeArrayGet(array, 0, fallback);
}

/**
 * Safely get last element of array
 * 
 * @example
 * const lastReceipt = safeArrayLast(receipts);
 */
export function safeArrayLast<T>(
  array: T[] | null | undefined,
  fallback: T | null = null
): T | null {
  return safeArrayGet(array, -1, fallback);
}

/**
 * Safely filter array, removing null/undefined values
 * 
 * @example
 * const validItems = safeArrayFilter(items, item => item.price > 0);
 */
export function safeArrayFilter<T>(
  array: T[] | null | undefined,
  predicate: (item: T, index: number) => boolean = () => true
): T[] {
  if (!array || !Array.isArray(array)) {
    return [];
  }

  return array.filter((item, index) => {
    // Filter out null/undefined
    if (item === null || item === undefined) {
      return false;
    }

    try {
      return predicate(item, index);
    } catch (error) {
      console.warn('Error in filter predicate:', error);
      return false;
    }
  });
}

/**
 * Safely map array with error handling
 * Skips items that throw errors during mapping
 * 
 * @example
 * const prices = safeArrayMap(items, item => item.price * 1.1);
 */
export function safeArrayMap<T, R>(
  array: T[] | null | undefined,
  mapper: (item: T, index: number) => R,
  skipErrors: boolean = true
): R[] {
  if (!array || !Array.isArray(array)) {
    return [];
  }

  const results: R[] = [];

  for (let i = 0; i < array.length; i++) {
    const item = array[i];

    // Skip null/undefined
    if (item === null || item === undefined) {
      continue;
    }

    try {
      const result = mapper(item, i);
      if (result !== null && result !== undefined) {
        results.push(result);
      }
    } catch (error) {
      console.warn(`Error mapping array item at index ${i}:`, error);
      if (!skipErrors) {
        throw error;
      }
    }
  }

  return results;
}

/**
 * Safely reduce array with error handling and initial value
 * 
 * @example
 * const total = safeArrayReduce(items, (sum, item) => sum + item.price, 0);
 */
export function safeArrayReduce<T, R>(
  array: T[] | null | undefined,
  reducer: (accumulator: R, item: T, index: number) => R,
  initialValue: R
): R {
  if (!array || !Array.isArray(array)) {
    return initialValue;
  }

  let accumulator = initialValue;

  for (let i = 0; i < array.length; i++) {
    const item = array[i];

    // Skip null/undefined
    if (item === null || item === undefined) {
      continue;
    }

    try {
      accumulator = reducer(accumulator, item, i);
    } catch (error) {
      console.warn(`Error reducing array at index ${i}:`, error);
      // Continue with current accumulator value
    }
  }

  return accumulator;
}

/**
 * Safely find element in array
 * 
 * @example
 * const user = safeArrayFind(users, u => u.id === userId);
 */
export function safeArrayFind<T>(
  array: T[] | null | undefined,
  predicate: (item: T, index: number) => boolean
): T | undefined {
  if (!array || !Array.isArray(array)) {
    return undefined;
  }

  for (let i = 0; i < array.length; i++) {
    const item = array[i];

    // Skip null/undefined
    if (item === null || item === undefined) {
      continue;
    }

    try {
      if (predicate(item, i)) {
        return item;
      }
    } catch (error) {
      console.warn(`Error in find predicate at index ${i}:`, error);
    }
  }

  return undefined;
}

/**
 * Check if array is empty or null/undefined
 * 
 * @example
 * if (isArrayEmpty(items)) {
 *   showEmptyState();
 * }
 */
export function isArrayEmpty(array: any[] | null | undefined): boolean {
  return !array || !Array.isArray(array) || array.length === 0;
}

/**
 * Check if array has elements
 * 
 * @example
 * if (isArrayNotEmpty(receipts)) {
 *   displayReceipts(receipts);
 * }
 */
export function isArrayNotEmpty<T>(
  array: T[] | null | undefined
): array is T[] {
  return Array.isArray(array) && array.length > 0;
}

/**
 * Safely get array length
 * Returns 0 for null/undefined/non-arrays
 * 
 * @example
 * const count = safeArrayLength(items); // Never crashes
 */
export function safeArrayLength(array: any[] | null | undefined): number {
  if (!array || !Array.isArray(array)) {
    return 0;
  }
  return array.length;
}

/**
 * Safely split array into chunks
 * 
 * @example
 * const pages = safeArrayChunk(items, 10); // 10 items per page
 */
export function safeArrayChunk<T>(
  array: T[] | null | undefined,
  chunkSize: number
): T[][] {
  if (!array || !Array.isArray(array) || chunkSize <= 0) {
    return [];
  }

  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Safely flatten nested arrays
 * 
 * @example
 * const allItems = safeArrayFlatten(categoriesWithItems);
 */
export function safeArrayFlatten<T>(
  arrays: Array<T[] | null | undefined> | null | undefined
): T[] {
  if (!arrays || !Array.isArray(arrays)) {
    return [];
  }

  const result: T[] = [];

  for (const arr of arrays) {
    if (Array.isArray(arr)) {
      result.push(...arr);
    }
  }

  return result;
}

/**
 * Safely remove duplicates from array
 * 
 * @example
 * const uniqueIds = safeArrayUnique(allIds);
 * const uniqueUsers = safeArrayUnique(users, user => user.id);
 */
export function safeArrayUnique<T>(
  array: T[] | null | undefined,
  keyExtractor?: (item: T) => any
): T[] {
  if (!array || !Array.isArray(array)) {
    return [];
  }

  if (!keyExtractor) {
    return Array.from(new Set(array));
  }

  const seen = new Set();
  const result: T[] = [];

  for (const item of array) {
    if (item === null || item === undefined) {
      continue;
    }

    try {
      const key = keyExtractor(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    } catch (error) {
      console.warn('Error extracting unique key:', error);
    }
  }

  return result;
}

// Export all helpers
export const ArrayHelpers = {
  safeArrayGet,
  safeArrayFirst,
  safeArrayLast,
  safeArrayFilter,
  safeArrayMap,
  safeArrayReduce,
  safeArrayFind,
  isArrayEmpty,
  isArrayNotEmpty,
  safeArrayLength,
  safeArrayChunk,
  safeArrayFlatten,
  safeArrayUnique,
};

export default ArrayHelpers;
