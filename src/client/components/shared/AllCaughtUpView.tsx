/**
 * All Caught Up View Component
 * Displayed when player has completed all available challenges
 */

import { Devvit } from '@devvit/public-api';

export interface AllCaughtUpViewProps {
  onBackToMenu: () => void;
  onTryAgain?: () => void;
  message?: string;
}

/**
 * All Caught Up View
 * Shows when no more challenges are available
 */
export const AllCaughtUpView: Devvit.BlockComponent<AllCaughtUpViewProps> = ({
  onBackToMenu,
  onTryAgain,
  message,
}) => {
  return (
    <vstack
      width="100%"
      height="100%"
      alignment="center middle"
      backgroundColor="#F6F7F8"
      padding="large"
      gap="large"
    >
      {/* Icon */}
      <text size="xxlarge">🎉</text>

      {/* Message */}
      <vstack gap="small" alignment="center middle">
        <text style="heading" size="xlarge" color="#FF4500" alignment="center">
          You're All Caught Up!
        </text>
        <text style="body" size="medium" color="#878a8c" alignment="center">
          {message || 'Stay tuned for more challenges'}
        </text>
      </vstack>

      {/* Actions */}
      <vstack gap="medium" width="80%" alignment="center middle">
        {onTryAgain ? (
          <button
            onPress={onTryAgain}
            appearance="primary"
            size="large"
            width="100%"
          >
            🔄 Try Different Category
          </button>
        ) : null}
        
        <button
          onPress={onBackToMenu}
          appearance="secondary"
          size="large"
          width="100%"
        >
          🏠 Back to Menu
        </button>
      </vstack>
    </vstack>
  );
};
