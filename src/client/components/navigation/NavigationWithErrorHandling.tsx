/**
 * NavigationWithErrorHandling Component
 * Enhanced navigation component with comprehensive error handling and UI consistency
 * 
 * Requirements: 1.2, 1.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5 - Navigation with error handling and UI consistency
 */

import React from 'react';
import { clsx } from 'clsx';
import { NavigationManager } from '../../services/navigation/NavigationManager';
import { useErrorFeedbackContext } from '../shared/ErrorFeedback';
import { uiConsistencyManager, useUIConsistencyValidation } from '../../services/UIConsistencyManager';
import { ACCESSIBILITY } from '../../utils/ui-consistency';
import type { NavigationResult } from '../../types/navigation.types';

/**
 * Props for NavigationWithErrorHandling component
 */
export interface NavigationWithErrorHandlingProps {
  /** Navigation manager instance */
  navigationManager: NavigationManager;
  /** Current challenge ID */
  currentChallengeId?: string;
  /** Whether navigation is enabled */
  enabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when navigation succeeds */
  onNavigationSuccess?: (challengeId: string) => void;
  /** Callback when navigation fails */
  onNavigationError?: (result: NavigationResult) => void;
}

/**
 * NavigationWithErrorHandling Component
 * Provides next/previous navigation with comprehensive error handling
 */
export const NavigationWithErrorHandling: React.FC<NavigationWithErrorHandlingProps> = ({
  navigationManager,
  currentChallengeId,
  enabled = true,
  className,
  onNavigationSuccess,
  onNavigationError
}) => {
  const { showNavigationError } = useErrorFeedbackContext();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [navigationState, setNavigationState] = React.useState({
    canNavigateNext: true,
    canNavigatePrevious: true,
    availableChallengeCount: 0
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const nextButtonRef = React.useRef<HTMLButtonElement>(null);
  const previousButtonRef = React.useRef<HTMLButtonElement>(null);

  // Validate UI consistency
  useUIConsistencyValidation(containerRef as React.RefObject<HTMLElement>, 'navigation');
  useUIConsistencyValidation(nextButtonRef as React.RefObject<HTMLElement>, 'button');
  useUIConsistencyValidation(previousButtonRef as React.RefObject<HTMLElement>, 'button');

  // Update navigation state
  React.useEffect(() => {
    const updateNavigationState = () => {
      const canNavigate = navigationManager.canNavigate();
      const availableCount = navigationManager.getAvailableChallengeCount();
      
      setNavigationState({
        canNavigateNext: canNavigate && availableCount > 1,
        canNavigatePrevious: canNavigate && availableCount > 1,
        availableChallengeCount: availableCount
      });
    };

    updateNavigationState();
    
    // Update state when challenge changes
    const interval = setInterval(updateNavigationState, 1000);
    return () => clearInterval(interval);
  }, [navigationManager, currentChallengeId]);

  /**
   * Handle navigation with comprehensive error handling
   */
  const handleNavigation = async (direction: 'next' | 'previous') => {
    if (!enabled || isNavigating) return;

    setIsNavigating(true);

    try {
      const result = direction === 'next' 
        ? navigationManager.navigateToNextChallenge()
        : navigationManager.navigateToPreviousChallenge();

      if (result.success && result.challengeId) {
        onNavigationSuccess?.(result.challengeId);
      } else {
        // Show error feedback
        showNavigationError(result);
        onNavigationError?.(result);
      }
    } catch (error) {
      // Handle unexpected errors
      const errorResult: NavigationResult = {
        success: false,
        error: 'NAVIGATION_LOOP_FAILURE',
        errorMessage: 'An unexpected error occurred during navigation',
        fallbackOptions: ['Try again', 'Return to menu', 'Refresh page'],
        errorContext: {
          title: 'Navigation Error',
          severity: 'error',
          showTechnicalDetails: true,
          userAction: `navigate_${direction}`,
          timestamp: new Date(),
          canRetry: true,
          retryCount: 0,
          suggestedWaitTime: 1000
        }
      };

      showNavigationError(errorResult);
      onNavigationError?.(errorResult);
    } finally {
      setIsNavigating(false);
    }
  };

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!enabled) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        handleNavigation('previous');
        break;
      case 'ArrowRight':
        event.preventDefault();
        handleNavigation('next');
        break;
    }
  };

  /**
   * Get button classes with consistency validation
   */
  const getNavigationButtonClasses = (disabled: boolean) => {
    return uiConsistencyManager.getStandardizedClasses('button', {
      variant: 'actionNext',
      size: 'md',
      className: clsx(
        disabled && 'opacity-50 cursor-not-allowed',
        isNavigating && 'pointer-events-none'
      )
    });
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        'flex items-center justify-center gap-4',
        'p-4',
        className
      )}
      role="navigation"
      aria-label="Challenge navigation"
      onKeyDown={handleKeyDown}
    >
      {/* Previous Button */}
      <button
        ref={previousButtonRef}
        onClick={() => handleNavigation('previous')}
        disabled={!enabled || !navigationState.canNavigatePrevious || isNavigating}
        className={getNavigationButtonClasses(!navigationState.canNavigatePrevious)}
        aria-label="Go to previous challenge"
        title="Previous Challenge (Left Arrow)"
      >
        <span aria-hidden="true">←</span>
        <span>Previous</span>
        {isNavigating && (
          <span className="animate-spin" aria-hidden="true">⟳</span>
        )}
      </button>

      {/* Challenge Counter */}
      <div 
        className="text-sm text-neutral-600 dark:text-white/70 px-2"
        aria-live="polite"
        aria-label={`${navigationState.availableChallengeCount} challenges available`}
      >
        {navigationState.availableChallengeCount === 0 ? (
          <span className="text-red-600 dark:text-red-400">No challenges available</span>
        ) : (
          <span>{navigationState.availableChallengeCount} available</span>
        )}
      </div>

      {/* Next Button */}
      <button
        ref={nextButtonRef}
        onClick={() => handleNavigation('next')}
        disabled={!enabled || !navigationState.canNavigateNext || isNavigating}
        className={getNavigationButtonClasses(!navigationState.canNavigateNext)}
        aria-label="Go to next challenge"
        title="Next Challenge (Right Arrow)"
      >
        <span>Next</span>
        <span aria-hidden="true">→</span>
        {isNavigating && (
          <span className="animate-spin" aria-hidden="true">⟳</span>
        )}
      </button>

      {/* Screen reader instructions */}
      <div className={ACCESSIBILITY.srOnly}>
        Use left and right arrow keys to navigate between challenges.
        {navigationState.availableChallengeCount === 0 && 
          ' No challenges are currently available for navigation.'
        }
      </div>
    </div>
  );
};

/**
 * Hook for managing navigation with error handling
 */
export function useNavigationWithErrorHandling(navigationManager: NavigationManager) {
  const { showNavigationError } = useErrorFeedbackContext();
  const [isNavigating, setIsNavigating] = React.useState(false);

  const navigateWithErrorHandling = React.useCallback(async (
    action: () => NavigationResult,
    actionName: string
  ): Promise<NavigationResult> => {
    setIsNavigating(true);

    try {
      const result = action();
      
      if (!result.success) {
        showNavigationError(result);
      }

      return result;
    } catch (error) {
      const errorResult: NavigationResult = {
        success: false,
        error: 'NAVIGATION_LOOP_FAILURE',
        errorMessage: `An unexpected error occurred during ${actionName}`,
        fallbackOptions: ['Try again', 'Return to menu'],
        errorContext: {
          title: 'Navigation Error',
          severity: 'error',
          showTechnicalDetails: true,
          userAction: actionName,
          timestamp: new Date(),
          canRetry: true,
          retryCount: 0,
          suggestedWaitTime: 1000
        }
      };

      showNavigationError(errorResult);
      return errorResult;
    } finally {
      setIsNavigating(false);
    }
  }, [showNavigationError]);

  const navigateNext = React.useCallback(() => {
    return navigateWithErrorHandling(
      () => navigationManager.navigateToNextChallenge(),
      'navigate_next'
    );
  }, [navigationManager, navigateWithErrorHandling]);

  const navigatePrevious = React.useCallback(() => {
    return navigateWithErrorHandling(
      () => navigationManager.navigateToPreviousChallenge(),
      'navigate_previous'
    );
  }, [navigationManager, navigateWithErrorHandling]);

  const navigateToChallenge = React.useCallback((challengeId: string) => {
    return navigateWithErrorHandling(
      () => navigationManager.navigateToChallenge(challengeId),
      'navigate_to_challenge'
    );
  }, [navigationManager, navigateWithErrorHandling]);

  return {
    isNavigating,
    navigateNext,
    navigatePrevious,
    navigateToChallenge
  };
}