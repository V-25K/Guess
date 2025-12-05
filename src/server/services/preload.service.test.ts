/**
 * Property-based tests for PreloadService
 * 
 * Tests preload count behavior and silent failure handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { PreloadService, type PreloadConfig } from './preload.service.js';
import type { Challenge } from '../../shared/models/challenge.types.js';

/**
 * Generate a mock Challenge for testing
 */
const challengeArbitrary = fc.record({
  id: fc.uuid(),
  creator_id: fc.string({ minLength: 1, maxLength: 20 }),
  creator_username: fc.string({ minLength: 1, maxLength: 20 }),
  title: fc.string({ minLength: 3, maxLength: 200 }),

  image_url: fc.string({ minLength: 1, maxLength: 500 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
  correct_answer: fc.string({ minLength: 1, maxLength: 500 }),
  max_score: fc.integer({ min: 1, max: 100 }),
  score_deduction_per_hint: fc.integer({ min: 0, max: 50 }),
  reddit_post_id: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  players_played: fc.integer({ min: 0, max: 10000 }),
  players_completed: fc.integer({ min: 0, max: 10000 }),
  created_at: fc.constant(new Date().toISOString()),
}) as fc.Arbitrary<Challenge>;

/**
 * Generate a list of challenges with unique IDs
 */
const challengeListArbitrary = (minLength: number, maxLength: number) =>
  fc.array(challengeArbitrary, { minLength, maxLength }).map(challenges => {
    // Ensure unique IDs
    const seen = new Set<string>();
    return challenges.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  });

describe('PreloadService Properties', () => {
  let preloadService: PreloadService;

  beforeEach(() => {
    // Use minimal delay for faster tests
    preloadService = new PreloadService({
      preloadCount: 3,
      preloadDelayMs: 0, // No delay in tests
      maxCacheSize: 10,
    });
  });

  /**
   * **Feature: performance-optimization, Property 2: Preload Fetches Next Challenges**
   * 
   * *For any* challenge at index I in a list of challenges, after loading completes,
   * the system SHALL initiate fetch for challenges at indices I+1, I+2, and I+3 (if they exist).
   * 
   * **Validates: Requirements 2.2**
   */
  describe('Property 2: Preload Fetches Next Challenges', () => {
    it('should preload exactly the next N challenges after current index', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a list of 4-20 challenges
          challengeListArbitrary(4, 20),
          // Generate a valid current index (not the last few)
          fc.nat(),
          // Generate preload count (1-5)
          fc.integer({ min: 1, max: 5 }),
          async (challenges, indexSeed, preloadCount) => {
            // Ensure we have enough challenges
            if (challenges.length < 4) return;

            // Calculate valid current index (leave room for preloading)
            const maxIndex = Math.max(0, challenges.length - 2);
            const currentIndex = indexSeed % (maxIndex + 1);

            // Create service with specific preload count
            const service = new PreloadService({
              preloadCount,
              preloadDelayMs: 0,
              maxCacheSize: 20,
            });

            // Preload next challenges
            await service.preloadNextChallenges(currentIndex, challenges);

            // Calculate expected preloaded challenges
            const startIndex = currentIndex + 1;
            const endIndex = Math.min(startIndex + preloadCount, challenges.length);
            const expectedCount = endIndex - startIndex;

            // Verify the correct number of challenges were preloaded
            expect(service.getCacheSize()).toBe(expectedCount);

            // Verify the correct challenges were preloaded
            for (let i = startIndex; i < endIndex; i++) {
              expect(service.hasPreloadedChallenge(challenges[i].id)).toBe(true);
            }

            // Verify challenges before current index were NOT preloaded
            for (let i = 0; i <= currentIndex; i++) {
              expect(service.hasPreloadedChallenge(challenges[i].id)).toBe(false);
            }

            // Verify challenges beyond preload range were NOT preloaded
            for (let i = endIndex; i < challenges.length; i++) {
              expect(service.hasPreloadedChallenge(challenges[i].id)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preload 0 challenges when at the last index', async () => {
      await fc.assert(
        fc.asyncProperty(
          challengeListArbitrary(1, 10),
          async (challenges) => {
            if (challenges.length === 0) return;

            const service = new PreloadService({
              preloadCount: 3,
              preloadDelayMs: 0,
              maxCacheSize: 10,
            });

            // Preload from last index
            const lastIndex = challenges.length - 1;
            await service.preloadNextChallenges(lastIndex, challenges);

            // Should have preloaded 0 challenges (no more after last)
            expect(service.getCacheSize()).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preload fewer challenges when near end of list', async () => {
      await fc.assert(
        fc.asyncProperty(
          challengeListArbitrary(5, 15),
          async (challenges) => {
            if (challenges.length < 5) return;

            const service = new PreloadService({
              preloadCount: 3,
              preloadDelayMs: 0,
              maxCacheSize: 10,
            });

            // Preload from second-to-last index
            const nearEndIndex = challenges.length - 2;
            await service.preloadNextChallenges(nearEndIndex, challenges);

            // Should have preloaded only 1 challenge (the last one)
            expect(service.getCacheSize()).toBe(1);
            expect(service.hasPreloadedChallenge(challenges[challenges.length - 1].id)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle empty challenge list gracefully', async () => {
      const service = new PreloadService({
        preloadCount: 3,
        preloadDelayMs: 0,
        maxCacheSize: 10,
      });

      // Should not throw with empty list
      await service.preloadNextChallenges(0, []);
      expect(service.getCacheSize()).toBe(0);
    });

    it('should handle negative index gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          challengeListArbitrary(3, 10),
          fc.integer({ min: -100, max: -1 }),
          async (challenges, negativeIndex) => {
            if (challenges.length === 0) return;

            const service = new PreloadService({
              preloadCount: 3,
              preloadDelayMs: 0,
              maxCacheSize: 10,
            });

            // Should not throw with negative index
            await service.preloadNextChallenges(negativeIndex, challenges);

            // Should have preloaded 0 challenges (invalid index)
            expect(service.getCacheSize()).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not duplicate preloads for already cached challenges', async () => {
      await fc.assert(
        fc.asyncProperty(
          challengeListArbitrary(5, 15),
          async (challenges) => {
            if (challenges.length < 5) return;

            const service = new PreloadService({
              preloadCount: 3,
              preloadDelayMs: 0,
              maxCacheSize: 20,
            });

            // Preload from index 0
            await service.preloadNextChallenges(0, challenges);
            const firstCacheSize = service.getCacheSize();

            // Preload again from index 0 (should not add duplicates)
            await service.preloadNextChallenges(0, challenges);

            // Cache size should remain the same
            expect(service.getCacheSize()).toBe(firstCacheSize);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: performance-optimization, Property 3: Preload Failure Does Not Block Gameplay**
   * 
   * *For any* preload operation that throws an error, the system SHALL catch the error
   * and allow on-demand loading to proceed without surfacing the error to the user.
   * 
   * **Validates: Requirements 2.3**
   */
  describe('Property 3: Preload Failure Does Not Block Gameplay', () => {
    it('should not throw when fetcher throws an error', async () => {
      await fc.assert(
        fc.asyncProperty(
          challengeListArbitrary(3, 10),
          fc.string({ minLength: 1, maxLength: 100 }), // Error message
          async (challenges, errorMessage) => {
            if (challenges.length < 3) return;

            const service = new PreloadService({
              preloadCount: 3,
              preloadDelayMs: 0,
              maxCacheSize: 10,
            });

            // Create a fetcher that always throws
            const failingFetcher = async () => {
              throw new Error(errorMessage);
            };

            // Should NOT throw - errors are caught silently
            await expect(
              service.preloadNextChallenges(0, challenges, failingFetcher)
            ).resolves.not.toThrow();

            // Challenges should still be cached (without additional data from fetcher)
            const expectedCount = Math.min(3, challenges.length - 1);
            expect(service.getCacheSize()).toBe(expectedCount);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not throw when challenges array is corrupted', async () => {
      const service = new PreloadService({
        preloadCount: 3,
        preloadDelayMs: 0,
        maxCacheSize: 10,
      });

      // Test with various invalid inputs - none should throw
      await expect(service.preloadNextChallenges(0, null as any)).resolves.not.toThrow();
      await expect(service.preloadNextChallenges(0, undefined as any)).resolves.not.toThrow();
      await expect(service.preloadNextChallenges(-1, [])).resolves.not.toThrow();
      await expect(service.preloadNextChallenges(NaN, [])).resolves.not.toThrow();
    });

    it('should allow on-demand loading after preload failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          challengeListArbitrary(5, 15),
          async (challenges) => {
            if (challenges.length < 5) return;

            const service = new PreloadService({
              preloadCount: 3,
              preloadDelayMs: 0,
              maxCacheSize: 10,
            });

            // Simulate preload with failing fetcher
            const failingFetcher = async () => {
              throw new Error('Network error');
            };

            // Preload should not throw
            await service.preloadNextChallenges(0, challenges, failingFetcher);

            // On-demand loading should still work
            // (getPreloadedChallenge returns null if not cached, allowing fallback)
            const result = service.getPreloadedChallenge('non-existent-id');
            expect(result).toBeNull();

            // Cached challenges should still be retrievable
            if (challenges.length > 1) {
              const preloaded = service.getPreloadedChallenge(challenges[1].id);
              // Should have the challenge (even without fetcher data)
              expect(preloaded).not.toBeNull();
              expect(preloaded?.challenge.id).toBe(challenges[1].id);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should continue preloading other challenges when one fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          challengeListArbitrary(5, 15),
          fc.integer({ min: 0, max: 2 }), // Which challenge index to fail
          async (challenges, failIndex) => {
            if (challenges.length < 5) return;

            const service = new PreloadService({
              preloadCount: 3,
              preloadDelayMs: 0,
              maxCacheSize: 10,
            });

            let callCount = 0;
            const selectiveFailingFetcher = async (challenge: Challenge) => {
              const currentCall = callCount++;
              if (currentCall === failIndex) {
                throw new Error('Selective failure');
              }
              return { avatarUrl: 'https://example.com/avatar.png' };
            };

            // Should not throw
            await expect(
              service.preloadNextChallenges(0, challenges, selectiveFailingFetcher)
            ).resolves.not.toThrow();

            // All challenges should still be cached (failure only affects fetcher data)
            const expectedCount = Math.min(3, challenges.length - 1);
            expect(service.getCacheSize()).toBe(expectedCount);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should log warnings but not expose errors to caller', async () => {
      const service = new PreloadService({
        preloadCount: 3,
        preloadDelayMs: 0,
        maxCacheSize: 10,
      });

      // Mock console.warn to verify it's called
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      const challenges: Challenge[] = [
        {
          id: '1',
          creator_id: 'user1',
          creator_username: 'user1',
          title: 'Test',

          image_url: 'http://example.com/img.jpg',
          tags: ['test'],
          correct_answer: 'answer',
          max_score: 100,
          score_deduction_per_hint: 10,
          reddit_post_id: null,
          players_played: 0,
          players_completed: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          creator_id: 'user1',
          creator_username: 'user1',
          title: 'Test 2',

          image_url: 'http://example.com/img2.jpg',
          tags: ['test'],
          correct_answer: 'answer2',
          max_score: 100,
          score_deduction_per_hint: 10,
          reddit_post_id: null,
          players_played: 0,
          players_completed: 0,
          created_at: new Date().toISOString(),
        },
      ];

      const failingFetcher = async () => {
        throw new Error('Test error');
      };

      // Should not throw
      await service.preloadNextChallenges(0, challenges, failingFetcher);

      // Warning should have been logged
      expect(warnSpy).toHaveBeenCalled();

      // Restore console.warn
      warnSpy.mockRestore();
    });
  });
});
