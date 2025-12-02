/**
 * LeaderboardView Component - Simplified & Compact
 * Shows top 5 players per page with pagination
 * Uses context.cache() for automatic data loading
 *
 * Requirements: 1.1, 2.1, 3.1, 3.2, 3.3, 5.2, 5.3
 */

import { Devvit, useAsync, useState } from "@devvit/public-api";
import type {
  LeaderboardService,
  PaginatedLeaderboardResult,
} from "../../../server/services/leaderboard.service.js";
import { YourRankSection } from "./YourRankSection.js";
import { BG_PRIMARY } from "../../constants/colors.js";

// Leaderboard page size constant - 5 entries per page to fit Devvit output scene constraints
const LEADERBOARD_PAGE_SIZE = 5;

export interface LeaderboardViewProps {
  userId: string;
  leaderboardService: LeaderboardService;
  pageSize?: number;
  cachedData?: PaginatedLeaderboardResult | null;
  onDataLoaded?: (data: PaginatedLeaderboardResult) => void;
}

/**
 * LeaderboardView with pagination support
 * Shows 5 players per page with navigation controls
 */
export const LeaderboardView: Devvit.BlockComponent<LeaderboardViewProps> = (
  {
    userId,
    leaderboardService,
    pageSize = LEADERBOARD_PAGE_SIZE,
    cachedData,
    onDataLoaded,
  },
  context
) => {
  // Pagination state - initialized to page 0 (first page)
  const [currentPage, setCurrentPage] = useState(0);
  // Retry counter to force re-fetch on error retry
  // Requirements: 5.3
  const [retryCount, setRetryCount] = useState(0);
  // Track previous data for preserving YourRankSection during page transitions
  // Requirements: 5.2
  const [previousUserRank, setPreviousUserRank] = useState<
    PaginatedLeaderboardResult["userRank"] | null
  >(null);

  const { data, loading, error } = useAsync<PaginatedLeaderboardResult>(
    async () => {
      return await context.cache(
        async () => {
          const result =
            await leaderboardService.getLeaderboardWithUserPaginated(
              userId,
              pageSize,
              currentPage
            );
          return result;
        },
        {
          key: `leaderboard:page${currentPage}:size${pageSize}:retry${retryCount}`,
          ttl: 60 * 1000, // 1 minute
        }
      );
    },
    {
      depends: [pageSize, currentPage, retryCount], // Re-fetch if pageSize, currentPage, or retryCount changes
    }
  );

  // Update parent cache when fresh data arrives (only for page 0 to avoid complexity)
  if (data && onDataLoaded && currentPage === 0) {
    onDataLoaded(data);
  }

  // Update previousUserRank when data is available
  // This preserves YourRankSection during page transitions
  if (data?.userRank && data.userRank !== previousUserRank) {
    setPreviousUserRank(data.userRank);
  }

  // Use fresh data if available, otherwise use cached data (only for page 0)
  const displayData = data || (currentPage === 0 ? cachedData : null);

  // Calculate totalPages from data
  const totalPages = displayData?.totalPages || 1;

  // Pagination control handlers with bounds checking
  // Requirements: 2.4, 2.5
  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Retry handler for error state
  // Requirements: 5.3
  const handleRetry = () => {
    // Trigger re-fetch by incrementing retry counter
    setRetryCount(retryCount + 1);
  };

  const entries = displayData?.entries || [];
  // Use current userRank if available, otherwise fall back to previous or cached
  // This preserves YourRankSection visibility during loading
  // Requirements: 5.2
  const userRank =
    displayData?.userRank ?? previousUserRank ?? cachedData?.userRank ?? null;

  // Initial loading state (no previous data AND no cached data)
  if (loading && !previousUserRank && !displayData) {
    return (
      <hstack
        alignment="center middle"
        padding="large"
        gap="medium"
        grow
        backgroundColor={BG_PRIMARY}
      >
        <text size="xlarge">⏳</text>
        <text size="medium" color="#878a8c">
          Loading leaderboard...
        </text>
      </hstack>
    );
  }

  // Error state with retry button
  // Requirements: 5.3
  if (error && !loading) {
    return (
      <vstack
        padding="medium"
        gap="small"
        width="100%"
        height="100%"
        backgroundColor={BG_PRIMARY}
      >
        {/* Header */}
        <hstack
          padding="small"
          gap="small"
          width="100%"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          alignment="middle"
        >
          <text size="xlarge">🏆</text>
          <text size="large" weight="bold" color="#1c1c1c">
            Top Players
          </text>
          <text size="small" color="#878a8c">
            (Ranked by Total Points)
          </text>
        </hstack>

        {/* Your Rank Section - Preserved during error state if available */}
        {userRank && (
          <vstack width="100%">
            <text size="small" weight="bold" color="#878a8c">
              Your Rank
            </text>
            <YourRankSection userRank={userRank} isLoading={false} />
          </vstack>
        )}

        {/* Error message with retry */}
        <vstack
          alignment="center middle"
          padding="large"
          gap="medium"
          grow
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
        >
          <text size="xlarge">⚠️</text>
          <text size="medium" weight="bold" color="#1c1c1c">
            Failed to load leaderboard
          </text>
          <text size="small" color="#878a8c" alignment="center">
            {error?.message || "An error occurred while fetching data"}
          </text>
          <button onPress={handleRetry} appearance="primary" size="medium">
            Retry
          </button>
        </vstack>
      </vstack>
    );
  }

  // Empty state (no entries and no error and no cached data)
  if (!loading && entries.length === 0 && !error && !displayData) {
    return (
      <vstack
        alignment="center middle"
        padding="large"
        gap="medium"
        grow
        backgroundColor={BG_PRIMARY}
      >
        <text size="xlarge">🏆</text>
        <text size="large" weight="bold">
          Leaderboard
        </text>
        <text size="medium" color="#878a8c" alignment="center">
          No players yet
        </text>
      </vstack>
    );
  }

  const getMedal = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `${rank}.`;
  };

  return (
    <zstack width="100%" height="100%">
      {/* Main content layer */}
      <vstack
        padding="medium"
        gap="small"
        width="100%"
        height="100%"
        backgroundColor={BG_PRIMARY}
        alignment= "center"
      >
        {/* Header with page indicator */}
        <hstack
          padding="medium"
          gap="medium"
          width="100%"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          alignment="middle"
        >
          <hstack grow>
            <spacer size="medium" />
            <text size="large" weight="bold" color="#1c1c1c">
              Total Players:
            </text>
            <spacer />
            <text size="medium" color="#878a8c">
              {displayData?.totalEntries || 0}
            </text>
            <spacer />
          </hstack>
          {/* Page indicator - always show if more than 1 page */}
          <vstack
            padding="xsmall"
            backgroundColor="#F0F0F0"
            cornerRadius="small"
          >
            <text size="xsmall" weight="bold" color="#1c1c1c">
              {currentPage + 1}/{totalPages}
            </text>
          </vstack>
        </hstack>

        {/* Loading indicator during page transitions - only show if no data to display */}
        {loading && entries.length === 0 && (
          <vstack
            alignment="center middle"
            padding="medium"
            gap="small"
            width="100%"
            backgroundColor="#FFFFFF"
            cornerRadius="medium"
          >
            <text size="large">⏳</text>
            <text size="small" color="#878a8c">
              Loading page {currentPage + 1}...
            </text>
          </vstack>
        )}

        {/* Leaderboard List */}
        {entries.length > 0 && (
          <vstack gap="small" width="85%" alignment="center middle">
            {entries.map((entry, index) => {
              const rank = entry.rank || currentPage * pageSize + index + 1;
              const isCurrentUser = entry.userId === userId;
              const isTopThree = rank <= 3;

              return (
                <hstack
                  key={entry.userId}
                  padding="small"
                  gap="small"
                  backgroundColor={isCurrentUser ? "#FFF4E6" : "#FFFFFF"}
                  borderColor={isCurrentUser ? "#FF4500" : "#E0E0E0"}
                  cornerRadius="small"
                  alignment="middle"
                  width="100%"
                >
                  {/* Rank/Medal */}
                  <vstack width="40px" alignment="center middle">
                    <text
                      size={isTopThree ? "large" : "medium"}
                      weight={isTopThree ? "bold" : "regular"}
                    >
                      {getMedal(rank)}
                    </text>
                  </vstack>

                  {/* Username */}
                  <vstack grow>
                    <text
                      size="medium"
                      weight={isCurrentUser ? "bold" : "regular"}
                      color={isCurrentUser ? "#FF4500" : "#1c1c1c"}
                    >
                      {isCurrentUser
                        ? `${entry.username} (You)`
                        : entry.username}
                    </text>
                    <text size="xsmall" color="#878a8c">
                      Level {entry.level}
                    </text>
                  </vstack>

                  {/* Points */}
                  <vstack alignment="end middle">
                    <text size="large" weight="bold" color="#FF4500">
                      {entry.totalPoints}
                    </text>
                    <text size="xsmall" color="#878a8c">
                      pts
                    </text>
                  </vstack>
                </hstack>
              );
            })}
          </vstack>
        )}

        {/* Spacer to make room for fixed bottom YourRankSection */}
        <spacer size="large" />
        <spacer size="medium" />
      </vstack>

      {/* Floating Navigation Arrows - Always visible with bordered appearance */}
      <hstack width="100%" height="100%" alignment="middle">
        {/* Left Arrow */}
        <vstack height="100%" alignment="middle start" padding="small">
          <button
            icon="left"
            size="small"
            onPress={handlePrevPage}
            disabled={currentPage === 0}
          />
        </vstack>

        <spacer grow />

        {/* Right Arrow */}
        <vstack height="100%" alignment="middle end" padding="small">
          <button
            icon="right"
            size="small"
            onPress={handleNextPage}
            disabled={currentPage >= totalPages - 1}
          />
        </vstack>
      </hstack>

      {/* Your Rank Section - Fixed at bottom, highest z-index (rendered last in zstack) */}
      <vstack width="100%" height="100%" alignment="bottom">
        <vstack width="100%" padding="small" backgroundColor={BG_PRIMARY}>
          <hstack width="100%" alignment="middle">
            <text size="small" weight="bold" color="#878a8c">
              Your Rank
            </text>
            <spacer grow />
            <text size="xsmall" color="#878a8c">
              Auto-refresh 1m
            </text>
          </hstack>
          <YourRankSection userRank={userRank} isLoading={false} />
        </vstack>
      </vstack>
    </zstack>
  );
};
