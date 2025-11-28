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

  // Icon selection based on type
  const getIcon = () => {
    switch (type) {
      case 'level_up': return '🎉';
      case 'challenge_solved': return '🏆';
      case 'challenge_created': return '✨';
      case 'comment': return '💬';
      default: return '🎁';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'level_up': return 'Level Up!';
      case 'challenge_solved': return 'Challenge Solved!';
      case 'challenge_created': return 'Challenge Created!';
      case 'comment': return 'Comment Bonus!';
      default: return 'Reward Earned!';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'level_up': return '#FFD700'; // Gold
      case 'challenge_solved': return '#00C853'; // Green
      case 'challenge_created': return '#2962FF'; // Blue
      default: return '#FF6D00'; // Orange
    }
  };

  return (
    <zstack width="100%" height="100%" alignment="center middle">
      {/* Semi-transparent background overlay */}
      <vstack
        width="100%"
        height="100%"
        backgroundColor="rgba(0,0,0,0.7)"
        onPress={onDismiss} // Dismiss on clicking background
      />

      {/* Notification Card */}
      <vstack
        width="80%"
        maxWidth="300px"
        backgroundColor="white"
        cornerRadius="medium"
        padding="medium"
        alignment="center middle"
        gap="medium"
        borderColor={getColor()}
        borderWidth="thick"
      >
        {/* Icon Header */}
        <vstack
          width="60px"
          height="60px"
          cornerRadius="full"
          backgroundColor={getColor()}
          alignment="center middle"
        >
          <text size="xxlarge">{getIcon()}</text>
        </vstack>

        {/* Title & Message */}
        <vstack alignment="center middle" gap="small">
          <text size="large" weight="bold" color="#1c1c1c">{getTitle()}</text>
          <text size="medium" color="#878a8c" alignment="center" wrap={true}>{message}</text>
        </vstack>

        {/* Stats Row */}
        {(points > 0 || experience > 0) && (
          <hstack gap="medium" alignment="center middle">
            {points > 0 && (
              <hstack gap="small" alignment="center middle" backgroundColor="#FFF3E0" padding="small" cornerRadius="small">
                <text size="medium">💎</text>
                <text size="medium" weight="bold" color="#E65100">+{points}</text>
              </hstack>
            )}
            {experience > 0 && (
              <hstack gap="small" alignment="center middle" backgroundColor="#E3F2FD" padding="small" cornerRadius="small">
                <text size="medium">⚡</text>
                <text size="medium" weight="bold" color="#1565C0">+{experience} XP</text>
              </hstack>
            )}
          </hstack>
        )}

        {/* Collect Button */}
        <button
          appearance="primary"
          size="medium"
          width="100%"
          onPress={onDismiss}
        >
          Collect
        </button>
      </vstack>
    </zstack>
  );
};
