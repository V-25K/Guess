/**
 * LeaderboardPreview Property Tests
 * Property-based tests for LeaderboardPreview component using fast-check
 *
 * **Feature: ui-ux-mobile-improvements**
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { LeaderboardPreview, type LeaderboardEntry, type UserRankInfo } from './LeaderboardPreview.js';

/**
 * Arbitrary for generating valid leaderboard entries
 */
const leaderboardEntryArb = (rank: number): fc.Arbitrary<LeaderboardEntry> =>
  fc.record({
    rank: fc.constant(rank),
    username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    points: fc.integer({ min: 0, max: 1000000 }),
    userId: fc.uuid(),
  });

/**
 * Arbitrary for generating an array of leaderboard entries with sequential ranks
 */
const leaderboardEntriesArb = (minLength: number, maxLength: number): fc.Arbitrary<LeaderboardEntry[]> =>
  fc.integer({ min: minLength, max: maxLength }).chain(length =>
    fc.tuple(...Array.from({ length }, (_, i) => leaderboardEntryArb(i + 1)))
  );

/**
 * Arbitrary for generating user rank info
 */
const userRankInfoArb = (minRank: number): fc.Arbitrary<UserRankInfo> =>
  fc.record({
    rank: fc.integer({ min: minRank, max: 1000 }),
    username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    points: fc.integer({ min: 0, max: 1000000 }),
  });

describe('LeaderboardPreview Property Tests', () => {
  /**
   * **Feature: ui-ux-mobile-improvements, Property 4: Leaderboard Preview Shows Maximum 5 Entries**
   * **Validates: Requirements 3.4, 5.2**
   *
   * For any leaderboard data array of length N, the LeaderboardPreview component
   * should display at most min(N, 5) entries.
   */
  describe('Property 4: Leaderboard Preview Shows Maximum 5 Entries', () => {
    it('should display at most 5 entries regardless of input array length', () => {
      fc.assert(
        fc.property(
          leaderboardEntriesArb(0, 20),
          fc.integer({ min: 0, max: 10000 }),
          fc.uuid(),
          (entries, totalPlayers, currentUserId) => {
            const mockOnViewFull = () => {};

            const { unmount } = render(
              <LeaderboardPreview
                entries={entries}
                totalPlayers={totalPlayers}
                currentUserId={currentUserId}
                onViewFull={mockOnViewFull}
              />
            );

            // Count rendered entries by looking for data-testid pattern
            const renderedEntries = screen.queryAllByTestId(/^leaderboard-entry-/);
            const expectedCount = Math.min(entries.length, 5);

            expect(renderedEntries.length).toBe(expectedCount);
            expect(renderedEntries.length).toBeLessThanOrEqual(5);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display exactly min(N, 5) entries for any array of length N', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 15 }),
          fc.integer({ min: 0, max: 10000 }),
          fc.uuid(),
          (arrayLength, totalPlayers, currentUserId) => {
            // Generate entries with sequential ranks
            const entries: LeaderboardEntry[] = Array.from({ length: arrayLength }, (_, i) => ({
              rank: i + 1,
              username: `User${i + 1}`,
              points: 1000 - i * 10,
              userId: `user-${i + 1}`,
            }));

            const mockOnViewFull = () => {};

            const { unmount } = render(
              <LeaderboardPreview
                entries={entries}
                totalPlayers={totalPlayers}
                currentUserId={currentUserId}
                onViewFull={mockOnViewFull}
              />
            );

            const renderedEntries = screen.queryAllByTestId(/^leaderboard-entry-/);
            const expectedCount = Math.min(arrayLength, 5);

            expect(renderedEntries.length).toBe(expectedCount);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ui-ux-mobile-improvements, Property 5: Current User Highlight in Top 5**
   * **Validates: Requirements 5.4**
   *
   * For any leaderboard data where the current user's rank is <= 5,
   * the user's entry in the LeaderboardPreview should have highlight styling applied.
   */
  describe('Property 5: Current User Highlight in Top 5', () => {
    it('should highlight current user entry when user is in top 5', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 100, max: 10000 }),
          (userRank, totalPlayers) => {
            // Generate 5 entries with the current user at the specified rank
            const currentUserId = 'current-user-id';
            const entries: LeaderboardEntry[] = Array.from({ length: 5 }, (_, i) => ({
              rank: i + 1,
              username: i + 1 === userRank ? 'CurrentUser' : `User${i + 1}`,
              points: 1000 - i * 10,
              userId: i + 1 === userRank ? currentUserId : `user-${i + 1}`,
            }));

            const mockOnViewFull = () => {};

            const { unmount } = render(
              <LeaderboardPreview
                entries={entries}
                totalPlayers={totalPlayers}
                currentUserId={currentUserId}
                onViewFull={mockOnViewFull}
              />
            );

            // Find the user's entry
            const userEntry = screen.getByTestId(`leaderboard-entry-${userRank}`);
            
            // User entry should have highlight attribute
            expect(userEntry).toHaveAttribute('data-user-highlight', 'true');
            
            // User entry should have highlight styling (bg-game-primary class)
            expect(userEntry.className).toMatch(/bg-game-primary/);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not highlight entries for users who are not the current user', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 100, max: 10000 }),
          (userRank, totalPlayers) => {
            const currentUserId = 'current-user-id';
            const entries: LeaderboardEntry[] = Array.from({ length: 5 }, (_, i) => ({
              rank: i + 1,
              username: i + 1 === userRank ? 'CurrentUser' : `User${i + 1}`,
              points: 1000 - i * 10,
              userId: i + 1 === userRank ? currentUserId : `user-${i + 1}`,
            }));

            const mockOnViewFull = () => {};

            const { unmount } = render(
              <LeaderboardPreview
                entries={entries}
                totalPlayers={totalPlayers}
                currentUserId={currentUserId}
                onViewFull={mockOnViewFull}
              />
            );

            // Check all non-user entries don't have highlight
            for (let i = 1; i <= 5; i++) {
              if (i !== userRank) {
                const entry = screen.getByTestId(`leaderboard-entry-${i}`);
                expect(entry).toHaveAttribute('data-user-highlight', 'false');
              }
            }

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ui-ux-mobile-improvements, Property 6: Your Rank Section for Users Outside Top 5**
   * **Validates: Requirements 5.5**
   *
   * For any leaderboard data where the current user's rank is > 5,
   * the "Your Rank" section should be visible and display the user's rank information.
   */
  describe('Property 6: Your Rank Section for Users Outside Top 5', () => {
    it('should show Your Rank section when user is outside top 5', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 6, max: 1000 }),
          fc.integer({ min: 100, max: 10000 }),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 0, max: 100000 }),
          (userRank, totalPlayers, username, points) => {
            // Generate top 5 entries (none are the current user)
            const currentUserId = 'current-user-id';
            const entries: LeaderboardEntry[] = Array.from({ length: 5 }, (_, i) => ({
              rank: i + 1,
              username: `User${i + 1}`,
              points: 1000 - i * 10,
              userId: `user-${i + 1}`,
            }));

            const currentUserRank: UserRankInfo = {
              rank: userRank,
              username,
              points,
            };

            const mockOnViewFull = () => {};

            const { unmount } = render(
              <LeaderboardPreview
                entries={entries}
                totalPlayers={totalPlayers}
                currentUserId={currentUserId}
                currentUserRank={currentUserRank}
                onViewFull={mockOnViewFull}
              />
            );

            // Your Rank section should be visible
            const yourRankSection = screen.getByTestId('your-rank-section');
            expect(yourRankSection).toBeInTheDocument();

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT show Your Rank section when user is in top 5', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 100, max: 10000 }),
          (userRank, totalPlayers) => {
            const currentUserId = 'current-user-id';
            
            // Generate 5 entries with current user in top 5
            const entries: LeaderboardEntry[] = Array.from({ length: 5 }, (_, i) => ({
              rank: i + 1,
              username: i + 1 === userRank ? 'CurrentUser' : `User${i + 1}`,
              points: 1000 - i * 10,
              userId: i + 1 === userRank ? currentUserId : `user-${i + 1}`,
            }));

            // Even if we provide currentUserRank, it shouldn't show because user is in top 5
            const currentUserRank: UserRankInfo = {
              rank: userRank,
              username: 'CurrentUser',
              points: 1000 - (userRank - 1) * 10,
            };

            const mockOnViewFull = () => {};

            const { unmount } = render(
              <LeaderboardPreview
                entries={entries}
                totalPlayers={totalPlayers}
                currentUserId={currentUserId}
                currentUserRank={currentUserRank}
                onViewFull={mockOnViewFull}
              />
            );

            // Your Rank section should NOT be visible
            const yourRankSection = screen.queryByTestId('your-rank-section');
            expect(yourRankSection).not.toBeInTheDocument();

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display correct rank information in Your Rank section', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 6, max: 1000 }),
          fc.integer({ min: 100, max: 10000 }),
          (userRank, totalPlayers) => {
            const currentUserId = 'current-user-id';
            const username = 'TestUser';
            const points = 500;

            const entries: LeaderboardEntry[] = Array.from({ length: 5 }, (_, i) => ({
              rank: i + 1,
              username: `User${i + 1}`,
              points: 1000 - i * 10,
              userId: `user-${i + 1}`,
            }));

            const currentUserRank: UserRankInfo = {
              rank: userRank,
              username,
              points,
            };

            const mockOnViewFull = () => {};

            const { unmount } = render(
              <LeaderboardPreview
                entries={entries}
                totalPlayers={totalPlayers}
                currentUserId={currentUserId}
                currentUserRank={currentUserRank}
                onViewFull={mockOnViewFull}
              />
            );

            const yourRankSection = screen.getByTestId('your-rank-section');
            
            // Should contain the rank number
            expect(yourRankSection.textContent).toContain(`${userRank}.`);
            
            // Should contain the username
            expect(yourRankSection.textContent).toContain(username);
            
            // Should contain the points
            expect(yourRankSection.textContent).toContain(points.toLocaleString());

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
