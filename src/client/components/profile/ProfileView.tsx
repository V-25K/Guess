import { Devvit, useAsync } from '@devvit/public-api';
import type { UserProfile } from '../../../shared/models/user.types.js';
import type { UserService } from '../../../server/services/user.service.js';
import { fetchAvatarUrl } from '../../../server/utils/challenge-utils.js';
import { getExpForLevel } from '../../../shared/utils/level-calculator.js';

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

  // Fetch avatar URL
  const { data: avatarUrl } = useAsync<string | null>(async () => {
    if (!profile?.username) return null;
    return await context.cache(
      async () => {
        const url = await fetchAvatarUrl(context, profile.username);
        return url || null; // Convert undefined to null for JSONValue compatibility
      },
      {
        key: `avatar:${profile.username}`,
        ttl: 30 * 60 * 1000, // 30 minutes (avatars don't change often)
      }
    );
  }, {
    depends: [profile?.username || ''],
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

  // Calculate XP progress for current level
  const expForNextLevel = getExpForLevel(profile.level + 1); // XP needed to reach NEXT level
  let totalExpForCurrentLevel = 0;
  // Sum XP required from level 2 to current level (to get XP at start of current level)
  for (let i = 2; i <= profile.level; i++) {
    totalExpForCurrentLevel += getExpForLevel(i);
  }
  const currentLevelExp = profile.total_experience - totalExpForCurrentLevel;
  const progressPercentage = Math.min((currentLevelExp / expForNextLevel) * 100, 100);

  return (
    <vstack padding="small" gap="small" width="100%" height="100%" backgroundColor="#F6F7F8">
      {/* Header - Username & Level */}
      <hstack
        padding="small"
        gap="medium"
        width="100%"
        backgroundColor="#FFFFFF"
        cornerRadius="medium"
        alignment="start middle"
      >
        {/* Avatar - Circular on the left */}
        {avatarUrl ? (
          <image
            url={avatarUrl}
            imageWidth={80}
            imageHeight={80}
            width="80px"
            height="80px"
            resizeMode="cover"
            description={`${profile.username}'s avatar`}
          />
        ) : (
          <text size="xxlarge">👤</text>
        )}

        {/* Username and Level on the right */}
        <vstack gap="small" alignment="start middle" grow>
          <text size="xlarge" weight="bold" color="#1c1c1c">
            {profile.username}
          </text>
          <hstack gap="small" alignment="start middle">
            <text size="medium" color="#FF4500" weight="bold">
              Level {profile.level}
            </text>
            <hstack gap="small" alignment="middle">
              <image url="exp.png" imageWidth={16} imageHeight={16} width="16px" height="16px" resizeMode="fit" />
              <text size="small" color="#878a8c">
                {profile.total_experience} XP
              </text>
            </hstack>
          </hstack>

          {/* XP Progress Bar */}
          <vstack width="100%" gap="none">
            <hstack width="100%" alignment="middle" gap="small">
              <text size="xsmall" color="#878a8c">
                {currentLevelExp}/{expForNextLevel} XP
              </text>
              <spacer grow />
              <text size="xsmall" color="#878a8c">
                {Math.round(progressPercentage)}%
              </text>
            </hstack>
            <vstack width="100%" height="8px" backgroundColor="#E0E0E0" cornerRadius="full">
              <vstack
                width={`${progressPercentage}%`}
                height="8px"
                backgroundColor="#FF4500"
                cornerRadius="full"
              />
            </vstack>
          </vstack>
        </vstack>
      </hstack>

      {/* Stats Grid - Compact 2x2 */}
      <hstack gap="small" width="100%">
        {/* Points */}
        <hstack
          width="49%"
          padding="medium"
          gap="small"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          alignment="center middle"
        >
          <vstack alignment="center middle">
            <image url="points.png" imageWidth={32} imageHeight={32} width="32px" height="32px" resizeMode="fit" />
          </vstack>
          <vstack alignment="center middle" gap="none">
            <text size="xlarge" weight="bold" color="#FF4500">
              {profile.total_points}
            </text>
            <text size="xsmall" color="#878a8c">Points</text>
          </vstack>
        </hstack>

        {/* Success Rate */}
        <hstack
          width="49%"
          padding="medium"
          gap="small"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          alignment="center middle"
        >
          <vstack alignment="center middle">
            <image url="expert_solver.png" imageWidth={32} imageHeight={32} width="32px" height="32px" resizeMode="fit" />
          </vstack>
          <vstack alignment="center middle" gap="none">
            <text size="xlarge" weight="bold" color="#46D160">
              {successRate}%
            </text>
            <text size="xsmall" color="#878a8c">Win Rate</text>
          </vstack>
        </hstack>
      </hstack>

      <hstack gap="small" width="100%">
        {/* Solved */}
        <hstack
          width="49%"
          padding="medium"
          gap="small"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          alignment="center middle"
        >
          <vstack alignment="center middle">
            <image url="novice_solver.png" imageWidth={32} imageHeight={32} width="32px" height="32px" resizeMode="fit" />
          </vstack>
          <vstack alignment="center middle" gap="none">
            <text size="xlarge" weight="bold" color="#1c1c1c">
              {profile.challenges_solved}
            </text>
            <text size="xsmall" color="#878a8c">Solved</text>
          </vstack>
        </hstack>

        {/* Created */}
        <hstack
          width="49%"
          padding="medium"
          gap="small"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          alignment="center middle"
        >
          <vstack alignment="center middle">
            <image url="creator.png" imageWidth={32} imageHeight={32} width="32px" height="32px" resizeMode="fit" />
          </vstack>
          <vstack alignment="center middle" gap="none">
            <text size="xlarge" weight="bold" color="#1c1c1c">
              {profile.challenges_created}
            </text>
            <text size="xsmall" color="#878a8c">Created</text>
          </vstack>
        </hstack>
      </hstack>

      {/* Streak Stats Row */}
      <hstack gap="small" width="100%">
        {/* Current Streak */}
        <hstack
          width="49%"
          padding="medium"
          gap="small"
          backgroundColor={profile.current_streak > 0 ? "#FFF8E1" : "#FFFFFF"}
          cornerRadius="medium"
          alignment="center middle"
        >
          <vstack alignment="center middle">
            <image url="streak_master.png" imageWidth={32} imageHeight={32} width="32px" height="32px" resizeMode="fit" />
          </vstack>
          <vstack alignment="center middle" gap="none">
            <text size="xlarge" weight="bold" color={profile.current_streak > 0 ? "#F57C00" : "#1c1c1c"}>
              {profile.current_streak || 0}
            </text>
            <text size="xsmall" color="#878a8c">Streak</text>
          </vstack>
        </hstack>

        {/* Best Streak */}
        <hstack
          width="49%"
          padding="medium"
          gap="small"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          alignment="center middle"
        >
          <vstack alignment="center middle">
            <image url="rising_star.png" imageWidth={32} imageHeight={32} width="32px" height="32px" resizeMode="fit" />
          </vstack>
          <vstack alignment="center middle" gap="none">
            <text size="xlarge" weight="bold" color="#1c1c1c">
              {profile.best_streak || 0}
            </text>
            <text size="xsmall" color="#878a8c">Best</text>
          </vstack>
        </hstack>
      </hstack>

      {/* Total Attempted - Full Width */}
      <hstack
        padding="medium"
        gap="small"
        backgroundColor="#FFFFFF"
        cornerRadius="medium"
        alignment="center middle"
        width="100%"
      >
        <vstack alignment="center middle">
          <image url="total_attempted.png" imageWidth={32} imageHeight={32} width="32px" height="32px" resizeMode="fit" />
        </vstack>
        <vstack alignment="center middle" gap="none">
          <text size="xlarge" weight="bold" color="#1c1c1c">
            {profile.challenges_attempted}
          </text>
          <text size="xsmall" color="#878a8c">
            Total Attempted
          </text>
        </vstack>
      </hstack>

      {/* Note: Refresh happens automatically via cache TTL (5 minutes) */}
      <text size="xsmall" color="#878a8c" alignment="center">
        Data refreshes automatically every 5 minutes
      </text>
    </vstack>
  );
};
