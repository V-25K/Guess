/**
 * Navigation Types
 * Defines all types related to navigation state management and challenge navigation
 * 
 * Requirements: 1.2, 1.3, 1.4, 4.1, 4.3
 */

import type { GameChallenge } from '../../shared/models/challenge.types';

/**
 * Challenge state model for navigation filtering
 * Requirements: 1.3 - Exclude challenges that are given up, game over, or have exhausted all attempts
 */
export interface ChallengeState {
  /** Unique challenge identifier */
  id: string;
  
  /** Current status of the challenge for the user */
  status: 'active' | 'completed' | 'given_up' | 'game_over';
  
  /** Number of attempts remaining for this challenge */
  attemptsRemaining: number;
  
  /** Timestamp when the challenge was last accessed */
  lastAccessed: Date;
  
  /** User's progress on this specific challenge */
  playerProgress: {
    /** Whether the challenge has been solved */
    isCompleted: boolean;
    /** Score achieved (if completed) */
    score?: number;
    /** Number of hints used */
    hintsUsed: number;
    /** Number of attempts made */
    attemptsMade: number;
  };
}

/**
 * Navigation context model for maintaining navigation state
 * Requirements: 4.1, 4.3 - Preserve player's overall session state and update navigation context
 */
export interface NavigationContext {
  /** ID of the currently active challenge */
  currentChallengeId: string;
  
  /** ID of the previously viewed challenge (for back navigation) */
  previousChallengeId?: string;
  
  /** List of challenge IDs that are available for navigation */
  availableChallenges: string[];
  
  /** History of navigation for session tracking */
  navigationHistory: string[];
  
  /** Preserved form data during navigation transitions */
  preservedFormData?: Record<string, any>;
  
  /** Current navigation session metadata */
  sessionMetadata: {
    /** When the navigation session started */
    sessionStartTime: Date;
    /** Total challenges navigated in this session */
    challengesNavigated: number;
    /** Whether the user is in a continuous navigation flow */
    isInNavigationFlow: boolean;
  };
}

/**
 * User permission model for access control
 * Requirements: 3.1, 3.2, 3.5 - Consistent access control validation
 */
export interface UserPermissions {
  /** User identifier */
  userId: string;
  
  /** User level for permission checking */
  level: number;
  
  /** Whether the user is a guest (unauthenticated) */
  isGuest: boolean;
  
  /** Whether the user can create challenges */
  canCreateChallenges: boolean;
  
  /** List of access restrictions for this user */
  accessRestrictions: string[];
}

/**
 * Guide state model for creator guide expansion
 * Requirements: 2.2, 2.3, 2.5 - Guide expansion without page refresh and state preservation
 */
export interface GuideState {
  /** Whether the guide is currently expanded */
  isExpanded: boolean;
  
  /** Whether the guide content has been loaded */
  contentLoaded: boolean;
  
  /** Preserved form data from create interface during guide expansion */
  preservedCreateFormData?: Record<string, any>;
  
  /** Source that triggered the guide expansion */
  expansionSource: 'navigation_tab' | 'create_option' | 'direct_link';
  
  /** Timestamp when guide was last expanded */
  lastExpanded?: Date;
}

/**
 * Navigation error types for error handling
 * Requirements: 4.5 - Clear error messaging and fallback options
 */
export type NavigationError = 
  | 'CHALLENGE_NOT_FOUND'
  | 'NO_AVAILABLE_CHALLENGES' 
  | 'NAVIGATION_LOOP_FAILURE'
  | 'PERMISSION_DENIED'
  | 'SESSION_EXPIRED'
  | 'INVALID_ENTRY_POINT'
  | 'CONTEXT_LOSS'
  | 'FORM_DATA_LOSS'
  | 'URL_SYNC_FAILURE'
  | 'CONTENT_LOAD_FAILURE'
  | 'STATE_PRESERVATION_FAILURE';

/**
 * Navigation result for operation feedback
 */
export interface NavigationResult {
  /** Whether the navigation was successful */
  success: boolean;
  
  /** The challenge ID that was navigated to (if successful) */
  challengeId?: string;
  
  /** Error type if navigation failed */
  error?: NavigationError;
  
  /** Human-readable error message */
  errorMessage?: string;
  
  /** Suggested fallback actions */
  fallbackOptions?: string[];

  /** Enhanced error context for UI feedback */
  errorContext?: {
    /** User-friendly error title */
    title: string;
    /** Error severity level */
    severity: 'error' | 'warning' | 'info';
    /** Whether to show technical details */
    showTechnicalDetails: boolean;
    /** Auto-dismiss timeout in milliseconds */
    autoDismissMs?: number;
    /** User action that triggered the error */
    userAction: string;
    /** Timestamp when error occurred */
    timestamp: Date;
    /** Whether the error can be retried */
    canRetry: boolean;
    /** Number of times this error has been retried */
    retryCount: number;
    /** Suggested wait time before retry (ms) */
    suggestedWaitTime: number;
  };

  /** Whether the error was automatically recovered */
  autoRecovered?: boolean;

  /** Restored form data (if applicable) */
  restoredFormData?: Record<string, any>;
}

/**
 * Challenge filter criteria for navigation
 * Requirements: 1.3 - Filter logic for available challenges
 */
export interface ChallengeFilterCriteria {
  /** Exclude challenges with these statuses */
  excludeStatuses: ('given_up' | 'game_over' | 'exhausted_attempts')[];
  
  /** Only include challenges the user has access to */
  respectPermissions: boolean;
  
  /** Whether to include completed challenges */
  includeCompleted: boolean;
  
  /** Minimum attempts remaining required */
  minAttemptsRemaining?: number;
}

/**
 * Navigation event types for state management
 */
export type NavigationEvent = 
  | { type: 'NAVIGATE_TO_CHALLENGE'; challengeId: string }
  | { type: 'NAVIGATE_NEXT'; currentChallengeId: string }
  | { type: 'NAVIGATE_PREVIOUS'; currentChallengeId: string }
  | { type: 'UPDATE_CHALLENGE_STATE'; challengeId: string; state: Partial<ChallengeState> }
  | { type: 'PRESERVE_CONTEXT'; context: Partial<NavigationContext> }
  | { type: 'RESTORE_CONTEXT'; contextId: string }
  | { type: 'EXPAND_GUIDE'; source: GuideState['expansionSource'] }
  | { type: 'COLLAPSE_GUIDE' }
  | { type: 'VALIDATE_ACCESS'; userId: string; resource: string }
  | { type: 'HANDLE_ERROR'; error: NavigationError; context?: any };