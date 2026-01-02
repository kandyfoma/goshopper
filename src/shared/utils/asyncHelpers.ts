// Async Operation Helpers
// Adds timeout and retry capabilities to async operations

/**
 * Wraps a promise with a timeout
 * Rejects if promise takes longer than specified timeout
 * 
 * @example
 * const data = await withTimeout(
 *   fetchData(),
 *   5000,
 *   'Data fetch timeout'
 * );
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Retry an async operation with exponential backoff
 * 
 * @example
 * const data = await retryOperation(
 *   () => fetchData(),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    shouldRetry?: (error: any, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt < maxRetries && shouldRetry(error, attempt)) {
        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );

        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`
        );

        // Wait before retrying
        await new Promise<void>(resolve => setTimeout(() => resolve(), delay));
      } else {
        // No more retries or shouldn't retry
        break;
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Check if error is a network error (retryable)
 * 
 * @example
 * if (isNetworkError(error)) {
 *   // Retry the operation
 * }
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorString = error.toString?.().toLowerCase() || '';

  const networkErrorPatterns = [
    'network',
    'timeout',
    'fetch',
    'econnrefused',
    'enotfound',
    'etimedout',
    'connection',
    'offline',
    'no internet',
    'failed to fetch',
  ];

  return networkErrorPatterns.some(
    pattern =>
      errorMessage.includes(pattern) || errorString.includes(pattern)
  );
}

/**
 * Check if error is a timeout error
 * 
 * @example
 * if (isTimeoutError(error)) {
 *   showToast('Operation took too long', 'warning');
 * }
 */
export function isTimeoutError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorString = error.toString?.().toLowerCase() || '';

  return (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorString.includes('timeout') ||
    errorString.includes('timed out')
  );
}

/**
 * Execute multiple promises with a timeout for each
 * 
 * @example
 * const results = await parallelWithTimeout(
 *   [fetchUser(), fetchPosts(), fetchComments()],
 *   5000
 * );
 */
export async function parallelWithTimeout<T>(
  promises: Promise<T>[],
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T[]> {
  return Promise.all(
    promises.map(promise => withTimeout(promise, timeoutMs, timeoutMessage))
  );
}

/**
 * Execute promises sequentially with timeout
 * Stops on first error
 * 
 * @example
 * await sequentialWithTimeout(
 *   [uploadImage1, uploadImage2, uploadImage3],
 *   10000
 * );
 */
export async function sequentialWithTimeout<T>(
  operations: Array<() => Promise<T>>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T[]> {
  const results: T[] = [];

  for (const operation of operations) {
    const result = await withTimeout(
      operation(),
      timeoutMs,
      timeoutMessage
    );
    results.push(result);
  }

  return results;
}

/**
 * Debounce an async function
 * Useful for search inputs, API calls, etc.
 * 
 * @example
 * const debouncedSearch = debounceAsync(searchAPI, 500);
 * await debouncedSearch(query);
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let latestResolve: ((value: ReturnType<T>) => void) | null = null;
  let latestReject: ((reason: any) => void) | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Store latest resolve/reject
      latestResolve = resolve;
      latestReject = reject;

      // Set new timeout
      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          if (latestResolve === resolve) {
            // Only resolve if this is still the latest call
            resolve(result);
          }
        } catch (error) {
          if (latestReject === reject) {
            // Only reject if this is still the latest call
            reject(error);
          }
        }
      }, waitMs);
    });
  };
}

/**
 * Throttle an async function
 * Ensures function is called at most once per interval
 * 
 * @example
 * const throttledSave = throttleAsync(saveData, 2000);
 * throttledSave(data); // Will execute
 * throttledSave(data); // Will be ignored if within 2s
 */
export function throttleAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T> | null> {
  let lastCallTime = 0;
  let pendingPromise: Promise<ReturnType<T>> | null = null;

  return async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
    const now = Date.now();

    // If within throttle window and there's a pending promise, return it
    if (pendingPromise && now - lastCallTime < waitMs) {
      return pendingPromise;
    }

    // If outside throttle window, execute
    if (now - lastCallTime >= waitMs) {
      lastCallTime = now;
      pendingPromise = func(...args);

      try {
        const result = await pendingPromise;
        pendingPromise = null;
        return result;
      } catch (error) {
        pendingPromise = null;
        throw error;
      }
    }

    return null;
  };
}

/**
 * Race multiple promises with timeout
 * Returns first resolved promise or rejects if all fail
 * 
 * @example
 * const data = await raceWithTimeout(
 *   [fetchFromCache(), fetchFromAPI()],
 *   5000
 * );
 */
export async function raceWithTimeout<T>(
  promises: Promise<T>[],
  timeoutMs: number,
  timeoutMessage: string = 'All operations timed out'
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  );

  return Promise.race([...promises, timeoutPromise]);
}

/**
 * Execute async operation with cancellation support
 * 
 * @example
 * const { promise, cancel } = cancellableOperation(() => fetchData());
 * // Later: cancel();
 */
export function cancellableOperation<T>(
  operation: () => Promise<T>
): {
  promise: Promise<T>;
  cancel: () => void;
} {
  let cancelled = false;

  const promise = new Promise<T>(async (resolve, reject) => {
    try {
      const result = await operation();
      if (!cancelled) {
        resolve(result);
      }
    } catch (error) {
      if (!cancelled) {
        reject(error);
      }
    }
  });

  const cancel = () => {
    cancelled = true;
  };

  return { promise, cancel };
}

/**
 * Batch async operations
 * Executes operations in batches to avoid overwhelming the system
 * 
 * @example
 * const results = await batchAsync(
 *   items,
 *   item => processItem(item),
 *   { batchSize: 5, delayBetweenBatches: 1000 }
 * );
 */
export async function batchAsync<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    continueOnError?: boolean;
  } = {}
): Promise<Array<{ success: boolean; result?: R; error?: any; item: T }>> {
  const {
    batchSize = 10,
    delayBetweenBatches = 0,
    continueOnError = true,
  } = options;

  const results: Array<{
    success: boolean;
    result?: R;
    error?: any;
    item: T;
  }> = [];

  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const batchPromises = batch.map(async item => {
      try {
        const result = await operation(item);
        return { success: true, result, item };
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        return { success: false, error, item };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Delay between batches if specified
    if (delayBetweenBatches > 0 && i + batchSize < items.length) {
      await new Promise<void>(resolve => setTimeout(() => resolve(), delayBetweenBatches));
    }
  }

  return results;
}

// Export all helpers
export const AsyncHelpers = {
  withTimeout,
  retryOperation,
  isNetworkError,
  isTimeoutError,
  parallelWithTimeout,
  sequentialWithTimeout,
  debounceAsync,
  throttleAsync,
  raceWithTimeout,
  cancellableOperation,
  batchAsync,
};

export default AsyncHelpers;
