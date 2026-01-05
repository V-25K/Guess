/**
 * Loading View Component
 * Displays a loading spinner and message
 */

import React from 'react';

interface LoadingViewProps {
  /** Loading message to display */
  message?: string;
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-[3px]',
  lg: 'w-16 h-16 border-4',
};

export function LoadingView({ message = 'Loading...', size = 'md' }: LoadingViewProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[200px] w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419]">
      <div 
        className={`
          ${sizeStyles[size]}
          border-neutral-200 dark:border-white/[0.12] border-t-game-primary dark:border-t-[#f0d078]
          rounded-full
          animate-spin motion-reduce:animate-none
        `}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading</span>
      </div>
      {message && (
        <p className="text-sm text-neutral-500 dark:text-white/50 font-medium animate-pulse motion-reduce:animate-none">
          {message}
        </p>
      )}
    </div>
  );
}
