/**
 * AllCaughtUpView Component
 * Displayed when the player has completed all available challenges
 */

import React from 'react';
import { Button } from '../shared/Button';

export interface AllCaughtUpViewProps {
  onBackToMenu: () => void;
  onCreateChallenge?: () => void;
  canCreate?: boolean;
}

export function AllCaughtUpView({
  onBackToMenu,
  onCreateChallenge,
  canCreate = false,
}: AllCaughtUpViewProps) {
  return (
    <div className="w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419] flex flex-col items-center justify-center p-6 text-center">
      {/* Celebration Icon */}
      <div className="text-6xl mb-4 animate-bounce">🎉</div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
        You're All Caught Up!
      </h1>

      {/* Message */}
      <p className="text-neutral-600 dark:text-white/70 mb-6 max-w-[280px]">
        Amazing! You've completed all available challenges. Check back later for new ones!
      </p>

      {/* Stats Card */}
      <div className="bg-white dark:bg-[#1a2332] rounded-xl border border-neutral-200 dark:border-white/10 p-4 mb-6 w-full max-w-[280px]">
        <div className="flex items-center justify-center gap-2 text-game-primary dark:text-[#f0d078]">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-semibold">All Challenges Completed</span>
        </div>
      </div>

      {/* Suggestions */}
      <div className="space-y-3 w-full max-w-[280px]">
        <p className="text-xs text-neutral-500 dark:text-white/50 uppercase tracking-wide font-semibold">
          What's next?
        </p>

        {/* Create Challenge Option */}
        {canCreate && onCreateChallenge && (
          <button
            onClick={onCreateChallenge}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#FF4500] to-[#FF6B35] dark:from-[#3b5998] dark:to-[#5a7fc2] text-white font-semibold flex items-center justify-center gap-2 shadow-md hover:from-[#E03D00] hover:to-[#E55A2B] dark:hover:from-[#4a6aa8] dark:hover:to-[#6a8fd2] transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Create a Challenge
          </button>
        )}

        {/* Back to Menu */}
        <Button variant="secondary" fullWidth onClick={onBackToMenu}>
          Back to Menu
        </Button>
      </div>

      {/* Footer hint */}
      <p className="text-xs text-neutral-400 dark:text-white/30 mt-8">
        New challenges are added regularly by the community
      </p>
    </div>
  );
}
