/**
 * Parallel Data Fetching
 * Utilities for fetching related data in parallel
 */

/**
 * Fetch multiple items in parallel with error handling
 * Returns results with success/failure status
 */
export async function fetchParallel<T>(
  fetchers: Array<() => Promise<T>>,
  options: {
    maxConcurrency?: number;
    continueOnError?: boolean;
  } = {}
): Promise<Array<{ success: boolean; data?: T; error?: any }>> {
  const { maxConcurrency = 5, continueOnError = true } = options;

  if (maxConcurrency <= 0 || fetchers.length <= maxConcurrency) {
    const promises = fetchers.map(async (fetcher) => {
      try {
        const data = await fetcher();
        return { success: true, data };
      } catch (error) {
        if (!continueOnError) throw error;
        return { success: false, error };
      }
    });

    return Promise.all(promises);
  }

  const results: Array<{ success: boolean; data?: T; error?: any }> = [];
  
  for (let i = 0; i < fetchers.length; i += maxConcurrency) {
    const batch = fetchers.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(async (fetcher) => {
      try {
        const data = await fetcher();
        return { success: true, data };
      } catch (error) {
        if (!continueOnError) throw error;
        return { success: false, error };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Fetch multiple items and return only successful results
 */
export async function fetchParallelSuccess<T>(
  fetchers: Array<() => Promise<T>>,
  options: {
    maxConcurrency?: number;
  } = {}
): Promise<T[]> {
  const results = await fetchParallel(fetchers, { ...options, continueOnError: true });
  return results
    .filter(result => result.success && result.data !== undefined)
    .map(result => result.data!);
}

/**
 * Fetch related data in parallel
 */
export async function fetchRelatedData<T extends Record<string, any>>(
  fetchers: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  const keys = Object.keys(fetchers) as Array<keyof T>;
  const promises = keys.map(key => fetchers[key]());

  const results = await Promise.all(promises);

  const data = {} as T;
  keys.forEach((key, index) => {
    data[key] = results[index];
  });

  return data;
}

/**
 * Fetch with timeout
 */
export async function fetchWithTimeout<T>(
  fetcher: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fetcher(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Configuration for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry (default: 1000ms = 1 second) */
  initialDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 10000ms) */
  maxDelayMs?: number;
  /** Callback invoked before each retry with attempt number and error */
  onRetry?: (attempt: number, error: any) => void;
  /** Custom delay function for testing - returns the actual delay used */
  delayFn?: (ms: number) => Promise<number>;
}

/**
 * Calculate the delay for a given retry attempt using exponential backoff with jitter.
 * 
 * Formula: min(initialDelay * 2^attempt, maxDelay) + jitter
 * Where jitter is a random value between 0 and 30% of the base delay.
 * 
 * This prevents the "thundering herd" problem where many clients retry simultaneously.
 * 
 * @param attempt - The current attempt number (0-indexed)
 * @param initialDelayMs - The initial delay in milliseconds (default: 1000)
 * @param maxDelayMs - The maximum delay cap in milliseconds (default: 10000)
 * @returns Object containing baseDelay, jitter, and totalDelay in milliseconds
 */
export function calculateRetryDelay(
  attempt: number,
  initialDelayMs: number = 1000,
  maxDelayMs: number = 10000
): { baseDelay: number; jitter: number; totalDelay: number } {
  // Exponential backoff: initialDelay * 2^attempt, capped at maxDelay
  const baseDelay = Math.min(
    initialDelayMs * Math.pow(2, attempt),
    maxDelayMs
  );
  // Add jitter (0-30% of base delay) to prevent thundering herd
  const jitter = Math.random() * 0.3 * baseDelay;
  const totalDelay = baseDelay + jitter;
  
  return { baseDelay, jitter, totalDelay };
}

/**
 * Fetch with retry and exponential backoff
 * 
 * Implements retry logic with the following behavior:
 * - Starts with 1-second delay (configurable via initialDelayMs)
 * - Doubles delay on each retry (exponential backoff: 2^attempt)
 * - Adds jitter (0-30% of delay) to prevent thundering herd
 * - Maximum 3 retries by default (configurable via maxRetries)
 * 
 * **Validates: Requirements 7.3**
 * 
 * @param fetcher - The async function to execute with retry
 * @param options - Configuration options for retry behavior
 * @returns The result of the fetcher function
 * @throws The last error if all retries fail
 */
export async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    onRetry,
    delayFn,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;

      // Don't delay after the last attempt
      if (attempt < maxRetries - 1) {
        const { totalDelay } = calculateRetryDelay(attempt, initialDelayMs, maxDelayMs);

        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        // Use custom delay function if provided (for testing), otherwise use setTimeout
        if (delayFn) {
          await delayFn(totalDelay);
        } else {
          await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
      }
    }
  }

  throw lastError;
}
