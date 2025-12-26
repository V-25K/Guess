/**
 * GameHeader Component
 * Header section showing challenge title, creator, score and attempts
 */

import React from 'react';
import { calculateWinRatio } from '../../../shared/utils/win-ratio';
import type { GameChallenge } from '../../../shared/models/challenge.types';

export interface GameHeaderProps {
  challenge: GameChallenge;
  potentialScore: number;
  attemptsRemaining: number;
  onBackToMenu: () => void;
  /** Callback when info button is clicked */
  onInfoClick?: () => void;
  /** Whether to use compact sizing for inline mode */
  compact?: boolean;
  /** User's available points */
  userPoints?: number;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  challenge,
  potentialScore,
  attemptsRemaining,
  onBackToMenu,
  onInfoClick,
  compact = false,
  userPoints,
}) => {
  if (compact) {
    // Compact single-row header for inline mode
    return (
      <div className="flex justify-between items-center px-2 py-1 bg-white dark:bg-[#1a2332] border-b border-neutral-200 dark:border-white/[0.08] flex-shrink-0">
        <button
          className="bg-transparent border-none text-neutral-700 dark:text-white/70 flex items-center justify-center p-1 cursor-pointer rounded-full hover:bg-neutral-200 dark:hover:bg-white/10 focus:outline-none transition-colors"
          onClick={onBackToMenu}
          aria-label="Back to Menu"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <h1 className="text-xs font-bold text-neutral-900 dark:text-white/95 truncate max-w-[40%]">
          {challenge.title}
        </h1>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="font-bold text-game-primary dark:text-[#f0d078]">{potentialScore}pts</span>
          <span className="text-neutral-500 dark:text-white/50">{10 - attemptsRemaining}/10</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Top Stats Bar */}
      <div className="flex justify-between items-center px-2 bg-neutral-100 dark:bg-[#1a2332] text-xs text-neutral-500 dark:text-white/50 border-b border-neutral-200 dark:border-white/[0.08] flex-shrink-0 h-9">
        <button
          className="bg-transparent border-none text-neutral-700 dark:text-white/70 flex items-center justify-center p-2 cursor-pointer w-10 h-10 rounded-full min-h-touch min-w-touch hover:bg-neutral-200 dark:hover:bg-white/10 active:bg-neutral-300 dark:active:bg-white/20 focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] transition-colors"
          onClick={onBackToMenu}
          aria-label="Back to Menu"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>

        <div className="flex gap-3 font-medium">
          <span>Played by: {challenge.players_played}</span>
          <span>Win ratio: {calculateWinRatio(challenge.players_played, challenge.players_completed).display}</span>
        </div>

        <button
          className="bg-transparent border-none text-neutral-500 dark:text-white/50 flex items-center justify-center p-1 cursor-pointer w-8 h-8 min-h-touch min-w-touch hover:text-neutral-700 dark:hover:text-white/70 focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] rounded-full transition-colors"
          aria-label="Game Info"
          onClick={onInfoClick}
        >
          <div className="w-[18px] h-[18px] border-[1.5px] border-current rounded-full flex items-center justify-center font-bold text-[11px] font-serif">
            i
          </div>
        </button>
      </div>

      {/* Challenge Header */}
      <div className="px-4 py-2 flex justify-between items-start bg-white dark:bg-[#1a2332] border-b border-neutral-200 dark:border-white/[0.08] flex-shrink-0">
        <div className="flex flex-col gap-1 max-w-[65%]">
          <h1 className="text-lg font-bold text-neutral-900 dark:text-white/95 m-0 leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
            {challenge.title}
          </h1>
          <span className="text-xs text-neutral-500 dark:text-white/50">by {challenge.creator_username}</span>
          {challenge.tags && challenge.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <span className="text-[9px] font-bold text-neutral-400 dark:text-white/40 uppercase tracking-wider">Themes:</span>
              {challenge.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className="text-sm font-bold text-game-primary dark:text-[#f0d078]">{potentialScore} pts</div>
          <div className="text-[11px] text-neutral-500 dark:text-white/50">Attempts: {10 - attemptsRemaining}/10</div>
          {userPoints !== undefined && (
            <div className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-white/50">
              <img src="/points.png" alt="" className="w-3.5 h-3.5" />
              <span>{userPoints.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
