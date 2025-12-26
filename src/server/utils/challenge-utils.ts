/**
 * Server-side Challenge Utility Functions
 * Helper functions that require async context (Reddit API calls)
 */

import type { Context } from '@devvit/server/server-context';
import { redis, reddit } from '@devvit/web/server';
import { CacheService, TTL } from '../services/cache.service.js';
import { CacheKeyBuilder } from '../../shared/utils/cache.js';

/**
 * Fetch avatar URL for a user by username (uncached)
 * @param context - Devvit context
 * @param username - Reddit username
 * @returns Avatar URL or undefined if not found
 */
export async function fetchAvatarUrl(
  _context: Context,
  username: string
): Promise<string | undefined> {
  try {
    const user = await reddit.getUserByUsername(username);
    return user ? await user.getSnoovatarUrl() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch avatar URL with Redis caching (24-hour TTL)
 * Reduces Reddit API calls for repeated lookups of the same user's avatar.
 * 
 * @param context - Devvit context
 * @param username - Reddit username
 * @returns Avatar URL or undefined if not found
 * 
 * Requirements: 5.3
 */
export async function fetchAvatarUrlCached(
  context: Context,
  username: string
): Promise<string | undefined> {
  const cacheService = new CacheService(context);
  
  return cacheService.getAvatarUrlWithCache(username, async () => {
    return fetchAvatarUrl(context, username);
  });
}

/**
 * Get avatar URL directly from Redis cache without fetching
 * Useful for checking if an avatar is already cached.
 * 
 * @param context - Devvit context
 * @param username - Reddit username
 * @returns Cached avatar URL or null if not cached
 */
export async function getCachedAvatarUrl(
  _context: Context,
  username: string
): Promise<string | null> {
  try {
    const cacheKey = CacheKeyBuilder.createKey('avatar', username);
    const value = await redis.get(cacheKey);
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Set avatar URL in Redis cache with 24-hour TTL
 * Useful for pre-populating the cache.
 * 
 * @param context - Devvit context
 * @param username - Reddit username
 * @param avatarUrl - Avatar URL to cache
 */
export async function setCachedAvatarUrl(
  _context: Context,
  username: string,
  avatarUrl: string
): Promise<void> {
  try {
    const cacheKey = CacheKeyBuilder.createKey('avatar', username);
    await redis.set(cacheKey, avatarUrl, {
      expiration: new Date(Date.now() + TTL.AVATAR),
    });
  } catch {
    // Silent failure - cache errors should not crash the application
  }
}
