/**
 * User Cache Service
 * Handles all Redis caching operations for user profiles
 * 
 * Uses Redis caching with 5-minute TTL for profile data.
 * Cache keys follow namespace format: user:{userId}:profile
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import type { Context } from '@devvit/server/server-context';
import { redis } from '@devvit/web/server';
import { BaseService } from '../base.service.js';
import type { UserProfile } from '../../../shared/models/user.types.js';
import { CacheKeyBuilder } from '../../../shared/utils/cache.js';
import type { Result } from '../../../shared/utils/result.js';
import { isOk } from '../../../shared/utils/result.js';
import type { AppError } from '../../../shared/models/errors.js';
import { databaseError } from '../../../shared/models/errors.js';
import { tryCatch } from '../../../shared/utils/result-adapters.js';

/** TTL for user profile cache (5 minutes) */
export const PROFILE_CACHE_TTL = 5 * 60 * 1000;

/**
 * UserCacheService handles all Redis caching operations for user profiles.
 * 
 * This service is responsible for:
 * - Creating cache keys with consistent namespace format
 * - Getting cached profiles from Redis
 * - Setting profiles in cache with TTL
 * - Invalidating cached profiles
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export class UserCacheService extends BaseService {
  constructor(context: Context) {
    super(context);
  }

  /**
   * Create a cache key for user profile using namespace format
   * Format: user:{userId}:profile
   * 
   * Requirements: 3.1
   */
  createProfileCacheKey(userId: string): string {
    return CacheKeyBuilder.createKey('user', userId, 'profile');
  }

  /**
   * Get user profile from Redis cache
   * 
   * Requirements: 3.2
   * 
   * @param userId - The user ID to look up
   * @returns The cached profile or null if not cached
   */
  async getCachedProfile(userId: string): Promise<Result<UserProfile | null, AppError>> {
    return tryCatch(
      async () => {
        const cacheKey = this.createProfileCacheKey(userId);
        const value = await redis.get(cacheKey);

        if (!value) {
          return null;
        }

        return JSON.parse(value) as UserProfile;
      },
      (error) => databaseError('getCachedProfile', String(error))
    );
  }

  /**
   * Set user profile in Redis cache with 5-minute TTL
   * 
   * Requirements: 3.3
   * 
   * @param userId - The user ID
   * @param profile - The profile to cache
   */
  async setCachedProfile(userId: string, profile: UserProfile): Promise<Result<void, AppError>> {
    return tryCatch(
      async () => {
        const cacheKey = this.createProfileCacheKey(userId);
        const serialized = JSON.stringify(profile);

        await redis.set(cacheKey, serialized, {
          expiration: new Date(Date.now() + PROFILE_CACHE_TTL),
        });
      },
      (error) => databaseError('setCachedProfile', String(error))
    );
  }

  /**
   * Invalidate cache for a specific user
   * Uses Redis to delete the cached profile
   * 
   * Requirements: 3.4
   * 
   * @param userId - The user ID to invalidate
   */
  async invalidateCache(userId: string): Promise<Result<void, AppError>> {
    return tryCatch(
      async () => {
        const cacheKey = this.createProfileCacheKey(userId);
        await redis.del(cacheKey);
        this.logInfo('UserCacheService', `Invalidated cache for user ${userId}`);
      },
      (error) => databaseError('invalidateCache', String(error))
    );
  }

  /**
   * Safely invalidate user cache - catches errors and logs them without throwing
   * This ensures cache invalidation failures don't crash the application.
   * 
   * Requirements: 3.4
   * 
   * @param userId - The user ID to invalidate
   */
  async safeInvalidateCache(userId: string): Promise<void> {
    const result = await this.invalidateCache(userId);
    if (!isOk(result)) {
      // Log but don't throw - invalidation failures should not crash
      this.logError('UserCacheService.safeInvalidateCache', result.error);
    }
  }

  /**
   * Get cache TTL value (for testing and configuration)
   */
  getCacheTTL(): number {
    return PROFILE_CACHE_TTL;
  }
}
