/**
 * Card Component
 * Reusable card container with different variants and padding options
 * Uses Tailwind CSS for styling
 * Requirements: 1.2, 4.2
 */

import React from 'react';

export type CardVariant = 'default' | 'elevated' | 'outlined';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Visual style variant */
  variant?: CardVariant;
  /** Padding size */
  padding?: CardPadding;
  /** Additional CSS classes */
  className?: string;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white dark:bg-[#1a2332] shadow-sm dark:shadow-black/20',
  elevated: 'bg-white dark:bg-[#1a2332] shadow-md dark:shadow-black/30 hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-all duration-200 motion-reduce:transition-none',
  outlined: 'bg-white dark:bg-[#1a2332] border border-neutral-200 dark:border-white/[0.12] hover:border-neutral-300 dark:hover:border-white/20 transition-colors duration-200 motion-reduce:transition-none',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
}: CardProps) {
  const classes = [
    'rounded-game-md',
    variantStyles[variant],
    paddingStyles[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}
