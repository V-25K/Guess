/**
 * Challenge Utility Functions
 * Helper functions for challenge data transformation
 */

import type { Challenge, GameChallenge, ImageItem } from '../models/challenge.types.js';

/**
 * Parse image URLs from the image_url field
 * Format: "url1,url2,url3" or single URL
 */
export function parseImageUrls(imageUrl: string): ImageItem[] {
  const urls = imageUrl
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  return urls.map((url, index) => ({
    url,
    isRevealed: index === 0, // First image is revealed by default
  }));
}

/**
 * Convert database challenges to game challenges with image state
 */
export function convertToGameChallenges(challenges: Challenge[]): GameChallenge[] {
  return challenges.map((c) => ({
    ...c,
    images: parseImageUrls(c.image_url),
    keywords: [], // Initialize empty keywords array
    creator_avatar_url: undefined, // Will be fetched separately
  }));
}
