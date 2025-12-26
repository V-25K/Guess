/**
 * Win Ratio Calculator Utility
 *
 * Calculates the win ratio percentage for challenges based on
 * players who completed vs players who attempted.
 */

/**
 * Result of win ratio calculation
 */
export interface WinRatioResult {
  /** Win ratio as integer 0-100 */
  ratio: number;
  /** Display string formatted as "XX%" */
  display: string;
}

/**
 * Calculate the win ratio for a challenge.
 *
 * @param playersPlayed - Total number of players who attempted the challenge
 * @param playersCompleted - Number of players who successfully completed the challenge
 * @returns WinRatioResult with ratio (0-100) and display string
 *
 * @example
 * calculateWinRatio(0, 0)    // Returns { ratio: 0, display: "0%" }
 * calculateWinRatio(10, 5)   // Returns { ratio: 50, display: "50%" }
 * calculateWinRatio(100, 75) // Returns { ratio: 75, display: "75%" }
 * calculateWinRatio(3, 1)    // Returns { ratio: 33, display: "33%" }
 */
export function calculateWinRatio(
  playersPlayed: number,
  playersCompleted: number
): WinRatioResult {
  // Handle division by zero - return 0 when no players have played
  if (playersPlayed === 0) {
    return { ratio: 0, display: '0%' };
  }

  // Handle invalid inputs (negative numbers) - treat as 0
  if (playersPlayed < 0 || playersCompleted < 0) {
    return { ratio: 0, display: '0%' };
  }

  // Calculate ratio and round to nearest integer
  const ratio = Math.round((playersCompleted / playersPlayed) * 100);

  // Handle NaN (shouldn't happen with above checks, but safety first)
  if (Number.isNaN(ratio)) {
    return { ratio: 0, display: '0%' };
  }

  return {
    ratio,
    display: `${ratio}%`,
  };
}
