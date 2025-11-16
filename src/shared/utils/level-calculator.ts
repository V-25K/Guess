/**
 * Level Calculator Utility
 * 
 * Handles experience-to-level calculations using exponential growth formula.
 * 
 * Level progression:
 * - Level 1: 0 EXP
 * - Level 2: 100 EXP
 * - Level 3: 250 EXP (100 + 150)
 * - Level 4: 475 EXP (100 + 150 + 225)
 * - Level 5: 812 EXP (100 + 150 + 225 + 337)
 */

const BASE_EXP = 100;
const GROWTH_FACTOR = 1.5;

/**
 * Calculate the experience required to reach a specific level from the previous level.
 * Uses exponential growth formula: baseExp * growthFactor^(level - 1)
 * 
 * @param level - The target level (must be >= 1)
 * @returns The experience points required to reach this level from the previous level
 * 
 * @example
 * getExpForLevel(1) // Returns 100 (exp needed to go from level 0 to 1)
 * getExpForLevel(2) // Returns 150 (exp needed to go from level 1 to 2)
 * getExpForLevel(3) // Returns 225 (exp needed to go from level 2 to 3)
 */
export function getExpForLevel(level: number): number {
  if (level < 1) {
    throw new Error('Level must be at least 1');
  }
  
  return Math.floor(BASE_EXP * Math.pow(GROWTH_FACTOR, level - 1));
}

/**
 * Calculate the current level based on total accumulated experience.
 * Iterates through levels until the total exp requirement exceeds the player's exp.
 * 
 * @param totalExp - The total accumulated experience points
 * @returns The current level (minimum 1)
 * 
 * @example
 * calculateLevel(0)    // Returns 1
 * calculateLevel(100)  // Returns 2
 * calculateLevel(250)  // Returns 3
 * calculateLevel(475)  // Returns 4
 */
export function calculateLevel(totalExp: number): number {
  if (totalExp < 0) {
    throw new Error('Total experience cannot be negative');
  }
  
  let level = 1;
  let expRequired = 0;
  
  while (true) {
    const expForNextLevel = getExpForLevel(level);
    
    if (expRequired + expForNextLevel > totalExp) {
      break;
    }
    
    expRequired += expForNextLevel;
    level++;
  }
  
  return level;
}

/**
 * Calculate the experience points needed to reach the next level.
 * 
 * @param currentExp - The player's current total experience
 * @param currentLevel - The player's current level
 * @returns The experience points needed to reach the next level
 * 
 * @example
 * getExpToNextLevel(0, 1)    // Returns 100 (need 100 exp to reach level 2)
 * getExpToNextLevel(50, 1)   // Returns 50 (need 50 more exp to reach level 2)
 * getExpToNextLevel(100, 2)  // Returns 150 (need 150 exp to reach level 3)
 * getExpToNextLevel(200, 2)  // Returns 50 (need 50 more exp to reach level 3)
 */
export function getExpToNextLevel(currentExp: number, currentLevel: number): number {
  if (currentExp < 0) {
    throw new Error('Current experience cannot be negative');
  }
  
  if (currentLevel < 1) {
    throw new Error('Current level must be at least 1');
  }
  
  let totalExpForCurrentLevel = 0;
  for (let i = 1; i < currentLevel; i++) {
    totalExpForCurrentLevel += getExpForLevel(i);
  }
  
  const totalExpForNextLevel = totalExpForCurrentLevel + getExpForLevel(currentLevel);
  
  return totalExpForNextLevel - currentExp;
}
