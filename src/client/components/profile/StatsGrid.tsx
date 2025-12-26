/**
 * StatsGrid Component
 * Displays user statistics in a grid layout
 * Uses Tailwind CSS for styling
 * Requirements: 1.2, 5.3
 */

import React from 'react';

export interface StatItem {
  /** Icon source URL */
  icon: string;
  /** Alt text for the icon */
  iconAlt: string;
  /** Stat value to display */
  value: number | string;
  /** Label for the stat */
  label: string;
  /** Optional color variant for the value */
  valueVariant?: 'default' | 'primary' | 'success' | 'warning';
  /** Whether this stat should be highlighted */
  highlight?: boolean;
  /** Whether this stat spans full width */
  fullWidth?: boolean;
}

export interface StatsGridProps {
  /** Array of stat items to display */
  stats: StatItem[];
  /** Additional CSS classes */
  className?: string;
}

// Value variant classes (light and dark mode)
const VALUE_VARIANT_CLASSES: Record<string, string> = {
  default: 'text-neutral-900 dark:text-white/95',
  primary: 'text-game-primary dark:text-[#f0d078]',
  success: 'text-success dark:text-emerald-400',
  warning: 'text-warning dark:text-[#f0d078]',
};

/**
 * Individual stat card component
 */
function StatCard({ stat }: { stat: StatItem }) {
  const valueClasses = VALUE_VARIANT_CLASSES[stat.valueVariant || 'default'];

  return (
    <div
      className={`flex items-center p-2.5 px-3 bg-white dark:bg-[#1a2332] border border-neutral-200 dark:border-white/[0.08] rounded-lg gap-3 w-full min-h-[44px] ${
        stat.highlight ? 'border-game-primary dark:border-[#f0d078]/50 bg-game-primary-light/10 dark:bg-[#f0d078]/5' : ''
      }`}
    >
      <img
        src={stat.icon}
        alt={stat.iconAlt}
        className="w-5 h-5 flex-shrink-0 opacity-90"
      />
      <div className="flex flex-row items-center justify-between flex-1 min-w-0 overflow-hidden">
        <div className="text-sm font-semibold text-neutral-700 dark:text-white/70 capitalize">
          {stat.label}
        </div>
        <div className={`text-base font-bold text-right ${valueClasses}`}>
          {stat.value}
        </div>
      </div>
    </div>
  );
}

/**
 * StatsGrid component for displaying user statistics
 */
export function StatsGrid({ stats, className = '' }: StatsGridProps) {
  return (
    <div
      className={`flex flex-col gap-2 w-full flex-1 min-h-0 overflow-auto ${className}`}
      role="list"
      aria-label="User statistics"
    >
      {stats.map((stat, index) => (
        <div key={`${stat.label}-${index}`} role="listitem">
          <StatCard stat={stat} />
        </div>
      ))}
    </div>
  );
}
