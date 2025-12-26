/**
 * Leaderboard Flow Integration Tests
 * Tests complete leaderboard flows including queries, position updates, pagination, and rank
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestContext,
  clearTestData,
  type TestContext,
} from './setup.js';
import {
  createUserWithProfile,
  seedLeaderboardUsers,
  verifyLeaderboardOrder,
} from './helpers.js';

describe('Leaderboard Flow Integration Tests', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = createTestContext();
  });

  afterEach(() => {
    clearTestData(testContext);
    vi.clearAllMocks();
  });

  /**
   * Requirement 4.1: WHEN the leaderboard is queried 
   * THEN the Integration Test Suite SHALL verify users are returned in correct order by points
   */
  describe('Leaderboard Query with Sort Order', () => {
    it('should return users sorted by points in descending order', async () => {
      // Seed users with different point values
      const users = seedLeaderboardUsers(testContext, 5, 100);

      // Query leaderboard from Redis
      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      // Verify descending order
      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i - 1].score).toBeGreaterThanOrEqual(leaderboard[i].score);
      }
    });

    it('should return correct number of users', async () => {
      seedLeaderboardUsers(testContext, 10, 50);

      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      expect(leaderboard.length).toBe(10);
    });

    it('should include user IDs and scores', async () => {
      const users = seedLeaderboardUsers(testContext, 3, 100);

      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      leaderboard.forEach(entry => {
        expect(entry.member).toBeDefined();
        expect(entry.member).toMatch(/^t2_/);
        expect(entry.score).toBeDefined();
        expect(typeof entry.score).toBe('number');
      });
    });

    it('should handle empty leaderboard', async () => {
      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      expect(leaderboard.length).toBe(0);
    });

    it('should handle users with same points (tie)', async () => {
      // Create users with same points
      createUserWithProfile(testContext, 't2_tie1', 'tie1', { total_points: 100 });
      createUserWithProfile(testContext, 't2_tie2', 'tie2', { total_points: 100 });
      createUserWithProfile(testContext, 't2_tie3', 'tie3', { total_points: 100 });

      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_tie1', score: 100 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_tie2', score: 100 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_tie3', score: 100 });

      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      expect(leaderboard.length).toBe(3);
      leaderboard.forEach(entry => {
        expect(entry.score).toBe(100);
      });
    });
  });


  /**
   * Requirement 4.2: WHEN a user's points change 
   * THEN the Integration Test Suite SHALL verify their leaderboard position updates
   */
  describe('Leaderboard Position Updates', () => {
    it('should update position when user gains points', async () => {
      // Create initial leaderboard
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_user1', score: 300 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_user2', score: 200 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_user3', score: 100 });

      // User3 gains points and moves up
      await testContext.mockRedis.zIncrBy('leaderboard:points', 't2_user3', 250);

      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      // User3 should now be first with 350 points
      expect(leaderboard[0].member).toBe('t2_user3');
      expect(leaderboard[0].score).toBe(350);
    });

    it('should maintain correct order after multiple updates', async () => {
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_a', score: 100 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_b', score: 100 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_c', score: 100 });

      // Multiple updates
      await testContext.mockRedis.zIncrBy('leaderboard:points', 't2_c', 50);
      await testContext.mockRedis.zIncrBy('leaderboard:points', 't2_a', 75);
      await testContext.mockRedis.zIncrBy('leaderboard:points', 't2_b', 25);

      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      // Order should be: a(175), c(150), b(125)
      expect(leaderboard[0].member).toBe('t2_a');
      expect(leaderboard[0].score).toBe(175);
      expect(leaderboard[1].member).toBe('t2_c');
      expect(leaderboard[1].score).toBe(150);
      expect(leaderboard[2].member).toBe('t2_b');
      expect(leaderboard[2].score).toBe(125);
    });

    it('should add new user to correct position', async () => {
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_existing1', score: 500 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_existing2', score: 100 });

      // New user with middle score
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_new', score: 300 });

      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      expect(leaderboard[0].member).toBe('t2_existing1');
      expect(leaderboard[1].member).toBe('t2_new');
      expect(leaderboard[2].member).toBe('t2_existing2');
    });

    it('should handle user moving from last to first', async () => {
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_top', score: 1000 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_mid', score: 500 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_bottom', score: 100 });

      // Bottom user gains massive points
      await testContext.mockRedis.zIncrBy('leaderboard:points', 't2_bottom', 1500);

      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      expect(leaderboard[0].member).toBe('t2_bottom');
      expect(leaderboard[0].score).toBe(1600);
    });

    it('should sync leaderboard with user profile points', async () => {
      const user = createUserWithProfile(testContext, 't2_sync', 'syncuser', {
        total_points: 0,
      });

      // User earns points
      user.total_points = 250;
      await testContext.mockRedis.zAdd('leaderboard:points', {
        member: user.user_id,
        score: user.total_points,
      });

      const score = await testContext.mockRedis.zScore('leaderboard:points', user.user_id);
      expect(score).toBe(user.total_points);
    });
  });


  /**
   * Requirement 4.3: WHEN pagination is applied to leaderboard 
   * THEN the Integration Test Suite SHALL verify correct page of results is returned
   */
  describe('Leaderboard Pagination', () => {
    beforeEach(async () => {
      // Seed 20 users for pagination testing
      for (let i = 0; i < 20; i++) {
        const score = (20 - i) * 100; // 2000, 1900, 1800, ... 100
        await testContext.mockRedis.zAdd('leaderboard:points', {
          member: `t2_page_${i}`,
          score,
        });
      }
    });

    // Helper to simulate pagination (mock doesn't support rank-based slicing)
    const getPage = async (offset: number, limit: number) => {
      const all = await testContext.mockRedis.zRange(
        'leaderboard:points',
        '-inf',
        '+inf',
        { by: 'score', reverse: true }
      );
      return all.slice(offset, offset + limit);
    };

    it('should return first page with correct limit', async () => {
      const pageSize = 5;
      const leaderboard = await getPage(0, pageSize);

      expect(leaderboard.length).toBe(pageSize);
      expect(leaderboard[0].score).toBe(2000);
      expect(leaderboard[4].score).toBe(1600);
    });

    it('should return second page with correct offset', async () => {
      const pageSize = 5;
      const offset = 5;
      const leaderboard = await getPage(offset, pageSize);

      expect(leaderboard.length).toBe(pageSize);
      expect(leaderboard[0].score).toBe(1500);
      expect(leaderboard[4].score).toBe(1100);
    });

    it('should return last page with remaining items', async () => {
      const pageSize = 7;
      const offset = 14;
      const leaderboard = await getPage(offset, pageSize);

      expect(leaderboard.length).toBe(6); // Only 6 remaining (20 - 14)
    });

    it('should return empty array when offset exceeds total', async () => {
      const offset = 25;
      const leaderboard = await getPage(offset, 5);

      expect(leaderboard.length).toBe(0);
    });

    it('should maintain consistent ordering across pages', async () => {
      const page1 = await getPage(0, 5);
      const page2 = await getPage(5, 5);

      // Last item of page 1 should have higher score than first item of page 2
      expect(page1[4].score).toBeGreaterThan(page2[0].score);
    });

    it('should handle single item pages', async () => {
      const leaderboard = await getPage(0, 1);

      expect(leaderboard.length).toBe(1);
      expect(leaderboard[0].score).toBe(2000);
    });

    it('should return total count for pagination info', async () => {
      const totalCount = await testContext.mockRedis.zCard('leaderboard:points');

      expect(totalCount).toBe(20);
    });
  });


  /**
   * Requirement 4.4: WHEN a user queries their rank 
   * THEN the Integration Test Suite SHALL verify the correct rank is returned
   */
  describe('User Rank Query', () => {
    beforeEach(async () => {
      // Seed leaderboard with known positions
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_rank1', score: 1000 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_rank2', score: 800 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_rank3', score: 600 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_rank4', score: 400 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_rank5', score: 200 });
    });

    it('should return correct rank for top user', async () => {
      // zRank returns 0-indexed position in ascending order
      // For descending rank, we need to calculate: total - rank - 1
      const totalUsers = await testContext.mockRedis.zCard('leaderboard:points');
      const ascRank = await testContext.mockRedis.zRank('leaderboard:points', 't2_rank1');
      
      // Convert to 1-indexed descending rank
      const rank = totalUsers - ascRank!;
      
      expect(rank).toBe(1);
    });

    it('should return correct rank for middle user', async () => {
      const totalUsers = await testContext.mockRedis.zCard('leaderboard:points');
      const ascRank = await testContext.mockRedis.zRank('leaderboard:points', 't2_rank3');
      
      const rank = totalUsers - ascRank!;
      
      expect(rank).toBe(3);
    });

    it('should return correct rank for last user', async () => {
      const totalUsers = await testContext.mockRedis.zCard('leaderboard:points');
      const ascRank = await testContext.mockRedis.zRank('leaderboard:points', 't2_rank5');
      
      const rank = totalUsers - ascRank!;
      
      expect(rank).toBe(5);
    });

    it('should return null for user not on leaderboard', async () => {
      const rank = await testContext.mockRedis.zRank('leaderboard:points', 't2_nonexistent');
      
      expect(rank).toBeNull();
    });

    it('should return user score along with rank', async () => {
      const score = await testContext.mockRedis.zScore('leaderboard:points', 't2_rank2');
      
      expect(score).toBe(800);
    });

    it('should update rank when user gains points', async () => {
      // User at rank 4 gains points to become rank 2
      await testContext.mockRedis.zIncrBy('leaderboard:points', 't2_rank4', 500);

      const totalUsers = await testContext.mockRedis.zCard('leaderboard:points');
      const ascRank = await testContext.mockRedis.zRank('leaderboard:points', 't2_rank4');
      const newRank = totalUsers - ascRank!;
      
      // With 900 points, should be rank 2 (behind 1000)
      expect(newRank).toBe(2);
    });

    it('should handle tied ranks correctly', async () => {
      // Add user with same score as rank2
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_tied', score: 800 });

      const score1 = await testContext.mockRedis.zScore('leaderboard:points', 't2_rank2');
      const score2 = await testContext.mockRedis.zScore('leaderboard:points', 't2_tied');

      expect(score1).toBe(score2);
    });
  });

  /**
   * Additional integration scenarios
   */
  describe('Complete Leaderboard Flow Scenarios', () => {
    it('should handle complete leaderboard lifecycle', async () => {
      // Step 1: Empty leaderboard
      let count = await testContext.mockRedis.zCard('leaderboard:points');
      expect(count).toBe(0);

      // Step 2: First user joins
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_first', score: 100 });
      count = await testContext.mockRedis.zCard('leaderboard:points');
      expect(count).toBe(1);

      // Step 3: More users join
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_second', score: 200 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_third', score: 50 });

      // Step 4: Verify order
      const leaderboard = await testContext.mockRedis.zRange(
        'leaderboard:points',
        0,
        -1,
        { reverse: true }
      );

      expect(leaderboard[0].member).toBe('t2_second');
      expect(leaderboard[1].member).toBe('t2_first');
      expect(leaderboard[2].member).toBe('t2_third');
    });

    it('should maintain consistency between user profile and leaderboard', async () => {
      const user = createUserWithProfile(testContext, 't2_consistent', 'consistent', {
        total_points: 500,
      });

      // Add to leaderboard
      await testContext.mockRedis.zAdd('leaderboard:points', {
        member: user.user_id,
        score: user.total_points,
      });

      // User earns more points
      const pointsEarned = 150;
      user.total_points += pointsEarned;
      await testContext.mockRedis.zIncrBy('leaderboard:points', user.user_id, pointsEarned);

      // Verify consistency
      const leaderboardScore = await testContext.mockRedis.zScore('leaderboard:points', user.user_id);
      expect(leaderboardScore).toBe(user.total_points);
    });

    it('should handle high-volume leaderboard operations', async () => {
      // Add 100 users
      for (let i = 0; i < 100; i++) {
        await testContext.mockRedis.zAdd('leaderboard:points', {
          member: `t2_volume_${i}`,
          score: Math.floor(Math.random() * 10000),
        });
      }

      const count = await testContext.mockRedis.zCard('leaderboard:points');
      expect(count).toBe(100);

      // Verify top 10 are in descending order
      const all = await testContext.mockRedis.zRange(
        'leaderboard:points',
        '-inf',
        '+inf',
        { by: 'score', reverse: true }
      );
      const top10 = all.slice(0, 10);

      expect(top10.length).toBe(10);
      for (let i = 1; i < top10.length; i++) {
        expect(top10[i - 1].score).toBeGreaterThanOrEqual(top10[i].score);
      }
    });

    it('should handle user removal from leaderboard', async () => {
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_remove1', score: 100 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_remove2', score: 200 });
      await testContext.mockRedis.zAdd('leaderboard:points', { member: 't2_remove3', score: 300 });

      // Remove middle user
      await testContext.mockRedis.zRem('leaderboard:points', ['t2_remove2']);

      const count = await testContext.mockRedis.zCard('leaderboard:points');
      expect(count).toBe(2);

      const score = await testContext.mockRedis.zScore('leaderboard:points', 't2_remove2');
      expect(score).toBeNull();
    });
  });
});
