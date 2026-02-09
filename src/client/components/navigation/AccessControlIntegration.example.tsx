/**
 * AccessControlIntegration Example
 * Shows how to integrate AccessControlManager with navigation components
 * 
 * This is an example file showing the integration pattern.
 * The actual integration would be done in the NavigationBar component.
 * 
 * Requirements: 3.3, 3.4 - Apply access control to all create functionality entry points
 */

import React from 'react';
import { accessControlManager } from '../../services/AccessControlManager';
import { AccessDeniedPopup, useAccessDeniedPopup } from '../shared/AccessDeniedPopup';
import { userAuthService } from '../../services/user-auth.service';
import type { ViewType } from '../../types/game.types';

/**
 * Example of how NavigationBar would integrate access control
 */
export const NavigationBarWithAccessControl: React.FC<{
  currentView: ViewType;
  onNavigate: (view: ViewType, event?: React.MouseEvent) => void;
}> = ({ currentView, onNavigate }) => {
  const { popupState, showAccessDeniedPopup, hideAccessDeniedPopup } = useAccessDeniedPopup();

  const handleCreateNavigation = async (event: React.MouseEvent) => {
    try {
      // Get current user
      const currentUser = await userAuthService.getCurrentUser();
      
      // Validate access
      const accessResult = accessControlManager.validateCreateAccess(currentUser, 'navigation_tab');
      
      if (accessResult.granted) {
        // Access granted - proceed with navigation
        onNavigate('create', event);
      } else {
        // Access denied - show popup
        showAccessDeniedPopup(accessResult, 'navigation_tab');
      }
    } catch (error) {
      console.error('Error checking create access:', error);
      // Show generic error popup
      showAccessDeniedPopup({
        granted: false,
        reason: 'PERMISSION_DENIED',
        message: 'Unable to verify permissions. Please try again.',
        suggestedActions: ['Try again', 'Refresh page', 'Return to menu']
      }, 'navigation_tab');
    }
  };

  const handleActionSelect = (action: string) => {
    switch (action) {
      case 'Log in with your Reddit account':
        // Redirect to login
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

  return (
    <>
      {/* Navigation Bar */}
      <nav className="flex justify-around items-center bg-white dark:bg-[#1a2332] border-t border-neutral-200 dark:border-white/[0.08] px-4 py-2 fixed bottom-0 left-0 w-full z-[1000] h-[60px]">
        {/* Other navigation buttons... */}
        
        {/* Create button with access control */}
        <button
          className="flex items-center justify-center w-12 h-12 rounded-xl border-none bg-transparent cursor-pointer transition-all duration-200 text-neutral-500 hover:text-game-primary hover:bg-neutral-100 dark:text-white/50 dark:hover:text-[#f0d078] dark:hover:bg-white/[0.08]"
          onClick={handleCreateNavigation}
          aria-label="Create Challenge"
          title="Create"
          type="button"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        
        {/* Other navigation buttons... */}
      </nav>

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
    </>
  );
};

/**
 * Example of how CreateChallengeView would integrate access control
 */
export const CreateChallengeViewWithAccessControl: React.FC<{
  onSuccess?: () => void;
  onCancel?: () => void;
}> = ({ onSuccess, onCancel }) => {
  const { popupState, showAccessDeniedPopup, hideAccessDeniedPopup } = useAccessDeniedPopup();
  const [isAccessChecked, setIsAccessChecked] = React.useState(false);
  const [hasAccess, setHasAccess] = React.useState(false);

  React.useEffect(() => {
    const checkAccess = async () => {
      try {
        const currentUser = await userAuthService.getCurrentUser();
        const accessResult = accessControlManager.validateCreateAccess(currentUser, 'direct_link');
        
        if (accessResult.granted) {
          setHasAccess(true);
        } else {
          showAccessDeniedPopup(accessResult, 'direct_link');
        }
      } catch (error) {
        console.error('Error checking create access:', error);
        showAccessDeniedPopup({
          granted: false,
          reason: 'PERMISSION_DENIED',
          message: 'Unable to verify permissions. Please try again.',
          suggestedActions: ['Try again', 'Return to menu']
        }, 'direct_link');
      } finally {
        setIsAccessChecked(true);
      }
    };

    checkAccess();
  }, [showAccessDeniedPopup]);

  const handleActionSelect = (action: string) => {
    switch (action) {
      case 'Log in with your Reddit account':
        window.location.href = '/auth/login';
        break;
      
      case 'Return to menu':
        if (onCancel) onCancel();
        break;
      
      default:
        hideAccessDeniedPopup();
        if (onCancel) onCancel();
        break;
    }
  };

  // Show loading while checking access
  if (!isAccessChecked) {
    return (
      <div className="w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-game-primary mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-white/70">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Show access denied popup if no access
  if (!hasAccess) {
    return (
      <>
        <div className="w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419] flex items-center justify-center">
          <div className="text-center p-8">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white/95 mb-4">
              Access Restricted
            </h2>
            <p className="text-neutral-600 dark:text-white/70 mb-6">
              Checking your permissions...
            </p>
          </div>
        </div>

        {popupState.accessResult && popupState.entryPoint && (
          <AccessDeniedPopup
            isVisible={popupState.isVisible}
            accessResult={popupState.accessResult}
            entryPoint={popupState.entryPoint}
            onDismiss={hideAccessDeniedPopup}
            onActionSelect={handleActionSelect}
          />
        )}
      </>
    );
  }

  // Render normal create view if access is granted
  return (
    <div className="w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419]">
      {/* Normal CreateChallengeView content would go here */}
      <div className="p-4">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white/95 mb-4">
          Create Challenge
        </h1>
        <p className="text-neutral-600 dark:text-white/70">
          Access granted! You can create challenges.
        </p>
        {/* Rest of create form... */}
      </div>
    </div>
  );
};

/**
 * Utility hook for access control integration
 */
export const useAccessControl = () => {
  const { popupState, showAccessDeniedPopup, hideAccessDeniedPopup } = useAccessDeniedPopup();

  const checkCreateAccess = async (entryPoint: 'navigation_tab' | 'create_button' | 'direct_link' | 'menu_option' = 'direct_link') => {
    try {
      const currentUser = await userAuthService.getCurrentUser();
      const accessResult = accessControlManager.validateCreateAccess(currentUser, entryPoint);
      
      if (!accessResult.granted) {
        showAccessDeniedPopup(accessResult, entryPoint);
      }
      
      return accessResult.granted;
    } catch (error) {
      console.error('Error checking create access:', error);
      showAccessDeniedPopup({
        granted: false,
        reason: 'PERMISSION_DENIED',
        message: 'Unable to verify permissions. Please try again.',
        suggestedActions: ['Try again', 'Return to menu']
      }, entryPoint);
      return false;
    }
  };

  return {
    checkCreateAccess,
    popupState,
    hideAccessDeniedPopup,
    AccessDeniedPopup: popupState.accessResult && popupState.entryPoint ? (
      <AccessDeniedPopup
        isVisible={popupState.isVisible}
        accessResult={popupState.accessResult}
        entryPoint={popupState.entryPoint}
        onDismiss={hideAccessDeniedPopup}
      />
    ) : null
  };
};