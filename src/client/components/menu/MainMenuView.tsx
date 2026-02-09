/**
 * Main Menu View Component (React)
 * Displays the main menu with navigation buttons
 */

import React, { useState } from 'react';
import { formatTimeRemaining } from '../../../shared/utils/date-utils';
import { HowToPlayModal } from './HowToPlayModal';
import { apiClient } from '../../api/client';
import { userAuthService } from '../../services/user-auth.service';
import { accessControlManager } from '../../services/AccessControlManager';
import { AccessDeniedPopup, useAccessDeniedPopup } from '../shared/AccessDeniedPopup';
import { isGuestProfile } from '../../../shared/models/user.types';
import { SubscriptionButton } from '../shared/SubscriptionButton';
import type { ViewType } from '../../App';

export interface MainMenuViewProps {
  canCreateChallenge: boolean;
  rateLimitTimeRemaining?: number;
  challengesCount?: number;
  userLevel: number;
  isModerator: boolean;
  onNavigate: (view: ViewType, event?: React.MouseEvent) => void;
  onShowToast?: (message: string) => void;
  /** Current user data */
  user?: any; // Will be typed properly based on the user type from App
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
  userLevel,
  isModerator,
  onNavigate,
  onShowToast,
  user,
}: MainMenuViewProps) {
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { popupState, showAccessDeniedPopup, hideAccessDeniedPopup } = useAccessDeniedPopup();

  // Get guest ID for subscription button
  const guestId = user && isGuestProfile(user) ? user.id : undefined;

  /**
   * Handle create challenge navigation with access control validation
   * Requirements: 3.3, 3.4 - Apply access control to menu create button
   */
  const handleCreateChallenge = async (event: React.MouseEvent) => {
    try {
      // Get current user
      const currentUser = await userAuthService.getCurrentUser();
      
      // Validate access using AccessControlManager
      const accessResult = accessControlManager.validateCreateAccess(currentUser, 'create_button');
      
      if (accessResult.granted) {
        // Access granted - proceed with additional checks (moderator bypass, level, rate limit)
        
        // Moderators bypass all other restrictions
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
            setCreateError(message);
            setTimeout(() => setCreateError(null), 4000);
          }
          return;
        }

        // All checks passed
        onNavigate('create', event);
      } else {
        // Access denied - show consistent popup
        showAccessDeniedPopup(accessResult, 'create_button');
      }
    } catch (error) {
      console.error('Error checking create access:', error);
      // Show generic error popup with consistent messaging
      showAccessDeniedPopup({
        granted: false,
        reason: 'PERMISSION_DENIED',
        message: 'Unable to verify permissions. Please try again.',
        suggestedActions: ['Try again', 'Return to menu']
      }, 'create_button');
    }
  };

  /**
   * Handle suggested actions from access denied popup
   * Requirements: 3.6 - Redirect users to appropriate alternative actions
   */
  const handleActionSelect = (action: string) => {
    switch (action) {
      case 'Log in with your Reddit account':
        // Redirect to login
        window.location.href = '/auth/login';
        break;
      
      case 'Continue playing to reach level 3':
      case 'Play more challenges to level up':
      case 'Browse existing challenges':
        // Navigate to gameplay
        onNavigate('gameplay');
        break;
      
      case 'Check your current level in Profile':
        // Navigate to profile
        onNavigate('profile');
        break;
      
      case 'Return to menu':
        // Stay on menu - just close popup
        hideAccessDeniedPopup();
        break;
      
      case 'Try again':
        // Close popup and allow retry
        hideAccessDeniedPopup();
        break;
      
      default:
        // Default action - close popup
        hideAccessDeniedPopup();
        break;
    }
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
        <SubscriptionButton
          guestId={guestId}
          hasUser={!!user}
          className="px-5 py-2 rounded-lg bg-neutral-100 dark:bg-white/10 border border-neutral-300 dark:border-white/30 text-neutral-700 dark:text-white font-semibold text-sm hover:bg-neutral-200 dark:hover:bg-white/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          onSubscriptionChange={(isSubscribed) => {
            if (isSubscribed && onShowToast) {
              onShowToast('Welcome to the community! 🎉');
            }
          }}
          showToast={true} // Enable toast notifications
        />
      </div>

      {/* How to Play Modal */}
      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />

      {/* Access Denied Popup */}
      {popupState.accessResult && popupState.entryPoint && (
        <AccessDeniedPopup
          isVisible={popupState.isVisible}
          accessResult={popupState.accessResult}
          entryPoint={popupState.entryPoint}
          onDismiss={hideAccessDeniedPopup}
          onActionSelect={handleActionSelect}
        />
      )}
    </div>
  );
}
