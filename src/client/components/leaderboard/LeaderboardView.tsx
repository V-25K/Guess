/**
 * Leaderboard View Component
 * Displays top players and user's rank using Tailwind CSS
 * Requirements: 1.2
 */

import React, { useEffect, useState } from 'react';
import { LoadingView } from '../shared/LoadingView';
import { ErrorView } from '../shared/ErrorView';
import { LeaderboardEntry } from './LeaderboardEntry';
import { YourRankSection } from './YourRankSection';
import { useGameReducer } from '../../hooks/useGameReducer';
import { apiClient } from '../../api/client';
import type { LeaderboardResponse } from '../../api/client';

export interface LeaderboardViewProps {
  onBack?: () => void;
}

export function LeaderboardView({ onBack }: LeaderboardViewProps) {
  const { state } = useGameReducer();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [entries, setEntries] = useState<LeaderboardResponse['entries']>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchLeaderboard(1);
  }, []);

  const fetchLeaderboard = async (pageNum: number) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const data = await apiClient.getLeaderboard(20, pageNum);

      setLeaderboard(data);
      if (pageNum === 1) {
        setEntries(data.entries);
      } else {
        setEntries(prev => [...prev, ...data.entries]);
      }

      setHasMore(data.hasNextPage);
      setPage(pageNum);

    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (!loading && !loadingMore && hasMore) {
        fetchLeaderboard(page + 1);
      }
    }
  };

  if (loading && page === 1) {
    return <LoadingView message="Loading leaderboard..." />;
  }

  if (error && page === 1) {
    return (
      <ErrorView
        title="Failed to Load Leaderboard"
        message={error || 'Unable to load leaderboard data'}
        onRetry={() => fetchLeaderboard(1)}
      />
    );
  }

  // Safely extract deeply nested user rank data
  const currentUserData = {
    rank: leaderboard?.userRank?.rank ?? null,
    username: leaderboard?.userRank?.username || state.user?.username || 'You',
    level: leaderboard?.userRank?.level || state.user?.level || 1,
    totalPoints: leaderboard?.userRank?.totalPoints ?? state.user?.total_points ?? 0
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#FFF8F0] dark:bg-[#0f1419] text-neutral-900 dark:text-white/95 overflow-hidden relative">
      {/* Your Rank Section (Top) */}
      <YourRankSection
        userRank={currentUserData}
        totalPlayers={leaderboard?.totalPlayers || leaderboard?.totalEntries || 0}
        isLoading={loading && page === 1}
      />

      {/* Leaderboard List */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain p-4 pb-20 flex flex-col gap-2"
        onScroll={handleScroll}
      >
        {entries.map((entry) => (
          <LeaderboardEntry
            key={`${entry.userId}-${entry.rank}`}
            entry={entry}
            isCurrentUser={state.user?.user_id === entry.userId}
          />
        ))}

        {loadingMore && (
          <div className="text-center p-4 text-neutral-500 dark:text-white/50">
            Loading more...
          </div>
        )}

        {!hasMore && entries.length > 0 && (
          <div className="text-center py-6 text-neutral-400 dark:text-white/30 text-xs">
            {entries.length >= 100
              ? '~ Top 100 Leaderboard Complete ~'
              : `~ ${entries.length} Players on Leaderboard ~`}
          </div>
        )}
      </div>
    </div>
  );
}
