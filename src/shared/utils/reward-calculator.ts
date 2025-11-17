/**
 * Reward Calculator Utility
 * 
 * Handles calculation of points and experience rewards for various game actions.
 */

import type { Reward } from '../models/common.types.js';
import { REWARDS } from '../constants/rewards.js';

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
 * Calculate the reward for completing a challenge based on attempt count.
 * 
 * Scoring structure:
 * - Attempt 1: 30 points (28 base + 2 bonus)
 * - Attempt 2: 27 points (28 base - 2 + 1 bonus)
 * - Attempt 3: 24 points (28 base - 4)
 * - Attempt 4: 22 points (28 base - 6)
 * - ...
 * - Attempt 10: 10 points (28 base - 18)
 * 
 * Formula: Score = 28 - ((attempts - 1) × 2) + bonus
 * Bonus: +2 for attempt 1, +1 for attempt 2, 0 otherwise
 * 
 * @param attemptsMade - Number of attempts made (1-10)
 * @param isSolved - Whether the challenge was successfully solved
 * @returns Reward object containing points and exp earned
 * 
 * @example
 * calculateAttemptReward(1, true)  // { points: 30, exp: 30 }
 * calculateAttemptReward(2, true)  // { points: 27, exp: 27 }
 * calculateAttemptReward(5, true)  // { points: 20, exp: 20 }
 * calculateAttemptReward(10, true) // { points: 10, exp: 10 }
 * calculateAttemptReward(5, false) // { points: 0, exp: 0 }
 */
export function calculateAttemptReward(
  attemptsMade: number,
  isSolved: boolean
): Reward {
  if (attemptsMade < 1 || attemptsMade > 10) {
    throw new Error('Attempts must be between 1 and 10');
  }
  
  if (!isSolved) {
    return REWARDS.SOLVE_FAILED;
  }
  
  // Base calculation: 28 - ((attempts - 1) × 2)
  let points = 28 - ((attemptsMade - 1) * 2);
  
  // Add bonuses for first two attempts
  if (attemptsMade === 1) {
    points += 2; // 30 points total
  } else if (attemptsMade === 2) {
    points += 1; // 27 points total
  }
  
  const exp = points; // 1:1 ratio
  
  return { points, exp };
}

/**
 * Calculate potential score for next attempt.
 * Used to show players what they could earn if they guess correctly on the next attempt.
 * 
 * @param currentAttempts - Number of attempts already made (0-9)
 * @returns Points that would be earned on next attempt, or 0 if at max attempts
 * 
 * @example
 * calculatePotentialScore(0)  // 30 (next is 1st attempt)
 * calculatePotentialScore(1)  // 27 (next is 2nd attempt)
 * calculatePotentialScore(9)  // 10 (next is 10th attempt)
 * calculatePotentialScore(10) // 0 (no more attempts)
 */
export function calculatePotentialScore(currentAttempts: number): number {
  const nextAttempt = currentAttempts + 1;
  if (nextAttempt > 10) return 0;
  
  const { points } = calculateAttemptReward(nextAttempt, true);
  return points;
}
