/**
 * ProfileView Component - Simplified & Compact
 * Displays all user stats in one clean screen
 * Uses context.cache() for automatic data loading
 */

import { Devvit, useState, useAsync } from '@devvit/public-api';
import type { UserProfile } from '../../../shared/models/user.types.js';
import type { UserService } from '../../../server/services/user.service.js';

export interface ProfileViewProps {
  userId: string;
  username?: string;
  userService: UserService;
}

/**
 * Simplified ProfileView - Everything visible in one screen
 */
export const ProfileView: Devvit.BlockComponent<ProfileViewProps> = (
  { userId, username, userService },
  context
) => {
  const { data: profile, loading, error } = useAsync<UserProfile | null>(async () => {
    return await context.cache(
      async () => {
        return await userService.getUserProfile(userId, username);
      },
      {
        key: `profile:${userId}`,
        ttl: 5 * 60 * 1000, // 5 minutes
      }
    );
  }, {
    depends: [userId], // Re-fetch if userId changes
  });

  if (loading) {
    return (
      <vstack alignment="center middle" padding="large" gap="medium" grow backgroundColor="#F6F7F8">
        <text size="xlarge">⏳</text>
        <text size="medium" color="#878a8c">Loading profile...</text>
      </vstack>
    );
  }

  if (error || !profile) {
    return (
      <vstack alignment="center middle" padding="large" gap="medium" grow backgroundColor="#F6F7F8">
        <text size="xlarge">❌</text>
        <text size="large" weight="bold" color="#1c1c1c">Failed to Load Profile</text>
        <text size="medium" color="#878a8c" alignment="center">
          {error?.message || 'Unable to load profile data'}
        </text>
      </vstack>
    );
  }

  const successRate = profile.challenges_attempted > 0 
    ? Math.round((profile.challenges_solved / profile.challenges_attempted) * 100)
    : 0;

  return (
    <vstack padding="medium" gap="small" width="100%" height="100%" backgroundColor="#F6F7F8">
      {/* Header - Username & Level */}
      <vstack 
        padding="medium" 
        gap="small" 
        width="100%"
        backgroundColor="#FFFFFF" 
        cornerRadius="medium"
        alignment="center middle"
      >
        <text size="xxlarge">👤</text>
        <text size="xlarge" weight="bold" color="#1c1c1c">
          {profile.username}
        </text>
        <hstack gap="small" alignment="center middle">
          <text size="medium" color="#FF4500" weight="bold">
            Level {profile.level}
          </text>
          <text size="small" color="#878a8c">
            • {profile.total_experience} XP
          </text>
        </hstack>
      </vstack>

      {/* Stats Grid - Compact 2x2 */}
      <hstack gap="small" width="100%">
        {/* Points */}
        <vstack 
          grow 
          padding="medium" 
          gap="small" 
          backgroundColor="#FFFFFF" 
          cornerRadius="medium"
          alignment="center middle"
        >
          <text size="large">🏆</text>
          <text size="xxlarge" weight="bold" color="#FF4500">
            {profile.total_points}
          </text>
          <text size="small" color="#878a8c">Points</text>
        </vstack>

        {/* Success Rate */}
        <vstack 
          grow 
          padding="medium" 
          gap="small" 
          backgroundColor="#FFFFFF" 
          cornerRadius="medium"
          alignment="center middle"
        >
          <text size="large">📊</text>
          <text size="xxlarge" weight="bold" color="#46D160">
            {successRate}%
          </text>
          <text size="small" color="#878a8c">Win Rate</text>
        </vstack>
      </hstack>

      <hstack gap="small" width="100%">
        {/* Solved */}
        <vstack 
          grow 
          padding="medium" 
          gap="small" 
          backgroundColor="#FFFFFF" 
          cornerRadius="medium"
          alignment="center middle"
        >
          <text size="large">✅</text>
          <text size="xxlarge" weight="bold" color="#1c1c1c">
            {profile.challenges_solved}
          </text>
          <text size="small" color="#878a8c">Solved</text>
        </vstack>

        {/* Created */}
        <vstack 
          grow 
          padding="medium" 
          gap="small" 
          backgroundColor="#FFFFFF" 
          cornerRadius="medium"
          alignment="center middle"
        >
          <text size="large">✨</text>
          <text size="xxlarge" weight="bold" color="#1c1c1c">
            {profile.challenges_created}
          </text>
          <text size="small" color="#878a8c">Created</text>
        </vstack>
      </hstack>

      {/* Total Attempted - Full Width */}
      <vstack 
        padding="medium" 
        gap="small" 
        backgroundColor="#FFFFFF" 
        cornerRadius="medium"
        alignment="center middle"
        width="100%"
      >
        <hstack gap="small" alignment="center middle">
          <text size="medium">🎮</text>
          <text size="large" weight="bold" color="#1c1c1c">
            {profile.challenges_attempted}
          </text>
          <text size="medium" color="#878a8c">
            Total Challenges Attempted
          </text>
        </hstack>
      </vstack>

      {/* Note: Refresh happens automatically via cache TTL (5 minutes) */}
      <text size="xsmall" color="#878a8c" alignment="center">
        Data refreshes automatically every 5 minutes
      </text>
    </vstack>
  );
};
