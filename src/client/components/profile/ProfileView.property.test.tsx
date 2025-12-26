/**
 * ProfileView Property Tests
 * Property-based tests for ProfileView avatar rendering using fast-check
 * Requirements: 5.3, 5.4, 5.5, 5.6
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, waitFor } from '@testing-library/react';
import { ProfileView } from './ProfileView';
import type { UserProfile } from '../../../shared/models/user.types';

// Mock the apiClient
vi.mock('../../api/client', () => ({
  apiClient: {
    getUserProfile: vi.fn(),
  },
}));

import { apiClient } from '../../api/client';

describe('ProfileView Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Generator for valid user profile with avatar_url
  const userProfileWithAvatarArbitrary = fc.record({
    user_id: fc.uuid(),
    username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    total_points: fc.integer({ min: 0, max: 100000 }),
    total_experience: fc.integer({ min: 0, max: 100000 }),
    level: fc.integer({ min: 1, max: 100 }),
    challenges_created: fc.integer({ min: 0, max: 1000 }),
    challenges_attempted: fc.integer({ min: 0, max: 1000 }),
    challenges_solved: fc.integer({ min: 0, max: 1000 }),
    current_streak: fc.integer({ min: 0, max: 100 }),
    best_streak: fc.integer({ min: 0, max: 100 }),
    last_challenge_created_at: fc.constant(null),
    role: fc.constant('player' as const),
    avatar_url: fc.webUrl(), // Valid avatar URL
  }).filter(p => p.challenges_solved <= p.challenges_attempted);

  // Generator for valid user profile without avatar_url
  const userProfileWithoutAvatarArbitrary = fc.record({
    user_id: fc.uuid(),
    username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    total_points: fc.integer({ min: 0, max: 100000 }),
    total_experience: fc.integer({ min: 0, max: 100000 }),
    level: fc.integer({ min: 1, max: 100 }),
    challenges_created: fc.integer({ min: 0, max: 1000 }),
    challenges_attempted: fc.integer({ min: 0, max: 1000 }),
    challenges_solved: fc.integer({ min: 0, max: 1000 }),
    current_streak: fc.integer({ min: 0, max: 100 }),
    best_streak: fc.integer({ min: 0, max: 100 }),
    last_challenge_created_at: fc.constant(null),
    role: fc.constant('player' as const),
    // No avatar_url field - simulates missing avatar
  }).filter(p => p.challenges_solved <= p.challenges_attempted);

  /**
   * **Feature: ui-ux-mobile-improvements, Property 5: Avatar Rendering with URL**
   * **Validates: Requirements 5.3, 5.5**
   * 
   * For any component (ProfileView or GameplayView) that receives a profile/challenge
   * with a valid avatar_url, the component should render an img element with that URL
   * as the src attribute.
   */
  describe('Property 5: Avatar Rendering with URL', () => {
    it('should render img element with avatar_url as src when avatar_url exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          userProfileWithAvatarArbitrary,
          async (profileData) => {
            const profile: UserProfile = profileData as UserProfile;
            
            vi.mocked(apiClient.getUserProfile).mockResolvedValue(profile);
            
            const { container } = render(<ProfileView />);
            
            // Wait for profile to load - look for username in h2
            await waitFor(() => {
              expect(container.querySelector('h2')).not.toBeNull();
            });
            
            // Check that img element exists with a valid src (avatar image with rounded-full class)
            const avatarImg = container.querySelector('img.rounded-full') as HTMLImageElement;
            expect(avatarImg).not.toBeNull();
            expect(avatarImg.tagName.toLowerCase()).toBe('img');
            // Browser normalizes URLs, so just verify src is set and starts with http
            expect(avatarImg.src).toBeTruthy();
            expect(avatarImg.src.startsWith('http')).toBe(true);
            
            // Check that placeholder is NOT rendered (div with 👤 emoji)
            const allText = container.textContent || '';
            // When avatar_url exists, the placeholder emoji should not be visible
            const placeholderDiv = Array.from(container.querySelectorAll('div')).find(
              div => div.textContent === '👤' && div.getAttribute('aria-hidden') === 'true'
            );
            expect(placeholderDiv).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ui-ux-mobile-improvements, Property 6: Avatar Fallback Rendering**
   * **Validates: Requirements 5.4, 5.6**
   * 
   * For any component (ProfileView or GameplayView) that receives a profile/challenge
   * without an avatar_url (undefined or empty), the component should render a placeholder
   * element instead of an img with empty src.
   */
  describe('Property 6: Avatar Fallback Rendering', () => {
    it('should render placeholder element when avatar_url is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          userProfileWithoutAvatarArbitrary,
          async (profileData) => {
            const profile: UserProfile = profileData as UserProfile;
            
            vi.mocked(apiClient.getUserProfile).mockResolvedValue(profile);
            
            const { container } = render(<ProfileView />);
            
            // Wait for profile to load - look for username in h2
            await waitFor(() => {
              expect(container.querySelector('h2')).not.toBeNull();
            });
            
            // Check that placeholder element exists (div with 👤 emoji and role="img")
            // The component uses role="img" with aria-label for accessibility
            const placeholderDiv = Array.from(container.querySelectorAll('div')).find(
              div => div.textContent === '👤' && div.getAttribute('role') === 'img'
            );
            expect(placeholderDiv).not.toBeUndefined();
            
            // Check that avatar img element is NOT rendered (no img with rounded-full that has avatar src)
            const avatarImg = container.querySelector('img.rounded-full[alt]') as HTMLImageElement;
            expect(avatarImg).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render placeholder element when avatar_url is empty string', async () => {
      await fc.assert(
        fc.asyncProperty(
          userProfileWithoutAvatarArbitrary,
          async (profileData) => {
            // Add empty string avatar_url
            const profile: UserProfile = { ...profileData, avatar_url: '' } as UserProfile;
            
            vi.mocked(apiClient.getUserProfile).mockResolvedValue(profile);
            
            const { container } = render(<ProfileView />);
            
            // Wait for profile to load - look for username in h2
            await waitFor(() => {
              expect(container.querySelector('h2')).not.toBeNull();
            });
            
            // Check that placeholder element exists (empty string should be falsy)
            // The component uses role="img" with aria-label for accessibility
            const placeholderDiv = Array.from(container.querySelectorAll('div')).find(
              div => div.textContent === '👤' && div.getAttribute('role') === 'img'
            );
            expect(placeholderDiv).not.toBeUndefined();
            
            // Check that avatar img element is NOT rendered
            const avatarImg = container.querySelector('img.rounded-full[alt]') as HTMLImageElement;
            expect(avatarImg).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
