/**
 * ChallengeImageGrid Component
 * Grid display of challenge images with click-to-enlarge and hint functionality
 */

import React from 'react';
import type { ImageItem } from '../../../shared/models/challenge.types';

export interface ChallengeImageGridProps {
  images: ImageItem[];
  onEnlargeImage: (index: number) => void;
  /** Whether hint mode is active (images can be clicked to reveal hints) */
  hintModeActive?: boolean;
  /** Callback when an image is clicked in hint mode */
  onHintImageClick?: (index: number) => void;
  /** Array of image indices that have been revealed as hints */
  revealedHints?: number[];
  /** Callback to view an already revealed hint */
  onViewRevealedHint?: (index: number) => void;
}

type GridItem = 
  | { type: 'image'; data: ImageItem; index: number }
  | { type: 'hint' }
  | { type: 'empty' };

export const ChallengeImageGrid: React.FC<ChallengeImageGridProps> = ({
  images,
  onEnlargeImage,
  hintModeActive = false,
  onHintImageClick,
  revealedHints = [],
  onViewRevealedHint,
}) => {
  const totalSlots = 4;
  const gridItems: GridItem[] = [];

  for (let i = 0; i < totalSlots; i++) {
    if (i < images.length) {
      gridItems.push({ type: 'image', data: images[i], index: i });
    } else if (i === images.length && i < totalSlots) {
      gridItems.push({ type: 'hint' });
    } else {
      gridItems.push({ type: 'empty' });
    }
  }

  const handleImageClick = (index: number) => {
    const isRevealed = revealedHints.includes(index);
    
    if (hintModeActive && !isRevealed && onHintImageClick) {
      // In hint mode, clicking unrevealed image triggers hint purchase
      onHintImageClick(index);
    } else if (isRevealed && onViewRevealedHint) {
      // Clicking revealed hint shows the description
      onViewRevealedHint(index);
    } else if (!hintModeActive) {
      // Normal mode - enlarge image
      onEnlargeImage(index);
    }
  };

  const handleImageKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleImageClick(index);
    }
  };

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1.5 w-full max-w-[180px] aspect-square flex-shrink-0">
      {gridItems.map((item, idx) => {
        if (item.type === 'image' && item.data) {
          const isRevealed = revealedHints.includes(item.index);
          
          return (
            <div
              key={idx}
              className={`
                relative bg-neutral-100 dark:bg-[#243044] rounded-lg overflow-hidden w-full h-full cursor-pointer shadow-sm dark:shadow-black/20 border focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078]
                ${hintModeActive && !isRevealed 
                  ? 'border-game-primary dark:border-[#f0d078] border-2 animate-pulse' 
                  : isRevealed 
                    ? 'border-green-500 dark:border-green-400 border-2' 
                    : 'border-neutral-200 dark:border-white/[0.12]'}
              `}
              onClick={() => handleImageClick(item.index)}
              onKeyDown={(e) => handleImageKeyDown(e, item.index)}
              tabIndex={0}
              role="button"
              aria-label={
                hintModeActive && !isRevealed
                  ? `Reveal hint for image ${item.index + 1}`
                  : isRevealed
                    ? `View hint for image ${item.index + 1}`
                    : `Enlarge image ${item.index + 1}`
              }
            >
              <img
                src={item.data.url}
                className="w-full h-full object-contain block"
                alt={item.data.description || `Challenge image ${item.index + 1}`}
              />
              
              {/* Revealed hint badge - more prominent */}
              {isRevealed && (
                <div className="absolute top-1 left-1 bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-400 dark:to-emerald-400 rounded-full px-1.5 py-0.5 shadow-md flex items-center gap-0.5">
                  <svg className="w-3 h-3 text-white dark:text-[#1a2332]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[8px] font-bold text-white dark:text-[#1a2332] uppercase tracking-wide">Hint</span>
                </div>
              )}
              
              {/* Hint mode overlay - only show when in hint mode and not revealed */}
              {hintModeActive && !isRevealed && (
                <div className="absolute inset-0 flex items-center justify-center bg-game-primary/30 dark:bg-[#f0d078]/30">
                  <div className="bg-game-primary dark:bg-[#f0d078] rounded-full p-1.5">
                    <svg className="w-4 h-4 text-white dark:text-[#1a2332]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          );
        } else if (item.type === 'hint') {
          return (
            <div
              key={idx}
              className="bg-white dark:bg-[#1a2332] border border-dashed border-neutral-400 dark:border-white/20 rounded-lg flex items-center justify-center p-2 text-center text-neutral-500 dark:text-white/50 text-xs font-medium leading-tight"
            >
              Tap any<br />image to<br />view it<br />large.
            </div>
          );
        } else {
          return <div key={idx} className="invisible" />;
        }
      })}
    </div>
  );
};
