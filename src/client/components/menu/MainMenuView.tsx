/**
 * Main Menu View Component
 * Displays the main menu with navigation buttons
 */

import { Devvit } from '@devvit/public-api';
import type { ViewType } from '../../hooks/useNavigation.js';

export interface MainMenuViewProps {
  canCreateChallenge: boolean;
  challengesCount?: number;
  onNavigate: (view: ViewType) => void;
}

/**
 * Main Menu View
 * Central hub for navigating to different parts of the app
 */
export const MainMenuView: Devvit.BlockComponent<MainMenuViewProps> = ({
  canCreateChallenge,
  challengesCount = 0,
  onNavigate,
}) => {
  return (
    <vstack
      alignment="center middle"
      padding="medium"
      gap="medium"
      width="100%"
      height="100%"
      backgroundColor="#F6F7F8"
    >
      {/* Game Title */}
      <vstack alignment="center middle" gap="small">
        <text style="heading" size="xxlarge" color="#FF4500">
          🎮 Guess The Link
        </text>
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
          👤 Profile
        </button>

        <button
          onPress={() => onNavigate('leaderboard')}
          appearance="secondary"
          size="large"
          width="80%"
        >
          🏆 Leaderboard
        </button>

        <button
          onPress={() => {
            if (canCreateChallenge) {
              onNavigate('create');
            }
          }}
          appearance="secondary"
          size="large"
          width="80%"
          disabled={!canCreateChallenge}
        >
          ✨ Create Challenge
        </button>

        <button
          onPress={() => onNavigate('gameplay')}
          appearance="primary"
          size="large"
          width="80%"
        >
          ▶️ Play
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
