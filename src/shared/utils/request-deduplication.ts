/**
 * Request Deduplication
 * Prevents duplicate in-flight requests for the same data
 * 
 * NOTE: Simplified version without setTimeout (not available in Devvit runtime)
 */

type PendingRequest<T> = {
  promise: Promise<T>;
  timestamp: number;
};

const pendingRequests = new Map<string, PendingRequest<any>>();
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Execute a request with deduplication
 * If the same request is already in flight, return the existing promise
 */
export async function deduplicateRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    timeout?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<T> {
  const { forceRefresh = false } = options;

  cleanupExpiredRequests();

  if (!forceRefresh) {
    const pending = pendingRequests.get(key);
    if (pending) {
      if (Date.now() - pending.timestamp < REQUEST_TIMEOUT) {
        return pending.promise;
      } else {
        pendingRequests.delete(key);
      }
    }
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      pendingRequests.delete(key);
      return result;
    } catch (error) {
      pendingRequests.delete(key);
      throw error;
    }
  })();

  pendingRequests.set(key, {
    promise,
    timestamp: Date.now(),
  });

  return promise;
}

/**
 * Clean up expired pending requests
 * Called synchronously without setTimeout
 */
function cleanupExpiredRequests(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, request] of pendingRequests.entries()) {
    if (now - request.timestamp > REQUEST_TIMEOUT) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => pendingRequests.delete(key));
}

/**
 * Clear all pending requests
 * Useful for testing
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Get number of pending requests
 */
export function getPendingRequestCount(): number {
  return pendingRequests.size;
}

/**
 * Create a deduplication key from parts
 */
export function createDedupeKey(...parts: (string | number | boolean | null | undefined)[]): string {
  return parts
    .filter(part => part !== null && part !== undefined)
    .map(part => String(part))
    .join(':');
}
