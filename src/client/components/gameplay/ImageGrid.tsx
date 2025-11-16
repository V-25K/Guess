/**
 * ImageGrid Component
 * Displays a grid of images with reveal/hidden states and hint numbers
 */

import { Devvit } from '@devvit/public-api';
import type { ImageItem } from '../../../shared/models/index.js';

export interface ImageGridProps {
  images: ImageItem[];
  onReveal: (index: number) => void;
  disabled?: boolean;
}

/**
 * ImageCell - Individual image or hint button
 */
const ImageCell: Devvit.BlockComponent<{
  image: ImageItem;
  index: number;
  onReveal: (index: number) => void;
  disabled: boolean;
}> = ({ image, index, onReveal, disabled }) => {
  const hintNumber = index + 1;

  if (image.isRevealed) {
    return (
      <vstack
        width="100%"
        height="200px"
        alignment="center middle"
        backgroundColor="#F5F5F5"
        cornerRadius="medium"
        border="thick"
        borderColor="#4CAF50"
      >
        <image
          url={image.url}
          imageWidth={300}
          imageHeight={200}
          resizeMode="cover"
        />
        <hstack
          padding="small"
          backgroundColor="#4CAF50"
          cornerRadius="small"
          alignment="center middle"
        >
          <text size="small" color="#FFFFFF" weight="bold">
            Hint {hintNumber}
          </text>
        </hstack>
      </vstack>
    );
  }

  return (
    <vstack
      width="100%"
      height="200px"
      alignment="center middle"
      backgroundColor="#E0E0E0"
      cornerRadius="medium"
      border="thick"
      borderColor="#BDBDBD"
      onPress={() => {
        if (!disabled) {
          onReveal(index);
        }
      }}
    >
      <vstack alignment="center middle" gap="small">
        <text size="xxlarge" color="#757575">
          🔒
        </text>
        <text size="large" weight="bold" color="#424242">
          Hint {hintNumber}
        </text>
        {!disabled && (
          <text size="small" color="#757575">
            Tap to reveal
          </text>
        )}
      </vstack>
    </vstack>
  );
};

/**
 * Get grid layout based on number of images
 */
function getGridLayout(imageCount: number): {
  columns: number;
  rows: number;
} {
  switch (imageCount) {
    case 2:
      return { columns: 2, rows: 1 };
    case 3:
      return { columns: 3, rows: 1 };
    case 4:
      return { columns: 2, rows: 2 };
    case 5:
      return { columns: 3, rows: 2 };
    default:
      return { columns: 2, rows: 1 };
  }
}

/**
 * ImageGrid - Displays grid of images with reveal functionality
 * 
 * @example
 * ```tsx
 * <ImageGrid
 *   images={challenge.images}
 *   onReveal={(index) => handleRevealImage(index)}
 *   disabled={gameState.isGameOver}
 * />
 * ```
 */
export const ImageGrid: Devvit.BlockComponent<ImageGridProps> = (
  { images, onReveal, disabled = false }
) => {
  const layout = getGridLayout(images.length);

  const rows: ImageItem[][] = [];
  for (let i = 0; i < images.length; i += layout.columns) {
    rows.push(images.slice(i, i + layout.columns));
  }

  return (
    <vstack gap="medium" width="100%">
      {rows.map((row, rowIndex) => (
        <hstack gap="medium" width="100%" alignment="center middle">
          {row.map((image, colIndex) => {
            const imageIndex = rowIndex * layout.columns + colIndex;
            return (
              <ImageCell
                image={image}
                index={imageIndex}
                onReveal={onReveal}
                disabled={disabled}
              />
            );
          })}
        </hstack>
      ))}

      {/* Image count indicator */}
      <hstack alignment="center middle" gap="small">
        <text size="small" color="#666666">
          {images.filter((img) => img.isRevealed).length} of {images.length} hints revealed
        </text>
      </hstack>
    </vstack>
  );
};
