/**
 * CacheService
 * Central service for managing all caching operations with consistent key naming and TTL management.
 * 
 * Uses Devvit's context.cache() for shared data (non-personalized) and Redis for user-specific data.
 * 
 * Requirements: 1.2, 4.1, 4.4, 8.1, 8.2, 8.3, 8.4
 */

import type { Context } from '@devvit/server/server-context';
import { redis } from '@devvit/web/server';

// JSONValue type for cache data
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
import { CacheKeyBuilder } from '../../shared/utils/cache.js';
import { BaseService } from './base.service.js';

/**
 * Type constraint for cacheable data - must be JSON serializable
 */
export type CacheableData = JSONValue;

/**
 * TTL constants in milliseconds
 */
export const TTL = {
  /** Minimum TTL for dynamic data (10 seconds) */
  MIN_DYNAMIC: 10_000,
  /** Maximum TTL for dynamic data (60 seconds) */
  MAX_DYNAMIC: 60_000,
  /** Default TTL for challenge feed (30 seconds) */
  CHALLENGE_FEED: 30_000,
  /** TTL for user profile data (5 minutes) */
  USER_PROFILE: 5 * 60 * 1000,
  /** TTL for avatar URLs (24 hours) */
  AVATAR: 24 * 60 * 60 * 1000,
} as const;

/**
 * Error thrown when TTL is outside valid range
 */
export class InvalidTTLError extends Error {
  constructor(ttl: number, min: number, max: number) {
    super(`TTL ${ttl}ms is outside valid range [${min}ms, ${max}ms]`);
    this.name = 'InvalidTTLError';
  }
}

/**
 * Validates that a TTL value is within the valid range for dynamic data
 * @param ttl - TTL value in milliseconds
 * @returns true if valid
 * @throws InvalidTTLError if TTL is outside valid range
 */
export function validateDynamicTTL(ttl: number): boolean {
  if (ttl < TTL.MIN_DYNAMIC || ttl > TTL.MAX_DYNAMIC) {
    throw new InvalidTTLError(ttl, TTL.MIN_DYNAMIC, TTL.MAX_DYNAMIC);
  }
  return true;
}

/**
 * Checks if a TTL value is within the valid range for dynamic data (non-throwing)
 * @param ttl - TTL value in milliseconds
 * @returns true if valid, false otherwise
 */
export function isValidDynamicTTL(ttl: number): boolean {
  return ttl >= TTL.MIN_DYNAMIC && ttl <= TTL.MAX_DYNAMIC;
}

/**
 * CacheService - Central service for managing all caching operations
 * 
 * Provides:
 * - Shared data caching using context.cache() for non-personalized data
 * - User-specific data caching using Redis
 * - Consistent key naming with CacheKeyBuilder
 * - TTL validation for dynamic data
 * - Error handling with fallback values
 */
export class CacheService extends BaseService {
  constructor(context: Context) {
    super(context);
  }

  /**
   * Get shared data using Redis
   * 
   * This method is for non-personalized data that can be shared across all users.
   * Uses Redis for caching with specified TTL.
   * 
   * @param key - Cache key (should follow namespace format)
   * @param fetcher - Function to fetch data if not cached
   * @param ttl - Time to live in milliseconds (must be 10-60 seconds for dynamic data)
   * @returns Cached or fetched data, or fallback value on error
   * 
   * Requirements: 1.2, 8.1, 8.2, 8.3, 8.4
   */
  async getSharedData<T extends JSONValue>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T | null> {
    try {
      // Validate TTL for dynamic data
      validateDynamicTTL(ttl);

      // Try to get from Redis cache first
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }

      // Cache miss - fetch data
      try {
        const result = await fetcher();
        
        // Store in Redis cache
        await redis.set(key, JSON.stringify(result), {
          expiration: new Date(Date.now() + ttl),
        });
        
        return result;
      } catch (fetchError) {
        this.logError('CacheService.getSharedData', fetchError);
        throw fetchError;
      }
    } catch (error) {
      // Log error and return null as fallback (Requirement 8.3)
      this.logError('CacheService.getSharedData', error);
      return null;
    }
  }

  /**
   * Get shared data with array fallback
   * 
   * Same as getSharedData but returns empty array on error instead of null.
   * Useful for list data like challenge feeds.
   * 
   * @param key - Cache key
   * @param fetcher - Function to fetch data if not cached
   * @param ttl - Time to live in milliseconds
   * @returns Cached or fetched data, or empty array on error
   * 
   * Requirements: 8.3
   */
  async getSharedDataArray<T extends JSONValue>(
    key: string,
    fetcher: () => Promise<T[]>,
    ttl: number
  ): Promise<T[]> {
    try {
      validateDynamicTTL(ttl);

      // Try to get from Redis cache first
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T[];
      }

      // Cache miss - fetch data
      try {
        const result = await fetcher();
        
        // Store in Redis cache
        await redis.set(key, JSON.stringify(result), {
          expiration: new Date(Date.now() + ttl),
        });
        
        return result ?? [];
      } catch (fetchError) {
        this.logError('CacheService.getSharedDataArray', fetchError);
        throw fetchError;
      }
    } catch (error) {
      // Return empty array as fallback (Requirement 8.3)
      this.logError('CacheService.getSharedDataArray', error);
      return [];
    }
  }

  /**
   * Get user-specific data from Redis cache
   * 
   * @param userId - User ID
   * @param key - Data key (e.g., 'profile')
   * @returns Cached data or null if not found
   * 
   * Requirements: 4.1
   */
  async getUserData<T>(userId: string, key: string): Promise<T | null> {
    try {
      const cacheKey = CacheKeyBuilder.createKey('user', userId, key);
      const value = await redis.get(cacheKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logError('CacheService.getUserData', error);
      return null;
    }
  }

  /**
   * Set user-specific data in Redis cache
   * 
   * @param userId - User ID
   * @param key - Data key (e.g., 'profile')
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (default: 5 minutes for profile data)
   * 
   * Requirements: 4.4
   */
  async setUserData<T>(
    userId: string,
    key: string,
    data: T,
    ttl: number = TTL.USER_PROFILE
  ): Promise<void> {
    try {
      const cacheKey = CacheKeyBuilder.createKey('user', userId, key);
      const serialized = JSON.stringify(data);
      
      await redis.set(cacheKey, serialized, {
        expiration: new Date(Date.now() + ttl),
      });
    } catch (error) {
      this.logError('CacheService.setUserData', error);
      // Don't throw - cache failures should not crash the application
    }
  }

  /**
   * Invalidate user-specific data in Redis cache
   * 
   * @param userId - User ID
   * @param key - Data key (e.g., 'profile')
   * 
   * Requirements: 4.2, 6.2
   */
  async invalidateUserData(userId: string, key: string): Promise<void> {
    try {
      const cacheKey = CacheKeyBuilder.createKey('user', userId, key);
      await redis.del(cacheKey);
    } catch (error) {
      // Log but don't throw - invalidation failures should not crash (Requirement 6.3)
      this.logError('CacheService.invalidateUserData', error);
    }
  }

  /**
   * Create a cache key using the namespace format
   * 
   * @param entity - Entity type (e.g., 'feed', 'user', 'avatar')
   * @param identifier - Unique identifier
   * @param qualifier - Optional qualifier
   * @returns Formatted cache key
   * 
   * Requirements: 6.4
   */
  createKey(entity: string, identifier: string, qualifier?: string): string {
    return CacheKeyBuilder.createKey(entity, identifier, qualifier);
  }

  /**
   * Get cached avatar URL from Redis
   * 
   * @param username - Reddit username
   * @returns Cached avatar URL or null if not found
   * 
   * Requirements: 5.3
   */
  async getAvatarUrl(username: string): Promise<string | null> {
    try {
      const cacheKey = CacheKeyBuilder.createKey('avatar', username);
      const value = await redis.get(cacheKey);
      return value || null;
    } catch (error) {
      this.logError('CacheService.getAvatarUrl', error);
      return null;
    }
  }

  /**
   * Set avatar URL in Redis cache with 24-hour TTL
   * 
   * @param username - Reddit username
   * @param avatarUrl - Avatar URL to cache
   * 
   * Requirements: 5.3
   */
  async setAvatarUrl(username: string, avatarUrl: string): Promise<void> {
    try {
      const cacheKey = CacheKeyBuilder.createKey('avatar', username);
      await redis.set(cacheKey, avatarUrl, {
        expiration: new Date(Date.now() + TTL.AVATAR),
      });
    } catch (error) {
      this.logError('CacheService.setAvatarUrl', error);
      // Don't throw - cache failures should not crash the application
    }
  }

  /**
   * Get avatar URL with caching - checks Redis first, then fetches from Reddit API
   * 
   * @param username - Reddit username
   * @param fetcher - Function to fetch avatar URL from Reddit API
   * @returns Avatar URL or undefined if not found
   * 
   * Requirements: 5.3
   */
  async getAvatarUrlWithCache(
    username: string,
    fetcher: () => Promise<string | undefined>
  ): Promise<string | undefined> {
    try {
      // Check Redis cache first
      const cached = await this.getAvatarUrl(username);
      if (cached) {
        return cached;
      }

      // Cache miss - fetch from Reddit API
      const avatarUrl = await fetcher();
      
      // Cache the result if we got a valid URL
      if (avatarUrl) {
        await this.setAvatarUrl(username, avatarUrl);
      }

      return avatarUrl;
    } catch (error) {
      this.logError('CacheService.getAvatarUrlWithCache', error);
      // Fall back to direct fetch on cache error
      try {
        return await fetcher();
      } catch {
        return undefined;
      }
    }
  }
}

