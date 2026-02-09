/**
 * NavigationBar Component
 * Bottom navigation bar with icon-only buttons
 */

import React from 'react';
import { clsx } from 'clsx';
import type { ViewType } from '../../types/game.types.js';
import type { ViewMode } from '../../hooks/useViewMode.js';
import { HomeIcon, ProfileIcon, LeaderboardIcon, AwardsIcon, CreateIcon } from './NavIcons';
import { accessControlManager } from '../../services/AccessControlManager';
import { AccessDeniedPopup, useAccessDeniedPopup } from '../shared/AccessDeniedPopup';
import { userAuthService } from '../../services/user-auth.service';
import { getNavigationItemClasses, NAVIGATION_STYLES } from '../../utils/ui-consistency';

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
  const { popupState, showAccessDeniedPopup, hideAccessDeniedPopup } = useAccessDeniedPopup();

  const isActive = (view: ViewType | ViewType[]) => {
    if (Array.isArray(view)) {
      return view.includes(currentView);
    }
    return currentView === view;
  };

  /**
   * Handle create navigation with access control validation
   * Requirements: 3.3, 3.4 - Apply access control to navigation tab create access
   */
  const handleCreateNavigation = async (event: React.MouseEvent) => {
    try {
      // Get current user
      const currentUser = await userAuthService.getCurrentUser();
      
      // Validate access using AccessControlManager
      const accessResult = accessControlManager.validateCreateAccess(currentUser, 'navigation_tab');
      
      if (accessResult.granted) {
        // Access granted - proceed with navigation
        onNavigate('create', event);
      } else {
        // Access denied - show consistent popup
        showAccessDeniedPopup(accessResult, 'navigation_tab');
      }
    } catch (error) {
      console.error('Error checking create access:', error);
      // Show generic error popup with consistent messaging
      showAccessDeniedPopup({
        granted: false,
        reason: 'PERMISSION_DENIED',
        message: 'Unable to verify permissions. Please try again.',
        suggestedActions: ['Try again', 'Refresh page', 'Return to menu']
      }, 'navigation_tab');
    }
  };

  /**
   * Handle suggested actions from access denied popup
   * Requirements: 3.6 - Redirect users to appropriate alternative actions
   */
  const handleActionSelect = (action: string) => {
    switch (action) {
      case 'Log in with your Reddit account':
        // Redirect to login - this would typically be handled by the auth service
        window.location.href = '/auth/login';
        break;
      
      case 'Continue playing to reach level 3':
      case 'Play more challenges to level up':
      case 'Browse existing challenges':
        // Navigate to menu/gameplay
        onNavigate('menu');
        break;
      
      case 'Check your current level in Profile':
        // Navigate to profile
        onNavigate('profile');
        break;
      
      case 'Return to menu':
        // Navigate to menu
        onNavigate('menu');
        break;
      
      case 'Refresh the page':
      case 'Try again':
        // Refresh page
        window.location.reload();
        break;
      
      default:
        // Default action - close popup
        hideAccessDeniedPopup();
        break;
    }
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
  const navItemBaseStyles = NAVIGATION_STYLES.itemBase;

  const getNavItemStyles = (active: boolean) =>
    getNavigationItemClasses(active);

  // Requirement 1.2: Show navigation bar in expanded mode for Profile, Leaderboard, Awards, Create
  return (
    <nav
      className={NAVIGATION_STYLES.container}
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
        onClick={handleCreateNavigation}
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

      {/* Access Denied Popup */}
      {popupState.accessResult && popupState.entryPoint && (
        <AccessDeniedPopup
          isVisible={popupState.isVisible}
          accessResult={popupState.accessResult}
          entryPoint={popupState.entryPoint}
          onDismiss={hideAccessDeniedPopup}
          onActionSelect={handleActionSelect}
        />
      )}
    </nav>
  );
};
