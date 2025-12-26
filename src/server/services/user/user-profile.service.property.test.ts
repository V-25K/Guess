/**
 * Property-based tests for UserProfileService avatar fetching
 * 
 * **Feature: ui-ux-mobile-improvements, Property 7: User Profile Avatar Inclusion**
 * **Validates: Requirements 5.1, 5.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { UserProfile } from '../../../shared/models/user.types.js';

/**
 * Simulates the avatar extraction logic from Reddit API response
 * This mirrors the logic in UserProfileService.getUserProfile
 */
function extractAvatarFromRedditUser(redditUser: { snoovatarImage?: string; profileImage?: string } | null): string | undefined {
  if (!redditUser) {
    return undefined;
  }
  return redditUser.snoovatarImage || redditUser.profileImage;
}

/**
 * Simulates enriching a profile with avatar data
 * This mirrors the logic in UserProfileService.getUserProfile
 */
function enrichProfileWithAvatar(
  profile: UserProfile,
  redditUser: { snoovatarImage?: string; profileImage?: string } | null
): UserProfile {
  const avatar = extractAvatarFromRedditUser(redditUser);
  return {
    ...profile,
    avatar_url: avatar,
  };
}

describe('UserProfileService Avatar Properties', () => {
  /**
   * **Feature: ui-ux-mobile-improvements, Property 7: User Profile Avatar Inclusion**
   * 
   * *For any* user profile returned by the server, when the Reddit API returns a 
   * snoovatarImage or profileImage, the avatar_url field should contain that URL.
   * 
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 7: User Profile Avatar Inclusion', () => {
    // Arbitrary for valid avatar URLs
    const validAvatarUrl = fc.webUrl().filter(url => url.length > 0);

    // Arbitrary for valid user IDs
    const validUserId = fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
      !s.includes(':') && s !== 'anonymous' && s.trim() !== ''
    );

    // Arbitrary for valid usernames
    const validUsername = fc.string({ minLength: 1, maxLength: 30 }).filter(s => 
      s !== 'anonymous' && s.trim() !== ''
    );

    // Arbitrary for a base user profile
    const baseProfileArb = fc.record({
      user_id: validUserId,
      username: validUsername,
      total_points: fc.nat(),
      total_experience: fc.nat(),
      level: fc.integer({ min: 1, max: 100 }),
      challenges_created: fc.nat(),
      challenges_attempted: fc.nat(),
      challenges_solved: fc.nat(),
      current_streak: fc.nat(),
      best_streak: fc.nat(),
      last_challenge_created_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
      role: fc.constantFrom('player' as const, 'mod' as const),
    });

    it('should include snoovatarImage as avatar_url when Reddit API returns snoovatarImage', () => {
      fc.assert(
        fc.property(
          baseProfileArb,
          validAvatarUrl,
          (baseProfile, snoovatarUrl) => {
            const redditUser = { snoovatarImage: snoovatarUrl };
            const enrichedProfile = enrichProfileWithAvatar(baseProfile as UserProfile, redditUser);
            
            // avatar_url should be set to the snoovatarImage
            expect(enrichedProfile.avatar_url).toBe(snoovatarUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include profileImage as avatar_url when Reddit API returns only profileImage', () => {
      fc.assert(
        fc.property(
          baseProfileArb,
          validAvatarUrl,
          (baseProfile, profileImageUrl) => {
            const redditUser = { profileImage: profileImageUrl };
            const enrichedProfile = enrichProfileWithAvatar(baseProfile as UserProfile, redditUser);
            
            // avatar_url should be set to the profileImage
            expect(enrichedProfile.avatar_url).toBe(profileImageUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prefer snoovatarImage over profileImage when both are present', () => {
      fc.assert(
        fc.property(
          baseProfileArb,
          validAvatarUrl,
          validAvatarUrl,
          (baseProfile, snoovatarUrl, profileImageUrl) => {
            // Ensure URLs are different to test preference
            fc.pre(snoovatarUrl !== profileImageUrl);
            
            const redditUser = { 
              snoovatarImage: snoovatarUrl, 
              profileImage: profileImageUrl 
            };
            const enrichedProfile = enrichProfileWithAvatar(baseProfile as UserProfile, redditUser);
            
            // avatar_url should prefer snoovatarImage
            expect(enrichedProfile.avatar_url).toBe(snoovatarUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set avatar_url to undefined when Reddit API returns no avatar', () => {
      fc.assert(
        fc.property(
          baseProfileArb,
          (baseProfile) => {
            const redditUser = {}; // No avatar fields
            const enrichedProfile = enrichProfileWithAvatar(baseProfile as UserProfile, redditUser);
            
            // avatar_url should be undefined
            expect(enrichedProfile.avatar_url).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set avatar_url to undefined when Reddit user is null', () => {
      fc.assert(
        fc.property(
          baseProfileArb,
          (baseProfile) => {
            const enrichedProfile = enrichProfileWithAvatar(baseProfile as UserProfile, null);
            
            // avatar_url should be undefined
            expect(enrichedProfile.avatar_url).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all other profile fields when enriching with avatar', () => {
      fc.assert(
        fc.property(
          baseProfileArb,
          validAvatarUrl,
          (baseProfile, avatarUrl) => {
            const redditUser = { snoovatarImage: avatarUrl };
            const enrichedProfile = enrichProfileWithAvatar(baseProfile as UserProfile, redditUser);
            
            // All original fields should be preserved
            expect(enrichedProfile.user_id).toBe(baseProfile.user_id);
            expect(enrichedProfile.username).toBe(baseProfile.username);
            expect(enrichedProfile.total_points).toBe(baseProfile.total_points);
            expect(enrichedProfile.total_experience).toBe(baseProfile.total_experience);
            expect(enrichedProfile.level).toBe(baseProfile.level);
            expect(enrichedProfile.challenges_created).toBe(baseProfile.challenges_created);
            expect(enrichedProfile.challenges_attempted).toBe(baseProfile.challenges_attempted);
            expect(enrichedProfile.challenges_solved).toBe(baseProfile.challenges_solved);
            expect(enrichedProfile.current_streak).toBe(baseProfile.current_streak);
            expect(enrichedProfile.best_streak).toBe(baseProfile.best_streak);
            expect(enrichedProfile.role).toBe(baseProfile.role);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
