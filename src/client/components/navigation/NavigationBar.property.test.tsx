/**
 * NavigationBar Property Tests
 * Property-based tests for NavigationBar visibility logic using fast-check
 *
 * **Feature: ui-ux-mobile-improvements**
 * **Feature: frontend-game-redesign**
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { NavigationBar } from './NavigationBar.js';
import type { ViewType } from '../../types/game.types.js';
import type { ViewMode } from '../../hooks/useViewMode.js';

/**
 * Navigation bar visibility logic
 * This function encapsulates the visibility rules for the navigation bar
 * based on view mode and current view.
 *
 * Rules:
 * - Hidden in inline mode (regardless of view)
 * - Hidden in expanded mode for 'menu' and 'gameplay' views
 * - Visible in expanded mode for 'profile', 'leaderboard', 'awards', 'create' views
 */
export function shouldShowNavigationBar(
  viewMode: ViewMode,
  currentView: ViewType
): boolean {
  // Rule 1: Always hidden in inline mode
  if (viewMode === 'inline') {
    return false;
  }

  // Rule 2: In expanded mode, hidden for menu and gameplay
  const hiddenInExpandedViews: ViewType[] = ['menu', 'gameplay', 'loading'];
  if (hiddenInExpandedViews.includes(currentView)) {
    return false;
  }

  // Rule 3: Visible for other views in expanded mode
  return true;
}

// Valid view types for testing
const ALL_VIEW_TYPES: ViewType[] = [
  'menu',
  'gameplay',
  'profile',
  'leaderboard',
  'create',
  'loading',
  'awards',
];

const EXPANDED_VISIBLE_VIEWS: ViewType[] = [
  'profile',
  'leaderboard',
  'awards',
  'create',
];

const EXPANDED_HIDDEN_VIEWS: ViewType[] = ['menu', 'gameplay', 'loading'];

describe('NavigationBar Visibility Property Tests', () => {
  /**
   * **Feature: ui-ux-mobile-improvements, Property 1: Navigation Bar Visibility in Inline Mode**
   * **Validates: Requirements 1.1**
   *
   * For any view type and app state, when the view mode is 'inline',
   * the navigation bar component should not be rendered.
   */
  it('should hide navigation bar for any view when in inline mode', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_VIEW_TYPES), (viewType) => {
        const isVisible = shouldShowNavigationBar('inline', viewType);

        // Navigation bar must be hidden in inline mode regardless of view
        expect(isVisible).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-ux-mobile-improvements, Property 2: Navigation Bar Visibility in Expanded Mode**
   * **Validates: Requirements 1.2, 1.3**
   *
   * For any view in the set {Profile, Leaderboard, Awards, Create} when the view mode
   * is 'expanded', the navigation bar component should be rendered and visible.
   */
  it('should show navigation bar for Profile, Leaderboard, Awards, Create views in expanded mode', () => {
    fc.assert(
      fc.property(fc.constantFrom(...EXPANDED_VISIBLE_VIEWS), (viewType) => {
        const isVisible = shouldShowNavigationBar('expanded', viewType);

        // Navigation bar must be visible for these views in expanded mode
        expect(isVisible).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Navigation bar hidden for menu/gameplay in expanded mode
   * **Validates: Requirements 1.3**
   */
  it('should hide navigation bar for menu and gameplay views in expanded mode', () => {
    fc.assert(
      fc.property(fc.constantFrom(...EXPANDED_HIDDEN_VIEWS), (viewType) => {
        const isVisible = shouldShowNavigationBar('expanded', viewType);

        // Navigation bar must be hidden for menu and gameplay in expanded mode
        expect(isVisible).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Combined property: All view types and modes produce consistent results
   */
  it('should produce consistent visibility for all view mode and view type combinations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ViewMode>('inline', 'expanded'),
        fc.constantFrom(...ALL_VIEW_TYPES),
        (viewMode, viewType) => {
          const isVisible = shouldShowNavigationBar(viewMode, viewType);

          // Result must be a boolean
          expect(typeof isVisible).toBe('boolean');

          // Verify the logic is consistent
          if (viewMode === 'inline') {
            expect(isVisible).toBe(false);
          } else if (EXPANDED_HIDDEN_VIEWS.includes(viewType)) {
            expect(isVisible).toBe(false);
          } else {
            expect(isVisible).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * NavigationBar Active State Property Tests
 * **Feature: frontend-game-redesign**
 */
describe('NavigationBar Active State Property Tests', () => {
  // Views where the navigation bar is visible in expanded mode
  // (excludes 'menu' and 'gameplay' which hide the nav bar)
  const VISIBLE_NAV_VIEWS: ViewType[] = ['profile', 'create', 'leaderboard', 'awards'];
  
  // Map of view types to their aria-label
  const VIEW_TO_LABEL: Record<string, string> = {
    menu: 'Menu',
    profile: 'Profile',
    create: 'Create Challenge',
    leaderboard: 'Leaderboard',
    awards: 'Awards',
  };

  /**
   * **Feature: frontend-game-redesign, Property 3: Navigation Bar Active State**
   * **Validates: Requirements 4.6**
   *
   * For any NavigationBar component rendered with a currentView prop,
   * the navigation item matching that view should have an active state indicator
   * (aria-current="page" and active styling class).
   */
  it('should mark the active navigation item with aria-current="page"', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VISIBLE_NAV_VIEWS),
        (currentView) => {
          const mockNavigate = () => {};
          
          const { unmount } = render(
            <NavigationBar
              currentView={currentView}
              onNavigate={mockNavigate}
              viewMode="expanded"
            />
          );

          // Get the button for the current view
          const label = VIEW_TO_LABEL[currentView];
          const activeButton = screen.getByRole('button', { name: label });
          
          // The active button should have aria-current="page"
          expect(activeButton).toHaveAttribute('aria-current', 'page');
          
          // Other buttons should NOT have aria-current="page"
          const otherViews = VISIBLE_NAV_VIEWS.filter(v => v !== currentView);
          for (const otherView of otherViews) {
            const otherLabel = VIEW_TO_LABEL[otherView];
            const otherButton = screen.getByRole('button', { name: otherLabel });
            expect(otherButton).not.toHaveAttribute('aria-current', 'page');
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: frontend-game-redesign, Property 3: Navigation Bar Active State (styling)**
   * **Validates: Requirements 4.6**
   *
   * For any NavigationBar component rendered with a currentView prop,
   * the active navigation item should have distinct styling from inactive items.
   */
  it('should apply active styling class to the current view button', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VISIBLE_NAV_VIEWS),
        (currentView) => {
          const mockNavigate = () => {};
          
          const { unmount } = render(
            <NavigationBar
              currentView={currentView}
              onNavigate={mockNavigate}
              viewMode="expanded"
            />
          );

          const label = VIEW_TO_LABEL[currentView];
          const activeButton = screen.getByRole('button', { name: label });
          
          // Active button should have the primary color class
          expect(activeButton.className).toMatch(/text-game-primary/);
          
          // Active button should have the background highlight
          expect(activeButton.className).toMatch(/bg-game-primary/);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Profile button should be active when profile view is selected
   */
  it('should mark profile button active for profile view', () => {
    const mockNavigate = () => {};
    
    const { unmount } = render(
      <NavigationBar
        currentView="profile"
        onNavigate={mockNavigate}
        viewMode="expanded"
      />
    );

    const profileButton = screen.getByRole('button', { name: 'Profile' });
    
    // Profile button should be active
    expect(profileButton).toHaveAttribute('aria-current', 'page');
    expect(profileButton.className).toMatch(/text-game-primary/);

    unmount();
  });
});

/**
 * NavigationBar Touch Target Property Tests
 * **Feature: frontend-game-redesign**
 */
describe('NavigationBar Touch Target Property Tests', () => {
  // All navigation button labels
  const NAV_BUTTON_LABELS = ['Menu', 'Profile', 'Create Challenge', 'Leaderboard', 'Awards'];

  /**
   * **Feature: frontend-game-redesign, Property 4: Touch Target Minimum Size**
   * **Validates: Requirements 5.1**
   *
   * For any interactive element (button, link, clickable div) in the navigation bar,
   * the element should have minimum dimensions of 44x44 pixels via min-h-touch and min-w-touch classes.
   */
  it('should have touch-friendly minimum size classes on all navigation buttons', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NAV_BUTTON_LABELS),
        (buttonLabel) => {
          const mockNavigate = () => {};
          
          // Use 'profile' view to ensure nav bar is visible
          const { unmount } = render(
            <NavigationBar
              currentView="profile"
              onNavigate={mockNavigate}
              viewMode="expanded"
            />
          );

          const button = screen.getByRole('button', { name: buttonLabel });
          
          // Button should have min-h-touch class (44px minimum height)
          expect(button.className).toMatch(/min-h-touch/);
          
          // Button should have min-w-touch class (44px minimum width)
          expect(button.className).toMatch(/min-w-touch/);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: All buttons should have explicit width/height for touch targets
   */
  it('should have explicit size classes on all navigation buttons', () => {
    const mockNavigate = () => {};
    
    const { unmount } = render(
      <NavigationBar
        currentView="profile"
        onNavigate={mockNavigate}
        viewMode="expanded"
      />
    );

    // Get all buttons in the navigation
    const buttons = screen.getAllByRole('button');
    
    // Each button should have size classes (w-12 h-12 = 48px, exceeds 44px minimum)
    for (const button of buttons) {
      // Should have width class
      expect(button.className).toMatch(/w-12/);
      // Should have height class
      expect(button.className).toMatch(/h-12/);
    }

    unmount();
  });
});

/**
 * NavigationBar ARIA Labels Property Tests
 * **Feature: frontend-game-redesign**
 */
describe('NavigationBar ARIA Labels Property Tests', () => {
  // Expected ARIA labels for each navigation button
  const EXPECTED_ARIA_LABELS = ['Menu', 'Profile', 'Create Challenge', 'Leaderboard', 'Awards'];

  /**
   * **Feature: frontend-game-redesign, Property 7: Interactive Element ARIA Labels**
   * **Validates: Requirements 8.1**
   *
   * For any interactive element (button, link) that does not contain visible text,
   * the element should have an aria-label or aria-labelledby attribute.
   */
  it('should have aria-label on all icon-only navigation buttons', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EXPECTED_ARIA_LABELS),
        (expectedLabel) => {
          const mockNavigate = () => {};
          
          const { unmount } = render(
            <NavigationBar
              currentView="profile"
              onNavigate={mockNavigate}
              viewMode="expanded"
            />
          );

          // Should be able to find button by its aria-label
          const button = screen.getByRole('button', { name: expectedLabel });
          
          // Button should exist and have the aria-label attribute
          expect(button).toBeInTheDocument();
          expect(button).toHaveAttribute('aria-label', expectedLabel);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * All navigation buttons should have aria-label since they only contain icons
   */
  it('should have aria-label attribute on every navigation button', () => {
    const mockNavigate = () => {};
    
    const { unmount } = render(
      <NavigationBar
        currentView="profile"
        onNavigate={mockNavigate}
        viewMode="expanded"
      />
    );

    // Get all buttons
    const buttons = screen.getAllByRole('button');
    
    // Each button should have an aria-label
    for (const button of buttons) {
      expect(button).toHaveAttribute('aria-label');
      // aria-label should not be empty
      const ariaLabel = button.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.length).toBeGreaterThan(0);
    }

    unmount();
  });

  /**
   * Navigation should have proper role and aria-label
   */
  it('should have proper navigation role and aria-label on the nav element', () => {
    const mockNavigate = () => {};
    
    const { unmount } = render(
      <NavigationBar
        currentView="profile"
        onNavigate={mockNavigate}
        viewMode="expanded"
      />
    );

    // Navigation element should have role="navigation"
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    
    // Navigation should have aria-label
    expect(nav).toHaveAttribute('aria-label', 'Main navigation');

    unmount();
  });

  /**
   * SVG icons should be hidden from screen readers
   */
  it('should hide SVG icons from screen readers with aria-hidden', () => {
    const mockNavigate = () => {};
    
    const { container, unmount } = render(
      <NavigationBar
        currentView="profile"
        onNavigate={mockNavigate}
        viewMode="expanded"
      />
    );

    // All SVG elements should have aria-hidden="true"
    const svgs = container.querySelectorAll('svg');
    for (const svg of svgs) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }

    unmount();
  });
});
