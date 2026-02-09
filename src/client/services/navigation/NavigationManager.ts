/**
 * NavigationManager Service
 * Orchestrates all navigation operations and maintains navigation state
 * 
 * Requirements: 1.2, 1.3, 1.4, 4.1, 4.3 - Navigation state management and challenge filtering
 */

import type { GameChallenge } from '../../../shared/models/challenge.types';
import type { ChallengeAttempt } from '../../../shared/models/attempt.types';
import type { 
  NavigationContext, 
  ChallengeState, 
  NavigationResult,
  NavigationEvent,
  NavigationError
} from '../../types/navigation.types';
import { ChallengeNavigator } from './ChallengeNavigator';
import { NavigationErrorHandler, type NavigationErrorContext } from './NavigationErrorHandler';

export class NavigationManager {
  private challengeNavigator: ChallengeNavigator;
  private errorHandler: NavigationErrorHandler;
  private navigationContext: NavigationContext;
  private contextStorage: Map<string, NavigationContext> = new Map();

  constructor() {
    this.challengeNavigator = new ChallengeNavigator();
    this.errorHandler = new NavigationErrorHandler();
    this.navigationContext = this.createInitialContext();
  }

  /**
   * Initialize the navigation manager with challenges and states
   */
  public initialize(
    challenges: GameChallenge[], 
    challengeStates: ChallengeState[], 
    userAttempts: ChallengeAttempt[] = [], 
    currentUserId: string = ''
  ): void {
    this.challengeNavigator.initialize(challenges, challengeStates, userAttempts, currentUserId);
    
    // Update available challenges in context
    this.navigationContext.availableChallenges = this.challengeNavigator.filterAvailableChallenges();
    
    // Set initial challenge if none is set
    if (!this.navigationContext.currentChallengeId && this.navigationContext.availableChallenges.length > 0) {
      this.navigationContext.currentChallengeId = this.navigationContext.availableChallenges[0];
    }
  }

  /**
   * Navigate to the next available challenge
   * Requirements: 1.2, 1.4 - Next challenge navigation with loop handling
   */
  public navigateToNextChallenge(): NavigationResult {
    try {
      const result = this.challengeNavigator.getNextAvailableChallenge(
        this.navigationContext.currentChallengeId
      );

      if (!result.success) {
        // Handle error with comprehensive error handling
        return this.handleNavigationError(result.error!, 'navigate_next', result);
      }

      if (result.challengeId) {
        this.updateNavigationContext({
          previousChallengeId: this.navigationContext.currentChallengeId,
          currentChallengeId: result.challengeId,
          navigationHistory: [
            ...this.navigationContext.navigationHistory,
            result.challengeId
          ].slice(-10), // Keep last 10 for memory efficiency
          sessionMetadata: {
            ...this.navigationContext.sessionMetadata,
            challengesNavigated: this.navigationContext.sessionMetadata.challengesNavigated + 1,
            isInNavigationFlow: true
          }
        });
      }

      return result;
    } catch (error) {
      console.error('Unexpected error in navigateToNextChallenge:', error);
      return this.handleNavigationError('NAVIGATION_LOOP_FAILURE', 'navigate_next');
    }
  }

  /**
   * Navigate to the previous available challenge
   */
  public navigateToPreviousChallenge(): NavigationResult {
    try {
      const result = this.challengeNavigator.getPreviousAvailableChallenge(
        this.navigationContext.currentChallengeId
      );

      if (!result.success) {
        return this.handleNavigationError(result.error!, 'navigate_previous', result);
      }

      if (result.challengeId) {
        this.updateNavigationContext({
          previousChallengeId: this.navigationContext.currentChallengeId,
          currentChallengeId: result.challengeId,
          navigationHistory: [
            ...this.navigationContext.navigationHistory,
            result.challengeId
          ].slice(-10),
          sessionMetadata: {
            ...this.navigationContext.sessionMetadata,
            challengesNavigated: this.navigationContext.sessionMetadata.challengesNavigated + 1,
            isInNavigationFlow: true
          }
        });
      }

      return result;
    } catch (error) {
      console.error('Unexpected error in navigateToPreviousChallenge:', error);
      return this.handleNavigationError('NAVIGATION_LOOP_FAILURE', 'navigate_previous');
    }
  }

  /**
   * Navigate to a specific challenge by ID
   */
  public navigateToChallenge(challengeId: string): NavigationResult {
    try {
      const validationResult = this.challengeNavigator.validateChallengeAccess(challengeId);
      
      if (!validationResult.success) {
        return this.handleNavigationError(validationResult.error!, 'navigate_to_challenge', validationResult);
      }

      this.updateNavigationContext({
        previousChallengeId: this.navigationContext.currentChallengeId,
        currentChallengeId: challengeId,
        navigationHistory: [
          ...this.navigationContext.navigationHistory,
          challengeId
        ].slice(-10),
        sessionMetadata: {
          ...this.navigationContext.sessionMetadata,
          challengesNavigated: this.navigationContext.sessionMetadata.challengesNavigated + 1,
          isInNavigationFlow: true
        }
      });

      return {
        success: true,
        challengeId
      };
    } catch (error) {
      console.error('Unexpected error in navigateToChallenge:', error);
      return this.handleNavigationError('CHALLENGE_NOT_FOUND', 'navigate_to_challenge');
    }
  }

  /**
   * Preserve navigation context during transitions
   * Requirements: 4.1 - Preserve player's overall session state
   */
  public preserveNavigationContext(): string {
    const contextId = `nav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Deep clone the context to avoid reference issues
    const preservedContext: NavigationContext = {
      ...this.navigationContext,
      navigationHistory: [...this.navigationContext.navigationHistory],
      sessionMetadata: { ...this.navigationContext.sessionMetadata },
      preservedFormData: this.navigationContext.preservedFormData 
        ? { ...this.navigationContext.preservedFormData }
        : undefined
    };

    this.contextStorage.set(contextId, preservedContext);
    
    // Clean up old contexts (keep last 5)
    const contextIds = Array.from(this.contextStorage.keys());
    if (contextIds.length > 5) {
      const oldestContexts = contextIds.slice(0, contextIds.length - 5);
      oldestContexts.forEach(id => this.contextStorage.delete(id));
    }

    return contextId;
  }

  /**
   * Restore navigation context from storage
   * Requirements: 4.2 - Restore challenge to its last known state
   */
  public restoreNavigationContext(contextId: string): NavigationResult {
    const storedContext = this.contextStorage.get(contextId);
    
    if (!storedContext) {
      return {
        success: false,
        error: 'CONTEXT_LOSS',
        errorMessage: 'Navigation context not found or expired',
        fallbackOptions: ['Continue with current state', 'Return to menu']
      };
    }

    this.navigationContext = storedContext;
    
    return {
      success: true,
      challengeId: this.navigationContext.currentChallengeId
    };
  }

  /**
   * Update challenge state and refresh available challenges
   */
  public updateChallengeState(challengeId: string, updates: Partial<ChallengeState>): void {
    this.challengeNavigator.updateChallengeState(challengeId, updates);
    
    // Refresh available challenges list
    this.navigationContext.availableChallenges = this.challengeNavigator.filterAvailableChallenges();
  }

  /**
   * Get current navigation context
   */
  public getNavigationContext(): NavigationContext {
    return { ...this.navigationContext };
  }

  /**
   * Get current challenge state
   */
  public getCurrentChallengeState(): ChallengeState | null {
    return this.challengeNavigator.getChallengeState(this.navigationContext.currentChallengeId);
  }

  /**
   * Check if navigation is possible (has available challenges)
   * Requirements: 1.5 - Handle empty challenge list scenario
   */
  public canNavigate(): boolean {
    return this.challengeNavigator.hasAvailableChallenges();
  }

  /**
   * Get available challenge count for UI feedback
   */
  public getAvailableChallengeCount(): number {
    return this.challengeNavigator.getAvailableChallengeCount();
  }

  /**
   * Handle navigation events
   */
  public handleNavigationEvent(event: NavigationEvent): NavigationResult {
    switch (event.type) {
      case 'NAVIGATE_TO_CHALLENGE':
        return this.navigateToChallenge(event.challengeId);
        
      case 'NAVIGATE_NEXT':
        return this.navigateToNextChallenge();
        
      case 'NAVIGATE_PREVIOUS':
        return this.navigateToPreviousChallenge();
        
      case 'UPDATE_CHALLENGE_STATE':
        this.updateChallengeState(event.challengeId, event.state);
        return { success: true };
        
      case 'PRESERVE_CONTEXT':
        const contextId = this.preserveNavigationContext();
        if (event.context) {
          this.updateNavigationContext(event.context);
        }
        return { success: true, challengeId: contextId };
        
      case 'RESTORE_CONTEXT':
        return this.restoreNavigationContext(event.contextId);
        
      default:
        return {
          success: false,
          error: 'INVALID_ENTRY_POINT',
          errorMessage: 'Unknown navigation event type',
          fallbackOptions: ['Try again', 'Return to menu']
        };
    }
  }

  /**
   * Reset navigation state (useful for logout or fresh start)
   */
  public resetNavigationState(): void {
    this.navigationContext = this.createInitialContext();
    this.challengeNavigator.resetChallengeStates();
    this.contextStorage.clear();
  }

  /**
   * Preserve form data during navigation
   * Requirements: 2.5 - Preserve form data during guide interactions
   */
  public preserveFormData(formData: Record<string, any>): void {
    this.navigationContext.preservedFormData = { ...formData };
  }

  /**
   * Restore preserved form data
   */
  public getPreservedFormData(): Record<string, any> | undefined {
    return this.navigationContext.preservedFormData 
      ? { ...this.navigationContext.preservedFormData }
      : undefined;
  }

  /**
   * Clear preserved form data
   */
  public clearPreservedFormData(): void {
    this.navigationContext.preservedFormData = undefined;
  }

  /**
   * Handle navigation errors with comprehensive error handling and user feedback
   * Requirements: 4.5 - Clear error messaging and fallback options
   */
  private handleNavigationError(
    error: NavigationError,
    userAction: string,
    originalResult?: NavigationResult
  ): NavigationResult {
    const errorContext: NavigationErrorContext = {
      navigationContext: this.getNavigationContext(),
      challengeState: this.getCurrentChallengeState() || undefined,
      userAction,
      timestamp: new Date(),
      metadata: {
        availableChallengeCount: this.getAvailableChallengeCount(),
        canNavigate: this.canNavigate(),
        sessionMetadata: this.navigationContext.sessionMetadata
      }
    };

    return this.errorHandler.handleNavigationError(error, errorContext, originalResult);
  }

  /**
   * Get error statistics for monitoring
   */
  public getErrorStatistics() {
    return this.errorHandler.getErrorStatistics();
  }

  /**
   * Create initial navigation context
   */
  private createInitialContext(): NavigationContext {
    return {
      currentChallengeId: '',
      availableChallenges: [],
      navigationHistory: [],
      sessionMetadata: {
        sessionStartTime: new Date(),
        challengesNavigated: 0,
        isInNavigationFlow: false
      }
    };
  }

  /**
   * Update navigation context with partial updates
   */
  private updateNavigationContext(updates: Partial<NavigationContext>): void {
    this.navigationContext = {
      ...this.navigationContext,
      ...updates
    };
  }
}