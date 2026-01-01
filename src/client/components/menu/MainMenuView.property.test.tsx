/**
 * MainMenuView Property Tests
 * Property-based tests for MainMenuView component using fast-check
 *
 * **Feature: ui-ux-mobile-improvements**
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { MainMenuView, type MainMenuViewProps } from './MainMenuView.js';
import type { LeaderboardEntry, UserRankInfo } from './LeaderboardPreview.js';

/**
 * Minimum touch target size in pixels (WCAG 2.1 AAA / Apple HIG)
 */
const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * Arbitrary for generating valid MainMenuView props
 */
const mainMenuPropsArb = (): fc.Arbitrary<MainMenuViewProps> =>
  fc.record({
    canCreateChallenge: fc.boolean(),
    rateLimitTimeRemaining: fc.integer({ min: 0, max: 86400000 }),
    challengesCount: fc.integer({ min: 0, max: 100 }),
    isMember: fc.boolean(),
    userLevel: fc.integer({ min: 1, max: 10 }),
    isModerator: fc.boolean(),
    onNavigate: fc.constant(vi.fn()),
    onSubscribe: fc.constant(vi.fn()),
    onShowToast: fc.constant(vi.fn()),
    leaderboardData: fc.constant([] as LeaderboardEntry[]),
    totalPlayers: fc.integer({ min: 0, max: 10000 }),
    currentUserId: fc.uuid(),
    currentUserRank: fc.constant(undefined as UserRankInfo | undefined),
  });

describe('MainMenuView Property Tests', () => {
  /**
   * **Feature: ui-ux-mobile-improvements, Property 7: Touch Target Minimum Size**
   * **Validates: Requirements 4.5**
   *
   * For any interactive button element in the MainMenuView,
   * the element should have adequate padding for touch targets.
   */
  describe('Property 7: Touch Target Minimum Size', () => {
    it('should have adequate padding classes on all navigation buttons', () => {
      fc.assert(
        fc.property(
          mainMenuPropsArb(),
          (props) => {
            const { unmount } = render(<MainMenuView {...props} />);

            // Get all navigation buttons by their test IDs
            const profileButton = screen.getByTestId('nav-button-profile');
            const playButton = screen.getByTestId('nav-button-play');
            const createButton = screen.getByTestId('nav-button-create');

            // All buttons should have py-3.5 or py-4 class for adequate touch target height
            // Profile and Create use py-3.5, Play uses py-4
            expect(profileButton.className).toMatch(/py-3\.5/);
            expect(playButton.className).toMatch(/py-4/);
            expect(createButton.className).toMatch(/py-3\.5/);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure all navigation buttons have accessible touch targets via padding classes', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // canCreateChallenge
          fc.boolean(), // isMember
          fc.integer({ min: 0, max: 100 }), // challengesCount
          (canCreateChallenge, isMember, challengesCount) => {
            const mockOnNavigate = vi.fn();
            const mockOnSubscribe = vi.fn();

            const { unmount } = render(
              <MainMenuView
                canCreateChallenge={canCreateChallenge}
                isMember={isMember}
                userLevel={5}
                isModerator={false}
                challengesCount={challengesCount}
                onNavigate={mockOnNavigate}
                onSubscribe={mockOnSubscribe}
              />
            );

            // Query navigation buttons specifically
            const profileButton = screen.getByTestId('nav-button-profile');
            const playButton = screen.getByTestId('nav-button-play');
            const createButton = screen.getByTestId('nav-button-create');

            // Each navigation button should have appropriate padding classes
            // py-3.5 = 14px padding, py-4 = 16px padding - both provide adequate touch targets
            expect(profileButton.className).toMatch(/py-3\.5/);
            expect(playButton.className).toMatch(/py-4/);
            expect(createButton.className).toMatch(/py-3\.5/);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have full width buttons for better touch accessibility', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.integer({ min: 0, max: 100 }),
          (isModerator, challengesCount) => {
            const { unmount } = render(
              <MainMenuView
                canCreateChallenge={true}
                isMember={false}
                userLevel={5}
                isModerator={isModerator}
                challengesCount={challengesCount}
                onNavigate={vi.fn()}
                onSubscribe={vi.fn()}
              />
            );

            // Navigation buttons should be full width for easy tapping
            const profileButton = screen.getByTestId('nav-button-profile');
            const playButton = screen.getByTestId('nav-button-play');
            const createButton = screen.getByTestId('nav-button-create');

            expect(profileButton.className).toMatch(/w-full/);
            expect(playButton.className).toMatch(/w-full/);
            expect(createButton.className).toMatch(/w-full/);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
