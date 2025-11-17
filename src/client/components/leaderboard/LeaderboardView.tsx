/**
 * LeaderboardView Component - Simplified & Compact
 * Shows top 10 players in one clean screen
 * Uses context.cache() for automatic data loading
 */

import { Devvit, useAsync } from '@devvit/public-api';
import type { LeaderboardEntry, LeaderboardService } from '../../../server/services/leaderboard.service.js';

export interface LeaderboardViewProps {
  userId: string;
  leaderboardService: LeaderboardService;
  pageSize?: number;
}

/**
 * Simplified LeaderboardView - Top 10 visible in one screen
 */
export const LeaderboardView: Devvit.BlockComponent<LeaderboardViewProps> = (
  { userId, leaderboardService, pageSize = 10 },
  context
) => {
  const { data, loading, error } = useAsync<{ entries: LeaderboardEntry[] }>(async () => {
    return await context.cache(
      async () => {
        const result = await leaderboardService.getLeaderboardWithUser(userId, pageSize, 0);
        return { entries: result.entries };
      },
      {
        key: `leaderboard:top${pageSize}`,
        ttl: 60 * 1000, // 1 minute
      }
    );
  }, {
    depends: [pageSize], // Re-fetch if pageSize changes
  });

  const entries = data?.entries || [];

  if (loading) {
    return (
      <vstack alignment="center middle" padding="large" gap="medium" grow backgroundColor="#F6F7F8">
        <text size="xlarge">⏳</text>
        <text size="medium" color="#878a8c">Loading leaderboard...</text>
      </vstack>
    );
  }

  if (error || entries.length === 0) {
    return (
      <vstack alignment="center middle" padding="large" gap="medium" grow backgroundColor="#F6F7F8">
        <text size="xlarge">🏆</text>
        <text size="large" weight="bold">Leaderboard</text>
        <text size="medium" color="#878a8c" alignment="center">
          {error?.message || 'No players yet'}
        </text>
      </vstack>
    );
  }

  const getMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.`;
  };

  return (
    <vstack padding="medium" gap="small" width="100%" height="100%" backgroundColor="#F6F7F8">
      {/* Header */}
      <vstack 
        padding="medium" 
        gap="small" 
        width="100%"
        backgroundColor="#FFFFFF" 
        cornerRadius="medium"
        alignment="center middle"
      >
        <text size="xxlarge">🏆</text>
        <text size="xlarge" weight="bold" color="#1c1c1c">
          Top Players
        </text>
        <text size="small" color="#878a8c">
          Ranked by Total Points
        </text>
      </vstack>

      {/* Leaderboard List - Compact */}
      <vstack gap="small" width="100%">
        {entries.map((entry, index) => {
          const rank = entry.rank || index + 1;
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
                  {isCurrentUser ? `${entry.username} (You)` : entry.username}
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

      {/* Note: Refresh happens automatically via cache TTL (1 minute) */}
      <text size="xsmall" color="#878a8c" alignment="center">
        Data refreshes automatically every minute
      </text>
    </vstack>
  );
};
