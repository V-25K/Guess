/**
 * BadgeItem Component
 * Displays a single badge/award item
 */

import React from 'react';
import type { UserProfile } from '../../../shared/models/user.types.js';

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  condition: (profile: UserProfile) => boolean;
  progressLabel?: (profile: UserProfile) => string;
};

export const BADGES: Badge[] = [
  {
    id: "novice_solver",
    name: "Novice Solver",
    description: "Solve your first challenge",
    icon: "/novice_solver.png",
    color: "#4CAF50",
    condition: (p) => p.challenges_solved >= 1,
    progressLabel: (p) => `${p.challenges_solved}/1`,
  },
  {
    id: "expert_solver",
    name: "Expert Solver",
    description: "Solve 50 challenges",
    icon: "/expert_solver.png",
    color: "#2196F3",
    condition: (p) => p.challenges_solved >= 50,
    progressLabel: (p) => `${p.challenges_solved}/50`,
  },
  {
    id: "creator",
    name: "Creator",
    description: "Create a challenge",
    icon: "/creator.png",
    color: "#9C27B0",
    condition: (p) => p.challenges_created >= 1,
    progressLabel: (p) => `${p.challenges_created}/1`,
  },
  {
    id: "master_creator",
    name: "Master Creator",
    description: "Create 10 challenges",
    icon: "/master_creator.png",
    color: "#673AB7",
    condition: (p) => p.challenges_created >= 10,
    progressLabel: (p) => `${p.challenges_created}/10`,
  },
  {
    id: "streak_master",
    name: "Streak Master",
    description: "Reach a streak of 5",
    icon: "/streak_master.png",
    color: "#FF5722",
    condition: (p) => (p.best_streak || 0) >= 5,
    progressLabel: (p) => `${p.best_streak || 0}/5`,
  },
  {
    id: "point_millionaire",
    name: "High Roller",
    description: "Earn 1000 points",
    icon: "/high_roller.png",
    color: "#00BCD4",
    condition: (p) => p.total_points >= 1000,
    progressLabel: (p) => `${p.total_points}/1000`,
  },
  {
    id: "level_5",
    name: "Rising Star",
    description: "Reach Level 5",
    icon: "/rising_star.png",
    color: "#FFC107",
    condition: (p) => p.level >= 5,
    progressLabel: (p) => `Lvl ${p.level}/5`,
  },
];

export interface BadgeItemProps {
  badge: Badge;
  profile: UserProfile;
}

export const BadgeItem: React.FC<BadgeItemProps> = ({ badge, profile }) => {
  const isUnlocked = badge.condition(profile);
  const statusText = isUnlocked ? 'Unlocked' : 'Locked';

  return (
    <div
      className={`aspect-[1/1.2] bg-white dark:bg-[#1a2332] rounded-xl p-3 flex flex-col items-center justify-center gap-2 border-2 transition-all duration-200 motion-reduce:transition-none relative text-center ${
        isUnlocked
          ? 'shadow-md'
          : 'border-neutral-200 dark:border-white/[0.08] opacity-60 grayscale-[0.7]'
      }`}
      style={isUnlocked ? { borderColor: badge.color } : {}}
      role="article"
      aria-label={`${badge.name} badge - ${statusText}`}
    >
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center ${
          isUnlocked
            ? 'bg-white/50 dark:bg-white/5'
            : 'bg-neutral-100 dark:bg-[#243044]'
        }`}
      >
        <img
          src={badge.icon}
          alt=""
          aria-hidden="true"
          className="w-9 h-9 object-contain"
        />
      </div>

      <span className="text-xs font-bold text-neutral-900 dark:text-white/95 leading-tight">{badge.name}</span>
      <span className="text-[10px] text-neutral-500 dark:text-white/50 leading-tight">{badge.description}</span>

      {!isUnlocked && badge.progressLabel && (
        <span className="text-[10px] font-bold text-game-primary dark:text-[#f0d078] mt-auto uppercase" aria-label={`Progress: ${badge.progressLabel(profile)}`}>
          {badge.progressLabel(profile)}
        </span>
      )}
      
      {/* Screen reader only status */}
      <span className="sr-only">{statusText}</span>
    </div>
  );
};
