/**
 * Main Menu View Component
 * Displays the main menu with navigation buttons
 */

import { Devvit } from '@devvit/public-api';
import type { ViewType } from '../../hooks/useNavigation.js';

export interface MainMenuViewProps {
  canCreateChallenge: boolean;
  challengesCount?: number;
  isMember: boolean;
  userLevel: number;
  isModerator: boolean;
  onNavigate: (view: ViewType) => void;
  onSubscribe: () => void;
}

/**
 * Main Menu View
 * Central hub for navigating to different parts of the app
 */
export const MainMenuView: Devvit.BlockComponent<MainMenuViewProps> = (
  { canCreateChallenge, challengesCount = 0, isMember, userLevel, isModerator, onNavigate, onSubscribe },
  context
) => {
  const REQUIRED_LEVEL = 3;
  return (
    <vstack
      alignment="center top"
      padding="medium"
      gap="medium"
      width="100%"
      height="100%"
      backgroundColor="#F6F7F8"
    >
      {/* Subscribe Button - Top Right */}
      <hstack width="100%" alignment="end top">
        <button
          onPress={onSubscribe}
          appearance={isMember ? "secondary" : "primary"}
          size="small"
          disabled={isMember}
        >
          {isMember ? "Subscribed" : "Subscribe"}
        </button>
      </hstack>

      {/* Game Title - Centered */}
      <vstack alignment="center middle" gap="small" width="100%">
        <image
          url="logo.png"
          imageHeight={100}
          imageWidth={240}
          resizeMode="fit"
        />
        <text style="body" color="#878a8c" alignment="center">
          Find the connection between images!
        </text>
      </vstack>

      {/* Main Action Buttons */}
      <vstack gap="medium" width="100%" alignment="center middle">
        <button
          onPress={() => onNavigate('profile')}
          appearance="secondary"
          size="large"
          width="80%"
        >
          Profile
        </button>

        <button
          onPress={() => onNavigate('leaderboard')}
          appearance="secondary"
          size="large"
          width="80%"
        >
          Leaderboard
        </button>

        <button
          onPress={() => {
            
            // First check: Is user a moderator? If yes, allow creation (subject to rate limit)
            if (isModerator === true) {
              if (!canCreateChallenge) {
                context.ui.showToast('Please wait before creating another challenge');
              } else {
                onNavigate('create');
              }
              return;
            }
            
            // Second check: Is user level high enough?
            if (userLevel < REQUIRED_LEVEL) {
              context.ui.showToast(
                `Reach level ${REQUIRED_LEVEL} to create challenges (Current: Level ${userLevel})`
              );
              return;
            }
            
            // Third check: Rate limit
            if (!canCreateChallenge) {
              context.ui.showToast('Please wait before creating another challenge');
              return;
            }
            
            // All checks passed
            onNavigate('create');
          }}
          appearance="secondary"
          size="large"
          width="80%"
        >
          Create Challenge
        </button>

        <button
          onPress={() => onNavigate('gameplay')}
          appearance="primary"
          size="large"
          width="80%"
        >
          Play
        </button>
        
        {challengesCount === 0 && (
          <text size="xsmall" color="#FF4500" alignment="center">
            ⚠️ No challenges available. Create one first!
          </text>
        )}
      </vstack>
    </vstack>
  );
};
