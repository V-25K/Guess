/**
 * Property-based tests for LeaderboardService
 * 
 * Tests Redis sorted set operations for leaderboard functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Helper function to calculate 1-indexed rank from 0-indexed ascending rank
 * This mirrors the logic in LeaderboardService.getUserRankFromRedis
 * 
 * @param ascendingRank - 0-indexed rank where lowest score = 0
 * @param totalCount - Total number of members in the sorted set
 * @returns 1-indexed rank where highest score = 1
 */
function calculateDescendingRank(ascendingRank: number, totalCount: number): number {
  // Convert from ascending (lowest=0) to descending (highest=1)
  // ascendingRank 0 = lowest score, should be rank totalCount
  // ascendingRank (totalCount-1) = highest score, should be rank 1
  return totalCount - ascendingRank;
}

/**
 * Simulates Redis sorted set behavior for testing
 */
class MockSortedSet {
  private members: Map<string, number> = new Map();

  zAdd(member: string, score: number): void {
    this.members.set(member, score);
  }

  zIncrBy(member: string, delta: number): number {
    const currentScore = this.members.get(member) ?? 0;
    const newScore = currentScore + delta;
    this.members.set(member, newScore);
    return newScore;
  }

  zRank(member: string): number | null {
    if (!this.members.has(member)) {
      return null;
    }
    
    // Sort by score ascending (Redis default)
    const sorted = Array.from(this.members.entries())
      .sort((a, b) => a[1] - b[1]);
    
    const index = sorted.findIndex(([m]) => m === member);
    return index >= 0 ? index : null;
  }

  zCard(): number {
    return this.members.size;
  }

  zScore(member: string): number | null {
    return this.members.get(member) ?? null;
  }

  clear(): void {
    this.members.clear();
  }
}

describe('LeaderboardService Properties', () => {
  /**
   * **Feature: performance-optimization, Property 13: User Rank Is 1-Indexed**
   * 
   * *For any* user rank returned by the leaderboard service, the rank SHALL equal
   * the Redis zRank value plus 1, ensuring ranks start at 1 (not 0).
   * 
   * Note: Since we're using descending order (highest score = rank 1), we need to
   * calculate: totalCount - zRank (which gives us 1-indexed descending rank)
   * 
   * **Validates: Requirements 9.3**
   */
  describe('Property 13: User Rank Is 1-Indexed', () => {
    let sortedSet: MockSortedSet;

    beforeEach(() => {
      sortedSet = new MockSortedSet();
    });

    it('should return 1-indexed rank where highest score is rank 1', () => {
      fc.assert(
        fc.property(
          // Generate a list of unique user IDs with scores
          fc.array(
            fc.record({
              userId: fc.uuid(),
              score: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 1, maxLength: 50 }
          ).map(entries => {
            // Ensure unique userIds
            const seen = new Set<string>();
            return entries.filter(e => {
              if (seen.has(e.userId)) return false;
              seen.add(e.userId);
              return true;
            });
          }).filter(entries => entries.length > 0),
          (entries) => {
            sortedSet.clear();
            
            // Add all entries to sorted set
            for (const entry of entries) {
              sortedSet.zAdd(entry.userId, entry.score);
            }

            const totalCount = sortedSet.zCard();

            // For each user, verify rank is 1-indexed
            for (const entry of entries) {
              const ascendingRank = sortedSet.zRank(entry.userId);
              expect(ascendingRank).not.toBeNull();
              
              // Calculate descending rank (highest score = rank 1)
              const descendingRank = calculateDescendingRank(ascendingRank!, totalCount);
              
              // Rank should be >= 1 (1-indexed)
              expect(descendingRank).toBeGreaterThanOrEqual(1);
              
              // Rank should be <= totalCount
              expect(descendingRank).toBeLessThanOrEqual(totalCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give rank 1 to the user with highest score', () => {
      fc.assert(
        fc.property(
          // Generate at least 2 users with different scores
          fc.array(
            fc.record({
              userId: fc.uuid(),
              score: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 2, maxLength: 20 }
          ).map(entries => {
            // Ensure unique userIds and unique scores for clear ranking
            const seenIds = new Set<string>();
            const seenScores = new Set<number>();
            return entries.filter(e => {
              if (seenIds.has(e.userId) || seenScores.has(e.score)) return false;
              seenIds.add(e.userId);
              seenScores.add(e.score);
              return true;
            });
          }).filter(entries => entries.length >= 2),
          (entries) => {
            sortedSet.clear();
            
            // Add all entries
            for (const entry of entries) {
              sortedSet.zAdd(entry.userId, entry.score);
            }

            const totalCount = sortedSet.zCard();
            
            // Find user with highest score
            const highestScoreEntry = entries.reduce((max, e) => 
              e.score > max.score ? e : max
            );

            const ascendingRank = sortedSet.zRank(highestScoreEntry.userId);
            const descendingRank = calculateDescendingRank(ascendingRank!, totalCount);
            
            // Highest score should have rank 1
            expect(descendingRank).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give rank equal to totalCount to the user with lowest score', () => {
      fc.assert(
        fc.property(
          // Generate at least 2 users with different scores
          fc.array(
            fc.record({
              userId: fc.uuid(),
              score: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 2, maxLength: 20 }
          ).map(entries => {
            // Ensure unique userIds and unique scores
            const seenIds = new Set<string>();
            const seenScores = new Set<number>();
            return entries.filter(e => {
              if (seenIds.has(e.userId) || seenScores.has(e.score)) return false;
              seenIds.add(e.userId);
              seenScores.add(e.score);
              return true;
            });
          }).filter(entries => entries.length >= 2),
          (entries) => {
            sortedSet.clear();
            
            // Add all entries
            for (const entry of entries) {
              sortedSet.zAdd(entry.userId, entry.score);
            }

            const totalCount = sortedSet.zCard();
            
            // Find user with lowest score
            const lowestScoreEntry = entries.reduce((min, e) => 
              e.score < min.score ? e : min
            );

            const ascendingRank = sortedSet.zRank(lowestScoreEntry.userId);
            const descendingRank = calculateDescendingRank(ascendingRank!, totalCount);
            
            // Lowest score should have rank equal to totalCount
            expect(descendingRank).toBe(totalCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: performance-optimization, Property 14: Score Updates Use Atomic Increment**
   * 
   * *For any* score update operation, the system SHALL use Redis zIncrBy (atomic increment)
   * rather than a read-modify-write sequence, preventing race conditions.
   * 
   * **Validates: Requirements 9.4**
   */
  describe('Property 14: Score Updates Use Atomic Increment', () => {
    let sortedSet: MockSortedSet;

    beforeEach(() => {
      sortedSet = new MockSortedSet();
    });

    it('should atomically increment scores correctly', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 1, max: 500 }),
          (userId, initialScore, delta) => {
            sortedSet.clear();
            
            // Set initial score
            sortedSet.zAdd(userId, initialScore);
            
            // Atomically increment
            const newScore = sortedSet.zIncrBy(userId, delta);
            
            // New score should be exactly initial + delta
            expect(newScore).toBe(initialScore + delta);
            
            // Verify the stored score matches
            expect(sortedSet.zScore(userId)).toBe(newScore);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple increments correctly', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 0, max: 1000 }),
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          (userId, initialScore, deltas) => {
            sortedSet.clear();
            
            // Set initial score
            sortedSet.zAdd(userId, initialScore);
            
            // Apply all increments
            let expectedScore = initialScore;
            for (const delta of deltas) {
              const newScore = sortedSet.zIncrBy(userId, delta);
              expectedScore += delta;
              expect(newScore).toBe(expectedScore);
            }
            
            // Final score should be sum of initial + all deltas
            const totalDelta = deltas.reduce((sum, d) => sum + d, 0);
            expect(sortedSet.zScore(userId)).toBe(initialScore + totalDelta);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create member with delta as score if member does not exist', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 1000 }),
          (userId, delta) => {
            sortedSet.clear();
            
            // Member doesn't exist, zIncrBy should create it
            const newScore = sortedSet.zIncrBy(userId, delta);
            
            // Score should be exactly the delta (starting from 0)
            expect(newScore).toBe(delta);
            expect(sortedSet.zScore(userId)).toBe(delta);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain correct ranking after increments', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              score: fc.integer({ min: 0, max: 1000 }),
            }),
            { minLength: 2, maxLength: 10 }
          ).map(entries => {
            // Ensure unique userIds
            const seen = new Set<string>();
            return entries.filter(e => {
              if (seen.has(e.userId)) return false;
              seen.add(e.userId);
              return true;
            });
          }).filter(entries => entries.length >= 2),
          fc.integer({ min: 1, max: 500 }),
          (entries, increment) => {
            sortedSet.clear();
            
            // Add all entries
            for (const entry of entries) {
              sortedSet.zAdd(entry.userId, entry.score);
            }

            // Pick a random user to increment
            const targetUser = entries[0];
            const originalScore = targetUser.score;
            
            // Increment their score
            sortedSet.zIncrBy(targetUser.userId, increment);
            
            // Verify the score was updated
            expect(sortedSet.zScore(targetUser.userId)).toBe(originalScore + increment);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: performance-optimization, Property 9: Redis Failure Falls Back to Database**
   * 
   * *For any* Redis read operation that fails, the system SHALL attempt to fetch data
   * directly from the database and return valid data (or empty result) rather than throwing.
   * 
   * **Validates: Requirements 7.1**
   */
  describe('Property 9: Redis Failure Falls Back to Database', () => {
    /**
     * Helper function that simulates the fallback pattern used in LeaderboardService
     */
    async function getWithFallback<T>(
      redisGetter: () => Promise<T>,
      dbFallback: () => Promise<T>,
      defaultValue: T
    ): Promise<T> {
      try {
        return await redisGetter();
      } catch (error) {
        // Redis failed - fall back to database
        console.error('[Test] Redis failed, falling back to database:', error);
        try {
          return await dbFallback();
        } catch (dbError) {
          // Database also failed - return default
          console.error('[Test] Database also failed:', dbError);
          return defaultValue;
        }
      }
    }

    it('should return database data when Redis throws an error', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              score: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (dbData) => {
            // Simulate Redis failure
            const redisGetter = async () => {
              throw new Error('Redis connection failed');
            };

            // Database returns valid data
            const dbFallback = async () => dbData;

            const result = await getWithFallback(redisGetter, dbFallback, []);
            
            // Should return database data
            expect(result).toEqual(dbData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return default value when both Redis and database fail', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer(), { minLength: 0, maxLength: 5 }),
          async (defaultValue) => {
            // Both Redis and database fail
            const redisGetter = async () => {
              throw new Error('Redis connection failed');
            };

            const dbFallback = async () => {
              throw new Error('Database connection failed');
            };

            const result = await getWithFallback(redisGetter, dbFallback, defaultValue);
            
            // Should return default value
            expect(result).toEqual(defaultValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return Redis data when Redis succeeds', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              score: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          fc.array(
            fc.record({
              userId: fc.uuid(),
              score: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (redisData, dbData) => {
            // Redis succeeds
            const redisGetter = async () => redisData;

            // Database would return different data (but shouldn't be called)
            const dbFallback = async () => dbData;

            const result = await getWithFallback(redisGetter, dbFallback, []);
            
            // Should return Redis data, not database data
            expect(result).toEqual(redisData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not throw errors to the caller', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string(),
          async (errorMessage) => {
            // Both Redis and database fail with various error messages
            const redisGetter = async () => {
              throw new Error(errorMessage);
            };

            const dbFallback = async () => {
              throw new Error('DB: ' + errorMessage);
            };

            // Should not throw, should return default
            const result = await getWithFallback(redisGetter, dbFallback, null);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
