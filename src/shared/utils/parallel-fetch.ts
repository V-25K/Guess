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
 * Fetch with retry and exponential backoff
 */
export async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );
        const jitter = Math.random() * 0.3 * delay;
        const totalDelay = delay + jitter;

        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }
  }

  throw lastError;
}
