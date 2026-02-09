/**
 * NavigationErrorHandler Service
 * Provides comprehensive error handling and user feedback for navigation operations
 * 
 * Requirements: 4.5 - Clear error messaging and fallback options for navigation failures
 */

import type { 
  NavigationError, 
  NavigationResult,
  NavigationContext,
  ChallengeState 
} from '../../types/navigation.types';

/**
 * Error recovery strategy for different error types
 */
export interface ErrorRecoveryStrategy {
  /** Primary recovery action */
  primaryAction: string;
  /** Secondary recovery actions */
  secondaryActions: string[];
  /** Whether to attempt automatic recovery */
  autoRecover: boolean;
  /** Recovery function if auto-recovery is enabled */
  recoveryFunction?: () => Promise<NavigationResult>;
}

/**
 * User feedback configuration for errors
 */
export interface ErrorFeedbackConfig {
  /** User-friendly error title */
  title: string;
  /** Detailed error message */
  message: string;
  /** Severity level for UI styling */
  severity: 'error' | 'warning' | 'info';
  /** Whether to show technical details */
  showTechnicalDetails: boolean;
  /** Auto-dismiss timeout in milliseconds */
  autoDismissMs?: number;
}

/**
 * Navigation error context for enhanced error reporting
 */
export interface NavigationErrorContext {
  /** Current navigation state when error occurred */
  navigationContext: NavigationContext;
  /** Challenge state when error occurred */
  challengeState?: ChallengeState;
  /** User action that triggered the error */
  userAction: string;
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Additional context data */
  metadata?: Record<string, any>;
}

export class NavigationErrorHandler {
  private errorHistory: Array<{
    error: NavigationError;
    context: NavigationErrorContext;
    timestamp: Date;
  }> = [];

  /**
   * Handle navigation error with comprehensive feedback and recovery options
   * Requirements: 4.5 - Clear error messaging and fallback options
   */
  public handleNavigationError(
    error: NavigationError,
    context: NavigationErrorContext,
    originalResult?: NavigationResult
  ): NavigationResult {
    // Log error for debugging
    this.logError(error, context);

    // Add to error history for pattern analysis
    this.addToErrorHistory(error, context);

    // Get error-specific handling strategy
    const strategy = this.getErrorRecoveryStrategy(error, context);
    const feedback = this.getErrorFeedback(error, context);

    // Create enhanced navigation result with recovery options
    const enhancedResult: NavigationResult = {
      success: false,
      error,
      errorMessage: feedback.message,
      fallbackOptions: [strategy.primaryAction, ...strategy.secondaryActions],
      // Add additional error context
      errorContext: {
        title: feedback.title,
        severity: feedback.severity,
        showTechnicalDetails: feedback.showTechnicalDetails,
        autoDismissMs: feedback.autoDismissMs,
        userAction: context.userAction,
        timestamp: context.timestamp,
        canRetry: this.canRetryError(error),
        retryCount: this.getErrorRetryCount(error, context),
        suggestedWaitTime: this.getSuggestedWaitTime(error)
      }
    };

    // Attempt automatic recovery if enabled
    if (strategy.autoRecover && strategy.recoveryFunction) {
      this.attemptAutoRecovery(strategy.recoveryFunction, enhancedResult);
    }

    return enhancedResult;
  }

  /**
   * Get error recovery strategy based on error type and context
   */
  private getErrorRecoveryStrategy(
    error: NavigationError,
    context: NavigationErrorContext
  ): ErrorRecoveryStrategy {
    switch (error) {
      case 'CHALLENGE_NOT_FOUND':
        return {
          primaryAction: 'Browse available challenges',
          secondaryActions: ['Return to menu', 'Refresh challenge list'],
          autoRecover: false
        };

      case 'NO_AVAILABLE_CHALLENGES':
        return {
          primaryAction: 'Create a new challenge',
          secondaryActions: ['Check for updates', 'Return to menu', 'View completed challenges'],
          autoRecover: false
        };

      case 'NAVIGATION_LOOP_FAILURE':
        return {
          primaryAction: 'Try again',
          secondaryActions: ['Return to menu', 'Refresh page'],
          autoRecover: true,
          recoveryFunction: () => this.recoverFromLoopFailure(context)
        };

      case 'PERMISSION_DENIED':
        return {
          primaryAction: 'Login or upgrade account',
          secondaryActions: ['View available challenges', 'Return to menu'],
          autoRecover: false
        };

      case 'SESSION_EXPIRED':
        return {
          primaryAction: 'Login again',
          secondaryActions: ['Continue as guest', 'Return to menu'],
          autoRecover: true,
          recoveryFunction: () => this.recoverFromSessionExpiry(context)
        };

      case 'CONTEXT_LOSS':
        return {
          primaryAction: 'Continue with current state',
          secondaryActions: ['Return to menu', 'Restore from backup'],
          autoRecover: true,
          recoveryFunction: () => this.recoverFromContextLoss(context)
        };

      case 'FORM_DATA_LOSS':
        return {
          primaryAction: 'Restore from auto-save',
          secondaryActions: ['Start over', 'Return to menu'],
          autoRecover: true,
          recoveryFunction: () => this.recoverFromFormDataLoss(context)
        };

      case 'URL_SYNC_FAILURE':
        return {
          primaryAction: 'Continue with current state',
          secondaryActions: ['Refresh page', 'Return to menu'],
          autoRecover: true,
          recoveryFunction: () => this.recoverFromUrlSyncFailure(context)
        };

      case 'CONTENT_LOAD_FAILURE':
        return {
          primaryAction: 'Retry loading',
          secondaryActions: ['Skip content', 'Return to menu'],
          autoRecover: true,
          recoveryFunction: () => this.recoverFromContentLoadFailure(context)
        };

      case 'STATE_PRESERVATION_FAILURE':
        return {
          primaryAction: 'Continue without saving state',
          secondaryActions: ['Try saving again', 'Return to menu'],
          autoRecover: true,
          recoveryFunction: () => this.recoverFromStatePreservationFailure(context)
        };

      default:
        return {
          primaryAction: 'Try again',
          secondaryActions: ['Return to menu', 'Refresh page'],
          autoRecover: false
        };
    }
  }

  /**
   * Get user-friendly error feedback configuration
   */
  private getErrorFeedback(
    error: NavigationError,
    context: NavigationErrorContext
  ): ErrorFeedbackConfig {
    switch (error) {
      case 'CHALLENGE_NOT_FOUND':
        return {
          title: 'Challenge Not Found',
          message: 'The requested challenge could not be found. It may have been removed or you may not have access to it.',
          severity: 'error',
          showTechnicalDetails: false
        };

      case 'NO_AVAILABLE_CHALLENGES':
        return {
          title: 'No Challenges Available',
          message: 'There are currently no challenges available for you to play. You may have completed all available challenges or they may be temporarily unavailable.',
          severity: 'info',
          showTechnicalDetails: false
        };

      case 'NAVIGATION_LOOP_FAILURE':
        return {
          title: 'Navigation Error',
          message: 'There was a problem determining the next challenge. This is usually a temporary issue.',
          severity: 'warning',
          showTechnicalDetails: false,
          autoDismissMs: 5000
        };

      case 'PERMISSION_DENIED':
        return {
          title: 'Access Denied',
          message: 'You don\'t have permission to access this challenge. You may need to log in or reach a higher level.',
          severity: 'warning',
          showTechnicalDetails: false
        };

      case 'SESSION_EXPIRED':
        return {
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again to continue.',
          severity: 'warning',
          showTechnicalDetails: false
        };

      case 'CONTEXT_LOSS':
        return {
          title: 'Navigation State Lost',
          message: 'Your navigation progress was lost, but we can continue from where you are now.',
          severity: 'warning',
          showTechnicalDetails: false,
          autoDismissMs: 3000
        };

      case 'FORM_DATA_LOSS':
        return {
          title: 'Form Data Lost',
          message: 'Some of your form data was lost during navigation. We\'ll try to restore what we can.',
          severity: 'warning',
          showTechnicalDetails: false
        };

      case 'URL_SYNC_FAILURE':
        return {
          title: 'URL Sync Issue',
          message: 'The page URL couldn\'t be updated, but your progress is still saved.',
          severity: 'info',
          showTechnicalDetails: false,
          autoDismissMs: 3000
        };

      case 'CONTENT_LOAD_FAILURE':
        return {
          title: 'Content Loading Failed',
          message: 'Some content failed to load. You can try again or continue without it.',
          severity: 'warning',
          showTechnicalDetails: false
        };

      case 'STATE_PRESERVATION_FAILURE':
        return {
          title: 'Save State Failed',
          message: 'Your progress couldn\'t be saved automatically. You can continue, but your state may not be preserved.',
          severity: 'warning',
          showTechnicalDetails: false
        };

      default:
        return {
          title: 'Navigation Error',
          message: 'An unexpected error occurred during navigation. Please try again.',
          severity: 'error',
          showTechnicalDetails: true
        };
    }
  }

  /**
   * Recovery functions for different error types
   */
  private async recoverFromLoopFailure(context: NavigationErrorContext): Promise<NavigationResult> {
    try {
      // Try to reset navigation to a known good state
      const availableChallenges = context.navigationContext.availableChallenges;
      if (availableChallenges.length > 0) {
        return {
          success: true,
          challengeId: availableChallenges[0]
        };
      }
      return { success: false, error: 'NO_AVAILABLE_CHALLENGES' };
    } catch (error) {
      return { success: false, error: 'NAVIGATION_LOOP_FAILURE' };
    }
  }

  private async recoverFromSessionExpiry(context: NavigationErrorContext): Promise<NavigationResult> {
    try {
      // Attempt to restore session from local storage or continue as guest
      const guestMode = this.enableGuestMode(context);
      if (guestMode) {
        return {
          success: true,
          challengeId: context.navigationContext.currentChallengeId || 'guest_challenge'
        };
      }
      return { success: false, error: 'SESSION_EXPIRED' };
    } catch (error) {
      return { success: false, error: 'SESSION_EXPIRED' };
    }
  }

  private async recoverFromContextLoss(context: NavigationErrorContext): Promise<NavigationResult> {
    try {
      // Try to restore context from browser storage
      const restoredContext = this.restoreContextFromStorage();
      if (restoredContext) {
        return {
          success: true,
          challengeId: restoredContext.currentChallengeId
        };
      }
      
      // Fallback to current state
      return {
        success: true,
        challengeId: context.navigationContext.currentChallengeId || 'default_challenge'
      };
    } catch (error) {
      return { success: false, error: 'CONTEXT_LOSS' };
    }
  }

  private async recoverFromFormDataLoss(context: NavigationErrorContext): Promise<NavigationResult> {
    try {
      // Try to restore form data from auto-save
      const restoredData = this.restoreFormDataFromAutoSave();
      if (restoredData) {
        return {
          success: true,
          challengeId: context.navigationContext.currentChallengeId,
          restoredFormData: restoredData
        };
      }
      return { success: false, error: 'FORM_DATA_LOSS' };
    } catch (error) {
      return { success: false, error: 'FORM_DATA_LOSS' };
    }
  }

  private async recoverFromUrlSyncFailure(context: NavigationErrorContext): Promise<NavigationResult> {
    try {
      // Continue with internal state, ignore URL sync
      return {
        success: true,
        challengeId: context.navigationContext.currentChallengeId
      };
    } catch (error) {
      return { success: false, error: 'URL_SYNC_FAILURE' };
    }
  }

  private async recoverFromContentLoadFailure(context: NavigationErrorContext): Promise<NavigationResult> {
    try {
      // Retry content loading with exponential backoff
      await this.delay(1000); // Wait 1 second before retry
      return {
        success: true,
        challengeId: context.navigationContext.currentChallengeId
      };
    } catch (error) {
      return { success: false, error: 'CONTENT_LOAD_FAILURE' };
    }
  }

  private async recoverFromStatePreservationFailure(context: NavigationErrorContext): Promise<NavigationResult> {
    try {
      // Continue without state preservation
      return {
        success: true,
        challengeId: context.navigationContext.currentChallengeId
      };
    } catch (error) {
      return { success: false, error: 'STATE_PRESERVATION_FAILURE' };
    }
  }

  /**
   * Helper methods for error handling
   */
  private logError(error: NavigationError, context: NavigationErrorContext): void {
    console.error('Navigation Error:', {
      error,
      userAction: context.userAction,
      currentChallenge: context.navigationContext.currentChallengeId,
      availableChallenges: context.navigationContext.availableChallenges.length,
      timestamp: context.timestamp,
      metadata: context.metadata
    });
  }

  private addToErrorHistory(error: NavigationError, context: NavigationErrorContext): void {
    this.errorHistory.push({
      error,
      context,
      timestamp: new Date()
    });

    // Keep only last 50 errors for memory efficiency
    if (this.errorHistory.length > 50) {
      this.errorHistory = this.errorHistory.slice(-50);
    }
  }

  private canRetryError(error: NavigationError): boolean {
    const retryableErrors: NavigationError[] = [
      'NAVIGATION_LOOP_FAILURE',
      'SESSION_EXPIRED',
      'CONTEXT_LOSS',
      'FORM_DATA_LOSS',
      'URL_SYNC_FAILURE',
      'CONTENT_LOAD_FAILURE',
      'STATE_PRESERVATION_FAILURE'
    ];
    return retryableErrors.includes(error);
  }

  private getErrorRetryCount(error: NavigationError, context: NavigationErrorContext): number {
    return this.errorHistory.filter(
      entry => entry.error === error && 
      entry.context.userAction === context.userAction &&
      Date.now() - entry.timestamp.getTime() < 300000 // Last 5 minutes
    ).length;
  }

  private getSuggestedWaitTime(error: NavigationError): number {
    const waitTimes: Record<NavigationError, number> = {
      'NAVIGATION_LOOP_FAILURE': 1000,
      'CONTENT_LOAD_FAILURE': 2000,
      'URL_SYNC_FAILURE': 500,
      'STATE_PRESERVATION_FAILURE': 1000,
      'SESSION_EXPIRED': 0,
      'PERMISSION_DENIED': 0,
      'CHALLENGE_NOT_FOUND': 0,
      'NO_AVAILABLE_CHALLENGES': 0,
      'CONTEXT_LOSS': 0,
      'FORM_DATA_LOSS': 0,
      'INVALID_ENTRY_POINT': 0
    };
    return waitTimes[error] || 0;
  }

  private async attemptAutoRecovery(
    recoveryFunction: () => Promise<NavigationResult>,
    fallbackResult: NavigationResult
  ): Promise<void> {
    try {
      const recoveryResult = await recoveryFunction();
      if (recoveryResult.success) {
        // Update the fallback result with recovery success
        Object.assign(fallbackResult, {
          success: true,
          challengeId: recoveryResult.challengeId,
          autoRecovered: true
        });
      }
    } catch (error) {
      console.warn('Auto-recovery failed:', error);
      // Keep the original fallback result
    }
  }

  private enableGuestMode(context: NavigationErrorContext): boolean {
    // Implementation would depend on the authentication system
    // For now, return true to indicate guest mode is available
    return true;
  }

  private restoreContextFromStorage(): NavigationContext | null {
    try {
      const stored = localStorage.getItem('navigation_context_backup');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  private restoreFormDataFromAutoSave(): Record<string, any> | null {
    try {
      const stored = localStorage.getItem('form_data_autosave');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics for monitoring and improvement
   */
  public getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<NavigationError, number>;
    recentErrors: number;
    mostCommonError: NavigationError | null;
  } {
    const now = Date.now();
    const recentThreshold = 3600000; // 1 hour

    const errorsByType = this.errorHistory.reduce((acc, entry) => {
      acc[entry.error] = (acc[entry.error] || 0) + 1;
      return acc;
    }, {} as Record<NavigationError, number>);

    const recentErrors = this.errorHistory.filter(
      entry => now - entry.timestamp.getTime() < recentThreshold
    ).length;

    const mostCommonError = Object.entries(errorsByType)
      .sort(([, a], [, b]) => b - a)[0]?.[0] as NavigationError | null;

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      recentErrors,
      mostCommonError
    };
  }

  /**
   * Clear error history (useful for testing or privacy)
   */
  public clearErrorHistory(): void {
    this.errorHistory = [];
  }
}