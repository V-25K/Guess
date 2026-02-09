/**
 * UI Consistency Utilities
 * Standardized styling patterns and component consistency helpers
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - UI consistency and accessibility standards
 */

import { clsx } from 'clsx';

/**
 * Standardized button style variants
 * Ensures consistent button appearance across all components
 */
export const BUTTON_STYLES = {
  // Base styles applied to all buttons
  base: [
    'inline-flex items-center justify-center gap-2',
    'font-semibold rounded-full',
    'transition-all duration-200 ease-out motion-reduce:transition-none',
    'focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] focus:ring-offset-2 dark:focus:ring-offset-[#1a2332]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none',
    'select-none whitespace-nowrap',
    'min-h-touch min-w-touch' // Accessibility: minimum touch target size
  ].join(' '),

  // Size variants
  sizes: {
    xs: 'px-2 py-1 text-xs min-h-[24px]',
    sm: 'px-3 py-1.5 text-sm min-h-[32px]',
    md: 'px-4 py-2 text-base min-h-touch min-w-touch',
    lg: 'px-6 py-3 text-lg min-h-[48px]',
  },

  // Visual variants
  variants: {
    primary: 'bg-game-primary dark:bg-gradient-to-r dark:from-[#d4a84b] dark:to-[#f0d078] text-white dark:text-[#1a2332] dark:font-bold hover:bg-game-primary-hover dark:hover:from-[#e4b85b] dark:hover:to-[#fff088] active:scale-95 shadow-md dark:shadow-[0_4px_12px_rgba(240,208,120,0.25)] hover:shadow-lg',
    secondary: 'bg-white dark:bg-[#2d3a4f] text-neutral-900 dark:text-white/95 border border-neutral-200 dark:border-white/[0.12] hover:bg-neutral-50 dark:hover:bg-[#3a4a62] hover:border-neutral-300 dark:hover:border-white/20 active:scale-95 shadow-sm dark:shadow-black/20 hover:shadow-md',
    ghost: 'bg-transparent text-neutral-700 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/[0.08] active:scale-95',
    danger: 'bg-red-500 dark:bg-red-500/90 text-white hover:bg-red-600 dark:hover:bg-red-500 active:scale-95 shadow-md hover:shadow-lg',
    // Small action buttons (like hint, next, give up)
    action: 'bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-white/70 hover:bg-neutral-300 dark:hover:bg-white/20 active:scale-95',
    // Action button with specific color on hover
    actionHint: 'bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-white/70 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400',
    actionNext: 'bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-white/70 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400',
    actionDanger: 'bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-white/70 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400',
  }
} as const;

/**
 * Standardized popup/modal styling
 * Ensures consistent popup appearance across all components
 */
export const POPUP_STYLES = {
  // Overlay background
  overlay: [
    'fixed inset-0 z-[9999] flex items-center justify-center',
    'bg-black/50 dark:bg-black/70',
    'animate-in fade-in duration-200',
    'p-4'
  ].join(' '),

  // Modal container
  container: [
    'w-full max-w-sm',
    'bg-white dark:bg-[#1a2332]',
    'border border-neutral-200 dark:border-white/[0.08]',
    'rounded-2xl',
    'shadow-xl dark:shadow-2xl',
    'animate-in zoom-in-95 duration-200',
    'overflow-hidden'
  ].join(' '),

  // Header section
  header: 'p-6 pb-4',

  // Content section
  content: 'px-6 pb-4',

  // Footer section
  footer: 'p-6 pt-2 border-t border-neutral-100 dark:border-white/[0.05]',

  // Icon container
  iconContainer: [
    'flex items-center justify-center w-10 h-10 rounded-full',
    'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
  ].join(' '),

  // Title text
  title: 'text-lg font-bold text-neutral-900 dark:text-white/95',

  // Message text
  message: 'text-sm text-neutral-600 dark:text-white/70 leading-relaxed',

  // Action button in popup
  actionButton: [
    'w-full text-left px-3 py-2',
    'bg-neutral-50 dark:bg-white/[0.05]',
    'border border-neutral-200 dark:border-white/[0.08]',
    'rounded-lg',
    'text-sm text-neutral-700 dark:text-white/80',
    'hover:bg-neutral-100 dark:hover:bg-white/[0.08]',
    'focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078]',
    'transition-colors duration-150'
  ].join(' ')
} as const;

/**
 * Standardized navigation styling
 * Ensures consistent navigation appearance across all components
 */
export const NAVIGATION_STYLES = {
  // Navigation bar container
  container: [
    'flex justify-around items-center',
    'bg-white dark:bg-[#1a2332]',
    'border-t border-neutral-200 dark:border-white/[0.08]',
    'px-4 py-2',
    'fixed bottom-0 left-0 w-full',
    'z-[1000]',
    'h-[60px]',
    'shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]'
  ].join(' '),

  // Navigation item base styles
  itemBase: [
    'flex items-center justify-center',
    'w-12 h-12 min-w-touch min-h-touch',
    'rounded-xl',
    'border-none bg-transparent',
    'cursor-pointer',
    'transition-all duration-200 motion-reduce:transition-none',
    'focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] focus:ring-offset-2 dark:focus:ring-offset-[#1a2332]'
  ].join(' '),

  // Navigation item states
  itemActive: 'text-game-primary bg-game-primary/10 dark:text-[#f0d078] dark:bg-[#f0d078]/15',
  itemInactive: 'text-neutral-500 hover:text-game-primary hover:bg-neutral-100 dark:text-white/50 dark:hover:text-[#f0d078] dark:hover:bg-white/[0.08]'
} as const;

/**
 * Standardized form input styling
 * Ensures consistent form appearance across all components
 */
export const INPUT_STYLES = {
  base: [
    'rounded-full border border-neutral-200 dark:border-white/[0.12]',
    'bg-neutral-50 dark:bg-[#1a2332]',
    'text-neutral-900 dark:text-white/95',
    'outline-none transition-colors duration-200 motion-reduce:transition-none',
    'focus:border-game-primary dark:focus:border-[#f0d078]',
    'focus:ring-2 focus:ring-game-primary/20 dark:focus:ring-[#f0d078]/20',
    'placeholder:text-neutral-400 dark:placeholder:text-white/40',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ].join(' '),

  sizes: {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }
} as const;

/**
 * Generate consistent button classes
 */
export function getButtonClasses(
  variant: keyof typeof BUTTON_STYLES.variants = 'primary',
  size: keyof typeof BUTTON_STYLES.sizes = 'md',
  fullWidth = false,
  loading = false,
  className = ''
): string {
  return clsx(
    BUTTON_STYLES.base,
    BUTTON_STYLES.variants[variant],
    BUTTON_STYLES.sizes[size],
    fullWidth && 'w-full',
    loading && 'pointer-events-none',
    className
  );
}

/**
 * Generate consistent navigation item classes
 */
export function getNavigationItemClasses(isActive: boolean, className = ''): string {
  return clsx(
    NAVIGATION_STYLES.itemBase,
    isActive ? NAVIGATION_STYLES.itemActive : NAVIGATION_STYLES.itemInactive,
    className
  );
}

/**
 * Generate consistent input classes
 */
export function getInputClasses(
  size: keyof typeof INPUT_STYLES.sizes = 'md',
  className = ''
): string {
  return clsx(
    INPUT_STYLES.base,
    INPUT_STYLES.sizes[size],
    className
  );
}

/**
 * Accessibility helpers
 */
export const ACCESSIBILITY = {
  // Screen reader only text
  srOnly: 'sr-only',
  
  // Skip link for keyboard navigation
  skipLink: [
    'absolute top-[-100%] left-0 z-50',
    'bg-game-primary text-white',
    'px-4 py-2 rounded-md',
    'transition-all duration-200',
    'focus:top-0'
  ].join(' '),

  // Focus visible styles
  focusVisible: 'focus-visible:outline-2 focus-visible:outline-game-primary focus-visible:outline-offset-2',

  // Touch target minimum size
  touchTarget: 'min-h-touch min-w-touch',

  // High contrast mode support
  highContrast: '@media (prefers-contrast: high) { outline-width: 3px; outline-style: solid; }'
} as const;