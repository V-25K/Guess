/**
 * useGameReducer Hook
 * Centralized state management for the game application using useReducer pattern
 * 
 * Requirements:
 * - 7.1: Use React hooks (useState, useReducer, useContext) for local and shared state
 * - 7.2: Separate UI state from domain/game state
 * 
 * This hook provides:
 * - Predictable state updates through a reducer
 * - Clear separation of concerns between UI and game state
 * - Type-safe actions and state
 * - Support for both authenticated and guest users
 */

import { useReducer, useCallback, useMemo } from 'react';
import type {
  GameState,
  GameAction,
  ViewType,
  GameContextValue,
} from '../types/game.types';
import { createInitialGameState } from '../types/game.types';
import type { AttemptResult } from '../../shared/models/attempt.types';
import { apiClient } from '../api/client';
import { userAuthService } from '../services/user-auth.service';
import { isGuestProfile } from '../../shared/models/user.types';

/**
 * Game state reducer
 * Handles all state transitions in a predictable manner
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // Navigation actions
    case 'SET_VIEW':
      return {
        ...state,
        currentView: action.payload,
      };

    case 'NAVIGATE_TO_GAMEPLAY':
      return {
        ...state,
        currentView: 'gameplay',
      };

    case 'NAVIGATE_TO_MENU':
      return {
        ...state,
        currentView: 'menu',
      };

    // User actions
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
      };

    case 'SET_USER_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          user: action.payload,
        },
      };

    case 'SET_USER_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          user: action.payload,
        },
      };

    // Challenge actions
    case 'SET_CHALLENGES':
      return {
        ...state,
        challenges: action.payload,
      };

    case 'SET_CHALLENGES_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          challenges: action.payload,
        },
      };

    case 'SET_CHALLENGES_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          challenges: action.payload,
        },
      };

    case 'SET_CURRENT_CHALLENGE_INDEX':
      return {
        ...state,
        currentChallengeIndex: action.payload,
      };

    case 'NEXT_CHALLENGE': {
      const nextIndex = (state.currentChallengeIndex + 1) % Math.max(1, state.challenges.length);
      return {
        ...state,
        currentChallengeIndex: nextIndex,
        lastAttemptResult: null,
      };
    }

    // Submission actions
    case 'SET_SUBMISSION_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          submission: action.payload,
        },
      };

    case 'SET_SUBMISSION_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          submission: action.payload,
        },
      };

    case 'SET_ATTEMPT_RESULT':
      return {
        ...state,
        lastAttemptResult: action.payload,
      };

    // Initialization actions
    case 'SET_INITIALIZED':
      return {
        ...state,
        initialized: action.payload,
      };

    case 'RESET_GAME':
      return {
        ...createInitialGameState(),
        user: state.user, // Preserve user on reset
        initialized: state.initialized,
      };

    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: {
          user: null,
          challenges: null,
          submission: null,
        },
      };

    // Leaderboard preview actions - Requirements: 3.4, 5.1, 5.2, 5.5
    case 'SET_LEADERBOARD_PREVIEW':
      return {
        ...state,
        leaderboardPreview: {
          ...state.leaderboardPreview,
          entries: action.payload.entries,
          totalPlayers: action.payload.totalPlayers,
          currentUserRank: action.payload.currentUserRank,
        },
      };

    case 'SET_LEADERBOARD_PREVIEW_LOADING':
      return {
        ...state,
        leaderboardPreview: {
          ...state.leaderboardPreview,
          loading: action.payload,
        },
      };

    case 'SET_LEADERBOARD_PREVIEW_ERROR':
      return {
        ...state,
        leaderboardPreview: {
          ...state.leaderboardPreview,
          error: action.payload,
        },
      };

    default:
      return state;
  }
}

/**
 * Custom hook for game state management
 * Provides state, dispatch, and convenience methods for common operations
 */
export function useGameReducer(): GameContextValue {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);

  /**
   * Navigate to a specific view
   */
  const navigateTo = useCallback((view: ViewType) => {
    dispatch({ type: 'SET_VIEW', payload: view });
  }, []);

  /**
   * Submit a guess for the current challenge
   */
  const submitGuess = useCallback(async (guess: string): Promise<AttemptResult> => {
    const currentChallenge = state.challenges[state.currentChallengeIndex];
    if (!currentChallenge) {
      throw new Error('No challenge selected');
    }

    dispatch({ type: 'SET_SUBMISSION_LOADING', payload: true });
    dispatch({ type: 'SET_SUBMISSION_ERROR', payload: null });

    try {
      const result = await apiClient.submitGuess(currentChallenge.id, guess);
      dispatch({ type: 'SET_ATTEMPT_RESULT', payload: result });

      // Refresh user profile to get updated stats
      if (result.isCorrect || result.gameOver) {
        try {
          const updatedProfile = await userAuthService.refreshUserProfile();
          dispatch({ type: 'SET_USER', payload: updatedProfile });
          
          // For guest users, also update local stats
          if (isGuestProfile(updatedProfile)) {
            userAuthService.updateGuestStats({
              pointsEarned: result.pointsEarned || 0,
              experienceEarned: result.experienceEarned || 0,
              challengeAttempted: true,
              challengeSolved: result.isCorrect,
              streakBroken: !result.isCorrect && result.gameOver,
            });
          }
        } catch (profileError) {
          console.error('Error refreshing user profile:', profileError);
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit guess';
      dispatch({ type: 'SET_SUBMISSION_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_SUBMISSION_LOADING', payload: false });
    }
  }, [state.challenges, state.currentChallengeIndex]);

  /**
   * Move to the next challenge
   */
  const nextChallenge = useCallback(() => {
    dispatch({ type: 'NEXT_CHALLENGE' });
  }, []);

  /**
   * Refresh all data from the server
   */
  const refreshData = useCallback(async () => {
    dispatch({ type: 'SET_USER_LOADING', payload: true });
    dispatch({ type: 'SET_CHALLENGES_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERRORS' });

    try {
      // Get user (authenticated or guest) - authentication is now optional
      const user = await userAuthService.getCurrentUser();
      dispatch({ type: 'SET_USER', payload: user });
      dispatch({ type: 'SET_USER_LOADING', payload: false });

      // Fetch challenges
      const challengesData = await apiClient.getChallenges();
      dispatch({ type: 'SET_CHALLENGES', payload: challengesData });
      dispatch({ type: 'SET_CHALLENGES_LOADING', payload: false });

      dispatch({ type: 'SET_INITIALIZED', payload: true });
      dispatch({ type: 'SET_VIEW', payload: 'menu' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      
      if (!state.user) {
        dispatch({ type: 'SET_USER_ERROR', payload: errorMessage });
        dispatch({ type: 'SET_USER_LOADING', payload: false });
      }
      
      if (state.challenges.length === 0) {
        dispatch({ type: 'SET_CHALLENGES_ERROR', payload: errorMessage });
        dispatch({ type: 'SET_CHALLENGES_LOADING', payload: false });
      }

      // Still navigate to menu even if there are errors
      dispatch({ type: 'SET_VIEW', payload: 'menu' });
    }
  }, [state.user, state.challenges.length]);

  /**
   * Computed values
   */
  const currentChallenge = useMemo(() => {
    return state.challenges[state.currentChallengeIndex] || null;
  }, [state.challenges, state.currentChallengeIndex]);

  const isCreator = useMemo(() => {
    if (!currentChallenge || !state.user) {
      return false;
    }
    
    const userId = isGuestProfile(state.user) ? state.user.id : state.user.user_id;
    return currentChallenge.creator_id === userId;
  }, [currentChallenge, state.user]);

  const canCreateChallenge = useMemo(() => {
    if (!state.user) return false;
    
    // Guest users CANNOT create challenges - they must be authenticated
    if (isGuestProfile(state.user)) {
      return false;
    }
    
    // Authenticated users only
    if (!state.user.last_challenge_created_at) return true;
    
    const lastCreated = new Date(state.user.last_challenge_created_at).getTime();
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - lastCreated > cooldownMs;
  }, [state.user]);

  const rateLimitTimeRemaining = useMemo(() => {
    if (!state.user) return 0;
    
    const lastCreatedAt = isGuestProfile(state.user) 
      ? state.user.last_challenge_created_at 
      : state.user.last_challenge_created_at;
      
    if (!lastCreatedAt) return 0;
    
    const lastCreated = new Date(lastCreatedAt).getTime();
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
    return Math.max(0, cooldownMs - (Date.now() - lastCreated));
  }, [state.user]);

  return {
    state,
    dispatch,
    navigateTo,
    submitGuess,
    nextChallenge,
    refreshData,
    currentChallenge,
    isCreator,
    canCreateChallenge,
    rateLimitTimeRemaining,
  };
}
