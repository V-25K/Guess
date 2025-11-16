/**
 * Server-side Challenge Utility Functions
 * Helper functions that require async context (Reddit API calls)
 */

import type { Context } from '@devvit/public-api';

/**
 * Fetch avatar URL for a user by username
 * @param context - Devvit context
 * @param username - Reddit username
 * @returns Avatar URL or undefined if not found
 */
export async function fetchAvatarUrl(
  context: Context,
  username: string
): Promise<string | undefined> {
  try {
    const user = await context.reddit.getUserByUsername(username);
    return user ? await user.getSnoovatarUrl() : undefined;
  } catch {
    return undefined;
  }
}
