/**
 * Loading View Component
 * Displays a loading screen while the app initializes
 */

import { Devvit } from '@devvit/public-api';

/**
 * Loading View
 * Shows while challenges and user data are being loaded
 */
export const LoadingView: Devvit.BlockComponent = () => {
  return (
    <vstack
      alignment="center middle"
      padding="medium"
      gap="medium"
      width="100%"
      height="100%"
      backgroundColor="#F6F7F8"
    >
      <text style="heading" size="xlarge" color="#FF4500">
        🎮 Guess The Link
      </text>
      <text style="body" color="#878a8c">
        Loading challenges...
      </text>
    </vstack>
  );
};
