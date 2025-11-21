/**
 * useUserProfile Hook
 * Custom hook to fetch and cache user profile data with loading and error states
 * 
 * Features:
 * - Automatic profile fetching on mount using useAsync
 * - Loading and error state management
 * - Auto-creation of profile if it doesn't exist
 * 
 * NOTE: Uses useAsync instead of useState for async operations to work with Devvit's runtime
 */

import { useAsync } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';
import type { UserProfile } from '../../shared/models/user.types.js';
import { UserService } from '../../server/services/user.service.js';
import { UserRepository } from '../../server/repositories/user.repository.js';

export interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to manage user profile state
 * 
 * @param context - Devvit context
 * @param userId - User ID to fetch profile for
 * @param username - Username for auto-creation if profile doesn't exist
 * @returns Profile data, loading state, and error state
 * 
 * @example
 * const { profile, loading, error } = useUserProfile(context, userId, username);
 * 
 * if (loading) return <text>Loading profile...</text>;
 * if (error) return <text>Error: {error}</text>;
 * if (!profile) return <text>No profile found</text>;
 * 
 * return <text>Level: {profile.level}</text>;
 */
export function useUserProfile(
  context: Context,
  userId: string,
  username?: string
): UseUserProfileResult {
  // Use useAsync for async data fetching (Devvit-compatible)
  const { data: profile, loading, error } = useAsync<UserProfile>(
    async () => {
      try {
        // Initialize service
        const userRepo = new UserRepository(context);
        const userService = new UserService(context, userRepo);

        // Fetch profile (will auto-create if username is provided)
        const fetchedProfile = await userService.getUserProfile(userId, username);

        if (!fetchedProfile) {
          throw new Error('Failed to load profile');
        }

        return fetchedProfile;
      } catch (err) {
        console.error('Failed to get user profile', err);
        throw err;
      }
    },
    {
      depends: [userId, username ?? ''], // Re-fetch if userId or username changes (convert undefined to empty string)
    }
  );

  return {
    profile: profile ?? null,
    loading,
    error: error ? (error instanceof Error ? error.message : 'Unknown error occurred') : null,
  };
}
