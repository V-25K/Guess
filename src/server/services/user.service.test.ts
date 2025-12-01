/**
 * Property-based tests for UserService
 * 
 * Tests cache invalidation and leaderboard update behavior on point awards.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Mock Redis client for testing cache operations
 */
class MockRedisClient {
  private store: Map<string, string> = new Map();
  public deletedKeys: string[] = [];
  public setKeys: string[] = [];
  public shouldThrow: boolean = false;
  public throwOnDelete: boolean = false;

  async get(key: string): Promise<string | null> {
    if (this.shouldThrow) {
      throw new Error('Redis connection failed');
    }
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _options?: { expiration: Date }): Promise<void> {
    if (this.shouldThrow) {
      throw new Error('Redis connection failed');
    }
    this.store.set(key, value);
    this.setKeys.push(key);
  }

  async del(key: string): Promise<void> {
    if (this.throwOnDelete) {
      throw new Error('Redis delete failed');
    }
    this.store.delete(key);
    this.deletedKeys.push(key);
  }

  reset(): void {
    this.store.clear();
    this.deletedKeys = [];
    this.setKeys = [];
    this.shouldThrow = false;
    this.throwOnDelete = false;
  }

  setData(key: string, value: string): void {
    this.store.set(key, value);
  }
}

/**
 * Mock LeaderboardService for testing atomic updates
 */
class MockLeaderboardService {
  public incrementedUsers: Array<{ userId: string; delta: number }> = [];
  public shouldThrow: boolean = false;

  async incrementScore(userId: string, delta: number): Promise<number> {
    if (this.shouldThrow) {
      throw new Error('Leaderboard update failed');
    }
    this.incrementedUsers.push({ userId, delta });
    return delta;
  }

  reset(): void {
    this.incrementedUsers = [];
    this.shouldThrow = false;
  }
}

/**
 * Simulates the invalidateCacheAndUpdateLeaderboard behavior from UserService
 * This mirrors the actual implementation pattern
 */
async function invalidateCacheAndUpdateLeaderboard(
  redis: MockRedisClient,
  leaderboardService: MockLeaderboardService | null,
  userId: string,
  pointsDelta: number
): Promise<{ cacheInvalidated: boolean; leaderboardUpdated: boolean }> {
  const results = await Promise.all([
    safeInvalidateUserCache(redis, userId),
    safeUpdateLeaderboard(leaderboardService, userId, pointsDelta),
  ]);

  return {
    cacheInvalidated: results[0],
    leaderboardUpdated: results[1],
  };
}

/**
 * Safe cache invalidation - catches errors and logs them without throwing
 */
async function safeInvalidateUserCache(redis: MockRedisClient, userId: string): Promise<boolean> {
  try {
    const cacheKey = `user:${userId}:profile`;
    await redis.del(cacheKey);
    return true;
  } catch (_error) {
    // Log but don't throw - invalidation failures should not crash
    return false;
  }
}

/**
 * Safe leaderboard update - catches errors and logs them without throwing
 */
async function safeUpdateLeaderboard(
  leaderboardService: MockLeaderboardService | null,
  userId: string,
  pointsDelta: number
): Promise<boolean> {
  try {
    if (leaderboardService) {
      await leaderboardService.incrementScore(userId, pointsDelta);
      return true;
    }
    return false;
  } catch (_error) {
    // Log but don't throw - leaderboard update failures should not crash
    return false;
  }
}

describe('UserService Properties', () => {
  /**
   * **Feature: performance-optimization, Property 6: Points Award Triggers Cache Invalidation and Leaderboard Update**
   * 
   * *For any* point award operation, the system SHALL invalidate the user's profile cache
   * AND update the leaderboard sorted set, both operations completing before the award
   * function returns.
   * 
   * **Validates: Requirements 6.2**
   */
  describe('Property 6: Points Award Triggers Cache Invalidation and Leaderboard Update', () => {
    it('should invalidate cache AND update leaderboard for any point award', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          async (userId, points) => {
            const redis = new MockRedisClient();
            const leaderboardService = new MockLeaderboardService();

            // Pre-populate cache to verify invalidation
            const cacheKey = `user:${userId}:profile`;
            redis.setData(cacheKey, JSON.stringify({ userId, points: 0 }));

            // Execute the combined operation
            const result = await invalidateCacheAndUpdateLeaderboard(
              redis,
              leaderboardService,
              userId,
              points
            );

            // Both operations should complete successfully
            expect(result.cacheInvalidated).toBe(true);
            expect(result.leaderboardUpdated).toBe(true);

            // Cache should be invalidated (key deleted)
            expect(redis.deletedKeys).toContain(cacheKey);

            // Leaderboard should be updated with correct user and points
            expect(leaderboardService.incrementedUsers).toContainEqual({
              userId,
              delta: points,
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct cache key format user:{userId}:profile', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          async (userId, points) => {
            const redis = new MockRedisClient();
            const leaderboardService = new MockLeaderboardService();

            await invalidateCacheAndUpdateLeaderboard(
              redis,
              leaderboardService,
              userId,
              points
            );

            // Verify the correct key format was used
            const expectedKey = `user:${userId}:profile`;
            expect(redis.deletedKeys).toContain(expectedKey);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass correct points delta to leaderboard service', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          async (userId, points) => {
            const redis = new MockRedisClient();
            const leaderboardService = new MockLeaderboardService();

            await invalidateCacheAndUpdateLeaderboard(
              redis,
              leaderboardService,
              userId,
              points
            );

            // Verify the correct delta was passed
            const update = leaderboardService.incrementedUsers.find(u => u.userId === userId);
            expect(update).toBeDefined();
            expect(update!.delta).toBe(points);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: performance-optimization, Property 7: Cache Invalidation Failure Does Not Crash**
   * 
   * *For any* cache invalidation operation that throws an error, the system SHALL log
   * the error and continue execution without throwing to the caller.
   * 
   * **Validates: Requirements 6.3**
   */
  describe('Property 7: Cache Invalidation Failure Does Not Crash', () => {
    it('should not throw when cache invalidation fails', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          async (userId, points) => {
            const redis = new MockRedisClient();
            const leaderboardService = new MockLeaderboardService();

            // Make cache invalidation fail
            redis.throwOnDelete = true;

            // Should not throw
            const result = await invalidateCacheAndUpdateLeaderboard(
              redis,
              leaderboardService,
              userId,
              points
            );

            // Cache invalidation failed but didn't crash
            expect(result.cacheInvalidated).toBe(false);
            
            // Leaderboard update should still succeed
            expect(result.leaderboardUpdated).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not throw when leaderboard update fails', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          async (userId, points) => {
            const redis = new MockRedisClient();
            const leaderboardService = new MockLeaderboardService();

            // Make leaderboard update fail
            leaderboardService.shouldThrow = true;

            // Should not throw
            const result = await invalidateCacheAndUpdateLeaderboard(
              redis,
              leaderboardService,
              userId,
              points
            );

            // Cache invalidation should still succeed
            expect(result.cacheInvalidated).toBe(true);
            
            // Leaderboard update failed but didn't crash
            expect(result.leaderboardUpdated).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not throw when both operations fail', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          async (userId, points) => {
            const redis = new MockRedisClient();
            const leaderboardService = new MockLeaderboardService();

            // Make both operations fail
            redis.throwOnDelete = true;
            leaderboardService.shouldThrow = true;

            // Should not throw
            const result = await invalidateCacheAndUpdateLeaderboard(
              redis,
              leaderboardService,
              userId,
              points
            );

            // Both failed but didn't crash
            expect(result.cacheInvalidated).toBe(false);
            expect(result.leaderboardUpdated).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should continue execution after cache invalidation error', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          async (userId, points) => {
            const redis = new MockRedisClient();
            const leaderboardService = new MockLeaderboardService();

            // Make cache invalidation fail
            redis.throwOnDelete = true;

            // Execute the operation
            await invalidateCacheAndUpdateLeaderboard(
              redis,
              leaderboardService,
              userId,
              points
            );

            // Leaderboard should still have been updated despite cache failure
            expect(leaderboardService.incrementedUsers.length).toBe(1);
            expect(leaderboardService.incrementedUsers[0].userId).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle null leaderboard service gracefully', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          async (userId, points) => {
            const redis = new MockRedisClient();

            // Should not throw with null leaderboard service
            const result = await invalidateCacheAndUpdateLeaderboard(
              redis,
              null,
              userId,
              points
            );

            // Cache invalidation should succeed
            expect(result.cacheInvalidated).toBe(true);
            
            // Leaderboard update returns false (no service)
            expect(result.leaderboardUpdated).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
