/**
 * useLeaderboard Hook
 * Custom hook to fetch and manage leaderboard data
 * 
 * Features:
 * - Automatic leaderboard fetching on mount using useAsync
 * - Loading and error state management
 * - Current user highlighting
 * 
 * NOTE: Uses useAsync instead of useState for async operations to work with Devvit's runtime
 */

import { useAsync } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';
import type { LeaderboardEntry } from '../../server/services/leaderboard.service.js';
import { LeaderboardService } from '../../server/services/leaderboard.service.js';
import { UserRepository } from '../../server/repositories/user.repository.js';

export interface UseLeaderboardResult {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  loading: boolean;
  error: string | null;
}

type LeaderboardData = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
};

/**
 * Hook to manage leaderboard state
 * 
 * @param context - Devvit context
 * @param userId - Current user ID for highlighting
 * @param pageSize - Number of entries per page (default: 10)
 * @returns Leaderboard data, loading state, and error state
 * 
 * @example
 * const { entries, userEntry, loading, error } = useLeaderboard(context, userId);
 * 
 * if (loading) return <text>Loading leaderboard...</text>;
 * if (error) return <text>Error: {error}</text>;
 * 
 * return entries.map(entry => <LeaderboardEntry entry={entry} />);
 */
export function useLeaderboard(
  context: Context,
  userId: string,
  pageSize: number = 10
): UseLeaderboardResult {
  // Use useAsync for async data fetching (Devvit-compatible)
  const { data, loading, error } = useAsync<LeaderboardData>(
    async () => {
      try {
        console.log(`[useLeaderboard] Fetching leaderboard for user ${userId}`);
        
        // Initialize service
        const userRepo = new UserRepository(context);
        const leaderboardService = new LeaderboardService(context, userRepo);
        
        // Fetch leaderboard with current user
        const result = await leaderboardService.getLeaderboardWithUser(
          userId,
          pageSize,
          0
        );
        
        console.log(`[useLeaderboard] Leaderboard loaded: ${result.entries.length} entries`);
        return result;
      } catch (err) {
        console.error('Failed to get leaderboard', err);
        throw err;
      }
    },
    {
      depends: [userId, pageSize], // Re-fetch if userId or pageSize changes
    }
  );

  return {
    entries: data?.entries ?? [],
    userEntry: data?.userEntry ?? null,
    loading,
    error: error ? (error instanceof Error ? error.message : 'Unknown error occurred') : null,
  };
}
