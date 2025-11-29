import { Devvit } from '@devvit/public-api';

export interface RewardNotificationProps {
  type: 'points' | 'experience' | 'level_up' | 'challenge_created' | 'challenge_solved' | 'comment';
  points?: number;
  experience?: number;
  level?: number;
  message: string;
  onDismiss: () => void;
}

export const RewardNotification: Devvit.BlockComponent<RewardNotificationProps> = ({
  type,
  points = 0,
  experience = 0,
  level = 0,
  message,
  onDismiss,
}) => {

  // Achievement configuration based on type
  const getAchievementConfig = () => {
    switch (type) {
      case 'level_up':
        return {
          icon: '🎉',
          title: 'Level Up!',
          subtitle: `You reached Level ${level}!`,
          color: '#FFD700',
          bgColor: '#FFFDE7',
          badgeText: 'MILESTONE',
          badgeColor: '#F57F17',
        };
      case 'challenge_solved':
        return {
          icon: '🏆',
          title: 'Challenge Solved!',
          subtitle: 'You cracked the puzzle!',
          color: '#00C853',
          bgColor: '#E8F5E9',
          badgeText: 'VICTORY',
          badgeColor: '#2E7D32',
        };
      case 'challenge_created':
        return {
          icon: '✨',
          title: 'Challenge Created!',
          subtitle: 'Your puzzle is live!',
          color: '#2962FF',
          bgColor: '#E3F2FD',
          badgeText: 'CREATOR',
          badgeColor: '#1565C0',
        };
      case 'comment':
        return {
          icon: '💬',
          title: 'Comment Bonus!',
          subtitle: 'Thanks for engaging!',
          color: '#9C27B0',
          bgColor: '#F3E5F5',
          badgeText: 'SOCIAL',
          badgeColor: '#7B1FA2',
        };
      default:
        return {
          icon: '🎁',
          title: 'Reward Earned!',
          subtitle: 'Keep up the great work!',
          color: '#FF6D00',
          bgColor: '#FFF3E0',
          badgeText: 'BONUS',
          badgeColor: '#E65100',
        };
    }
  };

  const config = getAchievementConfig();
  const showPoints = points > 0;
  const showExperience = experience > 0;

  return (
    <zstack width="100%" height="100%" alignment="center middle">
      <vstack
        width="100%"
        height="100%"
        backgroundColor="rgba(0,0,0,0.75)"
        onPress={onDismiss}
      />
      <vstack
        width="85%"
        maxWidth="320px"
        backgroundColor={config.bgColor}
        cornerRadius="large"
        padding="medium"
        alignment="center middle"
        gap="small"
        border="thick"
        borderColor={config.color}
      >
        <hstack width="100%" alignment="center middle">
          <hstack
            backgroundColor={config.badgeColor}
            padding="xsmall"
            cornerRadius="small"
          >
            <text size="xsmall" weight="bold" color="white">
              {config.badgeText}
            </text>
          </hstack>
        </hstack>

        <vstack
          width="70px"
          height="70px"
          cornerRadius="full"
          backgroundColor={config.color}
          alignment="center middle"
        >
          <text size="xxlarge">{config.icon}</text>
        </vstack>

        <vstack alignment="center middle" gap="small" width="100%">
          <text size="xlarge" weight="bold" color="#1c1c1c">
            {config.title}
          </text>
          <text size="medium" color={config.badgeColor} weight="bold">
            {config.subtitle}
          </text>
          <spacer size="xsmall" />
          <text size="small" color="#666666" alignment="center" wrap>
            {message}
          </text>
        </vstack>

        <spacer size="xsmall" />

        <vstack
          width="100%"
          backgroundColor="white"
          cornerRadius="medium"
          padding="small"
          gap="small"
        >
          <text size="xsmall" color="#999999" weight="bold" alignment="center">
            REWARDS EARNED
          </text>
          <hstack gap="medium" alignment="center middle" width="100%">
            {showPoints ? (
              <hstack
                grow
                gap="small"
                alignment="center middle"
                backgroundColor="#FFF8E1"
                padding="small"
                cornerRadius="small"
                border="thin"
                borderColor="#FFD54F"
              >
                <text size="large">💎</text>
                <vstack alignment="start middle">
                  <text size="large" weight="bold" color="#F57F17">
                    +{points}
                  </text>
                  <text size="xsmall" color="#F9A825">Points</text>
                </vstack>
              </hstack>
            ) : (
              <spacer size="small" />
            )}
            {showExperience ? (
              <hstack
                grow
                gap="small"
                alignment="center middle"
                backgroundColor="#E8F5E9"
                padding="small"
                cornerRadius="small"
                border="thin"
                borderColor="#81C784"
              >
                <text size="large">⚡</text>
                <vstack alignment="start middle">
                  <text size="large" weight="bold" color="#2E7D32">
                    +{experience}
                  </text>
                  <text size="xsmall" color="#43A047">XP</text>
                </vstack>
              </hstack>
            ) : (
              <spacer size="small" />
            )}
          </hstack>
        </vstack>

        <spacer size="xsmall" />

        <button appearance="primary" size="medium" onPress={onDismiss}>
          🎊 Collect Rewards
        </button>
      </vstack>
    </zstack>
  );
};
