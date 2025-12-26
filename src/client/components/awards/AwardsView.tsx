/**
 * Awards View Component
 * Displays user achievements and badges
 * Uses Tailwind CSS for styling
 * Requirements: 1.2
 */

import React, { useState, useEffect } from "react";
import type { UserProfile } from "../../../shared/models/user.types.js";
import { LoadingView } from "../shared/LoadingView.js";
import { apiClient } from "../../api/client.js";
import { BadgeItem, BADGES } from "./BadgeItem";

export interface AwardsViewProps {
  userId?: string;
  username?: string;
  onBack: () => void;
  cachedProfile?: UserProfile | null;
}

export const AwardsView: React.FC<AwardsViewProps> = ({
  onBack,
  cachedProfile,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile || null);
  const [loading, setLoading] = useState(!cachedProfile);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!cachedProfile) setLoading(true);
        const data = await apiClient.getUserProfile();
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile for awards:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [cachedProfile]);

  const displayProfile = profile || cachedProfile;

  if (loading && !displayProfile) return <LoadingView />;

  if (error && !displayProfile) {
    return (
      <div className="w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419] flex flex-col text-neutral-900 dark:text-white/95 overflow-hidden">
        <div className="w-full p-4 flex items-center justify-between bg-white dark:bg-[#1a2332] border-b border-neutral-200 dark:border-white/[0.08] flex-shrink-0">
          <h2 className="text-xl font-extrabold uppercase tracking-wide text-neutral-900 dark:text-white/95 m-0">Awards</h2>
          <button
            onClick={onBack}
            className="bg-transparent border-none text-neutral-900 dark:text-white/95 text-2xl cursor-pointer p-0 min-h-touch min-w-touch flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] rounded-game-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex items-center justify-center h-full text-neutral-500 dark:text-white/50">
          <p>Failed to load awards. Please try again.</p>
        </div>
      </div>
    );
  }

  if (!displayProfile) return null;

  const unlockedCount = BADGES.filter((b) => b.condition(displayProfile)).length;

  return (
    <div className="w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419] flex flex-col text-neutral-900 dark:text-white/95 overflow-hidden">
      <div className="w-full p-4 flex items-center justify-between bg-white dark:bg-[#1a2332] border-b border-neutral-200 dark:border-white/[0.08] flex-shrink-0">
        <h2 className="text-xl font-extrabold uppercase tracking-wide text-neutral-900 dark:text-white/95 m-0">Awards</h2>
        <div className="flex gap-3 items-center">
          <span className="text-sm font-semibold text-game-primary dark:text-[#f0d078] bg-game-primary/10 dark:bg-[#f0d078]/10 py-1 px-3 rounded-full">
            {unlockedCount}/{BADGES.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-20 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 w-full sm:grid-cols-3 lg:grid-cols-4">
          {BADGES.map((badge) => (
            <BadgeItem key={badge.id} badge={badge} profile={displayProfile} />
          ))}
        </div>
      </div>
    </div>
  );
};
