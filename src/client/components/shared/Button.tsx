/**
 * Button Component
 * Reusable button with different variants and sizes
 */

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Whether button should take full width of container */
  fullWidth?: boolean;
  /** Shows loading spinner and disables interaction */
  loading?: boolean;
  /** Icon to display before button text */
  leftIcon?: React.ReactNode;
  /** Icon to display after button text */
  rightIcon?: React.ReactNode;
  /** Button content */
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-game-primary dark:bg-gradient-to-r dark:from-[#d4a84b] dark:to-[#f0d078] text-white dark:text-[#1a2332] dark:font-bold hover:bg-game-primary-hover dark:hover:from-[#e4b85b] dark:hover:to-[#fff088] active:scale-95 shadow-md dark:shadow-[0_4px_12px_rgba(240,208,120,0.25)] hover:shadow-lg',
  secondary: 'bg-white dark:bg-[#2d3a4f] text-neutral-900 dark:text-white/95 border border-neutral-200 dark:border-white/[0.12] hover:bg-neutral-50 dark:hover:bg-[#3a4a62] hover:border-neutral-300 dark:hover:border-white/20 active:scale-95 shadow-sm dark:shadow-black/20 hover:shadow-md',
  ghost: 'bg-transparent text-neutral-700 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/[0.08] active:scale-95',
  danger: 'bg-red-500 dark:bg-red-500/90 text-white hover:bg-red-600 dark:hover:bg-red-500 active:scale-95 shadow-md hover:shadow-lg',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs min-h-[24px]',
  sm: 'px-3 py-1.5 text-sm min-h-[32px]',
  md: 'px-4 py-2 text-base min-h-touch min-w-touch',
  lg: 'px-6 py-3 text-lg min-h-[48px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = [
    'inline-flex items-center justify-center gap-2',
    'font-semibold rounded-full',
    'transition-all duration-200 ease-out motion-reduce:transition-none',
    'focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] focus:ring-offset-2 dark:focus:ring-offset-[#1a2332]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none',
    'select-none whitespace-nowrap',
  ].join(' ');

  const classes = [
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth ? 'w-full' : '',
    loading ? 'pointer-events-none' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span 
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" 
            aria-hidden="true"
          />
          <span className="opacity-70">{children}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="inline-flex items-center justify-center flex-shrink-0" aria-hidden="true">{leftIcon}</span>}
          <span className="inline-flex items-center">{children}</span>
          {rightIcon && <span className="inline-flex items-center justify-center flex-shrink-0" aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
