/**
 * Input Component
 * Reusable text input with label, error, and helper text support
 */

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text displayed above the input */
  label?: string;
  /** Error message to display (applies error styling) */
  error?: string;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Whether input should take full width of container */
  fullWidth?: boolean;
  /** Content to display on the left side of the input */
  leftAddon?: React.ReactNode;
  /** Content to display on the right side of the input */
  rightAddon?: React.ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  fullWidth = false,
  leftAddon,
  rightAddon,
  className = '',
  id,
  disabled,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText && !error ? `${inputId}-helper` : undefined;
  const describedBy = errorId || helperId;
  
  const wrapperClasses = [
    'flex flex-col gap-1',
    fullWidth ? 'w-full' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inputContainerClasses = [
    'flex items-stretch relative rounded-xl bg-white dark:bg-[#2d3a4f] border transition-all duration-200 motion-reduce:transition-none',
    error 
      ? 'border-red-500 dark:border-red-500/50 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20' 
      : 'border-neutral-200 dark:border-white/[0.12] hover:border-neutral-400 dark:hover:border-white/20 focus-within:border-game-primary dark:focus-within:border-[#f0d078] focus-within:ring-2 focus-within:ring-game-primary/20 dark:focus-within:ring-[#f0d078]/20',
    disabled ? 'opacity-50 cursor-not-allowed bg-neutral-100 dark:bg-[#243044]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inputClasses = [
    'flex-1 min-w-0 px-4 py-2 min-h-touch',
    'font-sans text-base text-neutral-900 dark:text-white/95 bg-transparent',
    'border-none outline-none',
    'placeholder:text-neutral-400 dark:placeholder:text-white/30',
    'disabled:cursor-not-allowed disabled:text-neutral-500 dark:disabled:text-white/30',
    leftAddon ? 'rounded-l-none' : 'rounded-l-xl',
    rightAddon ? 'rounded-r-none' : 'rounded-r-xl',
    error ? 'text-red-600 dark:text-red-400' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const addonClasses = 'flex items-center justify-center px-3 text-base text-neutral-500 dark:text-white/50 bg-neutral-100 dark:bg-[#243044] whitespace-nowrap select-none';

  return (
    <div className={wrapperClasses}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="text-sm font-medium text-neutral-900 dark:text-white/95"
        >
          {label}
        </label>
      )}
      <div className={inputContainerClasses}>
        {leftAddon && (
          <span 
            className={`${addonClasses} border-r border-neutral-200 dark:border-white/[0.12] rounded-l-xl`} 
            aria-hidden="true"
          >
            {leftAddon}
          </span>
        )}
        <input
          id={inputId}
          className={inputClasses}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {rightAddon && (
          <span 
            className={`${addonClasses} border-l border-neutral-200 dark:border-white/[0.12] rounded-r-xl`} 
            aria-hidden="true"
          >
            {rightAddon}
          </span>
        )}
      </div>
      {error && (
        <span 
          id={errorId} 
          className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400" 
          role="alert"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={helperId} className="text-sm text-neutral-500 dark:text-white/50">
          {helperText}
        </span>
      )}
    </div>
  );
}
