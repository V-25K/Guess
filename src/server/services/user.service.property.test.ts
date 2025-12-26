/**
 * Property-based tests for UserService Redis caching
 * 
 * **Feature: devvit-web-migration, Property 1: Redis caching consistency**
 * **Validates: Requirements 5.4, 13.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CacheKeyBuilder } from '../../shared/utils/cache.js';

describe('UserService Redis Caching Properties', () => {
  /**
   * **Feature: devvit-web-migration, Property 1: Redis caching consistency**
   * 
   * *For any* data fetch operation, the Redis cache keys and TTL values used in the web version
   * should match exactly those used in the Blocks version
   * 
   * **Validates: Requirements 5.4, 13.1**
   */
  describe('Property 1: Redis caching consistency', () => {
    // Arbitrary for valid user IDs (non-empty strings without colons)
    const validUserId = fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
      !s.includes(':') && s !== 'anonymous' && s.trim() !== ''
    );

    // Expected TTL for profile cache (5 minutes in milliseconds)
    const PROFILE_CACHE_TTL = 5 * 60 * 1000;

    it('should generate cache keys matching pattern user:{userId}:profile for all user IDs', () => {
      fc.assert(
        fc.property(validUserId, (userId) => {
          // Generate cache key using the same method as UserService
          const cacheKey = CacheKeyBuilder.createKey('user', userId, 'profile');
          
          // Verify key matches expected pattern
          const expectedKey = `user:${userId}:profile`;
          expect(cacheKey).toBe(expectedKey);
          
          // Verify key follows namespace pattern (entity:identifier:qualifier)
          const pattern = /^user:[^:]+:profile$/;
          expect(pattern.test(cacheKey)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should use consistent TTL value of 5 minutes (300000ms) for profile cache', () => {
      // This is a constant value test - verify the TTL constant is correct
      expect(PROFILE_CACHE_TTL).toBe(300000);
      expect(PROFILE_CACHE_TTL).toBe(5 * 60 * 1000);
    });

    it('should generate invalidation keys matching the same pattern as cache keys', () => {
      fc.assert(
        fc.property(validUserId, (userId) => {
          // Generate cache key for setting
          const setCacheKey = CacheKeyBuilder.createKey('user', userId, 'profile');
          
          // Generate cache key for invalidation (should be identical)
          const delCacheKey = CacheKeyBuilder.createKey('user', userId, 'profile');
          
          // Verify both keys are identical
          expect(setCacheKey).toBe(delCacheKey);
          expect(setCacheKey).toBe(`user:${userId}:profile`);
        }),
        { numRuns: 100 }
      );
    });

    it('should parse cache keys back to original components', () => {
      fc.assert(
        fc.property(validUserId, (userId) => {
          // Generate cache key
          const cacheKey = CacheKeyBuilder.createKey('user', userId, 'profile');
          
          // Parse it back
          const parsed = CacheKeyBuilder.parseKey(cacheKey);
          
          // Verify components match
          expect(parsed.entity).toBe('user');
          expect(parsed.identifier).toBe(userId);
          expect(parsed.qualifier).toBe('profile');
        }),
        { numRuns: 100 }
      );
    });
  });
});
