/**
 * NavigationBar Component
 * Bottom navigation bar with icon-only buttons
 */

import React from 'react';
import { clsx } from 'clsx';
import type { ViewType } from '../../types/game.types.js';
import type { ViewMode } from '../../hooks/useViewMode.js';
import { HomeIcon, ProfileIcon, LeaderboardIcon, AwardsIcon, CreateIcon } from './NavIcons';

export interface NavigationBarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType, event?: React.MouseEvent) => void;
  viewMode: ViewMode;
}

// Views where navigation bar should be hidden in expanded mode
const HIDDEN_IN_EXPANDED_VIEWS: ViewType[] = ['menu', 'gameplay'];

export const NavigationBar: React.FC<NavigationBarProps> = ({
  currentView,
  onNavigate,
  viewMode,
}) => {
  const isActive = (view: ViewType | ViewType[]) => {
    if (Array.isArray(view)) {
      return view.includes(currentView);
    }
    return currentView === view;
  };

  // Requirement 1.1: Hide navigation bar when in inline mode
  if (viewMode === 'inline') {
    return null;
  }

  // Requirement 1.3: Hide navigation bar when currentView is 'menu' or 'gameplay' in expanded mode
  if (viewMode === 'expanded' && HIDDEN_IN_EXPANDED_VIEWS.includes(currentView)) {
    return null;
  }

  // Base styles for nav items - touch-friendly 48x48px (exceeds 44px minimum)
  const navItemBaseStyles = clsx(
    // Layout
    'flex items-center justify-center',
    // Size - touch-friendly (44x44px minimum)
    'w-12 h-12 min-w-touch min-h-touch',
    // Shape
    'rounded-xl',
    // Reset button styles
    'border-none bg-transparent',
    // Cursor
    'cursor-pointer',
    // Transition
    'transition-all duration-200 motion-reduce:transition-none',
    // Focus styles for accessibility
    'focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] focus:ring-offset-2 dark:focus:ring-offset-[#1a2332]'
  );

  const getNavItemStyles = (active: boolean) =>
    clsx(
      navItemBaseStyles,
      // Light mode styles
      active
        ? 'text-game-primary bg-game-primary/10'
        : 'text-neutral-500 hover:text-game-primary hover:bg-neutral-100',
      // Dark mode styles
      active
        ? 'dark:text-[#f0d078] dark:bg-[#f0d078]/15'
        : 'dark:text-white/50 dark:hover:text-[#f0d078] dark:hover:bg-white/[0.08]'
    );

  // Requirement 1.2: Show navigation bar in expanded mode for Profile, Leaderboard, Awards, Create
  return (
    <nav
      className={clsx(
        // Layout
        'flex justify-around items-center',
        // Background - elevated surface
        'bg-white dark:bg-[#1a2332]',
        // Border
        'border-t border-neutral-200 dark:border-white/[0.08]',
        // Padding
        'px-4 py-2',
        // Position
        'fixed bottom-0 left-0 w-full',
        // Z-index
        'z-[1000]',
        // Height
        'h-[60px]',
        // Shadow
        'shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]'
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      <button
        className={getNavItemStyles(isActive('menu'))}
        onClick={(e) => onNavigate('menu', e)}
        aria-label="Menu"
        aria-current={isActive('menu') ? 'page' : undefined}
        title="Menu"
        type="button"
      >
        <HomeIcon />
      </button>

      <button
        className={getNavItemStyles(isActive('profile'))}
        onClick={(e) => onNavigate('profile', e)}
        aria-label="Profile"
        aria-current={isActive('profile') ? 'page' : undefined}
        title="Profile"
        type="button"
      >
        <ProfileIcon />
      </button>

      <button
        className={getNavItemStyles(isActive('create'))}
        onClick={(e) => onNavigate('create', e)}
        aria-label="Create Challenge"
        aria-current={isActive('create') ? 'page' : undefined}
        title="Create"
        type="button"
      >
        <CreateIcon />
      </button>

      <button
        className={getNavItemStyles(isActive('leaderboard'))}
        onClick={(e) => onNavigate('leaderboard', e)}
        aria-label="Leaderboard"
        aria-current={isActive('leaderboard') ? 'page' : undefined}
        title="Leaderboard"
        type="button"
      >
        <LeaderboardIcon />
      </button>

      <button
        className={getNavItemStyles(isActive('awards'))}
        onClick={(e) => onNavigate('awards', e)}
        aria-label="Awards"
        aria-current={isActive('awards') ? 'page' : undefined}
        title="Awards"
        type="button"
      >
        <AwardsIcon />
      </button>
    </nav>
  );
};
