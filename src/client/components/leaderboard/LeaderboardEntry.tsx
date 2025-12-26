/**
 * LeaderboardEntry Component
 * Displays a single leaderboard entry with rank, username, level, and points
 * Uses Tailwind CSS for styling
 * Requirements: 1.2
 */

import React from 'react';

export interface LeaderboardEntryData {
  userId: string;
  username: string;
  level: number;
  totalPoints: number;
  rank: number;
}

export interface LeaderboardEntryProps {
  /** Entry data */
  entry: LeaderboardEntryData;
  /** Whether this is the current user */
  isCurrentUser?: boolean;
}

/**
 * Returns medal emoji for top 3 ranks, or formatted rank number
 */
function getMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
}

// Avatar styles for top 3 ranks
const TOP_RANK_AVATAR_STYLES: Record<number, string> = {
  1: 'border-yellow-400 bg-yellow-400/20 text-yellow-400',
  2: 'border-gray-300 bg-gray-300/20 text-gray-300',
  3: 'border-amber-600 bg-amber-600/20 text-amber-600',
};

export function LeaderboardEntry({ entry, isCurrentUser = false }: LeaderboardEntryProps) {
  if (!entry) {
    return null;
  }

  const isTopThree = entry.rank <= 3;

  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : '??';

  const avatarClasses = isTopThree
    ? TOP_RANK_AVATAR_STYLES[entry.rank]
    : 'bg-neutral-100 dark:bg-[#243044] text-neutral-600 dark:text-white/70 border-transparent';

  return (
    <div
      className={`flex items-center bg-white dark:bg-[#1a2332] border border-neutral-200 dark:border-white/[0.08] rounded-xl p-3 gap-3 transition-all duration-200 motion-reduce:transition-none hover:border-game-primary dark:hover:border-[#f0d078]/50 ${
        isCurrentUser ? 'border-game-primary dark:border-[#f0d078]/50 bg-game-primary/5 dark:bg-[#f0d078]/5' : ''
      }`}
      role="listitem"
      aria-label={`Rank ${entry.rank}: ${entry.username}, ${entry.totalPoints} points`}
    >
      <div className="w-[32px] text-base font-bold text-neutral-400 dark:text-white/40 text-left">
        <span className={isTopThree ? 'text-lg' : ''}>
          {getMedal(entry.rank)}
        </span>
      </div>

      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 border-2 ${avatarClasses}`}
      >
        {getInitials(entry.username)}
      </div>

      <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0 overflow-hidden">
        <div className="text-sm font-semibold text-neutral-900 dark:text-white/95 whitespace-nowrap overflow-hidden text-ellipsis">
          {entry.username} {isCurrentUser && <span className="text-neutral-500 dark:text-white/50">(You)</span>}
        </div>
      </div>

      <div className="text-right flex-shrink-0 flex flex-col items-end">
        <div className="text-sm font-bold text-neutral-900 dark:text-white/95">
          {Number(entry?.totalPoints || 0).toLocaleString()}
        </div>
        <div className="text-[10px] text-neutral-400 dark:text-white/40 uppercase">pts</div>
      </div>
    </div>
  );
}
