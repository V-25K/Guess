/**
 * Button Component
 * Reusable button with different variants and sizes
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - UI consistency and accessibility standards
 */

import React from 'react';
import { getButtonClasses } from '../../utils/ui-consistency';
import { LoadingSpinner, ButtonIcon } from './UIConsistencyComponents';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'action' | 'actionHint' | 'actionNext' | 'actionDanger';
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
  const classes = getButtonClasses(variant, size, fullWidth, loading, className);

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          <span className="opacity-70">{children}</span>
        </>
      ) : (
        <>
          {leftIcon && <ButtonIcon position="left">{leftIcon}</ButtonIcon>}
          <span className="inline-flex items-center">{children}</span>
          {rightIcon && <ButtonIcon position="right">{rightIcon}</ButtonIcon>}
        </>
      )}
    </button>
  );
}
