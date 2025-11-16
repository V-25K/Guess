/**
 * Reward Constants
 * Defines all point and experience rewards for various actions
 */

import type { Reward } from '../models/index.js';

export const REWARDS = {
  SOLVE_ONE_IMAGE: { points: 25, exp: 25 } as Reward,
  SOLVE_MULTIPLE_IMAGES: { points: 25, exp: 25 } as Reward,
  SOLVE_FAILED: { points: 0, exp: 0 } as Reward,
  CREATE_CHALLENGE: { points: 5, exp: 5 } as Reward,
  COMMENT_ON_CHALLENGE: { points: 1, exp: 1 } as Reward,
} as const;

export const LEVEL_PROGRESSION = {
  BASE_EXP: 100,
  GROWTH_FACTOR: 1.5,
} as const;
