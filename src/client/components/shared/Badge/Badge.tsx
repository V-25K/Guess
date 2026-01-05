/**
 * Badge Component
 * Reusable badge for displaying status, labels, or counts
 */

import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'error' | 'warning';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  /** Badge content */
  children: React.ReactNode;
  /** Visual style variant */
  variant?: BadgeVariant;
  /** Size of the badge */
  size?: BadgeSize;
  /** Additional CSS classes */
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-100 dark:bg-[#243044] text-neutral-900 dark:text-white/95',
  success: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400',
  error: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
  warning: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}: BadgeProps) {
  const classes = [
    'inline-flex items-center justify-center',
    'font-medium leading-tight',
    'rounded-game-full whitespace-nowrap',
    variantStyles[variant],
    sizeStyles[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {children}
    </span>
  );
}
