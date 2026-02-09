/**
 * Game State Types
 * Defines all types related to game state management using useReducer pattern
 * 
 * Requirements: 6.4 - Define typed interfaces for all game state objects
 */

import type { AnyUserProfile } from '../../shared/models/user.types';
import type { GameChallenge } from '../../shared/models/challenge.types';
import type { AttemptResult } from '../../shared/models/attempt.types';

/**
 * Leaderboard entry for preview display
 * Requirements: 3.4, 5.1, 5.2
 */
export interface LeaderboardPreviewEntry {
  rank: number;
  username: string;
  points: number;
  userId: string;
}

/**
 * User rank info for "Your Rank" section
 * Requirements: 5.5
 */
export interface UserRankInfo {
  rank: number;
  username: string;
  points: number;
}

/**
 * Leaderboard preview state
 * Requirements: 3.4, 5.1, 5.2, 5.5
 */
export interface LeaderboardPreviewState {
  entries: LeaderboardPreviewEntry[];
  totalPlayers: number;
  currentUserRank: UserRankInfo | null;
  loading: boolean;
  error: string | null;
}

/**
 * View types for navigation within the application
 */
export type ViewType = 
  | 'loading' 
  | 'menu' 
  | 'gameplay' 
  | 'profile' 
  | 'leaderboard' 
  | 'create' 
  | 'selection' 
  | 'awards'
  | 'allCaughtUp';

/**
 * Loading state for async operations
 */
export interface LoadingState {
  user: boolean;
  challenges: boolean;
  submission: boolean;
}

/**
 * Error state for tracking errors across different operations
 */
export interface ErrorState {
  user: string | null;
  challenges: string | null;
  submission: string | null;
}

/**
 * Core game state interface
 * Contains all state needed for the game application
 */
export interface GameState {
  /** Current view being displayed */
  currentView: ViewType;
  
  /** User profile (authenticated or guest) */
  user: AnyUserProfile | null;
  
  /** List of available challenges */
  challenges: GameChallenge[];
  
  /** Index of the current challenge being played */
  currentChallengeIndex: number;
  
  /** Loading states for different operations */
  loading: LoadingState;
  
  /** Error states for different operations */
  errors: ErrorState;
  
  /** Last attempt result for feedback display */
  lastAttemptResult: AttemptResult | null;
  
  /** Whether the app has completed initial data fetch */
  initialized: boolean;
  
  /** Leaderboard preview data for main menu - Requirements: 3.4, 5.1, 5.2, 5.5 */
  leaderboardPreview: LeaderboardPreviewState;
}

/**
 * Action types for the game state reducer
 */
export type GameAction =
  // Navigation actions
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'NAVIGATE_TO_GAMEPLAY' }
  | { type: 'NAVIGATE_TO_MENU' }
  
  // User actions
  | { type: 'SET_USER'; payload: AnyUserProfile | null }
  | { type: 'SET_USER_LOADING'; payload: boolean }
  | { type: 'SET_USER_ERROR'; payload: string | null }
  
  // Challenge actions
  | { type: 'SET_CHALLENGES'; payload: GameChallenge[] }
  | { type: 'SET_CHALLENGES_LOADING'; payload: boolean }
  | { type: 'SET_CHALLENGES_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_CHALLENGE_INDEX'; payload: number }
  | { type: 'NEXT_CHALLENGE' }
  
  // Submission actions
  | { type: 'SET_SUBMISSION_LOADING'; payload: boolean }
  | { type: 'SET_SUBMISSION_ERROR'; payload: string | null }
  | { type: 'SET_ATTEMPT_RESULT'; payload: AttemptResult | null }
  
  // Leaderboard preview actions - Requirements: 3.4, 5.1, 5.2, 5.5
  | { type: 'SET_LEADERBOARD_PREVIEW'; payload: { entries: LeaderboardPreviewEntry[]; totalPlayers: number; currentUserRank: UserRankInfo | null } }
  | { type: 'SET_LEADERBOARD_PREVIEW_LOADING'; payload: boolean }
  | { type: 'SET_LEADERBOARD_PREVIEW_ERROR'; payload: string | null }
  
  // Initialization actions
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'RESET_GAME' }
  | { type: 'CLEAR_ERRORS' };

/**
 * Initial state factory function
 * Creates a fresh initial state for the game
 */
export function createInitialGameState(): GameState {
  return {
    currentView: 'loading',
    user: null,
    challenges: [],
    currentChallengeIndex: 0,
    loading: {
      user: true,
      challenges: true,
      submission: false,
    },
    errors: {
      user: null,
      challenges: null,
      submission: null,
    },
    lastAttemptResult: null,
    initialized: false,
    leaderboardPreview: {
      entries: [],
      totalPlayers: 0,
      currentUserRank: null,
      loading: false,
      error: null,
    },
  };
}

/**
 * Context value interface for providing game state and actions
 */
export interface GameContextValue {
  /** Current game state */
  state: GameState;
  
  /** Dispatch function for state updates */
  dispatch: React.Dispatch<GameAction>;
  
  /** Navigate to a specific view */
  navigateTo: (view: ViewType) => void;
  
  /** Submit a guess for the current challenge */
  submitGuess: (guess: string) => Promise<AttemptResult>;
  
  /** Move to the next challenge */
  nextChallenge: () => void;
  
  /** Refresh all data from the server */
  refreshData: () => Promise<void>;
  
  /** Get the current challenge */
  currentChallenge: GameChallenge | null;
  
  /** Check if user is the creator of current challenge */
  isCreator: boolean;
  
  /** Check if user can create a new challenge */
  canCreateChallenge: boolean;
  
  /** Time remaining until user can create another challenge */
  rateLimitTimeRemaining: number;
}
