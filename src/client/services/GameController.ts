/**
 * GameController Service
 * Main game controller that wires together NavigationManager, AccessControlManager, and UIStateManager
 * 
 * Requirements: 1.1, 1.2, 2.1, 3.3 - Integration of all navigation and access control components
 */

import type { GameChallenge } from '../../shared/models/challenge.types';
import type { AnyUserProfile } from '../../shared/models/user.types';
import type { ChallengeAttempt } from '../../shared/models/attempt.types';
import type { 
  NavigationContext, 
  ChallengeState, 
  NavigationResult,
  NavigationEvent,
  GuideState,
  UserPermissions
} from '../types/navigation.types';

import { NavigationManager } from './navigation/NavigationManager';
import { AccessControlManager, type AccessControlResult, type AccessEntryPoint } from './AccessControlManager';
import { UIStateManager, type UIContext } from './UIStateManager';
import { userAuthService } from './user-auth.service';

/**
 * Game controller configuration
 */
interface GameControllerConfig {
  /** Whether to enable automatic state persistence */
  enableStatePersistence: boolean;
  
  /** Whether to enable automatic URL synchronization */
  enableURLSync: boolean;
  
  /** Whether to enable debug logging */
  enableDebugLogging: boolean;
  
  /** Maximum number of contexts to keep in memory */
  maxContexts: number;
}

/**
 * Game controller event handlers
 */
interface GameControllerEventHandlers {
  /** Called when navigation occurs */
  onNavigationChange?: (challengeId: string, previousChallengeId?: string) => void;
  
  /** Called when access is denied */
  onAccessDenied?: (result: AccessControlResult, entryPoint: AccessEntryPoint) => void;
  
  /** Called when an error occurs */
  onError?: (error: Error, context?: any) => void;
  
  /** Called when state is preserved */
  onStatePreserved?: (contextId: string) => void;
  
  /** Called when state is restored */
  onStateRestored?: (contextId: string, success: boolean) => void;
}

/**
 * Main GameController class that orchestrates all game functionality
 */
export class GameController {
  private navigationManager: NavigationManager;
  private accessControlManager: AccessControlManager;
  private uiStateManager: UIStateManager;
  private config: GameControllerConfig;
  private eventHandlers: GameControllerEventHandlers;
  private initialized: boolean = false;

  constructor(
    config?: Partial<GameControllerConfig>,
    eventHandlers?: GameControllerEventHandlers
  ) {
    this.config = {
      enableStatePersistence: true,
      enableURLSync: true,
      enableDebugLogging: false,
      maxContexts: 10,
      ...config
    };
    
    this.eventHandlers = eventHandlers || {};
    
    // Initialize services
    this.navigationManager = new NavigationManager();
    this.accessControlManager = new AccessControlManager();
    this.uiStateManager = new UIStateManager();
    
    this.log('GameController initialized with config:', this.config);
  }

  /**
   * Initialize the game controller with challenges and user data
   * Requirements: 1.1, 1.2 - Integration of NavigationManager with challenge data
   */
  public async initialize(
    challenges: GameChallenge[], 
    user: AnyUserProfile,
    initialChallengeId?: string
  ): Promise<void> {
    try {
      this.log('Initializing GameController with', challenges.length, 'challenges');
      
      // Get user ID for filtering
      const userId = user.user_id || user.id;
      
      // Fetch user attempts to properly filter challenges
      let userAttempts: ChallengeAttempt[] = [];
      try {
        const attemptsResponse = await fetch('/api/attempts/user');
        if (attemptsResponse.ok) {
          userAttempts = await attemptsResponse.json();
        }
      } catch (error) {
        this.log('Failed to fetch user attempts, continuing without filtering:', error);
      }
      
      // Create challenge states from user's attempts
      const challengeStates = await this.createChallengeStates(challenges, user);
      
      // Initialize NavigationManager with user attempts and user ID for proper filtering
      this.navigationManager.initialize(challenges, challengeStates, userAttempts, userId);
      
      // Set initial challenge if provided
      if (initialChallengeId) {
        const result = this.navigationManager.navigateToChallenge(initialChallengeId);
        if (result.success) {
          this.updateURL(initialChallengeId);
        }
      }
      
      // Set up page refresh persistence if enabled
      if (this.config.enableStatePersistence) {
        this.uiStateManager.setupPageRefreshPersistence();
        
        // Try to recover from page refresh
        const recovery = this.uiStateManager.initializePageRefreshRecovery();
        if (recovery.recovered && recovery.challengeId) {
          this.log('Recovered from page refresh:', recovery.message);
          this.navigationManager.navigateToChallenge(recovery.challengeId);
          
          if (this.eventHandlers.onStateRestored) {
            this.eventHandlers.onStateRestored(recovery.challengeId, true);
          }
        }
      }
      
      this.initialized = true;
      this.log('GameController initialization complete');
      
    } catch (error) {
      this.log('Error initializing GameController:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { phase: 'initialization' });
      }
      throw error;
    }
  }

  /**
   * Navigate to the next available challenge
   * Requirements: 1.2, 1.3, 1.4 - Next challenge navigation with filtering and loop handling
   */
  public async navigateToNextChallenge(): Promise<NavigationResult> {
    this.ensureInitialized();
    
    try {
      // Preserve current state before navigation
      const contextId = this.preserveNavigationState();
      
      // Use NavigationManager to get next challenge
      const result = this.navigationManager.navigateToNextChallenge();
      
      if (result.success && result.challengeId) {
        // Update URL if sync is enabled
        if (this.config.enableURLSync) {
          this.updateURL(result.challengeId);
        }
        
        // Update current challenge ID for page refresh recovery
        if (this.config.enableStatePersistence) {
          this.uiStateManager.setCurrentChallengeId(result.challengeId);
        }
        
        // Notify event handlers
        if (this.eventHandlers.onNavigationChange) {
          const context = this.navigationManager.getNavigationContext();
          this.eventHandlers.onNavigationChange(
            result.challengeId, 
            context.previousChallengeId
          );
        }
        
        this.log('Successfully navigated to next challenge:', result.challengeId);
      } else {
        this.log('Navigation to next challenge failed:', result.errorMessage);
      }
      
      return result;
    } catch (error) {
      this.log('Error navigating to next challenge:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'navigateToNextChallenge' });
      }
      
      return {
        success: false,
        error: 'NAVIGATION_LOOP_FAILURE',
        errorMessage: 'Failed to navigate to next challenge',
        fallbackOptions: ['Try again', 'Return to menu']
      };
    }
  }

  /**
   * Navigate to a specific challenge
   */
  public async navigateToChallenge(challengeId: string): Promise<NavigationResult> {
    this.ensureInitialized();
    
    try {
      // Preserve current state before navigation
      const contextId = this.preserveNavigationState();
      
      // Use NavigationManager to navigate
      const result = this.navigationManager.navigateToChallenge(challengeId);
      
      if (result.success) {
        // Update URL if sync is enabled
        if (this.config.enableURLSync) {
          this.updateURL(challengeId);
        }
        
        // Update current challenge ID for page refresh recovery
        if (this.config.enableStatePersistence) {
          this.uiStateManager.setCurrentChallengeId(challengeId);
        }
        
        // Notify event handlers
        if (this.eventHandlers.onNavigationChange) {
          const context = this.navigationManager.getNavigationContext();
          this.eventHandlers.onNavigationChange(
            challengeId, 
            context.previousChallengeId
          );
        }
        
        this.log('Successfully navigated to challenge:', challengeId);
      }
      
      return result;
    } catch (error) {
      this.log('Error navigating to challenge:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'navigateToChallenge', challengeId });
      }
      
      return {
        success: false,
        error: 'CHALLENGE_NOT_FOUND',
        errorMessage: 'Failed to navigate to challenge',
        fallbackOptions: ['Try again', 'Return to menu']
      };
    }
  }

  /**
   * Validate create access for a user
   * Requirements: 3.1, 3.2, 3.3 - Consistent access control across all entry points
   */
  public async validateCreateAccess(
    entryPoint: AccessEntryPoint = 'direct_link'
  ): Promise<AccessControlResult> {
    try {
      const user = await userAuthService.getCurrentUser();
      const result = this.accessControlManager.validateCreateAccess(user, entryPoint);
      
      if (!result.granted && this.eventHandlers.onAccessDenied) {
        this.eventHandlers.onAccessDenied(result, entryPoint);
      }
      
      this.log('Access validation result:', result.granted ? 'granted' : 'denied', 'for', entryPoint);
      
      return result;
    } catch (error) {
      this.log('Error validating create access:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'validateCreateAccess', entryPoint });
      }
      
      return {
        granted: false,
        reason: 'PERMISSION_DENIED',
        message: 'Failed to validate access permissions',
        suggestedActions: ['Try again', 'Return to menu'],
        redirect: {
          targetView: 'menu',
          delay: 2000,
          showMessageBeforeRedirect: true
        }
      };
    }
  }

  /**
   * Handle access control failure with appropriate error messaging and redirects
   * Requirements: 3.6 - Clear error messaging and appropriate redirects for unauthorized users
   */
  public async handleAccessFailure(
    entryPoint: AccessEntryPoint,
    onRedirect?: (targetView: 'menu' | 'login' | 'profile') => void,
    onError?: (error: string) => void
  ): Promise<AccessControlResult> {
    try {
      const user = await userAuthService.getCurrentUser();
      
      return this.accessControlManager.handleAccessFailure(
        user,
        entryPoint,
        onRedirect,
        onError
      );
    } catch (error) {
      this.log('Error handling access failure:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'handleAccessFailure', entryPoint });
      }
      
      // Fallback error handling
      if (onError) {
        onError('Access validation failed. Please try again.');
      }
      
      if (onRedirect) {
        setTimeout(() => onRedirect('menu'), 1000);
      }
      
      return {
        granted: false,
        reason: 'PERMISSION_DENIED',
        message: 'Access validation failed. Please try again.',
        suggestedActions: ['Return to menu', 'Try again later'],
        redirect: {
          targetView: 'menu',
          delay: 1000,
          showMessageBeforeRedirect: true
        }
      };
    }
  }

  /**
   * Expand creator guide with state preservation
   * Requirements: 2.1, 2.2, 2.3 - Guide expansion without page refresh and state preservation
   */
  public expandCreatorGuide(
    source: GuideState['expansionSource'] = 'direct_link',
    preserveFormData?: Record<string, any>
  ): string {
    try {
      // Preserve current form data and UI state
      const contextId = this.uiStateManager.preserveFormData('create', preserveFormData);
      
      // Create guide state
      const guideState: GuideState = {
        isExpanded: true,
        contentLoaded: false,
        preservedCreateFormData: preserveFormData,
        expansionSource: source,
        lastExpanded: new Date()
      };
      
      // Preserve guide state
      this.uiStateManager.preserveGuideState('creator_guide', guideState);
      
      this.log('Creator guide expanded from:', source);
      
      return contextId;
    } catch (error) {
      this.log('Error expanding creator guide:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'expandCreatorGuide', source });
      }
      throw error;
    }
  }

  /**
   * Collapse creator guide and restore state
   * Requirements: 2.4 - Guide collapse functionality
   */
  public collapseCreatorGuide(): boolean {
    try {
      // Update guide state
      this.uiStateManager.updateGuideState('creator_guide', {
        isExpanded: false,
        contentLoaded: false
      });
      
      // Restore preserved form data if available
      const guideState = this.uiStateManager.restoreGuideState('creator_guide');
      if (guideState?.preservedCreateFormData) {
        // Form data restoration would be handled by the UI component
        this.log('Form data available for restoration after guide collapse');
      }
      
      this.log('Creator guide collapsed');
      return true;
    } catch (error) {
      this.log('Error collapsing creator guide:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'collapseCreatorGuide' });
      }
      return false;
    }
  }

  /**
   * Update challenge state and refresh navigation
   */
  public updateChallengeState(challengeId: string, updates: Partial<ChallengeState>): void {
    try {
      this.navigationManager.updateChallengeState(challengeId, updates);
      this.log('Challenge state updated for:', challengeId, updates);
    } catch (error) {
      this.log('Error updating challenge state:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'updateChallengeState', challengeId });
      }
    }
  }

  /**
   * Get current navigation context
   */
  public getNavigationContext(): NavigationContext {
    this.ensureInitialized();
    return this.navigationManager.getNavigationContext();
  }

  /**
   * Get current challenge state
   */
  public getCurrentChallengeState(): ChallengeState | null {
    this.ensureInitialized();
    return this.navigationManager.getCurrentChallengeState();
  }

  /**
   * Check if navigation is possible
   * Requirements: 1.5 - Handle empty challenge list scenario
   */
  public canNavigate(): boolean {
    if (!this.initialized) return false;
    return this.navigationManager.canNavigate();
  }

  /**
   * Get available challenge count
   */
  public getAvailableChallengeCount(): number {
    if (!this.initialized) return 0;
    return this.navigationManager.getAvailableChallengeCount();
  }

  /**
   * Get user permissions for current user
   */
  public async getUserPermissions(): Promise<UserPermissions> {
    try {
      const user = await userAuthService.getCurrentUser();
      return this.accessControlManager.getUserPermissions(user);
    } catch (error) {
      this.log('Error getting user permissions:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'getUserPermissions' });
      }
      
      // Return default permissions on error
      return {
        userId: 'unknown',
        level: 0,
        isGuest: true,
        canCreateChallenges: false,
        accessRestrictions: ['PERMISSION_DENIED']
      };
    }
  }

  /**
   * Handle navigation events
   */
  public handleNavigationEvent(event: NavigationEvent): NavigationResult {
    this.ensureInitialized();
    
    try {
      const result = this.navigationManager.handleNavigationEvent(event);
      
      // Handle URL sync for successful navigation events
      if (result.success && this.config.enableURLSync) {
        if (event.type === 'NAVIGATE_TO_CHALLENGE' || 
            event.type === 'NAVIGATE_NEXT' || 
            event.type === 'NAVIGATE_PREVIOUS') {
          if (result.challengeId) {
            this.updateURL(result.challengeId);
          }
        }
      }
      
      return result;
    } catch (error) {
      this.log('Error handling navigation event:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'handleNavigationEvent', event });
      }
      
      return {
        success: false,
        error: 'INVALID_ENTRY_POINT',
        errorMessage: 'Failed to handle navigation event',
        fallbackOptions: ['Try again', 'Return to menu']
      };
    }
  }

  /**
   * Comprehensive integration check and synchronization
   * Requirements: 1.1, 1.2, 2.1, 3.3 - Integration of all navigation and access control components
   */
  public async performIntegrationSync(): Promise<{
    success: boolean;
    components: {
      navigationManager: boolean;
      accessControlManager: boolean;
      uiStateManager: boolean;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    const componentStatus = {
      navigationManager: false,
      accessControlManager: false,
      uiStateManager: false
    };

    try {
      // Test NavigationManager integration
      try {
        const context = this.navigationManager.getNavigationContext();
        const canNav = this.navigationManager.canNavigate();
        componentStatus.navigationManager = true;
        this.log('NavigationManager integration: OK');
      } catch (error) {
        errors.push(`NavigationManager: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.log('NavigationManager integration: FAILED', error);
      }

      // Test AccessControlManager integration
      try {
        const user = await userAuthService.getCurrentUser();
        const permissions = this.accessControlManager.getUserPermissions(user);
        componentStatus.accessControlManager = true;
        this.log('AccessControlManager integration: OK');
      } catch (error) {
        errors.push(`AccessControlManager: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.log('AccessControlManager integration: FAILED', error);
      }

      // Test UIStateManager integration
      try {
        // Test basic state operations
        const testContextId = this.uiStateManager.preserveFormData('integration_test', { test: 'data' });
        const restored = this.uiStateManager.restoreUserContext(testContextId);
        
        // Test guide state operations
        const testGuideState: GuideState = {
          isExpanded: false,
          contentLoaded: false,
          expansionSource: 'direct_link'
        };
        this.uiStateManager.preserveGuideState('integration_test', testGuideState);
        const restoredGuide = this.uiStateManager.restoreGuideState('integration_test');
        
        componentStatus.uiStateManager = true;
        this.log('UIStateManager integration: OK');
      } catch (error) {
        errors.push(`UIStateManager: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.log('UIStateManager integration: FAILED', error);
      }

      // Test cross-component integration
      if (componentStatus.navigationManager && componentStatus.accessControlManager) {
        try {
          // Test navigation with access control
          const user = await userAuthService.getCurrentUser();
          const accessResult = this.accessControlManager.validateCreateAccess(user, 'integration_test' as AccessEntryPoint);
          this.log('Cross-component integration: Navigation + Access Control: OK');
        } catch (error) {
          errors.push(`Cross-component integration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (componentStatus.navigationManager && componentStatus.uiStateManager) {
        try {
          // Test navigation with state preservation
          const contextId = this.preserveNavigationState();
          this.log('Cross-component integration: Navigation + State Management: OK');
        } catch (error) {
          errors.push(`Cross-component state integration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const success = Object.values(componentStatus).every(status => status) && errors.length === 0;
      
      if (success) {
        this.log('Integration sync completed successfully');
      } else {
        this.log('Integration sync completed with errors:', errors);
      }

      return {
        success,
        components: componentStatus,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown integration error';
      errors.push(`Integration sync failed: ${errorMessage}`);
      
      return {
        success: false,
        components: componentStatus,
        errors
      };
    }
  }

  /**
   * Reset all state (useful for logout or fresh start)
   */
  public reset(): void {
    try {
      this.navigationManager.resetNavigationState();
      this.uiStateManager.clearAllContexts();
      this.initialized = false;
      this.log('GameController reset complete');
    } catch (error) {
      this.log('Error resetting GameController:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'reset' });
      }
    }
  }

  /**
   * Get integration helpers for UI components
   * Requirements: 4.1, 4.2 - Session state and challenge state preservation
   */
  public getUIIntegration() {
    return {
      // Navigation integration
      navigation: {
        navigateToNext: () => this.navigateToNextChallenge(),
        navigateToChallenge: (id: string) => this.navigateToChallenge(id),
        canNavigate: () => this.canNavigate(),
        getAvailableCount: () => this.getAvailableChallengeCount(),
        getCurrentContext: () => this.getNavigationContext(),
        getCurrentState: () => this.getCurrentChallengeState(),
        handleNavigationEvent: (event: NavigationEvent) => this.handleNavigationEvent(event)
      },
      
      // Access control integration
      accessControl: {
        validateCreateAccess: (entryPoint?: AccessEntryPoint) => this.validateCreateAccess(entryPoint),
        handleAccessFailure: (entryPoint: AccessEntryPoint, onRedirect?: any, onError?: any) => 
          this.handleAccessFailure(entryPoint, onRedirect, onError),
        getUserPermissions: () => this.getUserPermissions()
      },
      
      // Guide integration
      guide: {
        expand: (source?: GuideState['expansionSource'], formData?: Record<string, any>) => 
          this.expandCreatorGuide(source, formData),
        collapse: () => this.collapseCreatorGuide(),
        getState: () => this.uiStateManager.restoreGuideState('creator_guide')
      },
      
      // State management integration
      state: {
        preserve: (pageId: string, data?: Record<string, any>) => 
          this.uiStateManager.preserveFormData(pageId, data),
        restore: (contextId: string) => this.uiStateManager.restoreUserContext(contextId),
        preserveNavigation: () => this.preserveNavigationState(),
        updateChallengeState: (id: string, updates: Partial<ChallengeState>) => 
          this.updateChallengeState(id, updates),
        setupPageRefreshPersistence: () => this.uiStateManager.setupPageRefreshPersistence(),
        initializePageRefreshRecovery: () => this.uiStateManager.initializePageRefreshRecovery()
      },
      
      // Error handling integration
      errorHandling: {
        handleNavigationError: (error: Error, context?: any) => {
          this.log('Navigation error:', error, context);
          if (this.eventHandlers.onError) {
            this.eventHandlers.onError(error, { ...context, source: 'navigation' });
          }
        },
        handleAccessControlError: (error: Error, entryPoint: AccessEntryPoint) => {
          this.log('Access control error:', error, entryPoint);
          if (this.eventHandlers.onError) {
            this.eventHandlers.onError(error, { source: 'accessControl', entryPoint });
          }
        },
        handleStateManagementError: (error: Error, operation: string) => {
          this.log('State management error:', error, operation);
          if (this.eventHandlers.onError) {
            this.eventHandlers.onError(error, { source: 'stateManagement', operation });
          }
        }
      },
      
      // Event system integration
      events: {
        onNavigationChange: (callback: (challengeId: string, previousChallengeId?: string) => void) => {
          this.eventHandlers.onNavigationChange = callback;
        },
        onAccessDenied: (callback: (result: AccessControlResult, entryPoint: AccessEntryPoint) => void) => {
          this.eventHandlers.onAccessDenied = callback;
        },
        onError: (callback: (error: Error, context?: any) => void) => {
          this.eventHandlers.onError = callback;
        },
        onStatePreserved: (callback: (contextId: string) => void) => {
          this.eventHandlers.onStatePreserved = callback;
        },
        onStateRestored: (callback: (contextId: string, success: boolean) => void) => {
          this.eventHandlers.onStateRestored = callback;
        }
      }
    };
  }

  /**
   * Preserve current navigation state
   * Requirements: 4.1 - Preserve player's overall session state
   */
  private preserveNavigationState(): string {
    try {
      const contextId = this.navigationManager.preserveNavigationContext();
      
      if (this.config.enableStatePersistence) {
        const navigationContext = this.navigationManager.getNavigationContext();
        this.uiStateManager.preserveNavigationSession(
          navigationContext.currentChallengeId,
          { contextId, navigationContext }
        );
        
        if (this.eventHandlers.onStatePreserved) {
          this.eventHandlers.onStatePreserved(contextId);
        }
      }
      
      return contextId;
    } catch (error) {
      this.log('Error preserving navigation state:', error);
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error, { action: 'preserveNavigationState' });
      }
      return '';
    }
  }

  /**
   * Update browser URL to reflect current challenge
   * Requirements: 4.3 - Update URL/navigation context to reflect current challenge
   */
  private updateURL(challengeId: string): void {
    if (!this.config.enableURLSync) return;
    
    try {
      const newUrl = `${window.location.origin}${window.location.pathname}?challenge=${challengeId}`;
      window.history.replaceState({ challengeId }, '', newUrl);
      this.log('URL updated for challenge:', challengeId);
    } catch (error) {
      this.log('Failed to update URL:', error);
      // URL sync failure shouldn't break navigation
    }
  }

  /**
   * Create challenge states from user attempts
   */
  private async createChallengeStates(
    challenges: GameChallenge[], 
    user: AnyUserProfile
  ): Promise<ChallengeState[]> {
    const challengeStates: ChallengeState[] = [];
    
    // For now, create basic challenge states
    // In a real implementation, this would fetch attempt data from the API
    for (const challenge of challenges) {
      challengeStates.push({
        id: challenge.id,
        status: 'active',
        attemptsRemaining: 10,
        lastAccessed: new Date(),
        playerProgress: {
          isCompleted: false,
          hintsUsed: 0,
          attemptsMade: 0
        }
      });
    }
    
    return challengeStates;
  }

  /**
   * Ensure the controller is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('GameController must be initialized before use');
    }
  }

  /**
   * Debug logging helper
   */
  private log(...args: any[]): void {
    if (this.config.enableDebugLogging) {
      console.log('[GameController]', ...args);
    }
  }
}

/**
 * Default game controller instance
 */
export const gameController = new GameController({
  enableStatePersistence: true,
  enableURLSync: true,
  enableDebugLogging: false,
  maxContexts: 10
});