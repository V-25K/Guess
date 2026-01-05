/**
 * LeaderboardPreview Component
 * Displays a compact preview of the leaderboard on the main menu
 * Shows top 5 players and current user's rank if outside top 5
 */

import React from 'react';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  userId: string;
}

export interface UserRankInfo {
  rank: number;
  username: string;
  points: number;
}

export interface LeaderboardPreviewProps {
  /** Array of leaderboard entries */
  entries: LeaderboardEntry[];
  /** Total number of players */
  totalPlayers: number;
  /** Current user's ID for highlighting */
  currentUserId: string;
  /** Current user's rank info (if outside top 5) */
  currentUserRank?: UserRankInfo;
  /** Callback when user wants to view full leaderboard */
  onViewFull: (event: React.MouseEvent) => void;
}

const MAX_ENTRIES = 5;

/**
 * Returns medal emoji for top 3 ranks
 */
function getMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
}

/**
 * LeaderboardPreview Component
 * Compact leaderboard display for the main menu
 */
export function LeaderboardPreview({
  entries,
  totalPlayers,
  currentUserId,
  currentUserRank,
  onViewFull,
}: LeaderboardPreviewProps) {
  // Limit entries to maximum of 5
  const displayEntries = entries.slice(0, MAX_ENTRIES);
  
  // Check if current user is in top 5
  const isUserInTop5 = displayEntries.some(entry => entry.userId === currentUserId);
  
  // Show "Your Rank" section if user is outside top 5
  const showYourRank = !isUserInTop5 && currentUserRank && currentUserRank.rank > MAX_ENTRIES;

  return (
    <div className="w-full max-w-[320px] mx-auto bg-slate-800/50 rounded-game-md p-3 flex flex-col gap-2">
      {/* Header with total players */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Total Players: {totalPlayers.toLocaleString()}
        </h3>
        <button
          onClick={onViewFull}
          className="text-xs text-game-primary hover:text-game-primary/80 transition-colors"
          aria-label="View full leaderboard"
        >
          View All
        </button>
      </div>

      {/* Leaderboard entries */}
      <div className="flex flex-col gap-1.5" role="list" aria-label="Top 5 players">
        {displayEntries.map((entry) => {
          const isCurrentUser = entry.userId === currentUserId;
          const isTopThree = entry.rank <= 3;
          
          return (
            <div
              key={entry.userId}
              data-testid={`leaderboard-entry-${entry.rank}`}
              data-user-highlight={isCurrentUser ? 'true' : 'false'}
              className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                isCurrentUser 
                  ? 'bg-game-primary/20 border border-game-primary/50' 
                  : 'bg-slate-700/50'
              }`}
              role="listitem"
              aria-label={`Rank ${entry.rank}: ${entry.username}, ${entry.points} points${isCurrentUser ? ' (You)' : ''}`}
            >
              {/* Rank */}
              <span className={`w-6 text-center font-bold ${isTopThree ? 'text-base' : 'text-sm text-slate-400'}`}>
                {getMedal(entry.rank)}
              </span>
              
              {/* Username */}
              <span className={`flex-1 text-sm truncate ${isCurrentUser ? 'text-game-primary font-semibold' : 'text-slate-100'}`}>
                {entry.username}
                {isCurrentUser && ' (You)'}
              </span>
              
              {/* Points */}
              <span className="text-sm font-medium text-slate-300">
                {entry.points.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Your Rank section - shown if user is outside top 5 */}
      {showYourRank && currentUserRank && (
        <div 
          className="mt-2 pt-2 border-t border-slate-600"
          data-testid="your-rank-section"
        >
          <div className="flex items-center gap-2 p-2 bg-game-primary/20 border border-game-primary/50 rounded-md">
            <span className="w-6 text-center text-sm font-bold text-slate-400">
              {currentUserRank.rank}.
            </span>
            <span className="flex-1 text-sm text-game-primary font-semibold truncate">
              {currentUserRank.username} (You)
            </span>
            <span className="text-sm font-medium text-slate-300">
              {currentUserRank.points.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {displayEntries.length === 0 && (
        <div className="text-center py-4 text-slate-400 text-sm">
          No players yet. Be the first!
        </div>
      )}
    </div>
  );
}
