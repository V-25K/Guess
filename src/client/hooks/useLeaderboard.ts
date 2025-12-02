/**
 * useLeaderboard Hook
 * Custom hook to fetch and manage leaderboard data with pagination support
 * 
 * Features:
 * - Automatic leaderboard fetching on mount using useAsync
 * - Loading and error state management
 * - Current user highlighting
 * - Pagination support with page navigation metadata
 * 
 * NOTE: Uses useAsync instead of useState for async operations to work with Devvit's runtime
 */

import { useAsync } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';
import type { LeaderboardEntry, UserRankData, PaginatedLeaderboardResult } from '../../server/services/leaderboard.service.js';
import { LeaderboardService } from '../../server/services/leaderboard.service.js';
import { UserRepository } from '../../server/repositories/user.repository.js';

export interface UseLeaderboardResult {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userRank: UserRankData | null;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to manage leaderboard state with pagination support
 * 
 * @param context - Devvit context
 * @param userId - Current user ID for highlighting
 * @param pageSize - Number of entries per page (default: 5)
 * @param currentPage - Current page number (0-indexed, default: 0)
 * @returns Leaderboard data with pagination metadata, loading state, and error state
 * 
 * @example
 * const { entries, userRank, totalPages, hasNextPage, hasPreviousPage, loading, error } = useLeaderboard(context, userId, 5, currentPage);
 * 
 * if (loading) return <text>Loading leaderboard...</text>;
 * if (error) return <text>Error: {error}</text>;
 * 
 * return entries.map(entry => <LeaderboardEntry entry={entry} />);
 */
export function useLeaderboard(
  context: Context,
  userId: string,
  pageSize: number = 5,
  currentPage: number = 0
): UseLeaderboardResult {
  // Use useAsync for async data fetching (Devvit-compatible)
  const { data, loading, error } = useAsync<PaginatedLeaderboardResult>(
    async () => {
      try {
        // Initialize service
        const userRepo = new UserRepository(context);
        const leaderboardService = new LeaderboardService(context, userRepo);

        // Fetch paginated leaderboard with current user
        // Requirements: 1.2, 2.1
        const result = await leaderboardService.getLeaderboardWithUserPaginated(
          userId,
          pageSize,
          currentPage
        );

        return result;
      } catch (err) {
        console.error('Failed to get leaderboard', err);
        throw err;
      }
    },
    {
      depends: [userId, pageSize, currentPage], // Re-fetch if userId, pageSize, or currentPage changes
    }
  );

  // Find user entry in current page entries
  const userEntry = data?.entries.find(entry => entry.isCurrentUser) ?? null;

  return {
    entries: data?.entries ?? [],
    userEntry,
    userRank: data?.userRank ?? null,
    totalPages: data?.totalPages ?? 0,
    hasNextPage: data?.hasNextPage ?? false,
    hasPreviousPage: data?.hasPreviousPage ?? false,
    loading,
    error: error ? (error instanceof Error ? error.message : 'Unknown error occurred') : null,
  };
}
