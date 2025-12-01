/**
 * Request Deduplication
 * Prevents duplicate in-flight requests for the same data
 * 
 * Implements the RequestDeduplicator interface from the design document:
 * - dedupe<T>(key, fetcher): Execute with deduplication
 * - isInFlight(key): Check if request is in flight
 * - clear(key): Clear pending request
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
 * RequestDeduplicator class
 * Prevents duplicate in-flight requests for the same data
 * 
 * **Feature: performance-optimization, Property 4: Request Deduplication Returns Same Promise**
 * *For any* N simultaneous requests for the same user profile (where N > 1),
 * the deduplicator SHALL return the same promise to all callers,
 * resulting in exactly 1 actual fetch operation.
 * **Validates: Requirements 4.3**
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private requestTimeout: number;

  constructor(options: { timeout?: number } = {}) {
    this.requestTimeout = options.timeout ?? REQUEST_TIMEOUT;
  }

  /**
   * Execute a request with deduplication
   * If the same request is already in flight, return the existing promise
   * 
   * @param key - Unique key identifying the request
   * @param fetcher - Function that performs the actual fetch
   * @returns Promise that resolves to the fetched data
   */
  dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    this.cleanupExpiredRequests();

    // Check for existing in-flight request
    const pending = this.pendingRequests.get(key);
    if (pending) {
      if (Date.now() - pending.timestamp < this.requestTimeout) {
        // Return the same promise for duplicate requests
        return pending.promise;
      } else {
        // Request has timed out, remove it
        this.pendingRequests.delete(key);
      }
    }

    // Create new request promise with cleanup on completion
    const promise = (async () => {
      try {
        const result = await fetcher();
        // Clean up completed request
        this.pendingRequests.delete(key);
        return result;
      } catch (error) {
        // Clean up failed request
        this.pendingRequests.delete(key);
        throw error;
      }
    })();

    // Store pending promise by key
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Check if a request is currently in flight
   * 
   * @param key - Unique key identifying the request
   * @returns true if request is in flight, false otherwise
   */
  isInFlight(key: string): boolean {
    const pending = this.pendingRequests.get(key);
    if (!pending) return false;
    
    // Check if request has timed out
    if (Date.now() - pending.timestamp >= this.requestTimeout) {
      this.pendingRequests.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear a pending request
   * 
   * @param key - Unique key identifying the request to clear
   */
  clear(key: string): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all pending requests
   */
  clearAll(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Clean up expired pending requests
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.requestTimeout) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.pendingRequests.delete(key));
  }
}

// Default singleton instance for convenience
const defaultDeduplicator = new RequestDeduplicator();

/**
 * Execute a request with deduplication (legacy function API)
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
