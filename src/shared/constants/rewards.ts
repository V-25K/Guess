/**
 * Reward Constants
 * Defines all point and experience rewards for various actions
 */

import type { Reward, Bonus, BonusType } from '../models/index.js';

export const REWARDS = {
  SOLVE_ONE_IMAGE: { points: 25, exp: 25 } as Reward,
  SOLVE_MULTIPLE_IMAGES: { points: 25, exp: 25 } as Reward,
  SOLVE_FAILED: { points: 0, exp: 0 } as Reward,
  CREATE_CHALLENGE: { points: 5, exp: 5 } as Reward,
} as const;

export const LEVEL_PROGRESSION = {
  BASE_EXP: 100,
  GROWTH_FACTOR: 1.5,
} as const;

/**
 * Bonus rewards for special achievements
 */
export const BONUSES: Record<BonusType, Omit<Bonus, 'type'>> = {
  first_clear: { points: 50, exp: 50, label: 'First Clear!' },
  perfect_solve: { points: 20, exp: 20, label: 'Perfect!' },
  speed_demon: { points: 5, exp: 5, label: 'Speed Demon!' },
  comeback_king: { points: 3, exp: 3, label: 'Comeback King!' },
  streak: { points: 3, exp: 3, label: 'Streak Bonus!' },
  creator_bonus: { points: 2, exp: 2, label: 'Creator Bonus!' },
} as const;
