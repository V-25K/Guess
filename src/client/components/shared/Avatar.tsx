/**
 * Avatar Component
 * Displays user avatar with image URL and fallback placeholder
 * Uses Tailwind CSS for styling
 * Requirements: 1.2, 8.4
 */

import React, { useState } from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** Image URL for the avatar */
  src?: string;
  /** Alt text for the avatar image (required for accessibility) */
  alt: string;
  /** Size of the avatar */
  size?: AvatarSize;
  /** Fallback initials to display when image fails to load */
  fallbackInitials?: string;
  /** Additional CSS classes */
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export function Avatar({
  src,
  alt,
  size = 'md',
  fallbackInitials,
  className = '',
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const showFallback = !src || imageError;

  // Generate initials from alt text if fallbackInitials not provided
  const initials = fallbackInitials || alt
    .split(' ')
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const baseClasses = [
    'inline-flex items-center justify-center',
    'rounded-full overflow-hidden',
    'bg-neutral-200 dark:bg-neutral-700',
    sizeStyles[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (showFallback) {
    return (
      <div 
        className={baseClasses}
        role="img"
        aria-label={alt}
      >
        <span className="font-semibold text-neutral-600 dark:text-neutral-300">
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className={baseClasses}>
      <img
        src={src}
        alt={alt}
        onError={handleImageError}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
