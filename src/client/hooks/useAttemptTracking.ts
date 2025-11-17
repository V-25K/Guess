/**
 * useAttemptTracking Hook
 * Custom hook to manage attempt tracking state for gameplay
 * 
 * Features:
 * - Track current attempt count (0-10)
 * - Calculate attempts remaining
 * - Calculate potential score for next attempt
 * - Detect game over state
 * - Increment attempt counter
 * - Reset state for new challenges
 */

import { useState } from '@devvit/public-api';
import { calculatePotentialScore } from '../../shared/utils/reward-calculator.js';

/**
 * State interface for attempt tracking
 */
export interface AttemptTrackingState {
  /** Current number of attempts made (0-10) */
  attemptCount: number;
  /** Number of attempts remaining (0-10) */
  attemptsRemaining: number;
  /** Points that would be earned on next correct guess */
  potentialScore: number;
  /** Whether the game is over (10 attempts used or challenge solved) */
  isGameOver: boolean;
}

/**
 * Return type for useAttemptTracking hook
 */
export interface UseAttemptTrackingResult extends AttemptTrackingState {
  /** Increment the attempt count by 1 */
  incrementAttempt: () => void;
  /** Reset state to initial values */
  reset: () => void;
}

/**
 * Hook to manage attempt tracking state during gameplay
 * 
 * Tracks the number of attempts made, calculates remaining attempts,
 * and determines the potential score for the next correct guess.
 * 
 * @returns Attempt tracking state and control functions
 * 
 * @example
 * const { 
 *   attemptCount, 
 *   attemptsRemaining, 
 *   potentialScore, 
 *   isGameOver,
 *   incrementAttempt,
 *   reset 
 * } = useAttemptTracking();
 * 
 * // After submitting an incorrect guess
 * incrementAttempt();
 * 
 * // Display attempt info
 * <text>Attempt {attemptCount + 1} of 10</text>
 * <text>Potential: {potentialScore} pts</text>
 * 
 * // Check if game over
 * if (isGameOver) {
 *   <text>No more attempts!</text>
 * }
 * 
 * // Start new challenge
 * reset();
 */
export function useAttemptTracking(): UseAttemptTrackingResult {
  // Initialize state with separate useState calls (Devvit pattern)
  const [attemptCount, setAttemptCount] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(10);
  const [potentialScore, setPotentialScore] = useState(30);
  const [isGameOver, setIsGameOver] = useState(false);

  /**
   * Increment the attempt count by 1
   * Updates all derived values (attemptsRemaining, potentialScore, isGameOver)
   */
  const incrementAttempt = (): void => {
    const newAttemptCount = attemptCount + 1;
    const newAttemptsRemaining = 10 - newAttemptCount;
    const newPotentialScore = calculatePotentialScore(newAttemptCount);
    const newIsGameOver = newAttemptsRemaining === 0;

    setAttemptCount(newAttemptCount);
    setAttemptsRemaining(newAttemptsRemaining);
    setPotentialScore(newPotentialScore);
    setIsGameOver(newIsGameOver);
  };

  /**
   * Reset state to initial values
   * Use when starting a new challenge
   */
  const reset = (): void => {
    setAttemptCount(0);
    setAttemptsRemaining(10);
    setPotentialScore(30);
    setIsGameOver(false);
  };

  return {
    attemptCount,
    attemptsRemaining,
    potentialScore,
    isGameOver,
    incrementAttempt,
    reset,
  };
}
