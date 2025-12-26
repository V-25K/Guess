/**
 * Main Menu View Component (React)
 * Displays the main menu with navigation buttons
 * Uses Tailwind CSS for styling
 * Requirements: 1.2, 3.1, 3.2, 3.3, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React, { useState } from 'react';
import { formatTimeRemaining } from '../../../shared/utils/date-utils';
import { HowToPlayModal } from './HowToPlayModal';
import { apiClient } from '../../api/client';
import type { ViewType } from '../../App';

export interface MainMenuViewProps {
  canCreateChallenge: boolean;
  rateLimitTimeRemaining?: number;
  challengesCount?: number;
  isMember: boolean;
  userLevel: number;
  isModerator: boolean;
  onNavigate: (view: ViewType, event?: React.MouseEvent) => void;
  onSubscribe: () => void;
  onShowToast?: (message: string) => void;
  /** Leaderboard preview data - top players (kept for compatibility) */
  leaderboardData?: Array<{ rank: number; username: string; points: number; userId: string }>;
  /** Total number of players for leaderboard (kept for compatibility) */
  totalPlayers?: number;
  /** Current user's ID (kept for compatibility) */
  currentUserId?: string;
  /** Current user's rank info (kept for compatibility) */
  currentUserRank?: { rank: number; username: string; points: number };
}

const REQUIRED_LEVEL = 3;

/**
 * Main Menu View
 * Central hub for navigating to different parts of the app
 * Layout: How to play top-left, logo center, 3 stacked buttons, subscribe bottom-right
 */
export function MainMenuView({
  canCreateChallenge,
  rateLimitTimeRemaining = 0,
  challengesCount = 0,
  isMember,
  userLevel,
  isModerator,
  onNavigate,
  onSubscribe,
  onShowToast,
}: MainMenuViewProps) {
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [hasJoined, setHasJoined] = useState(isMember);

  const handleJoinCommunity = async () => {
    if (hasJoined || isSubscribing) return;
    
    setIsSubscribing(true);
    try {
      await apiClient.subscribeToSubreddit();
      setHasJoined(true);
      if (onShowToast) {
        onShowToast('Welcome to the community! 🎉');
      }
      onSubscribe(); // Call the original callback for any parent state updates
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join community';
      if (onShowToast) {
        onShowToast(message);
      } else {
        setCreateError(message);
        setTimeout(() => setCreateError(null), 4000);
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCreateChallenge = (event: React.MouseEvent) => {
    // Moderators bypass all restrictions
    if (isModerator) {
      onNavigate('create', event);
      return;
    }

    // Check: Is user level high enough?
    if (userLevel < REQUIRED_LEVEL) {
      const levelsNeeded = REQUIRED_LEVEL - userLevel;
      const message = `Reach Level ${REQUIRED_LEVEL} to create challenges! (${levelsNeeded} level${levelsNeeded > 1 ? 's' : ''} to go)`;
      if (onShowToast) {
        onShowToast(message);
      } else {
        // Can't use alert() in sandboxed iframe, show inline message instead
        setCreateError(message);
        setTimeout(() => setCreateError(null), 4000);
      }
      return;
    }

    // Check: Rate limit (24-hour cooldown)
    if (!canCreateChallenge) {
      const timeStr = formatTimeRemaining(rateLimitTimeRemaining);
      const message = `Challenge cooldown active. Next creation in ${timeStr}`;
      if (onShowToast) {
        onShowToast(message);
      } else {
        // Can't use alert() in sandboxed iframe, show inline message instead
        setCreateError(message);
        setTimeout(() => setCreateError(null), 4000);
      }
      return;
    }

    // All checks passed
    onNavigate('create', event);
  };

  // Determine play button state
  const isPlayDisabled = challengesCount === 0;
  const playButtonAriaLabel = isPlayDisabled
    ? 'Play game - currently disabled because no challenges are available'
    : 'Play game - start a new challenge';

  return (
    <div className="w-full h-full bg-[#FFF8F0] dark:bg-[#1a2332] flex flex-col relative overflow-hidden">
      {/* Subtle geometric pattern overlay */}
      <div 
        className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30z' fill='none' stroke='%23000000' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Header Row */}
      <div className="flex items-center justify-between p-4 relative z-10">
        {/* How to Play Button */}
        <button
          onClick={() => setShowHowToPlay(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-transparent border border-neutral-300 dark:border-white/30 text-neutral-700 dark:text-white/80 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
          aria-label="How to play"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          How to play
        </button>

        {/* Leaderboard Button */}
        <button
          onClick={(e) => onNavigate('leaderboard', e)}
          className="w-9 h-9 rounded-full border border-neutral-300 dark:border-white/30 text-neutral-700 dark:text-white/80 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
          aria-label="View Leaderboard"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm3 12V9h2v6H8zm4 0V7h2v8h-2zm-8 0v-4h2v4H4z" />
          </svg>
        </button>
      </div>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Guess The Link"
            className="w-48 h-auto object-contain drop-shadow-2xl"
          />
          <p className="mt-2 text-sm text-neutral-500 dark:text-white/50 font-medium tracking-wide">
            Find the link between the images.
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          {/* Profile Button - Blue gradient */}
          <button
            onClick={(e) => onNavigate('profile', e)}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#FF4500] to-[#FF6B35] dark:from-[#3b5998] dark:to-[#5a7fc2] text-white font-bold text-lg tracking-wide flex items-center justify-center gap-3 shadow-lg border border-white/20 hover:from-[#E03D00] hover:to-[#E55A2B] dark:hover:from-[#4a6aa8] dark:hover:to-[#6a8fd2] active:scale-[0.98] transition-all"
            aria-label="View Profile"
            data-testid="nav-button-profile"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            PROFILE
          </button>

          {/* Play Button - Gold gradient (most prominent) */}
          <button
            onClick={(e) => onNavigate('gameplay', e)}
            disabled={isPlayDisabled}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#FFD700] via-[#FFC107] to-[#FFD700] dark:from-[#d4a84b] dark:via-[#f0d078] dark:to-[#d4a84b] text-neutral-900 dark:text-[#1a2332] font-extrabold text-xl tracking-wide flex items-center justify-center gap-3 shadow-xl border-2 border-[#FFD700]/50 dark:border-[#f0d078]/50 hover:from-[#FFE033] hover:via-[#FFD21A] hover:to-[#FFE033] dark:hover:from-[#e4b85b] dark:hover:via-[#fff088] dark:hover:to-[#e4b85b] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            aria-label={playButtonAriaLabel}
            data-testid="nav-button-play"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            {isPlayDisabled ? 'NO CHALLENGES' : 'PLAY'}
          </button>

          {/* Create Button - Blue gradient */}
          <button
            onClick={handleCreateChallenge}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#FF4500] to-[#FF6B35] dark:from-[#3b5998] dark:to-[#5a7fc2] text-white font-bold text-lg tracking-wide flex items-center justify-center gap-3 shadow-lg border border-white/20 hover:from-[#E03D00] hover:to-[#E55A2B] dark:hover:from-[#4a6aa8] dark:hover:to-[#6a8fd2] active:scale-[0.98] transition-all"
            aria-label="Create Challenge"
            data-testid="nav-button-create"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            CREATE
          </button>

          {/* Create Error Toast */}
          {createError && (
            <div className="w-full px-4 py-3 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm font-medium text-center animate-pulse">
              {createError}
            </div>
          )}
        </div>
      </div>

      {/* Footer - Join Community Button */}
      <div className="p-4 flex justify-end relative z-10">
        <button
          onClick={handleJoinCommunity}
          disabled={hasJoined || isSubscribing}
          className="px-5 py-2 rounded-lg bg-neutral-100 dark:bg-white/10 border border-neutral-300 dark:border-white/30 text-neutral-700 dark:text-white font-semibold text-sm hover:bg-neutral-200 dark:hover:bg-white/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          data-testid="subscribe-button"
        >
          {isSubscribing ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Joining...
            </>
          ) : hasJoined ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Joined
            </>
          ) : (
            'Join the community'
          )}
        </button>
      </div>

      {/* How to Play Modal */}
      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </div>
  );
}
