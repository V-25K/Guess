/**
 * Challenge Utility Functions
 * Helper functions for challenge data transformation
 */

import type { Challenge, GameChallenge, ImageItem } from '../models/challenge.types.js';
import type { ChallengeAttempt } from '../models/attempt.types.js';

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
    isRevealed: true,
    description: descriptions?.[index],
  }));
}

/**
 * Convert database challenges to game challenges with image state
 * Parses image_descriptions from JSON string to array
 */
export function convertToGameChallenges(challenges: Challenge[]): GameChallenge[] {
  return challenges.map((c) => {
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
      keywords: [],
      creator_avatar_url: undefined,
      image_descriptions: parsedDescriptions,
    };
  });
}

/**
 * Filter challenges to show only those available for the user to play
 * Excludes:
 * - Challenges created by the user
 * - Challenges already solved
 * - Challenges that are game over (10 failed attempts)
 * 
 * @param challenges - All challenges
 * @param userAttempts - User's attempt history
 * @param userId - Current user ID
 * @returns Filtered list of available challenges
 */
export function filterAvailableChallenges(
  challenges: GameChallenge[],
  userAttempts: ChallengeAttempt[],
  userId: string
): GameChallenge[] {
  const attemptMap = new Map(userAttempts.map(a => [a.challenge_id, a]));

  const available: GameChallenge[] = [];
  for (const challenge of challenges) {
    if (challenge.creator_id === userId) {
      continue;
    }

    const attempt = attemptMap.get(challenge.id);

    if (!attempt || (!attempt.is_solved && !attempt.game_over)) {
      available.push(challenge);
    }
  }

  return available;
}
