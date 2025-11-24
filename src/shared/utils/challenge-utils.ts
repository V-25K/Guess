/**
 * Challenge Utility Functions
 * Helper functions for challenge data transformation
 */

import type { Challenge, GameChallenge, ImageItem } from '../models/challenge.types.js';

/**
 * Parse image URLs from the image_url field
 * Format: "url1,url2,url3" or single URL
 * 
 * Updated for attempt-based scoring: All images are revealed immediately
 */
export function parseImageUrls(imageUrl: string, descriptions?: string[]): ImageItem[] {
  const urls = imageUrl
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  return urls.map((url, index) => ({
    url,
    isRevealed: true, // All images revealed immediately in attempt-based scoring
    description: descriptions?.[index], // Add description if available
  }));
}

/**
 * Convert database challenges to game challenges with image state
 * Parses image_descriptions from JSON string to array
 */
export function convertToGameChallenges(challenges: Challenge[]): GameChallenge[] {
  return challenges.map((c) => {
    // Parse image_descriptions if it's a JSON string
    let parsedDescriptions: string[] | undefined;
    if (c.image_descriptions) {
      if (typeof c.image_descriptions === 'string') {
        try {
          const parsed = JSON.parse(c.image_descriptions);
          parsedDescriptions = Array.isArray(parsed) ? parsed : undefined;
        } catch (e) {
          console.error('Failed to parse image_descriptions:', e);
          parsedDescriptions = undefined;
        }
      } else if (Array.isArray(c.image_descriptions)) {
        parsedDescriptions = c.image_descriptions;
      }
    }

    return {
      ...c,
      images: parseImageUrls(c.image_url, parsedDescriptions),
      keywords: [], // Initialize empty keywords array
      creator_avatar_url: undefined, // Will be fetched separately
      image_descriptions: parsedDescriptions, // Use parsed descriptions
    };
  });
}
