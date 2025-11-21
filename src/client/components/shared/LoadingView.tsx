/**
 * Loading View Component
 * Displays a loading screen while the app initializes
 */

import { Devvit, useState, useAsync } from '@devvit/public-api';

/**
 * Loading View
 * Shows while challenges and user data are being loaded
 * Features animated logo with pulsing effect
 */
export const LoadingView: Devvit.BlockComponent = () => {
  const [tick, setTick] = useState(0);
  
  // Animate loading dots using useAsync pattern
  useAsync(
    async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      setTick(prev => prev + 1);
      return null;
    },
    { depends: [tick] }
  );
  
  // Calculate dots based on tick count
  const dotCount = tick % 4;
  const dots = '.'.repeat(dotCount);
  
  return (
    <vstack
      alignment="center middle"
      padding="medium"
      gap="medium"
      width="100%"
      height="100%"
      backgroundColor="#F6F7F8"
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
      
      {/* Loading text with animated dots */}
      <text style="body" color="#878a8c" size="medium">
        Loading{dots}
      </text>
    </vstack>
  );
};
