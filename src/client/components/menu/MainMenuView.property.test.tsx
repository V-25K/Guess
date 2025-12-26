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
   * the element should have minimum dimensions of 44x44 pixels.
   */
  describe('Property 7: Touch Target Minimum Size', () => {
    it('should have min-h-[44px] class on all navigation buttons', () => {
      fc.assert(
        fc.property(
          mainMenuPropsArb(),
          (props) => {
            const { unmount } = render(<MainMenuView {...props} />);

            // Get all navigation buttons by their test IDs
            const profileButton = screen.getByTestId('nav-button-profile');
            const playButton = screen.getByTestId('nav-button-play');
            const createButton = screen.getByTestId('nav-button-create');

            // All buttons should have min-h-[44px] class for touch target compliance
            expect(profileButton.className).toMatch(/min-h-\[44px\]/);
            expect(playButton.className).toMatch(/min-h-\[44px\]/);
            expect(createButton.className).toMatch(/min-h-\[44px\]/);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure all interactive buttons have accessible touch targets via CSS classes', () => {
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

            // Query all buttons in the component
            const allButtons = screen.getAllByRole('button');

            // Each button should have appropriate sizing classes
            // We check for min-h-[44px] or min-h-touch (which should be 44px)
            allButtons.forEach((button) => {
              const hasMinHeight = 
                button.className.includes('min-h-[44px]') || 
                button.className.includes('min-h-touch');
              
              // Navigation buttons must have minimum touch target
              // Subscribe button uses Button component which has its own sizing
              const isNavButton = button.hasAttribute('data-testid') && 
                button.getAttribute('data-testid')?.startsWith('nav-button-');
              
              if (isNavButton) {
                expect(hasMinHeight).toBe(true);
              }
            });

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
