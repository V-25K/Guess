/**
 * Error View Component
 * Displays error messages with optional retry action
 */

import React from 'react';
import { Button } from './Button';

interface ErrorViewProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorView({ 
  title = 'Something went wrong', 
  message, 
  onRetry 
}: ErrorViewProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-0 p-6 gap-4 text-center w-full h-full bg-[#FFF8F0] dark:bg-[#0f1419]">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
        <span className="text-3xl">⚠️</span>
      </div>
      <h2 className="text-xl font-bold text-neutral-900 dark:text-white/95">{title}</h2>
      <p className="text-neutral-600 dark:text-white/50 max-w-[400px]">{message}</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
