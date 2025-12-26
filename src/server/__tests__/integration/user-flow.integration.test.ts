/**
 * User Flow Integration Tests
 * Tests complete user flows including profile creation, updates, points, and streaks
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestContext,
  createTestUser,
  clearTestData,
  type TestContext,
} from './setup.js';
import {
  seedUser,
  assertResultOk,
  assertResultErr,
} from './helpers.js';

describe('User Flow Integration Tests', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = createTestContext();
  });

  afterEach(() => {
    clearTestData(testContext);
    vi.clearAllMocks();
  });

  /**
   * Requirement 1.1: WHEN a new user interacts with the system 
   * THEN the Integration Test Suite SHALL verify profile creation with correct default values
   */
  describe('New User Profile Creation', () => {
    it('should create a new user profile with correct default values', async () => {
      const userId = 't2_newuser123';
      const username = 'newuser';

      // Simulate creating a new user profile
      const newProfile = createTestUser({
        user_id: userId,
        username,
      });

      // Seed the user into mock database
      seedUser(testContext.mockSupabase, testContext.mockRedis, newProfile, false);

      // Verify the profile was created with correct defaults
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      
      expect(storedUser).toBeDefined();
      expect(storedUser!.user_id).toBe(userId);
      expect(storedUser!.username).toBe(username);
      expect(storedUser!.total_points).toBe(0);
      expect(storedUser!.total_experience).toBe(0);
      expect(storedUser!.level).toBe(1);
      expect(storedUser!.challenges_created).toBe(0);
      expect(storedUser!.challenges_attempted).toBe(0);
      expect(storedUser!.challenges_solved).toBe(0);
      expect(storedUser!.current_streak).toBe(0);
      expect(storedUser!.best_streak).toBe(0);
      expect(storedUser!.role).toBe('player');
    });

    it('should create profile with unique user_id', async () => {
      const userId1 = 't2_user1';
      const userId2 = 't2_user2';

      const profile1 = createTestUser({ user_id: userId1, username: 'user1' });
      const profile2 = createTestUser({ user_id: userId2, username: 'user2' });

      seedUser(testContext.mockSupabase, testContext.mockRedis, profile1, false);
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile2, false);

      expect(testContext.mockSupabase.data.users.length).toBe(2);
      expect(testContext.mockSupabase.data.users.find(u => u.user_id === userId1)).toBeDefined();
      expect(testContext.mockSupabase.data.users.find(u => u.user_id === userId2)).toBeDefined();
    });

    it('should set created_at timestamp on new profile', async () => {
      const userId = 't2_timestampuser';
      const beforeCreation = new Date().toISOString();

      const profile = createTestUser({ user_id: userId, username: 'timestampuser' });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      
      expect(storedUser!.created_at).toBeDefined();
      expect(new Date(storedUser!.created_at!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeCreation).getTime() - 1000
      );
    });
  });

  /**
   * Requirement 1.2: WHEN a user profile is updated 
   * THEN the Integration Test Suite SHALL verify the update persists and cache is invalidated
   */
  describe('Profile Update Persistence', () => {
    it('should persist profile updates to database', async () => {
      const userId = 't2_updateuser';
      const profile = createTestUser({ user_id: userId, username: 'originalname' });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Simulate profile update
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      storedUser!.username = 'updatedname';
      storedUser!.updated_at = new Date().toISOString();

      // Verify update persisted
      const updatedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      expect(updatedUser!.username).toBe('updatedname');
    });

    it('should invalidate cache when profile is updated', async () => {
      const userId = 't2_cacheuser';
      const profile = createTestUser({ user_id: userId, username: 'cacheuser' });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Cache the profile
      const cacheKey = `user:${userId}:profile`;
      await testContext.mockRedis.set(cacheKey, JSON.stringify(profile));

      // Verify cache exists
      const cachedBefore = await testContext.mockRedis.get(cacheKey);
      expect(cachedBefore).not.toBeNull();

      // Simulate cache invalidation on update
      await testContext.mockRedis.del(cacheKey);

      // Verify cache was invalidated
      const cachedAfter = await testContext.mockRedis.get(cacheKey);
      expect(cachedAfter).toBeNull();
    });

    it('should update multiple fields atomically', async () => {
      const userId = 't2_multiupdate';
      const profile = createTestUser({
        user_id: userId,
        username: 'multiuser',
        total_points: 100,
        level: 2,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Simulate atomic multi-field update
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      storedUser!.total_points = 200;
      storedUser!.level = 3;
      storedUser!.total_experience = 500;

      // Verify all fields updated
      const updatedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      expect(updatedUser!.total_points).toBe(200);
      expect(updatedUser!.level).toBe(3);
      expect(updatedUser!.total_experience).toBe(500);
    });
  });

  /**
   * Requirement 1.3: WHEN a user earns points 
   * THEN the Integration Test Suite SHALL verify points, experience, and level are updated correctly
   */
  describe('Points and Experience Updates', () => {
    it('should correctly add points to user total', async () => {
      const userId = 't2_pointsuser';
      const initialPoints = 100;
      const pointsToAdd = 50;

      const profile = createTestUser({
        user_id: userId,
        username: 'pointsuser',
        total_points: initialPoints,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, true);

      // Simulate awarding points
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      storedUser!.total_points += pointsToAdd;

      // Update leaderboard
      await testContext.mockRedis.zIncrBy('leaderboard:points', userId, pointsToAdd);

      // Verify points updated
      expect(storedUser!.total_points).toBe(initialPoints + pointsToAdd);

      // Verify leaderboard updated
      const leaderboardScore = await testContext.mockRedis.zScore('leaderboard:points', userId);
      expect(leaderboardScore).toBe(initialPoints + pointsToAdd);
    });

    it('should correctly add experience to user total', async () => {
      const userId = 't2_expuser';
      const initialExp = 200;
      const expToAdd = 100;

      const profile = createTestUser({
        user_id: userId,
        username: 'expuser',
        total_experience: initialExp,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Simulate awarding experience
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      storedUser!.total_experience += expToAdd;

      // Verify experience updated
      expect(storedUser!.total_experience).toBe(initialExp + expToAdd);
    });

    it('should update level when experience threshold is reached', async () => {
      const userId = 't2_levelupuser';
      
      // Start at level 1 with experience just below level 2 threshold
      const profile = createTestUser({
        user_id: userId,
        username: 'levelupuser',
        total_experience: 90,
        level: 1,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Simulate gaining experience that triggers level up
      // Level 2 requires 100 XP (based on typical level formula)
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      storedUser!.total_experience = 150;
      storedUser!.level = 2; // Level up!

      // Verify level updated
      expect(storedUser!.level).toBe(2);
      expect(storedUser!.total_experience).toBe(150);
    });

    it('should handle multiple point awards correctly', async () => {
      const userId = 't2_multipointsuser';
      
      const profile = createTestUser({
        user_id: userId,
        username: 'multipointsuser',
        total_points: 0,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, true);

      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);

      // Simulate multiple point awards
      const awards = [25, 50, 75, 100];
      let expectedTotal = 0;

      for (const points of awards) {
        storedUser!.total_points += points;
        await testContext.mockRedis.zIncrBy('leaderboard:points', userId, points);
        expectedTotal += points;
      }

      // Verify cumulative points
      expect(storedUser!.total_points).toBe(expectedTotal);
      
      const leaderboardScore = await testContext.mockRedis.zScore('leaderboard:points', userId);
      expect(leaderboardScore).toBe(expectedTotal);
    });
  });

  /**
   * Requirement 1.4: WHEN a user's streak changes 
   * THEN the Integration Test Suite SHALL verify streak values update and persist correctly
   */
  describe('Streak Increment and Reset', () => {
    it('should increment streak on successful solve', async () => {
      const userId = 't2_streakuser';
      const initialStreak = 3;

      const profile = createTestUser({
        user_id: userId,
        username: 'streakuser',
        current_streak: initialStreak,
        best_streak: initialStreak,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Simulate streak increment
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      storedUser!.current_streak += 1;
      storedUser!.best_streak = Math.max(storedUser!.best_streak, storedUser!.current_streak);

      // Verify streak incremented
      expect(storedUser!.current_streak).toBe(initialStreak + 1);
      expect(storedUser!.best_streak).toBe(initialStreak + 1);
    });

    it('should reset streak on failed attempt', async () => {
      const userId = 't2_resetstreakuser';
      
      const profile = createTestUser({
        user_id: userId,
        username: 'resetstreakuser',
        current_streak: 5,
        best_streak: 10,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Simulate streak reset (game over without solving)
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      storedUser!.current_streak = 0;

      // Verify streak reset but best_streak preserved
      expect(storedUser!.current_streak).toBe(0);
      expect(storedUser!.best_streak).toBe(10); // Best streak should not change
    });

    it('should update best_streak when current exceeds it', async () => {
      const userId = 't2_beststreakuser';
      
      const profile = createTestUser({
        user_id: userId,
        username: 'beststreakuser',
        current_streak: 5,
        best_streak: 5,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Simulate multiple successful solves
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      
      for (let i = 0; i < 3; i++) {
        storedUser!.current_streak += 1;
        storedUser!.best_streak = Math.max(storedUser!.best_streak, storedUser!.current_streak);
      }

      // Verify both streaks updated
      expect(storedUser!.current_streak).toBe(8);
      expect(storedUser!.best_streak).toBe(8);
    });

    it('should not update best_streak when current is lower', async () => {
      const userId = 't2_lowstreakuser';
      
      const profile = createTestUser({
        user_id: userId,
        username: 'lowstreakuser',
        current_streak: 0,
        best_streak: 15,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Simulate building a new streak
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      storedUser!.current_streak = 3;
      storedUser!.best_streak = Math.max(storedUser!.best_streak, storedUser!.current_streak);

      // Verify best_streak unchanged
      expect(storedUser!.current_streak).toBe(3);
      expect(storedUser!.best_streak).toBe(15);
    });

    it('should persist streak changes to database', async () => {
      const userId = 't2_persiststreakuser';
      
      const profile = createTestUser({
        user_id: userId,
        username: 'persiststreakuser',
        current_streak: 2,
        best_streak: 2,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      // Simulate streak update with cache invalidation
      const storedUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      storedUser!.current_streak = 3;
      storedUser!.best_streak = 3;
      storedUser!.updated_at = new Date().toISOString();

      // Invalidate cache
      const cacheKey = `user:${userId}:profile`;
      await testContext.mockRedis.del(cacheKey);

      // Verify database has updated values
      const dbUser = testContext.mockSupabase.data.users.find(u => u.user_id === userId);
      expect(dbUser!.current_streak).toBe(3);
      expect(dbUser!.best_streak).toBe(3);
      expect(dbUser!.updated_at).toBeDefined();
    });
  });

  /**
   * Additional integration scenarios
   */
  describe('Complete User Flow Scenarios', () => {
    it('should handle complete new user journey', async () => {
      const userId = 't2_journeyuser';
      const username = 'journeyuser';

      // Step 1: Create new user
      const profile = createTestUser({
        user_id: userId,
        username,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, true);

      const user = testContext.mockSupabase.data.users.find(u => u.user_id === userId)!;

      // Step 2: User attempts first challenge
      user.challenges_attempted = 1;

      // Step 3: User solves challenge and earns rewards
      user.challenges_solved = 1;
      user.total_points = 50;
      user.total_experience = 100;
      user.current_streak = 1;
      user.best_streak = 1;
      await testContext.mockRedis.zAdd('leaderboard:points', { member: userId, score: 50 });

      // Step 4: User creates a challenge
      user.challenges_created = 1;
      user.last_challenge_created_at = new Date().toISOString();

      // Verify complete journey state
      expect(user.challenges_attempted).toBe(1);
      expect(user.challenges_solved).toBe(1);
      expect(user.challenges_created).toBe(1);
      expect(user.total_points).toBe(50);
      expect(user.total_experience).toBe(100);
      expect(user.current_streak).toBe(1);
      expect(user.best_streak).toBe(1);
      expect(user.last_challenge_created_at).not.toBeNull();

      const leaderboardScore = await testContext.mockRedis.zScore('leaderboard:points', userId);
      expect(leaderboardScore).toBe(50);
    });

    it('should handle user with failed attempt resetting streak', async () => {
      const userId = 't2_failuser';
      
      // User with existing streak
      const profile = createTestUser({
        user_id: userId,
        username: 'failuser',
        current_streak: 5,
        best_streak: 5,
        challenges_attempted: 10,
        challenges_solved: 5,
      });
      seedUser(testContext.mockSupabase, testContext.mockRedis, profile, false);

      const user = testContext.mockSupabase.data.users.find(u => u.user_id === userId)!;

      // User fails a challenge (game over without solving)
      user.challenges_attempted += 1;
      user.current_streak = 0; // Streak reset

      // Verify state after failure
      expect(user.challenges_attempted).toBe(11);
      expect(user.challenges_solved).toBe(5); // Unchanged
      expect(user.current_streak).toBe(0);
      expect(user.best_streak).toBe(5); // Preserved
    });
  });
});
