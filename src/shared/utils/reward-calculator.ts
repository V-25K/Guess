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
