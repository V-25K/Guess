/**
 * Root Application Component
 * Manages global state, routing, and data fetching for the React client
 * 
 * Requirements:
 * - 5.3: Split components exceeding 300 lines
 * - 7.1: Use React hooks (useState, useReducer, useContext) for local and shared state
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
import { ToastProvider } from './components/shared/Toast';

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
        if (state.user && challenge.creator_id === state.user.user_id) {
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
   * Requirements: 1.4 - Request expanded mode before displaying Profile, Leaderboard, Awards, Create
   */
  const handleNavigate = useCallback(
    async (view: ViewType, event?: React.MouseEvent) => {
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
   * Requirements: 3.4, 5.1, 5.2, 5.5
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
      // Fetch user profile
      dispatch({ type: 'SET_USER_LOADING', payload: true });
      const profileData = await apiClient.getUserProfile();
      dispatch({ type: 'SET_USER', payload: profileData });
      dispatch({ type: 'SET_USER_LOADING', payload: false });
      
      // Fetch leaderboard preview data in parallel - Requirements: 3.4, 5.1, 5.2
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
  };

  const handleBackToMenu = () => {
    navigateTo('menu');
  };

  /**
   * Find and navigate to the next playable challenge (not completed/game over)
   * Checks attempt status for each challenge starting from current index
   */
  const findNextPlayableChallenge = useCallback(async () => {
    const challenges = state.challenges;
    if (challenges.length === 0) {
      navigateTo('menu');
      return;
    }

    setIsLoadingAttempt(true);
    const startIndex = state.currentChallengeIndex;
    
    // Check each challenge starting from the next one
    for (let i = 1; i <= challenges.length; i++) {
      const checkIndex = (startIndex + i) % challenges.length;
      const challenge = challenges[checkIndex];
      
      // Skip challenges created by the current user
      if (state.user && challenge.creator_id === state.user.user_id) {
        continue;
      }
      
      try {
        const attempt = await apiClient.getAttempt(challenge.id);
        
        // If no attempt or attempt is not completed (not solved and not game over), this is playable
        if (!attempt || (!attempt.is_solved && !attempt.game_over)) {
          dispatch({ type: 'SET_CURRENT_CHALLENGE_INDEX', payload: checkIndex });
          setIsLoadingAttempt(false);
          return;
        }
      } catch {
        // On error, assume challenge is playable
        dispatch({ type: 'SET_CURRENT_CHALLENGE_INDEX', payload: checkIndex });
        setIsLoadingAttempt(false);
        return;
      }
    }
    
    // All challenges are completed, show all caught up view
    setIsLoadingAttempt(false);
    navigateTo('allCaughtUp');
  }, [state.challenges, state.currentChallengeIndex, state.user, dispatch, navigateTo]);

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
      const updatedProfile = await apiClient.getUserProfile();
      dispatch({ type: 'SET_USER', payload: updatedProfile });
      
      return {
        success: true,
        hint: result.hint,
        newPoints: updatedProfile.total_points,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reveal hint',
      };
    }
  }, [currentChallenge, dispatch]);

  // Show loading while fetching initial data or preloading assets (only on initial load)
  if ((state.loading.user || assetsLoading) && !state.initialized) {
    return <LoadingView />;
  }

  // Show error if user authentication failed
  if (state.errors.user || !state.user) {
    return (
      <div className="app-container flex items-center justify-center p-6">
        <div className="text-center max-w-[400px]">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2 text-neutral-900 dark:text-neutral-100">Authentication Required</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-2">You must be logged in to Reddit to play this game.</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Please log in and refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
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
            isMember={false} // TODO(T1): Implement subreddit membership check - see docs/TODO-TRACKING.md
            userLevel={state.user.level}
            isModerator={state.user.role === 'mod'}
            onNavigate={handleNavigate}
            onSubscribe={() => {
              // TODO(T2): Implement subscribe functionality - see docs/TODO-TRACKING.md
            }}
            leaderboardData={state.leaderboardPreview.entries}
            totalPlayers={state.leaderboardPreview.totalPlayers}
            currentUserId={state.user.user_id}
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
              isCreator={isCreator}
              userPoints={state.user?.total_points ?? 0}
              onRevealHint={handleRevealHint}
              initialRevealedHints={currentAttempt?.hints_used || []}
              initialAttemptsMade={currentAttempt?.attempts_made || 0}
              initialGameOver={currentAttempt?.game_over || currentAttempt?.is_solved || false}
              initialIsCorrect={currentAttempt?.is_solved || false}
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
    </ToastProvider>
  );
}
