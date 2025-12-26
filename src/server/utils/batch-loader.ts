/**
 * Batch Loader Utility
 * Efficiently batches and deduplicates data fetching to prevent N+1 queries
 * 
 * Inspired by DataLoader pattern - collects individual requests and
 * batches them into a single database query
 * 
 * Requirements: Phase 4.1 - N+1 Query Fixes
 */

import { createLogger, type Logger } from './logger.js';

/**
 * Batch loading function type
 * Takes an array of keys and returns a Map of key -> value
 */
export type BatchLoadFn<K, V> = (keys: K[]) => Promise<Map<K, V>>;

/**
 * Batch loader options
 */
export type BatchLoaderOptions = {
  /** Maximum batch size */
  maxBatchSize: number;
  /** Batch window in milliseconds */
  batchWindowMs: number;
  /** Whether to cache results */
  cache: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
};

const DEFAULT_OPTIONS: BatchLoaderOptions = {
  maxBatchSize: 100,
  batchWindowMs: 10,
  cache: true,
  cacheTtlMs: 60_000, // 1 minute
};

/**
 * Pending request in the batch queue
 */
type PendingRequest<K, V> = {
  key: K;
  resolve: (value: V | null) => void;
  reject: (error: Error) => void;
};

/**
 * Cache entry with expiration
 */
type CacheEntry<V> = {
  value: V;
  expiresAt: number;
};

/**
 * BatchLoader - Batches and deduplicates data fetching
 * 
 * Usage:
 * ```typescript
 * const userLoader = new BatchLoader<string, User>(async (userIds) => {
 *   const users = await fetchUsersByIds(userIds);
 *   return new Map(users.map(u => [u.id, u]));
 * });
 * 
 * // These will be batched into a single query
 * const [user1, user2, user3] = await Promise.all([
 *   userLoader.load('user1'),
 *   userLoader.load('user2'),
 *   userLoader.load('user3'),
 * ]);
 * ```
 */
export class BatchLoader<K, V> {
  private batchFn: BatchLoadFn<K, V>;
  private options: BatchLoaderOptions;
  private logger: Logger;
  
  private pendingQueue: PendingRequest<K, V>[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private cache: Map<string, CacheEntry<V>> = new Map();

  constructor(batchFn: BatchLoadFn<K, V>, options?: Partial<BatchLoaderOptions>) {
    this.batchFn = batchFn;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = createLogger({ service: 'BatchLoader' });
  }

  /**
   * Load a single item by key
   * Requests are batched together within the batch window
   */
  async load(key: K): Promise<V | null> {
    // Check cache first
    if (this.options.cache) {
      const cached = this.getFromCache(key);
      if (cached !== undefined) {
        return cached;
      }
    }

    return new Promise<V | null>((resolve, reject) => {
      this.pendingQueue.push({ key, resolve, reject });
      this.scheduleBatch();
    });
  }

  /**
   * Load multiple items by keys
   * More efficient than calling load() multiple times
   */
  async loadMany(keys: K[]): Promise<Map<K, V | null>> {
    const results = await Promise.all(keys.map(key => this.load(key)));
    const resultMap = new Map<K, V | null>();
    
    keys.forEach((key, index) => {
      resultMap.set(key, results[index]);
    });
    
    return resultMap;
  }

  /**
   * Prime the cache with a known value
   */
  prime(key: K, value: V): void {
    if (this.options.cache) {
      this.setInCache(key, value);
    }
  }

  /**
   * Clear a specific key from the cache
   */
  clear(key: K): void {
    const cacheKey = this.getCacheKey(key);
    this.cache.delete(cacheKey);
  }

  /**
   * Clear the entire cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  /**
   * Schedule a batch execution
   */
  private scheduleBatch(): void {
    // If we've hit max batch size, execute immediately
    if (this.pendingQueue.length >= this.options.maxBatchSize) {
      this.executeBatch();
      return;
    }

    // Otherwise, wait for the batch window
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.executeBatch();
      }, this.options.batchWindowMs);
    }
  }

  /**
   * Execute the current batch
   */
  private async executeBatch(): Promise<void> {
    // Clear timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Get pending requests and clear queue
    const batch = this.pendingQueue.splice(0, this.options.maxBatchSize);
    
    if (batch.length === 0) {
      return;
    }

    // Deduplicate keys
    const uniqueKeys = [...new Set(batch.map(r => r.key))];
    
    this.logger.debug('Executing batch', {
      batchSize: batch.length,
      uniqueKeys: uniqueKeys.length,
    });

    try {
      // Execute batch load
      const results = await this.batchFn(uniqueKeys);

      // Resolve all pending requests
      for (const request of batch) {
        const value = results.get(request.key) ?? null;
        
        // Cache the result
        if (this.options.cache && value !== null) {
          this.setInCache(request.key, value);
        }
        
        request.resolve(value);
      }
    } catch (error) {
      // Reject all pending requests
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Batch load failed', error);
      
      for (const request of batch) {
        request.reject(err);
      }
    }

    // If there are more pending requests, schedule another batch
    if (this.pendingQueue.length > 0) {
      this.scheduleBatch();
    }
  }

  /**
   * Get a value from cache
   */
  private getFromCache(key: K): V | undefined {
    const cacheKey = this.getCacheKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in cache
   */
  private setInCache(key: K, value: V): void {
    const cacheKey = this.getCacheKey(key);
    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.options.cacheTtlMs,
    });
  }

  /**
   * Convert key to cache key string
   */
  private getCacheKey(key: K): string {
    if (typeof key === 'string') {
      return key;
    }
    return JSON.stringify(key);
  }
}

/**
 * Create a batch loader for user profiles
 */
export function createUserProfileLoader(
  fetchFn: (userIds: string[]) => Promise<Array<{ user_id: string; [key: string]: unknown }>>
): BatchLoader<string, { user_id: string; [key: string]: unknown }> {
  return new BatchLoader(async (userIds: string[]) => {
    const users = await fetchFn(userIds);
    return new Map(users.map(u => [u.user_id, u]));
  });
}

/**
 * Create a batch loader for challenges
 */
export function createChallengeLoader(
  fetchFn: (challengeIds: string[]) => Promise<Array<{ id: string; [key: string]: unknown }>>
): BatchLoader<string, { id: string; [key: string]: unknown }> {
  return new BatchLoader(async (challengeIds: string[]) => {
    const challenges = await fetchFn(challengeIds);
    return new Map(challenges.map(c => [c.id, c]));
  });
}
