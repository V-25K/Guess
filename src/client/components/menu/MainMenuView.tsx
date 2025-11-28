/**
 * Main Menu View Component
 * Displays the main menu with navigation buttons
 */

import { Devvit } from '@devvit/public-api';
import type { ViewType } from '../../hooks/useNavigation.js';
import { formatTimeRemaining } from '../../../shared/utils/date-utils.js';

export interface MainMenuViewProps {
  canCreateChallenge: boolean;
  rateLimitTimeRemaining?: number;
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
  { canCreateChallenge, rateLimitTimeRemaining = 0, challengesCount = 0, isMember, userLevel, isModerator, onNavigate, onSubscribe },
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

            // Moderators bypass all restrictions
            if (isModerator === true) {
              onNavigate('create');
              return;
            }

            // Check: Is user level high enough?
            if (userLevel < REQUIRED_LEVEL) {
              const levelsNeeded = REQUIRED_LEVEL - userLevel;
              context.ui.showToast(
                `🎯 Reach Level ${REQUIRED_LEVEL} to create challenges! (${levelsNeeded} level${levelsNeeded > 1 ? 's' : ''} to go)`
              );
              return;
            }

            // Check: Rate limit (24-hour cooldown)
            if (!canCreateChallenge) {
              const timeStr = formatTimeRemaining(rateLimitTimeRemaining);
              context.ui.showToast(`⏳ Challenge cooldown active. Next creation in ${timeStr}`);
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
