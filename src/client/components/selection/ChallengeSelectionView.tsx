/**
 * Challenge Selection View Component
 * Allows players to choose challenges by tag or random
 */

import { Devvit } from '@devvit/public-api';
import type { ChallengeTag } from '../../../shared/constants/tags.js';
import { CHALLENGE_TAGS, TAG_LABELS } from '../../../shared/constants/tags.js';
import { BG_PRIMARY } from '../../constants/colors.js';

export interface ChallengeSelectionViewProps {
  onSelectTag: (tag: ChallengeTag | 'random') => void;
  onBack: () => void;
  availableTags?: ChallengeTag[];
}

/**
 * Challenge Selection View
 * Mobile-friendly grid layout for tag selection
 */
export const ChallengeSelectionView: Devvit.BlockComponent<ChallengeSelectionViewProps> = ({
  onSelectTag,
  onBack,
  availableTags,
}) => {
  // If availableTags is provided, filter to only show those
  const tagsToShow = availableTags || CHALLENGE_TAGS;
  
  // Create rows of 2 tags each for mobile-friendly layout
  const tagRows: (ChallengeTag | 'random')[][] = [];
  const allTags: (ChallengeTag | 'random')[] = ['random', ...tagsToShow];
  
  for (let i = 0; i < allTags.length; i += 2) {
    tagRows.push(allTags.slice(i, i + 2));
  }

  return (
    <vstack
      width="100%"
      height="100%"
      backgroundColor={BG_PRIMARY}
      padding="medium"
      gap="medium"
    >
      {/* Header */}
      <vstack gap="small" alignment="center middle">
        <text style="heading" size="xlarge" color="#FF4500">
          Choose Your Challenge
        </text>
        <text style="body" size="small" color="#878a8c" alignment="center">
          Select a category or go random!
        </text>
      </vstack>

      {/* Tag Grid - Scrollable */}
      <vstack
        grow
        gap="small"
        alignment="center top"
      >
        {tagRows.map((row, rowIndex) => (
          <hstack
            key={`row-${rowIndex}`}
            gap="small"
            width="100%"
            alignment="center middle"
          >
            {row.map((tag) => {
              const label = tag === 'random' ? '🎲 Random' : TAG_LABELS[tag] || tag;
              const isRandom = tag === 'random';
              
              return (
                <button
                  key={tag}
                  onPress={() => onSelectTag(tag)}
                  appearance={isRandom ? 'primary' : 'secondary'}
                  size="medium"
                  grow
                >
                  {label}
                </button>
              );
            })}
            {/* Add spacer if odd number in last row */}
            {row.length === 1 && (
              <hstack grow />
            )}
          </hstack>
        ))}
      </vstack>

      {/* Back Button */}
      <button
        onPress={onBack}
        appearance="bordered"
        size="medium"
        width="100%"
      >
        ← Back to Menu
      </button>
    </vstack>
  );
};
