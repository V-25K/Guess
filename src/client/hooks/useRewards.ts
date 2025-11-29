/**
 * useRewards Hook
 * Custom hook to handle reward notifications and tracking
 * 
 * Features:
 * - Display reward notifications (toast/banner)
 * - Track recent rewards
 * - Auto-dismiss notifications after timeout
 * - Support for different reward types (points, experience, level up)
 */

import { useState } from '@devvit/public-api';

export type BonusInfo = {
  type: string;
  points: number;
  exp: number;
  label: string;
};

export type Reward = {
  id: string;
  type: 'points' | 'experience' | 'level_up' | 'challenge_created' | 'challenge_solved' | 'comment';
  points: number;
  experience: number;
  level: number;
  message: string;
  timestamp: number;
  bonuses?: BonusInfo[];
  totalPoints?: number;
  totalExp?: number;
};

export interface UseRewardsResult {
  currentReward: Reward | null;
  recentRewards: Reward[];
  showReward: (reward: Omit<Reward, 'id' | 'timestamp'>) => void;
  dismissReward: () => void;
  clearRewards: () => void;
}

/**
 * Hook to manage reward notifications and history
 * 
 * @param autoDismissMs - Auto-dismiss timeout in milliseconds (default: 3000, 0 to disable)
 * @param maxRecentRewards - Maximum number of recent rewards to track (default: 10)
 * @returns Reward state and control functions
 * 
 * @example
 * const { currentReward, showReward, dismissReward } = useRewards();
 * 
 * // Show a reward notification
 * showReward({
 *   type: 'points',
 *   points: 20,
 *   experience: 10,
 *   message: 'Challenge solved! +20 points, +10 exp'
 * });
 * 
 * // Render reward notification
 * if (currentReward) {
 *   return (
 *     <vstack>
 *       <text>{currentReward.message}</text>
 *       <button onPress={dismissReward}>Dismiss</button>
 *     </vstack>
 *   );
 * }
 */
export function useRewards(
  autoDismissMs: number = 3000,
  maxRecentRewards: number = 10
): UseRewardsResult {
  // State for current reward being displayed
  const [currentReward, setCurrentReward] = useState<Reward | null>(null);

  // State for recent rewards history
  const [recentRewards, setRecentRewards] = useState<Reward[]>([]);

  /**
   * Show a new reward notification
   * Generates a unique ID and timestamp for the reward
   */
  const showReward = (reward: Omit<Reward, 'id' | 'timestamp'>): void => {
    const newReward: Reward = {
      points: reward.points || 0,
      experience: reward.experience || 0,
      level: reward.level || 0,
      type: reward.type,
      message: reward.message,
      id: `reward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // Set as current reward
    setCurrentReward(newReward);

    // Add to recent rewards history
    setRecentRewards(prev => {
      const updated = [newReward, ...prev];
      // Keep only the most recent rewards
      return updated.slice(0, maxRecentRewards);
    });

    // Set up auto-dismiss if enabled
    if (autoDismissMs > 0) {
      // Note: Devvit doesn't support setTimeout in the same way as browser
      // Auto-dismiss would need to be handled differently in the UI layer
      // For now, we just set the reward and rely on manual dismissal
    }
  };

  /**
   * Manually dismiss the current reward notification
   */
  const dismissReward = (): void => {
    setCurrentReward(null);
  };

  /**
   * Clear all rewards from history
   */
  const clearRewards = (): void => {
    setRecentRewards([]);
    dismissReward();
  };

  return {
    currentReward,
    recentRewards,
    showReward,
    dismissReward,
    clearRewards,
  };
}

/**
 * Helper function to create reward messages based on reward type
 * 
 * @param type - Type of reward
 * @param points - Points earned
 * @param experience - Experience earned
 * @param level - New level (for level up rewards)
 * @returns Formatted reward message
 * 
 * @example
 * const message = createRewardMessage('challenge_solved', 20, 10);
 * // Returns: "Challenge solved! +20 points, +10 exp"
 */
export function createRewardMessage(
  type: Reward['type'],
  points?: number,
  experience?: number,
  level?: number,
  bonuses?: BonusInfo[]
): string {
  const bonusLabels = bonuses && bonuses.length > 0
    ? ' ' + bonuses.map(b => b.label).join(' ')
    : '';

  switch (type) {
    case 'challenge_solved':
      return `Challenge solved! +${points || 0} points, +${experience || 0} exp${bonusLabels}`;

    case 'challenge_created':
      return `Challenge created! +${points || 0} points, +${experience || 0} exp`;

    case 'comment':
      return `Comment reward! +${points || 0} points, +${experience || 0} exp`;

    case 'level_up':
      return `🎉 Level Up! You reached level ${level || 0}!`;

    case 'points':
      return `+${points || 0} points`;

    case 'experience':
      return `+${experience || 0} exp`;

    default:
      return `Reward earned! +${points || 0} points, +${experience || 0} exp`;
  }
}

/**
 * Hook to track and display level up notifications
 * Monitors user profile changes and shows level up rewards
 * 
 * @param currentLevel - Current user level
 * @returns Level up detection state and check function
 * 
 * @example
 * const { profile } = useUserProfile(context, userId);
 * const { checkLevelUp } = useLevelUpDetection(profile?.level || 1);
 * 
 * const levelUpReward = checkLevelUp();
 * if (levelUpReward) {
 *   showReward(levelUpReward);
 * }
 */
export function useLevelUpDetection(
  currentLevel: number
): {
  lastCheckedLevel: number;
  checkLevelUp: () => Omit<Reward, 'id' | 'timestamp'> | null;
} {
  const [lastCheckedLevel, setLastCheckedLevel] = useState<number>(currentLevel);

  const checkLevelUp = (): Omit<Reward, 'id' | 'timestamp'> | null => {
    // Check if level increased
    if (currentLevel > lastCheckedLevel) {
      setLastCheckedLevel(currentLevel);

      return {
        type: 'level_up',
        points: 0,
        experience: 0,
        level: currentLevel,
        message: createRewardMessage('level_up', 0, 0, currentLevel),
      };
    }

    return null;
  };

  return {
    lastCheckedLevel,
    checkLevelUp,
  };
}
