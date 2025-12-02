/**
 * YourRankSection Component
 * Displays the current user's rank, username, and total points
 * Persists across all pagination states
 * 
 * Requirements: 3.1, 3.4
 */

import { Devvit } from '@devvit/public-api';
import type { UserRankData } from '../../../server/services/leaderboard.service.js';

export interface YourRankSectionProps {
  userRank: UserRankData | null;
  isLoading?: boolean;
}

/**
 * YourRankSection - Shows current user's rank regardless of pagination state
 * Uses distinct styling (background #FFF4E6, border #FF4500)
 * Handles null rank case with "Unranked" placeholder
 */
export const YourRankSection: Devvit.BlockComponent<YourRankSectionProps> = ({
  userRank,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <vstack
        padding="small"
        backgroundColor="#FFF4E6"
        borderColor="#FF4500"
        cornerRadius="small"
        width="100%"
      >
        <text size="small" color="#878a8c">Loading your rank...</text>
      </vstack>
    );
  }

  // Handle null rank case - user has no rank yet
  if (!userRank || userRank.rank === null) {
    return (
      <hstack
        padding="small"
        gap="small"
        backgroundColor="#FFF4E6"
        borderColor="#FF4500"
        cornerRadius="small"
        alignment="middle"
        width="100%"
      >
        {/* Rank placeholder */}
        <vstack width="40px" alignment="center middle">
          <text size="medium" color="#878a8c">--</text>
        </vstack>

        {/* Username */}
        <vstack grow>
          <text size="medium" weight="bold" color="#FF4500">
            {userRank?.username || 'You'} (You)
          </text>
          <text size="xsmall" color="#878a8c">
            Unranked
          </text>
        </vstack>

        {/* Points */}
        <vstack alignment="end middle">
          <text size="large" weight="bold" color="#FF4500">
            {userRank?.totalPoints || 0}
          </text>
          <text size="xsmall" color="#878a8c">
            pts
          </text>
        </vstack>
      </hstack>
    );
  }

  // Display user's rank with distinct styling
  return (
    <hstack
      padding="small"
      gap="small"
      backgroundColor="#FFF4E6"
      borderColor="#FF4500"
      cornerRadius="small"
      alignment="middle"
      width="100%"
    >
      {/* Rank number */}
      <vstack width="40px" alignment="center middle">
        <text size="medium" weight="bold" color="#FF4500">
          #{userRank.rank}
        </text>
      </vstack>

      {/* Username with (You) suffix */}
      <vstack grow>
        <text size="medium" weight="bold" color="#FF4500">
          {userRank.username} (You)
        </text>
        <text size="xsmall" color="#878a8c">
          Level {userRank.level}
        </text>
      </vstack>

      {/* Total points */}
      <vstack alignment="end middle">
        <text size="large" weight="bold" color="#FF4500">
          {userRank.totalPoints}
        </text>
        <text size="xsmall" color="#878a8c">
          pts
        </text>
      </vstack>
    </hstack>
  );
};
