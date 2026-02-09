/**
 * Root Application Component
 * Manages global state, routing, and data fetching for the React client
 */

import React, { useEffect, lazy, Suspense, useCallback, useState } from 'react';
import { LoadingView } from './components/shared/LoadingView';
import { ErrorView } from './components/shared/ErrorView';
import { MainMenuView } from './components/menu/MainMenuView';
import { useGameReducer } from './hooks/useGameReducer';
import { useViewMode } from './hooks/useViewMode';
import { useImagePreloader, ALL_APP_ASSETS } from './hooks/useImagePreloader';
import { apiClient } from './api/client';
import { NavigationBar } from './components/navigation/NavigationBar';
import { userAuthService } from './services/user-auth.service';
import { GameController } from './services/GameController';
import { isGuestProfile } from '../shared/models/user.types';
import type { ChallengeState } from './types/navigation.types';

// Lazy load secondary views for code splitting
const GameplayView = lazy(() => import('./components/gameplay/GameplayView').then(m => ({ default: m.GameplayView })));
const ProfileView = lazy(() => import('./components/profile/ProfileView').then(m => ({ default: m.ProfileView })));
const LeaderboardView = lazy(() => import('./components/leaderboard/LeaderboardView').then(m => ({ default: m.LeaderboardView })));
const AwardsView = lazy(() => import('./components/awards/AwardsView').then(m => ({ default: m.AwardsView })));
const CreateChallengeView = lazy(() => import('./components/create/CreateChallengeView').then(m => ({ default: m.CreateChallengeView })));
const AllCaughtUpView = lazy(() => import('./components/gameplay/AllCaughtUpView').then(m => ({ default: m.AllCaughtUpView })));

import type { ViewType } from './types/game.types';
export type { ViewType };

// Views that require expanded mode (these have dedicated entrypoints in devvit.json)
const EXPANDED_MODE_VIEWS: ViewType[] = ['profile', 'leaderboard', 'awards', 'create'];

export function App() {
  const {
    state,
    dispatch,
    navigateTo,
    submitGuess,
    currentChallenge,
    isCreator,
    canCreateChallenge,
    rateLimitTimeRemaining,
  } = useGameReducer();

  const { mode: viewMode, requestExpanded } = useViewMode();

  // Preload all app assets (logo, profile icons, badge icons) at app startup
  const { isLoading: assetsLoading } = useImagePreloader(ALL_APP_ASSETS);

  // State for the current challenge's attempt (to persist hints_used, attempts_made, etc.)
  const [currentAttempt, setCurrentAttempt] = useState<{
    hints_used: number[];
    attempts_made: number;
    is_solved: boolean;
    game_over: boolean;
    points_earned: number;
  } | null>(null);
  const [isLoadingAttempt, setIsLoadingAttempt] = useState(false);

  // Initialize GameController for integrated navigation and access control
  const [gameController] = useState(() => new GameController({
    enableStatePersistence: true,
    enableURLSync: true,
    enableDebugLogging: false
  }, {
    onNavigationChange: (challengeId, previousChallengeId) => {
      // Update the current challenge index when navigation changes
      const challengeIndex = state.challenges.findIndex(c => c.id === challengeId);
      if (challengeIndex !== -1) {
        dispatch({ type: 'SET_CURRENT_CHALLENGE_INDEX', payload: challengeIndex });
      }
    },
    onAccessDenied: (result, entryPoint) => {
      console.warn('Access denied:', result.reason, 'from', entryPoint);
    },
    onError: (error, context) => {
      console.error('GameController error:', error, context);
    }
  }));

  // Fetch attempt data when challenge changes
  useEffect(() => {
    if (currentChallenge && state.currentView === 'gameplay') {
      setIsLoadingAttempt(true);
      apiClient.getAttempt(currentChallenge.id)
        .then(attempt => {
          setCurrentAttempt(attempt ? {
            hints_used: attempt.hints_used || [],
            attempts_made: attempt.attempts_made || 0,
            is_solved: attempt.is_solved || false,
            game_over: attempt.game_over || false,
            points_earned: attempt.points_earned || 0,
          } : null);
        })
        .catch(() => {
          setCurrentAttempt(null);
        })
        .finally(() => {
          setIsLoadingAttempt(false);
        });
    } else {
      setCurrentAttempt(null);
      setIsLoadingAttempt(false);
    }
  }, [currentChallenge?.id, state.currentView]);

  // Initialize GameController when challenges are loaded
  useEffect(() => {
    if (state.challenges.length > 0 && state.user) {
      // Initialize GameController with challenges and user data
      gameController.initialize(state.challenges, state.user, currentChallenge?.id)
        .then(async () => {
          console.log('GameController initialized successfully');
          
          // Perform integration sync to ensure all components are working
          const syncResult = await gameController.performIntegrationSync();
          if (!syncResult.success) {
            console.warn('GameController integration issues detected:', syncResult.errors);
            // Continue anyway - the app should still function with partial integration
          } else {
            console.log('All GameController components integrated successfully');
          }
        })
        .catch((error) => {
          console.error('Failed to initialize GameController:', error);
        });
    }
  }, [state.challenges, state.user, gameController, currentChallenge]);
  /**
   * Find the first playable challenge (not completed/game over) and navigate to gameplay
   * Note: We fetch challenges fresh from API to avoid stale closure issues
   */
  const navigateToPlayableChallenge = useCallback(async () => {
    setIsLoadingAttempt(true);
    
    try {
      // Fetch fresh challenges to avoid stale state
      const challenges = await apiClient.getChallenges();
      
      if (challenges.length === 0) {
        setIsLoadingAttempt(false);
        dispatch({ type: 'SET_CHALLENGES_ERROR', payload: 'No challenges available' });
        return;
      }
      
      // Update state with fresh challenges
      dispatch({ type: 'SET_CHALLENGES', payload: challenges });
      
      // Check each challenge to find one that's playable
      for (let i = 0; i < challenges.length; i++) {
        const challenge = challenges[i];
        
        // Skip challenges created by the current user
        if (state.user && challenge.creator_id === userAuthService.getUserId()) {
          continue;
        }
        
        try {
          const attempt = await apiClient.getAttempt(challenge.id);
          
          // If no attempt or attempt is not completed (not solved and not game over), this is playable
          if (!attempt || (!attempt.is_solved && !attempt.game_over)) {
            dispatch({ type: 'SET_CURRENT_CHALLENGE_INDEX', payload: i });
            navigateTo('gameplay');
            setIsLoadingAttempt(false);
            return;
          }
        } catch {
          // On error, assume challenge is playable
          dispatch({ type: 'SET_CURRENT_CHALLENGE_INDEX', payload: i });
          navigateTo('gameplay');
          setIsLoadingAttempt(false);
          return;
        }
      }
      
      // All challenges are completed - navigate to all caught up view
      setIsLoadingAttempt(false);
      navigateTo('allCaughtUp');
    } catch {
      setIsLoadingAttempt(false);
      dispatch({ type: 'SET_CHALLENGES_ERROR', payload: 'Failed to load challenges' });
    }
  }, [state.user, dispatch, navigateTo]);

  /**
   * Enhanced navigation handler that requests expanded mode for certain views
   * and validates access control for create functionality
   * Requirements: 3.3, 3.4 - Consistent access control across all entry points
   */
  const handleNavigate = useCallback(
    async (view: ViewType, event?: React.MouseEvent) => {
      // Special handling for create view - validate access control using GameController
      if (view === 'create') {
        try {
          const accessResult = await gameController.validateCreateAccess('direct_link');
          
          if (!accessResult.granted) {
            // Access denied - don't navigate, let the component handle the popup
            console.warn('Create access denied:', accessResult.reason);
            // Still proceed with navigation - CreateChallengeView will handle access control
            // This ensures consistent behavior across all entry points
          }
        } catch (error) {
          console.error('Error validating create access during navigation:', error);
          // Continue with navigation - CreateChallengeView will handle the error
        }
      }
      
      // If navigating to a view that requires expanded mode and we're in inline mode
      if (EXPANDED_MODE_VIEWS.includes(view) && viewMode === 'inline' && event) {
        try {
          // Use view-specific entrypoints defined in devvit.json
          // Each entrypoint loads a separate HTML file that sets window.__DEVVIT_INITIAL_VIEW__
          await requestExpanded(event.nativeEvent as PointerEvent, view);
          // Note: After requestExpanded, a new instance loads with the target view
          return; // Don't call navigateTo since a new instance will handle it
        } catch {
          // Fall through to regular navigation if expanded mode fails
        }
      }
      
      // For gameplay, find a playable challenge first
      if (view === 'gameplay') {
        await navigateToPlayableChallenge();
        return;
      }
      
      navigateTo(view);
    },
    [viewMode, requestExpanded, navigateTo, navigateToPlayableChallenge]
  );

  // Fetch initial data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  /**
   * Fetch leaderboard preview data (top 5 players and current user rank)
   */
  const fetchLeaderboardPreview = async () => {
    dispatch({ type: 'SET_LEADERBOARD_PREVIEW_LOADING', payload: true });
    try {
      // Fetch top 5 players for preview
      const leaderboardResponse = await apiClient.getLeaderboard(5, 1);
      
      // Map API response to preview format
      const entries = leaderboardResponse.entries.map(entry => ({
        rank: entry.rank,
        username: entry.username,
        points: entry.totalPoints,
        userId: entry.userId,
      }));
      
      // Get current user rank info if available
      let currentUserRank = null;
      if (leaderboardResponse.userRank && leaderboardResponse.userRank.rank !== null) {
        currentUserRank = {
          rank: leaderboardResponse.userRank.rank,
          username: leaderboardResponse.userRank.username,
          points: leaderboardResponse.userRank.totalPoints,
        };
      }
      
      dispatch({
        type: 'SET_LEADERBOARD_PREVIEW',
        payload: {
          entries,
          totalPlayers: leaderboardResponse.totalEntries,
          currentUserRank,
        },
      });
    } catch {
      dispatch({ type: 'SET_LEADERBOARD_PREVIEW_ERROR', payload: 'Failed to load leaderboard' });
    } finally {
      dispatch({ type: 'SET_LEADERBOARD_PREVIEW_LOADING', payload: false });
    }
  };

  const fetchInitialData = async () => {
    try {
      // Get user (authenticated or guest) - authentication is now optional
      dispatch({ type: 'SET_USER_LOADING', payload: true });
      const user = await userAuthService.getCurrentUser();
      dispatch({ type: 'SET_USER', payload: user });
      dispatch({ type: 'SET_USER_LOADING', payload: false });
      
      // Fetch leaderboard preview data in parallel
      fetchLeaderboardPreview();

      // Fetch postData from server (contains challengeId, openDirectly, initialView if set during post creation)
      let postData: { challengeId?: string; openDirectly?: boolean; initialView?: string } = {};
      try {
        const response = await fetch('/api/post-data');
        if (response.ok) {
          postData = await response.json();
        }
      } catch {
        // No post data available
      }
      const { challengeId, openDirectly, initialView } = postData;

      // Check for initial view set by entry point files (e.g., profile.tsx, leaderboard.tsx)
      // This is the documented approach for multi-entrypoint Devvit apps
      const entryPointView = window.__DEVVIT_INITIAL_VIEW__;
      if (entryPointView) {
        // Navigate to the view specified by the entry point
        dispatch({ type: 'SET_VIEW', payload: entryPointView });
        dispatch({ type: 'SET_INITIALIZED', payload: true });
        
        // Load challenges in background for later use
        apiClient.getChallenges().then(data => {
          dispatch({ type: 'SET_CHALLENGES', payload: data });
        }).catch(console.error);
        return;
      }

      // If expanding to a specific view (e.g. from postData initialView)
      if (initialView) {
        dispatch({ type: 'SET_VIEW', payload: initialView as ViewType });
        dispatch({ type: 'SET_INITIALIZED', payload: true });

        // If we need data for that view, we can fetch it here or let the view handle it (views handle it mostly)
        // But we should still fetch challenges in background if needed later
        if (initialView !== 'create' && initialView !== 'profile' && initialView !== 'leaderboard' && initialView !== 'awards') {
          // If it's something else that needs challenges, fetch them
          dispatch({ type: 'SET_CHALLENGES_LOADING', payload: true });
          const challengesData = await apiClient.getChallenges();
          dispatch({ type: 'SET_CHALLENGES', payload: challengesData });
          dispatch({ type: 'SET_CHALLENGES_LOADING', payload: false });
        } else {
          // For non-gameplay views, we can lazy load challenges or skip if not needed immediately
          // Ideally we just load them in background
          apiClient.getChallenges().then(data => {
            dispatch({ type: 'SET_CHALLENGES', payload: data });
          }).catch(console.error);
        }
        return;
      }

      if (challengeId && openDirectly) {
        // Load specific challenge
        try {
          const challenge = await apiClient.getChallenge(challengeId);
          dispatch({ type: 'SET_CHALLENGES', payload: [challenge] });
          dispatch({ type: 'SET_CURRENT_CHALLENGE_INDEX', payload: 0 });
          dispatch({ type: 'SET_CHALLENGES_LOADING', payload: false });
          dispatch({ type: 'SET_VIEW', payload: 'gameplay' });
          dispatch({ type: 'SET_INITIALIZED', payload: true });
          return;
        } catch {
          // Fall through to load all challenges
        }
      }

      // Default: Fetch all challenges and go to menu
      dispatch({ type: 'SET_CHALLENGES_LOADING', payload: true });
      const challengesData = await apiClient.getChallenges();
      dispatch({ type: 'SET_CHALLENGES', payload: challengesData });
      dispatch({ type: 'SET_CHALLENGES_LOADING', payload: false });

      // Navigate to menu once data is loaded
      dispatch({ type: 'SET_INITIALIZED', payload: true });
      dispatch({ type: 'SET_VIEW', payload: 'menu' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';

      // For guest users, we should still be able to continue with limited functionality
      if (!state.user) {
        try {
          // Try to create a guest user as fallback
          const guestUser = await userAuthService.getCurrentUser();
          dispatch({ type: 'SET_USER', payload: guestUser });
          dispatch({ type: 'SET_USER_LOADING', payload: false });
        } catch (guestError) {
          dispatch({ type: 'SET_USER_ERROR', payload: errorMessage });
          dispatch({ type: 'SET_USER_LOADING', payload: false });
        }
      }
      
      if (state.challenges.length === 0) {
        dispatch({ type: 'SET_CHALLENGES_ERROR', payload: errorMessage });
        dispatch({ type: 'SET_CHALLENGES_LOADING', payload: false });
      }

      // Still navigate to menu even if there are errors
      dispatch({ type: 'SET_VIEW', payload: 'menu' });
    }
  };

  const handleBackToMenu = () => {
    navigateTo('menu');
  };

  /**
   * Navigate to the next available challenge using GameController
   * Requirements: 1.2, 1.3, 4.3 - Next challenge navigation with filtering and state updates
   */
  const findNextPlayableChallenge = useCallback(async () => {
    if (state.challenges.length === 0) {
      navigateTo('menu');
      return;
    }

    setIsLoadingAttempt(true);
    
    try {
      // Update current challenge state in GameController if we have one
      if (currentChallenge && currentAttempt) {
        let status: ChallengeState['status'] = 'active';
        if (currentAttempt.is_solved) {
          status = 'completed';
        } else if (currentAttempt.game_over) {
          status = 'game_over';
        }
        
        gameController.updateChallengeState(currentChallenge.id, {
          status,
          attemptsRemaining: 10 - currentAttempt.attempts_made,
          playerProgress: {
            isCompleted: currentAttempt.is_solved,
            score: currentAttempt.points_earned,
            hintsUsed: currentAttempt.hints_used.length,
            attemptsMade: currentAttempt.attempts_made
          }
        });
      }
      
      // Use GameController to get next challenge
      const result = await gameController.navigateToNextChallenge();
      
      if (result.success && result.challengeId) {
        // Find the challenge index in our state
        const challengeIndex = state.challenges.findIndex(c => c.id === result.challengeId);
        
        if (challengeIndex !== -1) {
          // Skip challenges created by the current user
          const challenge = state.challenges[challengeIndex];
          if (state.user && challenge.creator_id === userAuthService.getUserId()) {
            // Try to get another challenge
            const nextResult = await gameController.navigateToNextChallenge();
            if (nextResult.success && nextResult.challengeId) {
              const nextIndex = state.challenges.findIndex(c => c.id === nextResult.challengeId);
              if (nextIndex !== -1) {
                dispatch({ type: 'SET_CURRENT_CHALLENGE_INDEX', payload: nextIndex });
              }
            }
          } else {
            dispatch({ type: 'SET_CURRENT_CHALLENGE_INDEX', payload: challengeIndex });
          }
        }
      } else {
        // No available challenges, show all caught up view
        navigateTo('allCaughtUp');
      }
    } catch (error) {
      console.error('Error navigating to next challenge:', error);
      
      // Provide better user feedback for navigation errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Show user-friendly error message
      if (errorMessage.includes('NO_AVAILABLE_CHALLENGES')) {
        navigateTo('allCaughtUp');
      } else if (errorMessage.includes('NAVIGATION_LOOP_FAILURE')) {
        // Show error message and stay on current challenge
        console.warn('Navigation loop failure, staying on current challenge');
        // Could show a toast notification here in the future
      } else {
        // Fallback to menu on other errors
        navigateTo('menu');
      }
    } finally {
      setIsLoadingAttempt(false);
    }
  }, [state.challenges, state.currentChallengeIndex, state.user, currentChallenge, currentAttempt, gameController, dispatch, navigateTo]);

  /**
   * Check if next challenge navigation is available using GameController
   * Requirements: 1.5 - Handle empty challenge list scenario with button disabling
   */
  const canNavigateToNext = useCallback(() => {
    const availableCount = gameController.getAvailableChallengeCount();
    
    // No navigation if no challenges available
    if (availableCount === 0) {
      return false;
    }
    
    // Allow navigation if more than one challenge available
    if (availableCount > 1) {
      return true;
    }
    
    // For single challenge, still allow navigation (it will loop back to itself)
    // This provides consistent behavior and allows users to "refresh" the challenge
    return true;
  }, [gameController]);

  /**
   * Handle revealing a hint for the current challenge
   * Deducts points from user and returns the image description
   */
  const handleRevealHint = useCallback(async (imageIndex: number, hintCost: number) => {
    if (!currentChallenge) {
      return { success: false, error: 'No challenge selected' };
    }

    try {
      const result = await apiClient.revealHint(currentChallenge.id, imageIndex, hintCost);
      
      // Refresh user profile to get updated points
      const updatedProfile = await userAuthService.refreshUserProfile();
      dispatch({ type: 'SET_USER', payload: updatedProfile });
      
      return {
        success: true,
        hint: result.hint,
        newPoints: isGuestProfile(updatedProfile) ? updatedProfile.total_points : updatedProfile.total_points,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reveal hint',
      };
    }
  }, [currentChallenge, dispatch]);

  /**
   * Handle giving up on the current challenge
   * Marks the challenge as game over and resets user's streak
   */
  const handleGiveUp = useCallback(async (challengeId: string) => {
    try {
      const result = await apiClient.giveUpChallenge(challengeId);
      
      if (result.success) {
        // Refresh user profile to get updated streak
        const updatedProfile = await userAuthService.refreshUserProfile();
        dispatch({ type: 'SET_USER', payload: updatedProfile });
        
        // Update current attempt state to reflect game over
        setCurrentAttempt(prev => prev ? {
          ...prev,
          game_over: true,
        } : null);
      } else {
        throw new Error(result.message || 'Failed to give up challenge');
      }
    } catch (error) {
      console.error('Error giving up challenge:', error);
      throw error;
    }
  }, [dispatch]);

  // Show loading while fetching initial data or preloading assets (only on initial load)
  if ((state.loading.user || assetsLoading) && !state.initialized) {
    return <LoadingView />;
  }

  // Show error only if we can't get any user (authenticated or guest)
  if (state.errors.user && !state.user) {
    return (
      <div className="app-container flex items-center justify-center p-6">
        <div className="text-center max-w-[400px]">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2 text-neutral-900 dark:text-neutral-100">Unable to Start Game</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            We couldn't set up your profile. This might be due to browser storage restrictions.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Skip to content link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Main content wrapper */}

      {state.currentView === 'loading' && <LoadingView />}

      {state.currentView === 'menu' && state.user && !isLoadingAttempt && (
        <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
          <MainMenuView
            canCreateChallenge={canCreateChallenge}
            rateLimitTimeRemaining={rateLimitTimeRemaining}
            challengesCount={state.challenges.length}
            userLevel={isGuestProfile(state.user) ? state.user.level : state.user.level}
            isModerator={!isGuestProfile(state.user) && state.user.role === 'mod'}
            onNavigate={handleNavigate}
            user={state.user}
            leaderboardData={state.leaderboardPreview.entries}
            totalPlayers={state.leaderboardPreview.totalPlayers}
            currentUserId={userAuthService.getUserId()}
            currentUserRank={state.leaderboardPreview.currentUserRank ?? undefined}
          />
        </main>
      )}

      {state.currentView === 'menu' && state.user && isLoadingAttempt && (
        <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
          <LoadingView message="Finding a challenge..." />
        </main>
      )}

      <Suspense fallback={<LoadingView />}>
        {state.currentView === 'gameplay' && currentChallenge && !isLoadingAttempt && (
          <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <GameplayView
              challenge={currentChallenge}
              onSubmitGuess={submitGuess}
              onNextChallenge={findNextPlayableChallenge}
              onBackToMenu={handleBackToMenu}
              onGiveUp={handleGiveUp}
              isCreator={isCreator}
              userPoints={state.user ? (isGuestProfile(state.user) ? state.user.total_points : state.user.total_points) : 0}
              onRevealHint={handleRevealHint}
              initialRevealedHints={currentAttempt?.hints_used || []}
              initialAttemptsMade={currentAttempt?.attempts_made || 0}
              initialGameOver={currentAttempt?.game_over || currentAttempt?.is_solved || false}
              initialIsCorrect={currentAttempt?.is_solved || false}
              canNavigateToNext={canNavigateToNext()}
            />
          </main>
        )}

        {state.currentView === 'gameplay' && currentChallenge && isLoadingAttempt && (
          <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <LoadingView />
          </main>
        )}

        {state.currentView === 'gameplay' && !currentChallenge && (
          <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <ErrorView
              message="No challenges available"
              onRetry={() => navigateTo('menu')}
            />
          </main>
        )}

        {state.currentView === 'profile' && (
          <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <ProfileView onBack={() => navigateTo('menu')} />
          </main>
        )}

        {state.currentView === 'leaderboard' && (
          <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <LeaderboardView onBack={() => navigateTo('menu')} />
          </main>
        )}

        {state.currentView === 'awards' && (
          <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <AwardsView onBack={() => navigateTo('menu')} />
          </main>
        )}

        {state.currentView === 'create' && (
          <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <CreateChallengeView
              onSuccess={() => {
                // Refresh challenges after creation
                fetchInitialData();
                navigateTo('menu');
              }}
              onCancel={() => navigateTo('menu')}
            />
          </main>
        )}

        {state.currentView === 'allCaughtUp' && (
          <main id="main-content" className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <AllCaughtUpView
              onBackToMenu={handleBackToMenu}
              onCreateChallenge={canCreateChallenge ? () => navigateTo('create') : undefined}
              canCreate={canCreateChallenge}
            />
          </main>
        )}
      </Suspense>

      {state.user && !state.loading.user && (
        <NavigationBar
          currentView={state.currentView}
          onNavigate={handleNavigate}
          viewMode={viewMode}
        />
      )}
    </div>
  );
}
