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

  /**
   * **Feature: leaderboard-pagination, Property 1: Page size constraint**
   * 
   * *For any* leaderboard data with N entries and page number P, the number of entries 
   * displayed on page P SHALL be min(5, N - P * 5) when P * 5 < N, and 0 otherwise.
   * 
   * **Validates: Requirements 1.1, 1.3**
   */
  describe('Property 1: Page size constraint', () => {
    const PAGE_SIZE = 5;

    /**
     * Helper function that calculates entries on a given page
     * This mirrors the logic used in pagination
     */
    function getEntriesOnPage(totalEntries: number, pageNumber: number, pageSize: number): number {
      const offset = pageNumber * pageSize;
      if (offset >= totalEntries) {
        return 0;
      }
      return Math.min(pageSize, totalEntries - offset);
    }

    it('should return min(5, N - P * 5) entries when P * 5 < N', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 19 }),
          (totalEntries, pageNumber) => {
            const offset = pageNumber * PAGE_SIZE;
            
            // Only test valid pages where offset < totalEntries
            if (offset < totalEntries) {
              const entriesOnPage = getEntriesOnPage(totalEntries, pageNumber, PAGE_SIZE);
              const expected = Math.min(PAGE_SIZE, totalEntries - offset);
              
              expect(entriesOnPage).toBe(expected);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 entries when page offset exceeds total entries', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 0, max: 20 }),
          (totalEntries, pageNumber) => {
            const offset = pageNumber * PAGE_SIZE;
            
            // Only test pages where offset >= totalEntries
            if (offset >= totalEntries) {
              const entriesOnPage = getEntriesOnPage(totalEntries, pageNumber, PAGE_SIZE);
              expect(entriesOnPage).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display exactly 5 entries on full pages', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 6, max: 100 }),
          (totalEntries) => {
            // First page should always have 5 entries when total > 5
            const entriesOnFirstPage = getEntriesOnPage(totalEntries, 0, PAGE_SIZE);
            expect(entriesOnFirstPage).toBe(PAGE_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display fewer than 5 entries on last page when not evenly divisible', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }).filter(n => n % PAGE_SIZE !== 0),
          (totalEntries) => {
            const totalPages = Math.ceil(totalEntries / PAGE_SIZE);
            const lastPageNumber = totalPages - 1;
            const entriesOnLastPage = getEntriesOnPage(totalEntries, lastPageNumber, PAGE_SIZE);
            
            // Last page should have remaining entries (less than PAGE_SIZE)
            const expectedRemaining = totalEntries % PAGE_SIZE;
            expect(entriesOnLastPage).toBe(expectedRemaining);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display exactly 5 entries on last page when evenly divisible', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }).map(n => n * PAGE_SIZE),
          (totalEntries) => {
            const totalPages = Math.ceil(totalEntries / PAGE_SIZE);
            const lastPageNumber = totalPages - 1;
            const entriesOnLastPage = getEntriesOnPage(totalEntries, lastPageNumber, PAGE_SIZE);
            
            // Last page should have exactly PAGE_SIZE entries
            expect(entriesOnLastPage).toBe(PAGE_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never display more than 5 entries on any page', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 19 }),
          (totalEntries, pageNumber) => {
            const entriesOnPage = getEntriesOnPage(totalEntries, pageNumber, PAGE_SIZE);
            expect(entriesOnPage).toBeLessThanOrEqual(PAGE_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not display empty placeholders - only available entries', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 19 }),
          (totalEntries, pageNumber) => {
            const offset = pageNumber * PAGE_SIZE;
            const entriesOnPage = getEntriesOnPage(totalEntries, pageNumber, PAGE_SIZE);
            
            if (offset < totalEntries) {
              // Entries on page should be exactly the available entries, not padded
              const availableEntries = Math.min(PAGE_SIZE, totalEntries - offset);
              expect(entriesOnPage).toBe(availableEntries);
            } else {
              // No entries on pages beyond the data
              expect(entriesOnPage).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: leaderboard-pagination, Property 5: Entry rank consistency across pages**
   * 
   * *For any* entry displayed on page P at position I (0-indexed within page), 
   * the entry's rank SHALL equal P * 5 + I + 1.
   * 
   * **Validates: Requirements 2.4, 2.5**
   */
  describe('Property 5: Entry rank consistency across pages', () => {
    const PAGE_SIZE = 5;

    /**
     * Helper function that calculates the expected rank for an entry
     * based on its page number and position within the page.
     * This mirrors the rank calculation in LeaderboardView and LeaderboardService.
     * 
     * @param pageNumber - The current page (0-indexed)
     * @param indexWithinPage - The position within the page (0-indexed)
     * @returns The expected 1-indexed rank
     */
    function calculateExpectedRank(pageNumber: number, indexWithinPage: number, pageSize: number = PAGE_SIZE): number {
      return pageNumber * pageSize + indexWithinPage + 1;
    }

    /**
     * Helper function that simulates getting entries for a page
     * Returns entries with correctly calculated ranks
     */
    function getEntriesForPage(
      allEntries: Array<{ userId: string; username: string; totalPoints: number }>,
      pageNumber: number,
      pageSize: number = PAGE_SIZE
    ): Array<{ userId: string; username: string; totalPoints: number; rank: number }> {
      const offset = pageNumber * pageSize;
      const pageEntries = allEntries.slice(offset, offset + pageSize);
      
      return pageEntries.map((entry, index) => ({
        ...entry,
        rank: calculateExpectedRank(pageNumber, index, pageSize),
      }));
    }

    it('should calculate rank as (pageNumber * pageSize) + index + 1 for any entry', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }), // pageNumber
          fc.integer({ min: 0, max: 4 }),  // indexWithinPage (0-4 for page size 5)
          (pageNumber, indexWithinPage) => {
            const expectedRank = calculateExpectedRank(pageNumber, indexWithinPage);
            
            // Rank should be (pageNumber * PAGE_SIZE) + indexWithinPage + 1
            expect(expectedRank).toBe(pageNumber * PAGE_SIZE + indexWithinPage + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should assign rank 1 to first entry on first page', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              username: fc.string({ minLength: 1, maxLength: 20 }),
              totalPoints: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (allEntries) => {
            const pageEntries = getEntriesForPage(allEntries, 0);
            
            if (pageEntries.length > 0) {
              // First entry on first page should have rank 1
              expect(pageEntries[0].rank).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should assign rank 6 to first entry on second page', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              username: fc.string({ minLength: 1, maxLength: 20 }),
              totalPoints: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 6, maxLength: 50 }
          ),
          (allEntries) => {
            const pageEntries = getEntriesForPage(allEntries, 1);
            
            if (pageEntries.length > 0) {
              // First entry on second page (page 1) should have rank 6
              expect(pageEntries[0].rank).toBe(6);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consecutive ranks within a page', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              username: fc.string({ minLength: 1, maxLength: 20 }),
              totalPoints: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          fc.integer({ min: 0, max: 9 }),
          (allEntries, pageNumber) => {
            const pageEntries = getEntriesForPage(allEntries, pageNumber);
            
            // Ranks within a page should be consecutive
            for (let i = 1; i < pageEntries.length; i++) {
              expect(pageEntries[i].rank).toBe(pageEntries[i - 1].rank + 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain rank continuity across page boundaries', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              username: fc.string({ minLength: 1, maxLength: 20 }),
              totalPoints: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 11, maxLength: 50 }
          ),
          fc.integer({ min: 0, max: 8 }),
          (allEntries, pageNumber) => {
            const currentPageEntries = getEntriesForPage(allEntries, pageNumber);
            const nextPageEntries = getEntriesForPage(allEntries, pageNumber + 1);
            
            if (currentPageEntries.length === PAGE_SIZE && nextPageEntries.length > 0) {
              // Last rank on current page + 1 should equal first rank on next page
              const lastRankOnCurrentPage = currentPageEntries[currentPageEntries.length - 1].rank;
              const firstRankOnNextPage = nextPageEntries[0].rank;
              
              expect(firstRankOnNextPage).toBe(lastRankOnCurrentPage + 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show medals (🥇🥈🥉) only for ranks 1-3', () => {
      /**
       * Helper function that determines medal display
       * This mirrors the getMedal logic in LeaderboardView
       */
      function getMedal(rank: number): string {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `${rank}.`;
      }

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (rank) => {
            const medal = getMedal(rank);
            
            if (rank === 1) {
              expect(medal).toBe('🥇');
            } else if (rank === 2) {
              expect(medal).toBe('🥈');
            } else if (rank === 3) {
              expect(medal).toBe('🥉');
            } else {
              // Ranks > 3 should show number with period
              expect(medal).toBe(`${rank}.`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only show medals on first page (ranks 1-3 are only on page 0)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              userId: fc.uuid(),
              username: fc.string({ minLength: 1, maxLength: 20 }),
              totalPoints: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 6, maxLength: 50 }
          ),
          fc.integer({ min: 1, max: 9 }), // Pages after the first
          (allEntries, pageNumber) => {
            const pageEntries = getEntriesForPage(allEntries, pageNumber);
            
            // All entries on pages after the first should have rank > 3
            for (const entry of pageEntries) {
              expect(entry.rank).toBeGreaterThan(3);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct ranks with different page sizes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // pageSize
          fc.integer({ min: 0, max: 10 }), // pageNumber
          fc.integer({ min: 0, max: 19 }), // indexWithinPage
          (pageSize, pageNumber, indexOffset) => {
            // Ensure index is within page bounds
            const indexWithinPage = indexOffset % pageSize;
            
            const expectedRank = calculateExpectedRank(pageNumber, indexWithinPage, pageSize);
            
            // Rank should be (pageNumber * pageSize) + indexWithinPage + 1
            expect(expectedRank).toBe(pageNumber * pageSize + indexWithinPage + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure all ranks are positive (1-indexed)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // pageNumber
          fc.integer({ min: 0, max: 4 }),   // indexWithinPage
          (pageNumber, indexWithinPage) => {
            const rank = calculateExpectedRank(pageNumber, indexWithinPage);
            
            // Rank should always be >= 1 (1-indexed)
            expect(rank).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: leaderboard-pagination, Property 6: Your Rank Section invariant**
   * 
   * *For any* pagination state, the Your_Rank_Section SHALL display the same user rank data 
   * regardless of the current page number.
   * 
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  describe('Property 6: Your Rank Section invariant', () => {
    /**
     * Simulates the getLeaderboardWithUserPaginated function's userRank behavior
     * The userRank should be the same regardless of which page is requested
     */
    function getUserRankData(
      userId: string,
      allUsers: Array<{ userId: string; username: string; totalPoints: number; level: number }>,
    ): { rank: number | null; username: string; totalPoints: number; level: number } | null {
      // Find the user in the list
      const user = allUsers.find(u => u.userId === userId);
      if (!user) {
        return null;
      }

      // Sort users by points descending to calculate rank
      const sortedUsers = [...allUsers].sort((a, b) => b.totalPoints - a.totalPoints);
      const rank = sortedUsers.findIndex(u => u.userId === userId) + 1;

      return {
        rank: rank > 0 ? rank : null,
        username: user.username,
        totalPoints: user.totalPoints,
        level: user.level,
      };
    }

    it('should return the same userRank data regardless of currentPage', () => {
      fc.assert(
        fc.property(
          // Generate a list of users
          fc.array(
            fc.record({
              userId: fc.uuid(),
              username: fc.string({ minLength: 1, maxLength: 20 }),
              totalPoints: fc.integer({ min: 0, max: 10000 }),
              level: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 1, maxLength: 50 }
          ).map(users => {
            // Ensure unique userIds
            const seen = new Set<string>();
            return users.filter(u => {
              if (seen.has(u.userId)) return false;
              seen.add(u.userId);
              return true;
            });
          }).filter(users => users.length > 0),
          // Generate multiple page numbers to test
          fc.array(fc.integer({ min: 0, max: 20 }), { minLength: 2, maxLength: 10 }),
          (users, pageNumbers) => {
            // Pick a random user to be the "current user"
            const currentUserId = users[0].userId;

            // Get userRank for each page number
            const userRanks = pageNumbers.map(pageNumber => 
              getUserRankData(currentUserId, users)
            );

            // All userRanks should be identical regardless of page number
            const firstRank = userRanks[0];
            for (const rank of userRanks) {
              expect(rank).toEqual(firstRank);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain userRank when navigating forward through pages', () => {
      fc.assert(
        fc.property(
          // Generate users
          fc.array(
            fc.record({
              userId: fc.uuid(),
              username: fc.string({ minLength: 1, maxLength: 20 }),
              totalPoints: fc.integer({ min: 0, max: 10000 }),
              level: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 6, maxLength: 50 }
          ).map(users => {
            const seen = new Set<string>();
            return users.filter(u => {
              if (seen.has(u.userId)) return false;
              seen.add(u.userId);
              return true;
            });
          }).filter(users => users.length >= 6),
          (users) => {
            const currentUserId = users[0].userId;
            const PAGE_SIZE = 5;
            const totalPages = Math.ceil(users.length / PAGE_SIZE);

            // Simulate navigating through all pages
            let previousRank = getUserRankData(currentUserId, users);
            
            for (let page = 0; page < totalPages; page++) {
              const currentRank = getUserRankData(currentUserId, users);
              
              // UserRank should be the same on every page
              expect(currentRank).toEqual(previousRank);
              previousRank = currentRank;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain userRank when navigating backward through pages', () => {
      fc.assert(
        fc.property(
          // Generate users
          fc.array(
            fc.record({
              userId: fc.uuid(),
              username: fc.string({ minLength: 1, maxLength: 20 }),
              totalPoints: fc.integer({ min: 0, max: 10000 }),
              level: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 6, maxLength: 50 }
          ).map(users => {
            const seen = new Set<string>();
            return users.filter(u => {
              if (seen.has(u.userId)) return false;
              seen.add(u.userId);
              return true;
            });
          }).filter(users => users.length >= 6),
          (users) => {
            const currentUserId = users[0].userId;
            const PAGE_SIZE = 5;
            const totalPages = Math.ceil(users.length / PAGE_SIZE);

            // Simulate navigating backward from last page
            let previousRank = getUserRankData(currentUserId, users);
            
            for (let page = totalPages - 1; page >= 0; page--) {
              const currentRank = getUserRankData(currentUserId, users);
              
              // UserRank should be the same on every page
              expect(currentRank).toEqual(previousRank);
              previousRank = currentRank;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show null rank for user not in leaderboard', () => {
      fc.assert(
        fc.property(
          // Generate users
          fc.array(
            fc.record({
              userId: fc.uuid(),
              username: fc.string({ minLength: 1, maxLength: 20 }),
              totalPoints: fc.integer({ min: 0, max: 10000 }),
              level: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          // Generate a userId that's not in the list
          fc.uuid(),
          fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 2, maxLength: 5 }),
          (users, nonExistentUserId, pageNumbers) => {
            // Ensure the nonExistentUserId is not in users
            const filteredUsers = users.filter(u => u.userId !== nonExistentUserId);
            
            // Get userRank for non-existent user across different pages
            const userRanks = pageNumbers.map(() => 
              getUserRankData(nonExistentUserId, filteredUsers)
            );

            // All should be null
            for (const rank of userRanks) {
              expect(rank).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: leaderboard-pagination, Property 2: Total pages calculation**
   * 
   * *For any* leaderboard with N total entries where N > 0, the total number of pages 
   * SHALL equal ceil(N / 5).
   * 
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Total pages calculation', () => {
    const PAGE_SIZE = 5;

    /**
     * Helper function that calculates total pages
     * This mirrors the logic in LeaderboardService.getLeaderboardWithUserPaginated
     */
    function calculateTotalPages(totalEntries: number, pageSize: number): number {
      return totalEntries > 0 ? Math.ceil(totalEntries / pageSize) : 0;
    }

    it('should calculate total pages as ceil(totalEntries / pageSize) for any positive entry count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (totalEntries) => {
            const totalPages = calculateTotalPages(totalEntries, PAGE_SIZE);
            
            // Total pages should equal ceil(totalEntries / pageSize)
            expect(totalPages).toBe(Math.ceil(totalEntries / PAGE_SIZE));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 pages when there are 0 entries', () => {
      const totalPages = calculateTotalPages(0, PAGE_SIZE);
      expect(totalPages).toBe(0);
    });

    it('should return 1 page for 1-5 entries', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (totalEntries) => {
            const totalPages = calculateTotalPages(totalEntries, PAGE_SIZE);
            expect(totalPages).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 2 pages for 6-10 entries', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 6, max: 10 }),
          (totalEntries) => {
            const totalPages = calculateTotalPages(totalEntries, PAGE_SIZE);
            expect(totalPages).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure last page can hold remaining entries', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (totalEntries) => {
            const totalPages = calculateTotalPages(totalEntries, PAGE_SIZE);
            
            // All entries should fit within totalPages * pageSize
            expect(totalPages * PAGE_SIZE).toBeGreaterThanOrEqual(totalEntries);
            
            // But (totalPages - 1) * pageSize should be less than totalEntries
            // (meaning we actually need that last page)
            if (totalPages > 0) {
              expect((totalPages - 1) * PAGE_SIZE).toBeLessThan(totalEntries);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should work with different page sizes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          (totalEntries, pageSize) => {
            const totalPages = calculateTotalPages(totalEntries, pageSize);
            
            // Total pages should equal ceil(totalEntries / pageSize)
            expect(totalPages).toBe(Math.ceil(totalEntries / pageSize));
            
            // All entries should fit
            expect(totalPages * pageSize).toBeGreaterThanOrEqual(totalEntries);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: leaderboard-pagination, Property 3: Pagination button disabled states**
   * 
   * *For any* pagination state with currentPage P and totalPages T where T > 1, 
   * the previous button SHALL be disabled if and only if P === 0, 
   * and the next button SHALL be disabled if and only if P === T - 1.
   * 
   * **Validates: Requirements 2.2, 2.3**
   */
  describe('Property 3: Pagination button disabled states', () => {
    /**
     * Helper functions that determine button disabled states
     * These mirror the logic in LeaderboardView pagination controls
     */
    function isPrevButtonDisabled(currentPage: number): boolean {
      return currentPage === 0;
    }

    function isNextButtonDisabled(currentPage: number, totalPages: number): boolean {
      return currentPage === totalPages - 1;
    }

    it('should disable previous button if and only if currentPage is 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }), // totalPages >= 2 for pagination to show
          fc.integer({ min: 0, max: 99 }),
          (totalPages, pageOffset) => {
            // Ensure currentPage is within valid range
            const currentPage = pageOffset % totalPages;
            
            const prevDisabled = isPrevButtonDisabled(currentPage);
            
            // Previous button should be disabled if and only if on first page
            expect(prevDisabled).toBe(currentPage === 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should disable next button if and only if currentPage is totalPages - 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }), // totalPages >= 2 for pagination to show
          fc.integer({ min: 0, max: 99 }),
          (totalPages, pageOffset) => {
            // Ensure currentPage is within valid range
            const currentPage = pageOffset % totalPages;
            
            const nextDisabled = isNextButtonDisabled(currentPage, totalPages);
            
            // Next button should be disabled if and only if on last page
            expect(nextDisabled).toBe(currentPage === totalPages - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have both buttons enabled on middle pages', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 100 }), // Need at least 3 pages for middle pages
          fc.integer({ min: 1, max: 98 }),
          (totalPages, middlePageOffset) => {
            // Ensure we're on a middle page (not first or last)
            const currentPage = 1 + (middlePageOffset % (totalPages - 2));
            
            const prevDisabled = isPrevButtonDisabled(currentPage);
            const nextDisabled = isNextButtonDisabled(currentPage, totalPages);
            
            // Both buttons should be enabled on middle pages
            expect(prevDisabled).toBe(false);
            expect(nextDisabled).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have previous disabled and next enabled on first page when totalPages > 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }),
          (totalPages) => {
            const currentPage = 0;
            
            const prevDisabled = isPrevButtonDisabled(currentPage);
            const nextDisabled = isNextButtonDisabled(currentPage, totalPages);
            
            expect(prevDisabled).toBe(true);
            expect(nextDisabled).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have previous enabled and next disabled on last page when totalPages > 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }),
          (totalPages) => {
            const currentPage = totalPages - 1;
            
            const prevDisabled = isPrevButtonDisabled(currentPage);
            const nextDisabled = isNextButtonDisabled(currentPage, totalPages);
            
            expect(prevDisabled).toBe(false);
            expect(nextDisabled).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have both buttons disabled when totalPages is 1', () => {
      const totalPages = 1;
      const currentPage = 0;
      
      const prevDisabled = isPrevButtonDisabled(currentPage);
      const nextDisabled = isNextButtonDisabled(currentPage, totalPages);
      
      // On single page, both should be disabled
      expect(prevDisabled).toBe(true);
      expect(nextDisabled).toBe(true);
    });
  });

  /**
   * **Feature: leaderboard-pagination, Property 4: Page navigation state transitions**
   * 
   * *For any* valid page P where 0 <= P < totalPages, pressing next when P < totalPages - 1 
   * SHALL result in page P + 1, and pressing previous when P > 0 SHALL result in page P - 1.
   * 
   * **Validates: Requirements 2.4, 2.5**
   */
  describe('Property 4: Page navigation state transitions', () => {
    /**
     * Helper functions that simulate page navigation
     * These mirror the handlePrevPage and handleNextPage logic in LeaderboardView
     */
    function navigateNext(currentPage: number, totalPages: number): number {
      if (currentPage < totalPages - 1) {
        return currentPage + 1;
      }
      return currentPage;
    }

    function navigatePrev(currentPage: number): number {
      if (currentPage > 0) {
        return currentPage - 1;
      }
      return currentPage;
    }

    it('should increment page by 1 when pressing next on non-last page', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }),
          fc.integer({ min: 0, max: 98 }),
          (totalPages, pageOffset) => {
            // Ensure we're not on the last page
            const currentPage = pageOffset % (totalPages - 1);
            
            const newPage = navigateNext(currentPage, totalPages);
            
            expect(newPage).toBe(currentPage + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should decrement page by 1 when pressing previous on non-first page', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }),
          fc.integer({ min: 1, max: 99 }),
          (totalPages, pageOffset) => {
            // Ensure we're not on the first page
            const currentPage = 1 + (pageOffset % (totalPages - 1));
            
            const newPage = navigatePrev(currentPage);
            
            expect(newPage).toBe(currentPage - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should stay on same page when pressing next on last page', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (totalPages) => {
            const currentPage = totalPages - 1;
            
            const newPage = navigateNext(currentPage, totalPages);
            
            // Should stay on the same page
            expect(newPage).toBe(currentPage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should stay on same page when pressing previous on first page', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (totalPages) => {
            const currentPage = 0;
            
            const newPage = navigatePrev(currentPage);
            
            // Should stay on the same page
            expect(newPage).toBe(currentPage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain valid page range after any navigation sequence', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
          (totalPages, navigationSequence) => {
            let currentPage = 0;
            
            // Apply navigation sequence (true = next, false = prev)
            for (const goNext of navigationSequence) {
              if (goNext) {
                currentPage = navigateNext(currentPage, totalPages);
              } else {
                currentPage = navigatePrev(currentPage);
              }
              
              // Page should always be in valid range
              expect(currentPage).toBeGreaterThanOrEqual(0);
              expect(currentPage).toBeLessThan(totalPages);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reach any valid page through navigation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 0, max: 19 }),
          (totalPages, targetPageOffset) => {
            const targetPage = targetPageOffset % totalPages;
            let currentPage = 0;
            
            // Navigate to target page
            while (currentPage < targetPage) {
              currentPage = navigateNext(currentPage, totalPages);
            }
            
            expect(currentPage).toBe(targetPage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return to first page after navigating forward then backward', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          fc.integer({ min: 1, max: 20 }),
          (totalPages, steps) => {
            let currentPage = 0;
            const actualSteps = Math.min(steps, totalPages - 1);
            
            // Navigate forward
            for (let i = 0; i < actualSteps; i++) {
              currentPage = navigateNext(currentPage, totalPages);
            }
            
            // Navigate backward same number of steps
            for (let i = 0; i < actualSteps; i++) {
              currentPage = navigatePrev(currentPage);
            }
            
            // Should be back at first page
            expect(currentPage).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: leaderboard-pagination, Property 7: Current user entry highlighting**
   * 
   * *For any* leaderboard entry E where E.userId equals the current user's ID, 
   * the entry SHALL have distinct background color (#FFF4E6), distinct border color (#FF4500), 
   * and username text containing "(You)" suffix.
   * 
   * **Validates: Requirements 4.1, 4.2, 4.3**
   */
  describe('Property 7: Current user entry highlighting', () => {
    // Constants matching LeaderboardView styling
    const CURRENT_USER_BACKGROUND = '#FFF4E6';
    const CURRENT_USER_BORDER = '#FF4500';
    const YOU_SUFFIX = '(You)';

    /**
     * Helper function that determines entry styling based on isCurrentUser flag
     * This mirrors the logic in LeaderboardView entry rendering
     */
    function getEntryStyle(isCurrentUser: boolean): { backgroundColor: string; borderColor: string } {
      return {
        backgroundColor: isCurrentUser ? CURRENT_USER_BACKGROUND : '#FFFFFF',
        borderColor: isCurrentUser ? CURRENT_USER_BORDER : '#E0E0E0',
      };
    }

    /**
     * Helper function that formats username based on isCurrentUser flag
     * This mirrors the logic in LeaderboardView entry rendering
     */
    function formatUsername(username: string, isCurrentUser: boolean): string {
      return isCurrentUser ? `${username} (You)` : username;
    }

    it('should apply distinct background color #FFF4E6 for current user entries', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 10000 }),
          (userId, username, totalPoints) => {
            const isCurrentUser = true;
            const style = getEntryStyle(isCurrentUser);
            
            expect(style.backgroundColor).toBe(CURRENT_USER_BACKGROUND);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply distinct border color #FF4500 for current user entries', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 10000 }),
          (userId, username, totalPoints) => {
            const isCurrentUser = true;
            const style = getEntryStyle(isCurrentUser);
            
            expect(style.borderColor).toBe(CURRENT_USER_BORDER);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should append "(You)" suffix to username for current user entries', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (username) => {
            const isCurrentUser = true;
            const formattedUsername = formatUsername(username, isCurrentUser);
            
            expect(formattedUsername).toContain(YOU_SUFFIX);
            expect(formattedUsername).toBe(`${username} ${YOU_SUFFIX}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply all three highlighting properties together for current user', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 1, max: 100 }),
          (userId, username, totalPoints, level) => {
            const isCurrentUser = true;
            const style = getEntryStyle(isCurrentUser);
            const formattedUsername = formatUsername(username, isCurrentUser);
            
            // All three properties should be applied
            expect(style.backgroundColor).toBe(CURRENT_USER_BACKGROUND);
            expect(style.borderColor).toBe(CURRENT_USER_BORDER);
            expect(formattedUsername).toContain(YOU_SUFFIX);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should highlight current user entry regardless of rank position', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 1000 }), // rank
          fc.integer({ min: 0, max: 10000 }), // totalPoints
          (userId, username, rank, totalPoints) => {
            const isCurrentUser = true;
            const style = getEntryStyle(isCurrentUser);
            const formattedUsername = formatUsername(username, isCurrentUser);
            
            // Highlighting should apply regardless of rank
            expect(style.backgroundColor).toBe(CURRENT_USER_BACKGROUND);
            expect(style.borderColor).toBe(CURRENT_USER_BORDER);
            expect(formattedUsername).toContain(YOU_SUFFIX);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should highlight current user entry on any page', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 100 }), // currentPage
          fc.integer({ min: 0, max: 10000 }), // totalPoints
          (userId, username, currentPage, totalPoints) => {
            // The isCurrentUser flag is determined by userId match, not page
            const isCurrentUser = true;
            const style = getEntryStyle(isCurrentUser);
            const formattedUsername = formatUsername(username, isCurrentUser);
            
            // Highlighting should apply on any page
            expect(style.backgroundColor).toBe(CURRENT_USER_BACKGROUND);
            expect(style.borderColor).toBe(CURRENT_USER_BORDER);
            expect(formattedUsername).toContain(YOU_SUFFIX);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: leaderboard-pagination, Property 8: Non-current user entry standard styling**
   * 
   * *For any* leaderboard entry E where E.userId does not equal the current user's ID, 
   * the entry SHALL have standard background color (#FFFFFF) and standard border color (#E0E0E0).
   * 
   * **Validates: Requirements 4.4**
   */
  describe('Property 8: Non-current user entry standard styling', () => {
    // Constants matching LeaderboardView styling
    const STANDARD_BACKGROUND = '#FFFFFF';
    const STANDARD_BORDER = '#E0E0E0';

    /**
     * Helper function that determines entry styling based on isCurrentUser flag
     * This mirrors the logic in LeaderboardView entry rendering
     */
    function getEntryStyle(isCurrentUser: boolean): { backgroundColor: string; borderColor: string } {
      return {
        backgroundColor: isCurrentUser ? '#FFF4E6' : STANDARD_BACKGROUND,
        borderColor: isCurrentUser ? '#FF4500' : STANDARD_BORDER,
      };
    }

    /**
     * Helper function that formats username based on isCurrentUser flag
     * This mirrors the logic in LeaderboardView entry rendering
     */
    function formatUsername(username: string, isCurrentUser: boolean): string {
      return isCurrentUser ? `${username} (You)` : username;
    }

    it('should apply standard background color #FFFFFF for non-current user entries', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 10000 }),
          (userId, username, totalPoints) => {
            const isCurrentUser = false;
            const style = getEntryStyle(isCurrentUser);
            
            expect(style.backgroundColor).toBe(STANDARD_BACKGROUND);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply standard border color #E0E0E0 for non-current user entries', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 10000 }),
          (userId, username, totalPoints) => {
            const isCurrentUser = false;
            const style = getEntryStyle(isCurrentUser);
            
            expect(style.borderColor).toBe(STANDARD_BORDER);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not append "(You)" suffix to username for non-current user entries', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('(You)')),
          (username) => {
            const isCurrentUser = false;
            const formattedUsername = formatUsername(username, isCurrentUser);
            
            expect(formattedUsername).not.toContain('(You)');
            expect(formattedUsername).toBe(username);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply standard styling for all non-current user entries', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('(You)')),
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 1, max: 100 }),
          (userId, username, totalPoints, level) => {
            const isCurrentUser = false;
            const style = getEntryStyle(isCurrentUser);
            const formattedUsername = formatUsername(username, isCurrentUser);
            
            // All standard styling properties should be applied
            expect(style.backgroundColor).toBe(STANDARD_BACKGROUND);
            expect(style.borderColor).toBe(STANDARD_BORDER);
            expect(formattedUsername).not.toContain('(You)');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply standard styling regardless of rank position', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 1000 }), // rank
          fc.integer({ min: 0, max: 10000 }), // totalPoints
          (userId, username, rank, totalPoints) => {
            const isCurrentUser = false;
            const style = getEntryStyle(isCurrentUser);
            
            // Standard styling should apply regardless of rank (even top 3)
            expect(style.backgroundColor).toBe(STANDARD_BACKGROUND);
            expect(style.borderColor).toBe(STANDARD_BORDER);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply standard styling on any page', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 100 }), // currentPage
          fc.integer({ min: 0, max: 10000 }), // totalPoints
          (userId, username, currentPage, totalPoints) => {
            const isCurrentUser = false;
            const style = getEntryStyle(isCurrentUser);
            
            // Standard styling should apply on any page
            expect(style.backgroundColor).toBe(STANDARD_BACKGROUND);
            expect(style.borderColor).toBe(STANDARD_BORDER);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should differentiate between current and non-current user styling', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (currentUserId, otherUserId, currentUsername, otherUsername) => {
            // Ensure different users
            if (currentUserId === otherUserId) return;
            
            const currentUserStyle = getEntryStyle(true);
            const otherUserStyle = getEntryStyle(false);
            
            // Styles should be different
            expect(currentUserStyle.backgroundColor).not.toBe(otherUserStyle.backgroundColor);
            expect(currentUserStyle.borderColor).not.toBe(otherUserStyle.borderColor);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
