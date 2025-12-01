/**
 * Cache Utility
 * Provides in-memory caching with TTL (Time To Live) support
 */

export type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

export type CacheOptions = {
  ttl: number; // Time to live in milliseconds
};

/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL: number = 60000) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Set a value in the cache with optional TTL
   */
  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data: value, expiresAt });
  }

  /**
   * Get a value from the cache
   * Returns null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of entries in the cache (including expired)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries from the cache
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get or set a value using a factory function
   * If the key exists and is not expired, return the cached value
   * Otherwise, call the factory function, cache the result, and return it
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T | null> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    try {
      const value = await factory();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Create a cache key from multiple parts
 * @deprecated Use CacheKeyBuilder.createKey() for namespace-compliant keys
 */
export function createCacheKey(...parts: (string | number | boolean | null | undefined)[]): string {
  return parts
    .filter(part => part !== null && part !== undefined)
    .map(part => String(part))
    .join(':');
}

/**
 * Error thrown when a cache key part contains invalid characters
 */
export class InvalidCacheKeyError extends Error {
  constructor(part: string, value: string) {
    super(`Cache key ${part} contains invalid character ':'. Value: "${value}"`);
    this.name = 'InvalidCacheKeyError';
  }
}

/**
 * Validates that a cache key part does not contain colons
 * @param part - The name of the part being validated (for error messages)
 * @param value - The value to validate
 * @throws InvalidCacheKeyError if the value contains a colon
 */
function validateKeyPart(part: string, value: string): void {
  if (value.includes(':')) {
    throw new InvalidCacheKeyError(part, value);
  }
}

/**
 * CacheKeyBuilder - Utility for creating namespace-compliant cache keys
 * 
 * Keys follow the pattern: {entity}:{identifier} or {entity}:{identifier}:{qualifier}
 * All parts are validated to ensure they don't contain colons.
 * 
 * @example
 * CacheKeyBuilder.createKey('feed', 'challenges') // 'feed:challenges'
 * CacheKeyBuilder.createKey('user', 't2_abc123', 'profile') // 'user:t2_abc123:profile'
 * CacheKeyBuilder.createKey('avatar', 'username123') // 'avatar:username123'
 */
export const CacheKeyBuilder = {
  /**
   * Create a namespace-compliant cache key
   * 
   * @param entity - The entity type (e.g., 'feed', 'user', 'avatar', 'leaderboard')
   * @param identifier - The unique identifier for the entity
   * @param qualifier - Optional qualifier for more specific keys
   * @returns A formatted cache key string
   * @throws InvalidCacheKeyError if any part contains a colon
   * 
   * @example
   * createKey('feed', 'challenges') // 'feed:challenges'
   * createKey('user', 't2_abc123', 'profile') // 'user:t2_abc123:profile'
   */
  createKey(entity: string, identifier: string, qualifier?: string): string {
    // Validate all parts don't contain colons
    validateKeyPart('entity', entity);
    validateKeyPart('identifier', identifier);
    
    if (qualifier !== undefined) {
      validateKeyPart('qualifier', qualifier);
      return `${entity}:${identifier}:${qualifier}`;
    }
    
    return `${entity}:${identifier}`;
  },

  /**
   * Parse a cache key back into its component parts
   * 
   * @param key - The cache key to parse
   * @returns An object with entity, identifier, and optional qualifier
   */
  parseKey(key: string): { entity: string; identifier: string; qualifier?: string } {
    const parts = key.split(':');
    
    if (parts.length < 2 || parts.length > 3) {
      throw new Error(`Invalid cache key format: "${key}". Expected {entity}:{identifier} or {entity}:{identifier}:{qualifier}`);
    }
    
    return {
      entity: parts[0],
      identifier: parts[1],
      qualifier: parts.length === 3 ? parts[2] : undefined,
    };
  },

  /**
   * Check if a string is a valid cache key part (contains no colons)
   * 
   * @param value - The value to check
   * @returns true if the value is valid, false otherwise
   */
  isValidKeyPart(value: string): boolean {
    return !value.includes(':');
  },
};
