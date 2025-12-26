/**
 * useImagePreloader Hook
 * Preloads images and tracks loading state
 * Ensures images are cached before displaying content
 */

import { useState, useEffect } from 'react';

/**
 * Preload a single image and return a promise
 */
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => {
      // Resolve anyway - missing images shouldn't block the UI
      console.warn(`Failed to preload image: ${src}`);
      resolve();
    };
    img.src = src;
  });
}

/**
 * Hook to preload multiple images
 * @param imageSources - Array of image URLs to preload
 * @returns Object with loading state and any errors
 */
export function useImagePreloader(imageSources: string[]) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    if (imageSources.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadedCount(0);

    let mounted = true;

    const loadImages = async () => {
      let count = 0;
      
      await Promise.all(
        imageSources.map(async (src) => {
          await preloadImage(src);
          count++;
          if (mounted) {
            setLoadedCount(count);
          }
        })
      );

      if (mounted) {
        setIsLoading(false);
      }
    };

    loadImages();

    return () => {
      mounted = false;
    };
  }, [imageSources.join(',')]); // Re-run if sources change

  return {
    isLoading,
    loadedCount,
    totalCount: imageSources.length,
    progress: imageSources.length > 0 ? (loadedCount / imageSources.length) * 100 : 100,
  };
}

/**
 * Static list of profile page assets to preload
 */
export const PROFILE_ASSETS = [
  '/points.png',
  '/win_rate.png',
  '/novice_solver.png',
  '/creator.png',
  '/streak_master.png',
  '/rising_star.png',
  '/total_attempted.png',
  '/exp.png',
];

/**
 * Static list of main menu assets to preload
 */
export const MENU_ASSETS = ['/logo.png'];

/**
 * Static list of awards/badges page assets to preload
 * These are the badge icons shown in the awards view
 */
export const AWARDS_ASSETS = [
  '/novice_solver.png',
  '/expert_solver.png',
  '/creator.png',
  '/master_creator.png',
  '/streak_master.png',
  '/high_roller.png',
  '/rising_star.png',
];

/**
 * All app assets combined (deduplicated)
 * Use this for preloading everything at app startup
 */
export const ALL_APP_ASSETS = [
  ...new Set([...MENU_ASSETS, ...PROFILE_ASSETS, ...AWARDS_ASSETS]),
];
