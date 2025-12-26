/**
 * Toast Component
 * Notification component with auto-dismiss functionality
 * Uses Tailwind CSS for styling with reduced-motion support
 * Requirements: 1.2, 8.5
 */

import React, { useEffect, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  /** Unique identifier for the toast */
  id: string;
  /** Message to display */
  message: string;
  /** Type of toast (determines styling) */
  type: ToastType;
  /** Duration in milliseconds before auto-dismiss (default: 5000) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss: (id: string) => void;
}

/** Default duration for auto-dismiss in milliseconds */
export const DEFAULT_TOAST_DURATION = 5000;

const typeStyles: Record<ToastType, string> = {
  success: 'bg-success-light text-success-text border-success',
  error: 'bg-error-light text-error-text border-error',
  warning: 'bg-warning-light text-warning-text border-warning',
  info: 'bg-info-light text-info-text border-info',
};

export function Toast({
  id,
  message,
  type,
  duration = DEFAULT_TOAST_DURATION,
  onDismiss,
}: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const handleDismiss = useCallback(() => {
    onDismiss(id);
  }, [id, onDismiss]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    
    // Set up auto-dismiss timer
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    }

    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, handleDismiss]);

  const getIcon = () => {
    const iconClass = "w-5 h-5 flex-shrink-0";
    switch (type) {
      case 'success':
        return (
          <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`
        flex items-center justify-between gap-2
        px-4 py-3 min-w-[280px] max-w-[400px]
        rounded-game-md shadow-lg border
        animate-slide-up motion-reduce:animate-none
        ${typeStyles[type]}
      `}
      role="alert"
      aria-live="polite"
      data-testid={`toast-${id}`}
    >
      <div className="flex items-center gap-2 flex-1">
        {getIcon()}
        <span className="text-sm font-medium">{message}</span>
      </div>
      <button
        type="button"
        className="
          flex items-center justify-center w-6 h-6 p-0
          border-none rounded-game-sm
          bg-transparent cursor-pointer
          opacity-70 transition-opacity duration-200 motion-reduce:transition-none
          hover:opacity-100 hover:bg-black/5
          focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2
        "
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
