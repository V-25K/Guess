/**
 * Loading View Component
 * Displays a loading screen while the app initializes
 */

import { Devvit } from '@devvit/public-api';
import { BG_PRIMARY } from '../../constants/colors.js';

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
      backgroundColor={BG_PRIMARY}
    >
      {/* Animated Logo */}
      <vstack alignment="center middle" gap="small">
        <image
          url="logo.png"
          imageHeight={120}
          imageWidth={288}
          resizeMode="fit"
        />
      </vstack>
      
      {/* Loading text */}
      <text style="body" color="#878a8c" size="medium">
        Loading...
      </text>
    </vstack>
  );
};
