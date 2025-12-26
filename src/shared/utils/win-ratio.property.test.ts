/**
 * Property-based tests for win ratio calculation
 *
 * **Feature: ui-ux-mobile-improvements, Property 3: Win Ratio Calculation Correctness**
 * **Validates: Requirements 3.3, 6.3, 6.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateWinRatio } from './win-ratio.js';

describe('Win Ratio Calculator Properties', () => {
  /**
   * **Feature: ui-ux-mobile-improvements, Property 3: Win Ratio Calculation Correctness**
   *
   * *For any* non-negative integers players_played and players_completed where
   * players_completed <= players_played, the calculateWinRatio function should return
   * Math.round((players_completed / players_played) * 100) when players_played > 0,
   * and 0 when players_played equals 0.
   *
   * **Validates: Requirements 3.3, 6.3, 6.4**
   */
  describe('Property 3: Win Ratio Calculation Correctness', () => {
    // Arbitrary for valid player counts (non-negative integers)
    const validPlayerCount = fc.integer({ min: 0, max: 10000 });

    it('should return 0 when players_played is 0', () => {
      fc.assert(
        fc.property(validPlayerCount, (playersCompleted) => {
          const result = calculateWinRatio(0, playersCompleted);

          expect(result.ratio).toBe(0);
          expect(result.display).toBe('0%');
        }),
        { numRuns: 100 }
      );
    });

    it('should calculate ratio as Math.round((completed / played) * 100) when played > 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          (playersPlayed, playersCompleted) => {
            // Ensure completed <= played for valid scenarios
            const validCompleted = Math.min(playersCompleted, playersPlayed);

            const result = calculateWinRatio(playersPlayed, validCompleted);
            const expectedRatio = Math.round((validCompleted / playersPlayed) * 100);

            expect(result.ratio).toBe(expectedRatio);
            expect(result.display).toBe(`${expectedRatio}%`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return ratio between 0 and 100 for valid inputs where completed <= played', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          (playersPlayed, playersCompleted) => {
            // Ensure completed <= played
            const validCompleted = Math.min(playersCompleted, playersPlayed);

            const result = calculateWinRatio(playersPlayed, validCompleted);

            expect(result.ratio).toBeGreaterThanOrEqual(0);
            expect(result.ratio).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 100 when all players completed', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10000 }), (playersPlayed) => {
          const result = calculateWinRatio(playersPlayed, playersPlayed);

          expect(result.ratio).toBe(100);
          expect(result.display).toBe('100%');
        }),
        { numRuns: 100 }
      );
    });

    it('should return 0 when no players completed', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10000 }), (playersPlayed) => {
          const result = calculateWinRatio(playersPlayed, 0);

          expect(result.ratio).toBe(0);
          expect(result.display).toBe('0%');
        }),
        { numRuns: 100 }
      );
    });

    it('should handle negative inputs by returning 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: -1 }),
          fc.integer({ min: -10000, max: 10000 }),
          (playersPlayed, playersCompleted) => {
            const result = calculateWinRatio(playersPlayed, playersCompleted);

            expect(result.ratio).toBe(0);
            expect(result.display).toBe('0%');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format display string correctly with percentage symbol', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          (playersPlayed, playersCompleted) => {
            const result = calculateWinRatio(playersPlayed, playersCompleted);

            // Display should always end with %
            expect(result.display).toMatch(/^\d+%$/);
            // Display should match ratio
            expect(result.display).toBe(`${result.ratio}%`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
