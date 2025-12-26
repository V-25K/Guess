/**
 * Profile View Component (React)
 * Displays user statistics and progression
 * Uses Tailwind CSS for styling
 * Requirements: 1.2, 5.3
 */

import React, { useEffect, useState } from 'react';
import { LoadingView } from '../shared/LoadingView';
import { ErrorView } from '../shared/ErrorView';
import { StatsGrid, StatItem } from './StatsGrid';
import { apiClient } from '../../api/client';
import { getExpForLevel } from '../../../shared/utils/level-calculator';
import type { UserProfile } from '../../../shared/models/user.types';

export interface ProfileViewProps {
  onBack?: () => void;
}

export function ProfileView({ onBack }: ProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getUserProfile();
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading profile..." />;
  }

  if (error || !profile) {
    return (
      <ErrorView
        title="Failed to Load Profile"
        message={error || 'Unable to load profile data'}
        onRetry={fetchProfile}
      />
    );
  }

  const successRate = profile.challenges_attempted > 0
    ? Math.round((profile.challenges_solved / profile.challenges_attempted) * 100)
    : 0;

  // Calculate XP progress for current level
  const expForNextLevel = getExpForLevel(profile.level + 1);
  let totalExpForCurrentLevel = 0;
  for (let i = 2; i <= profile.level; i++) {
    totalExpForCurrentLevel += getExpForLevel(i);
  }
  const currentLevelExp = profile.total_experience - totalExpForCurrentLevel;
  const progressPercentage = Math.min((currentLevelExp / expForNextLevel) * 100, 100);

  // Build stats array for StatsGrid
  const stats: StatItem[] = [
    {
      icon: '/points.png',
      iconAlt: 'Points',
      value: profile.total_points,
      label: 'Points',
      valueVariant: 'primary',
    },
    {
      icon: '/win_rate.png',
      iconAlt: 'Win Rate',
      value: `${successRate}%`,
      label: 'Win Ratio',
      valueVariant: 'success',
    },
    {
      icon: '/novice_solver.png',
      iconAlt: 'Solved',
      value: profile.challenges_solved,
      label: 'Solved',
    },
    {
      icon: '/creator.png',
      iconAlt: 'Created',
      value: profile.challenges_created,
      label: 'Created',
    },
    {
      icon: '/streak_master.png',
      iconAlt: 'Streak',
      value: profile.current_streak || 0,
      label: 'Streak',
      valueVariant: profile.current_streak > 0 ? 'warning' : 'default',
      highlight: profile.current_streak > 0,
    },
    {
      icon: '/rising_star.png',
      iconAlt: 'Best Streak',
      value: profile.best_streak || 0,
      label: 'Best Streak',
    },
    {
      icon: '/total_attempted.png',
      iconAlt: 'Total Attempted',
      value: profile.challenges_attempted,
      label: 'Attempts',
    }
  ];

  return (
    <div className="flex flex-col p-3 pb-3 gap-3 w-full h-full min-h-0 bg-[#FFF8F0] dark:bg-[#0f1419] overflow-hidden">
      {/* Header Card - Username & Level */}
      <div className="flex flex-row items-center text-left gap-3 w-full p-3 bg-white dark:bg-[#1a2332] rounded-xl border border-neutral-200 dark:border-white/[0.08] flex-shrink-0">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`${profile.username}'s profile avatar`}
            className="w-14 h-14 rounded-full flex-shrink-0 object-cover"
          />
        ) : (
          <div
            className="text-[32px] w-14 h-14 flex items-center justify-center bg-neutral-100 dark:bg-[#243044] rounded-full flex-shrink-0"
            role="img"
            aria-label={`${profile.username}'s default avatar`}
          >
            👤
          </div>
        )}

        <div className="flex-1 flex flex-col items-start gap-1">
          <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white/95 m-0 leading-tight">
            {profile.username}
          </h2>
          <div className="flex flex-col items-start gap-0.5 text-sm text-neutral-500 dark:text-white/50 font-medium w-full">
            <span className="text-game-primary dark:text-[#f0d078] font-bold">Level {profile.level}</span>
            
            {/* Experience Display */}
            <div className="flex items-center gap-2 mt-1 w-full">
              <img
                src="/exp.png"
                alt="Experience points icon"
                className="w-4 h-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span aria-label={`${profile.total_experience} experience points`}>{profile.total_experience} XP</span>
              
              {/* XP Progress Bar */}
              <div className="flex-1 ml-2 max-w-[120px]">
                <div
                  className="w-full h-2 bg-neutral-100 dark:bg-[#243044] rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(progressPercentage)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Level progress: ${Math.round(progressPercentage)}%`}
                >
                  <div
                    className="h-full bg-gradient-to-r from-game-accent to-amber-500 dark:from-[#d4a84b] dark:to-[#f0d078] rounded-full transition-all duration-300 motion-reduce:transition-none"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats List */}
      <StatsGrid stats={stats} />

      <p className="text-xs text-neutral-400 dark:text-white/30 text-center mt-auto py-2 flex-shrink-0">
        Data refreshes automatically
      </p>
    </div>
  );
}
