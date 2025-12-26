/**
 * Reward Calculator Utility
 * 
 * Handles calculation of points and experience rewards for various game actions.
 */

import type { Reward, Bonus, BonusType, RewardWithBonuses } from '../models/common.types.js';
import { REWARDS, BONUSES } from '../constants/rewards.js';

/**
 * Context for calculating bonuses
 */
export type BonusContext = {
  isFirstClear: boolean;      // User's first ever challenge solve
  currentStreak: number;      // Current consecutive solves (before this one)
  attemptsMade: number;       // Number of attempts used
};

/**
 * Create a bonus object from a bonus type
 */
function createBonus(type: BonusType): Bonus {
  const bonusData = BONUSES[type];
  return {
    type,
    points: bonusData.points,
    exp: bonusData.exp,
    label: bonusData.label,
  };
}

/**
 * Calculate penalty for using a hint based on total images and hint number (1-based index of usage)
 * - 3 image challenges: 4 points per hint
 * - 2 image challenges: 6 points per hint
 */
export function calculateHintPenalty(totalImages: number, hintNumber: number): number {
  if (totalImages === 3) {
    // 4 points per hint for 3-image challenges
    if (hintNumber >= 1 && hintNumber <= 3) return 4;
  } else if (totalImages === 2) {
    // 6 points per hint for 2-image challenges
    if (hintNumber >= 1 && hintNumber <= 2) return 6;
  }
  return 0;
}

/**
 * Calculate total penalty for all hints used
 */
export function calculateTotalHintPenalty(totalImages: number, hintsUsedCount: number): number {
  let penalty = 0;
  for (let i = 1; i <= hintsUsedCount; i++) {
    penalty += calculateHintPenalty(totalImages, i);
  }
  return penalty;
}

/**
 * Calculate all applicable bonuses for a challenge completion
 */
export function calculateBonuses(context: BonusContext): Bonus[] {
  const bonuses: Bonus[] = [];

  // First Clear Bonus - first challenge ever solved
  if (context.isFirstClear) {
    bonuses.push(createBonus('first_clear'));
  }

  // Perfect Solve Bonus - solved on first attempt
  if (context.attemptsMade === 1) {
    bonuses.push(createBonus('perfect_solve'));
  }

  // Speed Demon Bonus - solved within 3 attempts (but not first, to avoid double bonus)
  if (context.attemptsMade >= 2 && context.attemptsMade <= 3) {
    bonuses.push(createBonus('speed_demon'));
  }

  // Comeback King Bonus - solved on last attempt
  if (context.attemptsMade === 10) {
    bonuses.push(createBonus('comeback_king'));
  }

  // Streak Bonus - consecutive solves (awarded if streak > 0 before this solve)
  if (context.currentStreak > 0) {
    bonuses.push(createBonus('streak'));
  }

  return bonuses;
}

/**
 * Calculate the reward for completing a challenge based on performance.
 * 
 * Reward structure:
 * - Solved with 1 image revealed: 20 points, 10 exp
 * - Solved with 2+ images revealed: 10 points, 5 exp
 * - Failed to solve: 0 points, 0 exp
 * 
 * @param imagesRevealed - Number of images revealed during the attempt
 * @param isSolved - Whether the challenge was successfully solved
 * @returns Reward object containing points and exp earned
 * 
 * @example
 * calculateChallengeReward(1, true)  // { points: 20, exp: 10 }
 * calculateChallengeReward(3, true)  // { points: 10, exp: 5 }
 * calculateChallengeReward(5, false) // { points: 0, exp: 0 }
 */
export function calculateChallengeReward(
  imagesRevealed: number,
  isSolved: boolean
): Reward {
  if (imagesRevealed < 1) {
    throw new Error('Images revealed must be at least 1');
  }

  if (!isSolved) {
    return REWARDS.SOLVE_FAILED;
  }

  const points = Math.max(0, 25 - (imagesRevealed - 1) * 5);
  const exp = points;

  return { points, exp };
}

/**
 * Get the reward for creating a challenge.
 * 
 * @returns Reward object containing 5 points and 10 exp
 * 
 * @example
 * getCreationReward() // { points: 5, exp: 10 }
 */
export function getCreationReward(): Reward {
  return REWARDS.CREATE_CHALLENGE;
}

/**
 * Get the reward for receiving a comment on a challenge.
 * This reward is given to the challenge creator for each comment.
 * 
 * @returns Reward object containing 1 point and 1 exp
 * 
 * @example
 * getCommentReward() // { points: 1, exp: 1 }
 */
export function getCommentReward(): Reward {
  return REWARDS.COMMENT_ON_CHALLENGE;
}

/**
 * Get the creator bonus when someone solves their challenge
 */
export function getCreatorBonus(): Bonus {
  return createBonus('creator_bonus');
}

/**
 * Calculate the reward for completing a challenge based on attempt count.
 * Formula: Score = 30 - ((attempts - 1) × 2)
 * Minimum score (no hints): 12 points at 10 attempts
 * No built-in bonus - bonuses are calculated separately via calculateBonuses()
 */
export function calculateAttemptReward(
  attemptsMade: number,
  isSolved: boolean,
  hintsUsedCount: number = 0,
  totalImages: number = 3
): Reward {
  if (attemptsMade < 1 || attemptsMade > 10) {
    throw new Error('Attempts must be between 1 and 10');
  }

  if (!isSolved) {
    return REWARDS.SOLVE_FAILED;
  }

  // Base calculation: 30 - ((attempts - 1) × 2)
  // At attempt 1: 30 points, at attempt 10: 12 points
  let points = 30 - ((attemptsMade - 1) * 2);

  // Deduct hints penalty
  const hintPenalty = calculateTotalHintPenalty(totalImages, hintsUsedCount);
  points -= hintPenalty;

  // Cap at 0 (ensure non-negative)
  points = Math.max(0, points);

  const exp = points; // 1:1 ratio

  return { points, exp };
}

/**
 * Calculate full reward with bonuses for a challenge completion
 */
export function calculateAttemptRewardWithBonuses(
  attemptsMade: number,
  isSolved: boolean,
  bonusContext: BonusContext,
  hintsUsedCount: number = 0,
  totalImages: number = 3
): RewardWithBonuses {
  const baseReward = calculateAttemptReward(attemptsMade, isSolved, hintsUsedCount, totalImages);

  if (!isSolved) {
    return {
      ...baseReward,
      bonuses: [],
      totalPoints: 0,
      totalExp: 0,
    };
  }

  const bonuses = calculateBonuses(bonusContext);

  const bonusPoints = bonuses.reduce((sum, b) => sum + b.points, 0);
  const bonusExp = bonuses.reduce((sum, b) => sum + b.exp, 0);

  return {
    points: baseReward.points,
    exp: baseReward.exp,
    bonuses,
    totalPoints: baseReward.points + bonusPoints,
    totalExp: baseReward.exp + bonusExp,
  };
}

/**
 * Calculate potential score for next attempt.
 */
export function calculatePotentialScore(
  currentAttempts: number,
  hintsUsedCount: number = 0,
  totalImages: number = 3
): number {
  const nextAttempt = currentAttempts + 1;
  if (nextAttempt > 10) return 0;

  const { points } = calculateAttemptReward(nextAttempt, true, hintsUsedCount, totalImages);
  return points;
}
