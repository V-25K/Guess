/**
 * Example: Access Control Error Handling and Redirects
 * Demonstrates the enhanced error handling and redirect functionality
 * 
 * Requirements: 3.6 - Clear error messaging and appropriate redirects for unauthorized users
 */

import React, { useState } from 'react';
import { AccessDeniedPopup, useAccessDeniedPopup } from '../shared/AccessDeniedPopup';
import { accessControlManager } from '../../services/AccessControlManager';
import { errorHandlingService } from '../../services/ErrorHandlingService';
import type { AnyUserProfile } from '../../../shared/models/user.types';
import type { ViewType } from '../../types/game.types';

interface AccessControlErrorHandlingExampleProps {
  /** Current user profile */
  user: AnyUserProfile;
  
  /** Navigation callback */
  onNavigate: (view: ViewType) => void;
  
  /** Error display callback */
  onShowError?: (message: string) => void;
}

/**
 * Example component showing access control error handling with redirects
 */
export const AccessControlErrorHandlingExample: React.FC<AccessControlErrorHandlingExampleProps> = ({
  user,
  onNavigate,
  onShowError
}) => {
  const { popupState, showAccessDeniedPopup, hideAccessDeniedPopup } = useAccessDeniedPopup();
  const [lastError, setLastError] = useState<string | null>(null);

  /**
   * Handle create challenge attempt with full error handling
   */
  const handleCreateChallenge = async () => {
    try {
      // Validate session first
      const sessionResult = await accessControlManager.validateSession(
        user,
        () => {
          // Session expired callback
          if (onShowError) {
            onShowError('Your session has expired. Please refresh the page.');
          }
          setTimeout(() => onNavigate('menu'), 2000);
        }
      );

      if (!sessionResult.valid) {
        setLastError(`Session validation failed: ${sessionResult.reason}`);
        return;
      }

      // Handle access failure with full error handling and redirects
      const result = accessControlManager.handleAccessFailure(
        user,
        'create_button',
        (targetView) => {
          // Redirect callback
          console.log(`Redirecting to: ${targetView}`);
          onNavigate(targetView === 'login' ? 'menu' : targetView); // Map login to menu
        },
        (error) => {
          // Error callback
          setLastError(error);
          if (onShowError) {
            onShowError(error);
          }
        }
      );

      if (!result.granted) {
        // Show access denied popup with redirect handling
        showAccessDeniedPopup(result, 'create_button');
        return;
      }

      // Access granted - proceed with create challenge
      onNavigate('create');
    } catch (error) {
      // Handle unexpected errors
      const errorResult = errorHandlingService.handleNavigationError(
        error instanceof Error ? error : 'Unknown error',
        {
          currentView: 'menu',
          attemptedAction: 'create_challenge'
        }
      );

      if (errorResult.showToUser) {
        setLastError(errorResult.message);
        if (onShowError) {
          onShowError(errorResult.message);
        }
      }

      // Execute fallback action
      errorHandlingService.executeFallbackAction(errorResult, {
        onNavigate,
        onRetry: () => handleCreateChallenge(),
        onRefresh: () => window.location.reload()
      });
    }
  };

  /**
   * Handle navigation error scenarios
   */
  const handleNavigationError = (errorType: string) => {
    const error = errorType === 'network' 
      ? new Error('Network connection failed')
      : errorType === 'not_found'
      ? 'CHALLENGE_NOT_FOUND'
      : errorType === 'no_challenges'
      ? 'NO_AVAILABLE_CHALLENGES'
      : 'UNKNOWN_ERROR';

    const result = errorHandlingService.handleNavigationError(error, {
      currentView: 'menu',
      attemptedAction: 'navigate'
    });

    if (result.showToUser) {
      setLastError(result.message);
      if (onShowError) {
        onShowError(result.message);
      }
    }

    // Execute fallback action
    errorHandlingService.executeFallbackAction(result, {
      onNavigate,
      onRetry: () => console.log('Retrying navigation...'),
      onRefresh: () => window.location.reload()
    });
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        Access Control Error Handling Demo
      </h2>
      
      <div className="space-y-4">
        {/* User Info */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <strong>User:</strong> {user.username} 
            {'isGuest' in user && user.isGuest ? ' (Guest)' : ` (Level ${user.level})`}
          </p>
        </div>

        {/* Create Challenge Button */}
        <button
          onClick={handleCreateChallenge}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Try Create Challenge
        </button>

        {/* Navigation Error Simulation */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Simulate Navigation Errors:
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleNavigationError('network')}
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Network Error
            </button>
            <button
              onClick={() => handleNavigationError('not_found')}
              className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
            >
              Not Found
            </button>
            <button
              onClick={() => handleNavigationError('no_challenges')}
              className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
            >
              No Challenges
            </button>
            <button
              onClick={() => handleNavigationError('unknown')}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Unknown Error
            </button>
          </div>
        </div>

        {/* Last Error Display */}
        {lastError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Last Error:</strong> {lastError}
            </p>
            <button
              onClick={() => setLastError(null)}
              className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Access Denied Popup */}
      <AccessDeniedPopup
        isVisible={popupState.isVisible}
        accessResult={popupState.accessResult!}
        entryPoint={popupState.entryPoint!}
        onDismiss={hideAccessDeniedPopup}
        onRedirect={onNavigate}
        onActionSelect={(action) => {
          console.log(`User selected action: ${action}`);
          // Handle specific actions if needed
        }}
      />
    </div>
  );
};

/**
 * Usage example with different user types
 */
export const AccessControlErrorHandlingExamples: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('menu');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Example users
  const guestUser = {
    id: 'guest-123',
    username: 'guest_user',
    level: 1,
    total_points: 50,
    total_experience: 100,
    challenges_created: 0,
    challenges_attempted: 5,
    challenges_solved: 2,
    current_streak: 0,
    best_streak: 1,
    last_challenge_created_at: null,
    role: 'player' as const,
    is_subscribed: false,
    subscribed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    isGuest: true as const
  };

  const lowLevelUser = {
    id: 'user-456',
    user_id: 'user-456',
    username: 'newbie_player',
    level: 2,
    total_points: 150,
    total_experience: 300,
    challenges_created: 0,
    challenges_attempted: 10,
    challenges_solved: 5,
    current_streak: 2,
    best_streak: 3,
    last_challenge_created_at: null,
    role: 'player' as const,
    is_subscribed: false,
    subscribed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  const authorizedUser = {
    id: 'user-789',
    user_id: 'user-789',
    username: 'experienced_player',
    level: 5,
    total_points: 1000,
    total_experience: 2000,
    challenges_created: 3,
    challenges_attempted: 50,
    challenges_solved: 35,
    current_streak: 5,
    best_streak: 10,
    last_challenge_created_at: '2024-01-15T00:00:00Z',
    role: 'player' as const,
    is_subscribed: true,
    subscribed_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        Access Control Error Handling Examples
      </h1>

      {/* Current View Display */}
      <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
        <p className="text-blue-700 dark:text-blue-300">
          Current View: <strong>{currentView}</strong>
        </p>
      </div>

      {/* Global Error Display */}
      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <p className="text-red-700 dark:text-red-300">
            <strong>System Message:</strong> {errorMessage}
          </p>
          <button
            onClick={() => setErrorMessage(null)}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Examples for different user types */}
      <div className="grid gap-6 md:grid-cols-3">
        <AccessControlErrorHandlingExample
          user={guestUser}
          onNavigate={setCurrentView}
          onShowError={setErrorMessage}
        />
        
        <AccessControlErrorHandlingExample
          user={lowLevelUser}
          onNavigate={setCurrentView}
          onShowError={setErrorMessage}
        />
        
        <AccessControlErrorHandlingExample
          user={authorizedUser}
          onNavigate={setCurrentView}
          onShowError={setErrorMessage}
        />
      </div>
    </div>
  );
};