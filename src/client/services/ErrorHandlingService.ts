/**
 * Error Handling Service
 * Provides centralized error handling and user feedback for navigation and access control failures
 * 
 * Requirements: 3.6, 4.5 - Error handling and redirects for access control and navigation failures
 */

import type { ViewType } from '../types/game.types';
import type { AccessControlResult } from './AccessControlManager';

/**
 * Navigation error types
 */
export type NavigationError = 
  | 'CHALLENGE_NOT_FOUND'
  | 'NO_AVAILABLE_CHALLENGES'
  | 'NAVIGATION_LOOP_FAILURE'
  | 'NETWORK_ERROR'
  | 'PERMISSION_DENIED'
  | 'SESSION_EXPIRED'
  | 'UNKNOWN_ERROR';

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
  /** Whether the error was handled successfully */
  handled: boolean;
  
  /** User-friendly error message */
  message: string;
  
  /** Suggested fallback action */
  fallbackAction?: {
    type: 'navigate' | 'retry' | 'refresh';
    target?: ViewType;
    delay?: number;
  };
  
  /** Whether to show the error to the user */
  showToUser: boolean;
}

/**
 * Error Handling Service Class
 * Centralizes error handling logic and provides consistent user feedback
 */
export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  
  private constructor() {}
  
  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Handle navigation errors with appropriate fallback actions
   * Requirements: 4.5 - Clear error messaging and fallback options for navigation failures
   */
  public handleNavigationError(
    error: NavigationError | Error | string,
    context?: {
      currentView?: ViewType;
      attemptedAction?: string;
      challengeId?: string;
    }
  ): ErrorHandlingResult {
    const errorType = this.categorizeError(error);
    
    switch (errorType) {
      case 'CHALLENGE_NOT_FOUND':
        return {
          handled: true,
          message: 'The requested challenge could not be found. Returning to the main menu.',
          fallbackAction: {
            type: 'navigate',
            target: 'menu',
            delay: 2000
          },
          showToUser: true
        };
      
      case 'NO_AVAILABLE_CHALLENGES':
        return {
          handled: true,
          message: 'No challenges are currently available. You\'ve completed all available challenges!',
          fallbackAction: {
            type: 'navigate',
            target: 'allCaughtUp',
            delay: 1500
          },
          showToUser: true
        };
      
      case 'NAVIGATION_LOOP_FAILURE':
        return {
          handled: true,
          message: 'Navigation encountered an issue. Staying on the current challenge.',
          fallbackAction: undefined, // Stay where we are
          showToUser: false // Don't show this technical error to users
        };
      
      case 'NETWORK_ERROR':
        return {
          handled: true,
          message: 'Network connection issue. Please check your connection and try again.',
          fallbackAction: {
            type: 'retry',
            delay: 3000
          },
          showToUser: true
        };
      
      case 'PERMISSION_DENIED':
        return {
          handled: true,
          message: 'You don\'t have permission to access this feature.',
          fallbackAction: {
            type: 'navigate',
            target: 'menu',
            delay: 2000
          },
          showToUser: true
        };
      
      case 'SESSION_EXPIRED':
        return {
          handled: true,
          message: 'Your session has expired. Please refresh the page to continue.',
          fallbackAction: {
            type: 'refresh',
            delay: 2000
          },
          showToUser: true
        };
      
      case 'UNKNOWN_ERROR':
      default:
        return {
          handled: true,
          message: 'An unexpected error occurred. Returning to the main menu.',
          fallbackAction: {
            type: 'navigate',
            target: 'menu',
            delay: 2000
          },
          showToUser: true
        };
    }
  }

  /**
   * Handle access control errors with appropriate redirects
   * Requirements: 3.6 - Handle access control validation failures with redirects
   */
  public handleAccessControlError(
    accessResult: AccessControlResult,
    context?: {
      entryPoint?: string;
      attemptedAction?: string;
    }
  ): ErrorHandlingResult {
    if (accessResult.granted) {
      return {
        handled: true,
        message: 'Access granted',
        showToUser: false
      };
    }

    const message = accessResult.message || 'Access denied';
    const redirect = accessResult.redirect;

    return {
      handled: true,
      message,
      fallbackAction: redirect ? {
        type: 'navigate',
        target: redirect.targetView === 'login' ? 'menu' : redirect.targetView, // Map login to menu since we don't have a login view
        delay: redirect.delay || 0
      } : {
        type: 'navigate',
        target: 'menu',
        delay: 2000
      },
      showToUser: true
    };
  }

  /**
   * Execute fallback action based on error handling result
   */
  public executeFallbackAction(
    result: ErrorHandlingResult,
    callbacks: {
      onNavigate?: (view: ViewType) => void;
      onRetry?: () => void;
      onRefresh?: () => void;
    }
  ): void {
    if (!result.fallbackAction) {
      return;
    }

    const { type, target, delay = 0 } = result.fallbackAction;

    const executeAction = () => {
      switch (type) {
        case 'navigate':
          if (target && callbacks.onNavigate) {
            callbacks.onNavigate(target);
          }
          break;
        
        case 'retry':
          if (callbacks.onRetry) {
            callbacks.onRetry();
          }
          break;
        
        case 'refresh':
          if (callbacks.onRefresh) {
            callbacks.onRefresh();
          } else {
            // Default refresh behavior
            window.location.reload();
          }
          break;
      }
    };

    if (delay > 0) {
      setTimeout(executeAction, delay);
    } else {
      executeAction();
    }
  }

  /**
   * Categorize error into known error types
   */
  private categorizeError(error: NavigationError | Error | string): NavigationError {
    if (typeof error === 'string') {
      if (error.includes('CHALLENGE_NOT_FOUND') || error.includes('not found')) {
        return 'CHALLENGE_NOT_FOUND';
      }
      if (error.includes('NO_AVAILABLE_CHALLENGES') || error.includes('no challenges')) {
        return 'NO_AVAILABLE_CHALLENGES';
      }
      if (error.includes('NAVIGATION_LOOP_FAILURE') || error.includes('loop failure')) {
        return 'NAVIGATION_LOOP_FAILURE';
      }
      if (error.includes('network') || error.includes('fetch')) {
        return 'NETWORK_ERROR';
      }
      if (error.includes('permission') || error.includes('access')) {
        return 'PERMISSION_DENIED';
      }
      if (error.includes('session') || error.includes('expired')) {
        return 'SESSION_EXPIRED';
      }
      return 'UNKNOWN_ERROR';
    }

    if (error instanceof Error) {
      return this.categorizeError(error.message);
    }

    // If it's already a NavigationError type
    return error;
  }

  /**
   * Log error for debugging and monitoring
   */
  public logError(
    error: NavigationError | Error | string,
    context?: Record<string, any>
  ): void {
    const timestamp = new Date().toISOString();
    const errorInfo = {
      timestamp,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      context
    };

    console.error('ErrorHandlingService:', errorInfo);
    
    // In a production environment, you might want to send this to a logging service
    // Example: analyticsService.trackError(errorInfo);
  }
}

/**
 * Default error handling service instance
 */
export const errorHandlingService = ErrorHandlingService.getInstance();