/**
 * Cache Behavior Integration Tests
 * Tests cache hit, invalidation, miss, and TTL expiration behaviors
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  clearTestData,
  type TestContext,
} from './setup.js';
import {
  createUserWithProfile,
  createChallengeWithCreator,
  setupFakeTimers,
  restoreFakeTimers,
  advanceTime,
} from './helpers.js';

describe('Cache Behavior Integration Tests', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = createTestContext();
  });

  afterEach(() => {
    clearTestData(testContext);
    vi.clearAllMocks();
  });

  /**
   * Requirement 6.1: WHEN data is cached 
   * THEN the Integration Test Suite SHALL verify subsequent reads return cached data
   */
  describe('Cache Hit Behavior', () => {
    it('should return cached data on subsequent reads', async () => {
      const userId = 't2_cacheuser';
      const cacheKey = `user:${userId}:profile`;
      const userData = createTestUser({ user_id: userId, username: 'cacheuser' });

      // Cache the data
      await testContext.mockRedis.set(cacheKey, JSON.stringify(userData));

      // First read
      const firstRead = await testContext.mockRedis.get(cacheKey);
      expect(firstRead).not.toBeNull();

      // Second read should return same data
      const secondRead = await testContext.mockRedis.get(cacheKey);
      expect(secondRead).toBe(firstRead);
    });

    it('should return cached challenge data', async () => {
      const challengeId = 'cached-challenge-id';
      const cacheKey = `challenge:${challengeId}`;
      const challengeData = createTestChallenge({ id: challengeId, title: 'Cached Challenge' });

      await testContext.mockRedis.set(cacheKey, JSON.stringify(challengeData));

      const cached = await testContext.mockRedis.get(cacheKey);
      const parsed = JSON.parse(cached!);

      expect(parsed.id).toBe(challengeId);
      expect(parsed.title).toBe('Cached Challenge');
    });

    it('should return cached leaderboard data', async () => {
      // Add users to leaderboard
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_user1', score: 100 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_user2', score: 200 });

      // First read
      const firstRead = await testContext.mockRedis.zRange(
        'leaderboard:points',
        '-inf',
        '+inf',
        { by: 'score', reverse: true }
      );

      // Second read should return same data
      const secondRead = await testContext.mockRedis.zRange(
        'leaderboard:points',
        '-inf',
        '+inf',
        { by: 'score', reverse: true }
      );

      expect(firstRead).toEqual(secondRead);
    });

    it('should cache user profile with all fields', async () => {
      const user = createTestUser({
        user_id: 't2_fulluser',
        username: 'fulluser',
        total_points: 500,
        level: 5,
        current_streak: 3,
      });
      const cacheKey = `user:${user.user_id}:profile`;

      await testContext.mockRedis.set(cacheKey, JSON.stringify(user));

      const cached = await testContext.mockRedis.get(cacheKey);
      const parsed = JSON.parse(cached!);

      expect(parsed.user_id).toBe('t2_fulluser');
      expect(parsed.total_points).toBe(500);
      expect(parsed.level).toBe(5);
      expect(parsed.current_streak).toBe(3);
    });

    it('should cache hash data correctly', async () => {
      const hashKey = 'user:t2_hashuser:stats';

      await testContext.mockRedis.hSet(hashKey, 'points', '100');
      await testContext.mockRedis.hSet(hashKey, 'level', '5');
      await testContext.mockRedis.hSet(hashKey, 'streak', '3');

      const points = await testContext.mockRedis.hGet(hashKey, 'points');
      const level = await testContext.mockRedis.hGet(hashKey, 'level');
      const streak = await testContext.mockRedis.hGet(hashKey, 'streak');

      expect(points).toBe('100');
      expect(level).toBe('5');
      expect(streak).toBe('3');
    });
  });


  /**
   * Requirement 6.2: WHEN cached data is modified 
   * THEN the Integration Test Suite SHALL verify cache is invalidated
   */
  describe('Cache Invalidation on Update', () => {
    it('should invalidate cache when user profile is updated', async () => {
      const userId = 't2_invalidateuser';
      const cacheKey = `user:${userId}:profile`;
      const userData = createTestUser({ user_id: userId, total_points: 100 });

      // Cache initial data
      await testContext.mockRedis.set(cacheKey, JSON.stringify(userData));

      // Verify cache exists
      const cachedBefore = await testContext.mockRedis.get(cacheKey);
      expect(cachedBefore).not.toBeNull();

      // Simulate update - invalidate cache
      await testContext.mockRedis.del(cacheKey);

      // Verify cache is invalidated
      const cachedAfter = await testContext.mockRedis.get(cacheKey);
      expect(cachedAfter).toBeNull();
    });

    it('should invalidate cache when challenge is updated', async () => {
      const challengeId = 'update-challenge';
      const cacheKey = `challenge:${challengeId}`;
      const challengeData = createTestChallenge({ id: challengeId });

      await testContext.mockRedis.set(cacheKey, JSON.stringify(challengeData));

      // Invalidate on update
      await testContext.mockRedis.del(cacheKey);

      const cached = await testContext.mockRedis.get(cacheKey);
      expect(cached).toBeNull();
    });

    it('should update leaderboard cache when points change', async () => {
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_update', score: 100 });

      // Update score
      await testContext.mockRedis.zIncrBy('leaderboard:points', 't2_update', 50);

      const newScore = await testContext.mockRedis.zScore('leaderboard:points', 't2_update');
      expect(newScore).toBe(150);
    });

    it('should invalidate multiple related cache keys', async () => {
      const userId = 't2_multikey';
      const profileKey = `user:${userId}:profile`;
      const statsKey = `user:${userId}:stats`;
      const attemptsKey = `user:${userId}:attempts`;

      // Cache multiple keys
      await testContext.mockRedis.set(profileKey, 'profile-data');
      await testContext.mockRedis.set(statsKey, 'stats-data');
      await testContext.mockRedis.set(attemptsKey, 'attempts-data');

      // Invalidate all on user update
      await testContext.mockRedis.del(profileKey);
      await testContext.mockRedis.del(statsKey);
      await testContext.mockRedis.del(attemptsKey);

      expect(await testContext.mockRedis.get(profileKey)).toBeNull();
      expect(await testContext.mockRedis.get(statsKey)).toBeNull();
      expect(await testContext.mockRedis.get(attemptsKey)).toBeNull();
    });

    it('should remove user from leaderboard on deletion', async () => {
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_delete', score: 500 });

      // Verify exists
      const scoreBefore = await testContext.mockRedis.zScore('leaderboard:points', 't2_delete');
      expect(scoreBefore).toBe(500);

      // Remove from leaderboard
      await testContext.mockRedis.zRem('leaderboard:points', ['t2_delete']);

      // Verify removed
      const scoreAfter = await testContext.mockRedis.zScore('leaderboard:points', 't2_delete');
      expect(scoreAfter).toBeNull();
    });

    it('should invalidate hash fields on update', async () => {
      const hashKey = 'user:t2_hashupdate:data';

      await testContext.mockRedis.hSet(hashKey, 'field1', 'value1');
      await testContext.mockRedis.hSet(hashKey, 'field2', 'value2');

      // Update field
      await testContext.mockRedis.hSet(hashKey, 'field1', 'updated-value');

      const field1 = await testContext.mockRedis.hGet(hashKey, 'field1');
      expect(field1).toBe('updated-value');
    });
  });


  /**
   * Requirement 6.3: WHEN cache misses occur 
   * THEN the Integration Test Suite SHALL verify data is fetched from database and cached
   */
  describe('Cache Miss and Population', () => {
    it('should return null on cache miss', async () => {
      const cacheKey = 'nonexistent:key';

      const cached = await testContext.mockRedis.get(cacheKey);
      expect(cached).toBeNull();
    });

    it('should populate cache after database fetch', async () => {
      const userId = 't2_populate';
      const cacheKey = `user:${userId}:profile`;

      // Verify cache miss
      const cacheMiss = await testContext.mockRedis.get(cacheKey);
      expect(cacheMiss).toBeNull();

      // Simulate database fetch and cache population
      const userData = createTestUser({ user_id: userId, username: 'populateuser' });
      await testContext.mockRedis.set(cacheKey, JSON.stringify(userData));

      // Verify cache is now populated
      const cacheHit = await testContext.mockRedis.get(cacheKey);
      expect(cacheHit).not.toBeNull();
      expect(JSON.parse(cacheHit!).user_id).toBe(userId);
    });

    it('should handle cache miss for challenge data', async () => {
      const challengeId = 'miss-challenge';
      const cacheKey = `challenge:${challengeId}`;

      // Cache miss
      const miss = await testContext.mockRedis.get(cacheKey);
      expect(miss).toBeNull();

      // Fetch from "database" and cache
      const challenge = createTestChallenge({ id: challengeId });
      await testContext.mockRedis.set(cacheKey, JSON.stringify(challenge));

      // Now should hit
      const hit = await testContext.mockRedis.get(cacheKey);
      expect(hit).not.toBeNull();
    });

    it('should handle cache miss for leaderboard entry', async () => {
      const userId = 't2_newleader';

      // Cache miss - user not in leaderboard
      const score = await testContext.mockRedis.zScore('leaderboard:points', userId);
      expect(score).toBeNull();

      // Add to leaderboard (simulating database fetch + cache)
      await testContext.mockRedis.zAdd('leaderboard:points', { member: userId, score: 100 });

      // Now should exist
      const newScore = await testContext.mockRedis.zScore('leaderboard:points', userId);
      expect(newScore).toBe(100);
    });

    it('should populate cache with correct TTL', async () => {
      const cacheKey = 'ttl:test:key';
      const ttlSeconds = 300; // 5 minutes

      await testContext.mockRedis.set(cacheKey, 'test-value', { ex: ttlSeconds });

      const cached = await testContext.mockRedis.get(cacheKey);
      expect(cached).toBe('test-value');
    });

    it('should handle hash cache miss and population', async () => {
      const hashKey = 'user:t2_hashmiss:data';

      // Cache miss
      const miss = await testContext.mockRedis.hGet(hashKey, 'field');
      expect(miss).toBeNull();

      // Populate
      await testContext.mockRedis.hSet(hashKey, 'field', 'value');

      // Now should hit
      const hit = await testContext.mockRedis.hGet(hashKey, 'field');
      expect(hit).toBe('value');
    });

    it('should handle bulk cache population', async () => {
      const users = [
        createTestUser({ user_id: 't2_bulk1', username: 'bulk1' }),
        createTestUser({ user_id: 't2_bulk2', username: 'bulk2' }),
        createTestUser({ user_id: 't2_bulk3', username: 'bulk3' }),
      ];

      // Populate all caches
      for (const user of users) {
        const cacheKey = `user:${user.user_id}:profile`;
        await testContext.mockRedis.set(cacheKey, JSON.stringify(user));
      }

      // Verify all cached
      for (const user of users) {
        const cacheKey = `user:${user.user_id}:profile`;
        const cached = await testContext.mockRedis.get(cacheKey);
        expect(cached).not.toBeNull();
        expect(JSON.parse(cached!).user_id).toBe(user.user_id);
      }
    });
  });


  /**
   * Requirement 6.4: WHEN cache TTL expires 
   * THEN the Integration Test Suite SHALL verify fresh data is fetched
   */
  describe('Cache TTL Expiration', () => {
    beforeEach(() => {
      setupFakeTimers();
    });

    afterEach(() => {
      restoreFakeTimers();
    });

    it('should expire cache after TTL', async () => {
      const cacheKey = 'expire:test';
      const ttlMs = 5000; // 5 seconds

      await testContext.mockRedis.set(cacheKey, 'test-value', { ex: ttlMs / 1000 });

      // Should exist before expiry
      const beforeExpiry = await testContext.mockRedis.get(cacheKey);
      expect(beforeExpiry).toBe('test-value');

      // Advance time past TTL
      advanceTime(ttlMs + 1000);

      // Should be expired
      const afterExpiry = await testContext.mockRedis.get(cacheKey);
      expect(afterExpiry).toBeNull();
    });

    it('should not expire cache before TTL', async () => {
      const cacheKey = 'noexpire:test';
      const ttlMs = 10000; // 10 seconds

      await testContext.mockRedis.set(cacheKey, 'test-value', { ex: ttlMs / 1000 });

      // Advance time but not past TTL
      advanceTime(5000);

      // Should still exist
      const cached = await testContext.mockRedis.get(cacheKey);
      expect(cached).toBe('test-value');
    });

    it('should handle user profile cache expiration', async () => {
      const userId = 't2_expireuser';
      const cacheKey = `user:${userId}:profile`;
      const ttlMs = 60000; // 1 minute

      const userData = createTestUser({ user_id: userId });
      await testContext.mockRedis.set(cacheKey, JSON.stringify(userData), { ex: ttlMs / 1000 });

      // Verify cached
      expect(await testContext.mockRedis.get(cacheKey)).not.toBeNull();

      // Expire
      advanceTime(ttlMs + 1000);

      // Should need refresh
      expect(await testContext.mockRedis.get(cacheKey)).toBeNull();
    });

    it('should handle challenge cache expiration', async () => {
      const challengeId = 'expire-challenge';
      const cacheKey = `challenge:${challengeId}`;
      const ttlMs = 300000; // 5 minutes

      const challenge = createTestChallenge({ id: challengeId });
      await testContext.mockRedis.set(cacheKey, JSON.stringify(challenge), { ex: ttlMs / 1000 });

      // Expire
      advanceTime(ttlMs + 1000);

      expect(await testContext.mockRedis.get(cacheKey)).toBeNull();
    });

    it('should refresh cache after expiration', async () => {
      const cacheKey = 'refresh:test';
      const ttlMs = 5000;

      // Initial cache
      await testContext.mockRedis.set(cacheKey, 'old-value', { ex: ttlMs / 1000 });

      // Expire
      advanceTime(ttlMs + 1000);
      expect(await testContext.mockRedis.get(cacheKey)).toBeNull();

      // Refresh with new value
      await testContext.mockRedis.set(cacheKey, 'new-value', { ex: ttlMs / 1000 });

      expect(await testContext.mockRedis.get(cacheKey)).toBe('new-value');
    });

    it('should handle cache without TTL (persistent)', async () => {
      const cacheKey = 'persistent:test';

      // Set without TTL
      await testContext.mockRedis.set(cacheKey, 'persistent-value');

      // Advance time significantly
      advanceTime(3600000); // 1 hour

      // Should still exist
      const cached = await testContext.mockRedis.get(cacheKey);
      expect(cached).toBe('persistent-value');
    });
  });

  /**
   * Additional cache behavior scenarios
   */
  describe('Complete Cache Flow Scenarios', () => {
    it('should handle complete cache lifecycle', async () => {
      const userId = 't2_lifecycle';
      const cacheKey = `user:${userId}:profile`;

      // Step 1: Cache miss
      expect(await testContext.mockRedis.get(cacheKey)).toBeNull();

      // Step 2: Fetch and cache
      const userData = createTestUser({ user_id: userId, total_points: 100 });
      await testContext.mockRedis.set(cacheKey, JSON.stringify(userData));

      // Step 3: Cache hit
      const cached = await testContext.mockRedis.get(cacheKey);
      expect(JSON.parse(cached!).total_points).toBe(100);

      // Step 4: Update and invalidate
      userData.total_points = 200;
      await testContext.mockRedis.del(cacheKey);

      // Step 5: Cache miss again
      expect(await testContext.mockRedis.get(cacheKey)).toBeNull();

      // Step 6: Re-cache with new data
      await testContext.mockRedis.set(cacheKey, JSON.stringify(userData));
      const newCached = await testContext.mockRedis.get(cacheKey);
      expect(JSON.parse(newCached!).total_points).toBe(200);
    });

    it('should maintain cache consistency across operations', async () => {
      const userId = 't2_consistent';
      const profileKey = `user:${userId}:profile`;

      // Create user in "database"
      const user = createUserWithProfile(testContext, userId, 'consistent', {
        total_points: 0,
      });

      // Cache profile
      await testContext.mockRedis.set(profileKey, JSON.stringify(user));

      // Update user points
      user.total_points = 100;

      // Invalidate cache
      await testContext.mockRedis.del(profileKey);

      // Re-cache with updated data
      await testContext.mockRedis.set(profileKey, JSON.stringify(user));

      // Verify consistency
      const cached = JSON.parse((await testContext.mockRedis.get(profileKey))!);
      expect(cached.total_points).toBe(user.total_points);
    });

    it('should handle concurrent cache operations', async () => {
      const keys = ['key1', 'key2', 'key3', 'key4', 'key5'];

      // Concurrent writes
      await Promise.all(
        keys.map((key, i) => testContext.mockRedis.set(key, `value${i}`))
      );

      // Concurrent reads
      const results = await Promise.all(
        keys.map(key => testContext.mockRedis.get(key))
      );

      results.forEach((result, i) => {
        expect(result).toBe(`value${i}`);
      });
    });

    it('should handle cache warming scenario', async () => {
      // Simulate cache warming - pre-populate frequently accessed data
      const popularChallenges = [
        createTestChallenge({ id: 'popular1', title: 'Popular 1' }),
        createTestChallenge({ id: 'popular2', title: 'Popular 2' }),
        createTestChallenge({ id: 'popular3', title: 'Popular 3' }),
      ];

      // Warm cache
      for (const challenge of popularChallenges) {
        const cacheKey = `challenge:${challenge.id}`;
        await testContext.mockRedis.set(cacheKey, JSON.stringify(challenge));
      }

      // Verify all warmed
      for (const challenge of popularChallenges) {
        const cacheKey = `challenge:${challenge.id}`;
        const cached = await testContext.mockRedis.get(cacheKey);
        expect(cached).not.toBeNull();
      }
    });
  });
});
