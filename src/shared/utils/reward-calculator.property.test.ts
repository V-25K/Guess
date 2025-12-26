/**
 * Property-based tests for reward calculation
 * 
 * **Feature: devvit-web-migration, Property 2: Reward calculation equivalence**
 * **Validates: Requirements 5.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateAttemptReward,
  calculateAttemptRewardWithBonuses,
  calculatePotentialScore,
  calculateHintPenalty,
  calculateTotalHintPenalty,
  type BonusContext,
} from './reward-calculator.js';

describe('Reward Calculator Properties', () => {
  /**
   * **Feature: devvit-web-migration, Property 2: Reward calculation equivalence**
   * 
   * *For any* challenge completion with a given number of attempts and bonus context,
   * the reward calculation in the web version should produce the same points and experience
   * as the Blocks version
   * 
   * **Validates: Requirements 5.5**
   */
  describe('Property 2: Reward calculation equivalence', () => {
    // Arbitrary for valid attempt counts (1-10)
    const validAttempts = fc.integer({ min: 1, max: 10 });
    
    // Arbitrary for hints used (0-3 for 3-image challenges, 0-2 for 2-image challenges)
    const validHintsFor3Images = fc.integer({ min: 0, max: 3 });
    const validHintsFor2Images = fc.integer({ min: 0, max: 2 });
    
    // Arbitrary for streak values (0-100)
    const validStreak = fc.integer({ min: 0, max: 100 });

    it('should calculate base reward using formula: 30 - ((attempts - 1) × 2)', () => {
      fc.assert(
        fc.property(validAttempts, (attempts) => {
          const reward = calculateAttemptReward(attempts, true, 0, 3);
          
          // Formula: 30 - ((attempts - 1) × 2)
          const expectedPoints = 30 - ((attempts - 1) * 2);
          
          expect(reward.points).toBe(expectedPoints);
          expect(reward.exp).toBe(expectedPoints); // 1:1 ratio
        }),
        { numRuns: 100 }
      );
    });

    it('should deduct hint penalties from base score for 3-image challenges', () => {
      fc.assert(
        fc.property(validAttempts, validHintsFor3Images, (attempts, hintsUsed) => {
          const reward = calculateAttemptReward(attempts, true, hintsUsed, 3);
          
          // Calculate expected base score
          const baseScore = 30 - ((attempts - 1) * 2);
          
          // Calculate expected hint penalty
          const hintPenalty = calculateTotalHintPenalty(3, hintsUsed);
          
          // Expected final score (capped at 0)
          const expectedPoints = Math.max(0, baseScore - hintPenalty);
          
          expect(reward.points).toBe(expectedPoints);
          expect(reward.exp).toBe(expectedPoints);
        }),
        { numRuns: 100 }
      );
    });

    it('should deduct hint penalties from base score for 2-image challenges', () => {
      fc.assert(
        fc.property(validAttempts, validHintsFor2Images, (attempts, hintsUsed) => {
          const reward = calculateAttemptReward(attempts, true, hintsUsed, 2);
          
          // Calculate expected base score
          const baseScore = 30 - ((attempts - 1) * 2);
          
          // Calculate expected hint penalty
          const hintPenalty = calculateTotalHintPenalty(2, hintsUsed);
          
          // Expected final score (capped at 0)
          const expectedPoints = Math.max(0, baseScore - hintPenalty);
          
          expect(reward.points).toBe(expectedPoints);
          expect(reward.exp).toBe(expectedPoints);
        }),
        { numRuns: 100 }
      );
    });

    it('should never return negative points or experience', () => {
      fc.assert(
        fc.property(validAttempts, validHintsFor3Images, (attempts, hintsUsed) => {
          const reward = calculateAttemptReward(attempts, true, hintsUsed, 3);
          
          expect(reward.points).toBeGreaterThanOrEqual(0);
          expect(reward.exp).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should return zero reward for failed attempts', () => {
      fc.assert(
        fc.property(validAttempts, validHintsFor3Images, (attempts, hintsUsed) => {
          const reward = calculateAttemptReward(attempts, false, hintsUsed, 3);
          
          expect(reward.points).toBe(0);
          expect(reward.exp).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain 1:1 ratio between points and experience for base rewards', () => {
      fc.assert(
        fc.property(validAttempts, validHintsFor3Images, (attempts, hintsUsed) => {
          const reward = calculateAttemptReward(attempts, true, hintsUsed, 3);
          
          // Points and exp should always be equal
          expect(reward.points).toBe(reward.exp);
        }),
        { numRuns: 100 }
      );
    });

    it('should calculate total reward as base + bonuses', () => {
      fc.assert(
        fc.property(
          validAttempts,
          validHintsFor3Images,
          fc.boolean(),
          validStreak,
          (attempts, hintsUsed, isFirstClear, currentStreak) => {
            const bonusContext: BonusContext = {
              isFirstClear,
              currentStreak,
              attemptsMade: attempts,
            };
            
            const rewardWithBonuses = calculateAttemptRewardWithBonuses(
              attempts,
              true,
              bonusContext,
              hintsUsed,
              3
            );
            
            // Calculate expected base reward
            const baseReward = calculateAttemptReward(attempts, true, hintsUsed, 3);
            
            // Total should be base + bonus
            const bonusPoints = rewardWithBonuses.bonuses.reduce((sum, b) => sum + b.points, 0);
            const bonusExp = rewardWithBonuses.bonuses.reduce((sum, b) => sum + b.exp, 0);
            
            expect(rewardWithBonuses.points).toBe(baseReward.points);
            expect(rewardWithBonuses.exp).toBe(baseReward.exp);
            expect(rewardWithBonuses.totalPoints).toBe(baseReward.points + bonusPoints);
            expect(rewardWithBonuses.totalExp).toBe(baseReward.exp + bonusExp);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate potential score for next attempt correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 9 }), // current attempts (0-9, so next is 1-10)
          validHintsFor3Images,
          (currentAttempts, hintsUsed) => {
            const potentialScore = calculatePotentialScore(currentAttempts, hintsUsed, 3);
            
            // Calculate what the score would be if solved on next attempt
            const nextAttempt = currentAttempts + 1;
            const expectedReward = calculateAttemptReward(nextAttempt, true, hintsUsed, 3);
            
            expect(potentialScore).toBe(expectedReward.points);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 potential score when attempts exhausted', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 20 }), // attempts >= 10
          validHintsFor3Images,
          (currentAttempts, hintsUsed) => {
            const potentialScore = calculatePotentialScore(currentAttempts, hintsUsed, 3);
            
            expect(potentialScore).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate hint penalties consistently for 3-image challenges', () => {
      // Test specific hint penalties for 3-image challenges (4 pts each)
      expect(calculateHintPenalty(3, 1)).toBe(4);
      expect(calculateHintPenalty(3, 2)).toBe(4);
      expect(calculateHintPenalty(3, 3)).toBe(4);
      
      // Test total penalties
      expect(calculateTotalHintPenalty(3, 0)).toBe(0);
      expect(calculateTotalHintPenalty(3, 1)).toBe(4);
      expect(calculateTotalHintPenalty(3, 2)).toBe(8); // 4 + 4
      expect(calculateTotalHintPenalty(3, 3)).toBe(12); // 4 + 4 + 4
    });

    it('should calculate hint penalties consistently for 2-image challenges', () => {
      // Test specific hint penalties for 2-image challenges (6 pts each)
      expect(calculateHintPenalty(2, 1)).toBe(6);
      expect(calculateHintPenalty(2, 2)).toBe(6);
      
      // Test total penalties
      expect(calculateTotalHintPenalty(2, 0)).toBe(0);
      expect(calculateTotalHintPenalty(2, 1)).toBe(6);
      expect(calculateTotalHintPenalty(2, 2)).toBe(12); // 6 + 6
    });

    it('should award perfect solve bonus only on first attempt', () => {
      fc.assert(
        fc.property(validAttempts, (attempts) => {
          const bonusContext: BonusContext = {
            isFirstClear: false,
            currentStreak: 0,
            attemptsMade: attempts,
          };
          
          const rewardWithBonuses = calculateAttemptRewardWithBonuses(
            attempts,
            true,
            bonusContext,
            0,
            3
          );
          
          const hasPerfectSolveBonus = rewardWithBonuses.bonuses.some(
            b => b.type === 'perfect_solve'
          );
          
          if (attempts === 1) {
            expect(hasPerfectSolveBonus).toBe(true);
          } else {
            expect(hasPerfectSolveBonus).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should award speed demon bonus for 2-3 attempts only', () => {
      fc.assert(
        fc.property(validAttempts, (attempts) => {
          const bonusContext: BonusContext = {
            isFirstClear: false,
            currentStreak: 0,
            attemptsMade: attempts,
          };
          
          const rewardWithBonuses = calculateAttemptRewardWithBonuses(
            attempts,
            true,
            bonusContext,
            0,
            3
          );
          
          const hasSpeedDemonBonus = rewardWithBonuses.bonuses.some(
            b => b.type === 'speed_demon'
          );
          
          if (attempts >= 2 && attempts <= 3) {
            expect(hasSpeedDemonBonus).toBe(true);
          } else {
            expect(hasSpeedDemonBonus).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should award comeback king bonus only on 10th attempt', () => {
      fc.assert(
        fc.property(validAttempts, (attempts) => {
          const bonusContext: BonusContext = {
            isFirstClear: false,
            currentStreak: 0,
            attemptsMade: attempts,
          };
          
          const rewardWithBonuses = calculateAttemptRewardWithBonuses(
            attempts,
            true,
            bonusContext,
            0,
            3
          );
          
          const hasComebackKingBonus = rewardWithBonuses.bonuses.some(
            b => b.type === 'comeback_king'
          );
          
          if (attempts === 10) {
            expect(hasComebackKingBonus).toBe(true);
          } else {
            expect(hasComebackKingBonus).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should award streak bonus when current streak > 0', () => {
      fc.assert(
        fc.property(validStreak, (currentStreak) => {
          const bonusContext: BonusContext = {
            isFirstClear: false,
            currentStreak,
            attemptsMade: 5,
          };
          
          const rewardWithBonuses = calculateAttemptRewardWithBonuses(
            5,
            true,
            bonusContext,
            0,
            3
          );
          
          const hasStreakBonus = rewardWithBonuses.bonuses.some(
            b => b.type === 'streak'
          );
          
          if (currentStreak > 0) {
            expect(hasStreakBonus).toBe(true);
          } else {
            expect(hasStreakBonus).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
