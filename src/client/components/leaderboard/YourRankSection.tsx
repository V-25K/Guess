/**
 * YourRankSection Component
 * Displays the current user's rank, username, and total points
 * Persists across all pagination states
 */

import React from 'react';

export interface YourRankData {
  rank: number | null;
  username: string;
  level: number;
  totalPoints: number;
}

export interface YourRankSectionProps {
  userRank: YourRankData | null;
  totalPlayers: number;
  isLoading?: boolean;
}

/**
 * YourRankSection - Shows current user's rank regardless of pagination state
 */
export const YourRankSection: React.FC<YourRankSectionProps> = ({
  userRank,
  totalPlayers,
  isLoading = false,
}) => {
  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : '??';

  if (isLoading) {
    return (
      <div className="block relative w-full p-4 pb-2 bg-transparent z-10">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-bold text-neutral-500 dark:text-white/50 uppercase tracking-wide m-0">Your Rank</h3>
          <span className="text-[10px] text-neutral-400 dark:text-white/40 uppercase font-semibold">
            Total Players: --
          </span>
        </div>
        <div className="flex items-center bg-white dark:bg-[#1a2332] text-neutral-900 dark:text-white/95 border-2 border-game-primary dark:border-[#f0d078] rounded-xl p-3 gap-3 shadow-lg">
          <span className="text-xs text-neutral-500 dark:text-white/50">Loading...</span>
        </div>
      </div>
    );
  }

  const rankDisplay = userRank?.rank ? `#${userRank.rank}` : '--';
  const username = userRank?.username || 'You';
  const points = userRank?.totalPoints || 0;

  return (
    <div className="block relative w-full p-4 pb-2 bg-transparent z-10">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-bold text-neutral-500 dark:text-white/50 uppercase tracking-wide m-0">Your Rank</h3>
        <span className="text-[10px] text-neutral-400 dark:text-white/40 uppercase font-semibold">
          Total Players: {totalPlayers.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center bg-white dark:bg-[#1a2332] text-neutral-900 dark:text-white/95 border-2 border-game-primary dark:border-[#f0d078] rounded-xl p-3 gap-3 shadow-lg">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-[#243044] flex items-center justify-center font-bold text-neutral-600 dark:text-white/70 text-sm flex-shrink-0">
          {getInitials(username)}
        </div>

        {/* User Info */}
        <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0 overflow-hidden">
          <div className="text-sm font-semibold text-neutral-900 dark:text-white/95 whitespace-nowrap overflow-hidden text-ellipsis">
            {username} <span className="text-neutral-500 dark:text-white/50">(You)</span>
          </div>
        </div>

        {/* Rank & Points */}
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-game-primary dark:text-[#f0d078]">
            {rankDisplay}
          </div>
          <div className="text-xs font-bold text-neutral-900 dark:text-white/95">
            {points.toLocaleString()} <span className="text-[10px] text-neutral-400 dark:text-white/40 uppercase">pts</span>
          </div>
        </div>
      </div>
    </div>
  );
};
