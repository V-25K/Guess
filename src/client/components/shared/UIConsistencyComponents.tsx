/**
 * UI Consistency React Components
 * Standardized React components for consistent UI patterns
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - UI consistency and accessibility standards
 */

import React from 'react';
import { clsx } from 'clsx';
import { ACCESSIBILITY } from '../../utils/ui-consistency';

/**
 * Consistent loading spinner component
 */
export function LoadingSpinner({ 
  size = 'sm', 
  className = '' 
}: { 
  size?: 'xs' | 'sm' | 'md' | 'lg'; 
  className?: string; 
}) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <span 
      className={clsx(
        sizeClasses[size],
        'border-2 border-current border-t-transparent rounded-full animate-spin',
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Consistent icon wrapper for buttons
 */
export function ButtonIcon({ 
  children, 
  position = 'left' 
}: { 
  children: React.ReactNode; 
  position?: 'left' | 'right'; 
}) {
  return (
    <span 
      className={clsx(
        'inline-flex items-center justify-center flex-shrink-0',
        position === 'left' ? 'order-first' : 'order-last'
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/**
 * Consistent skip link for accessibility
 */
export function SkipLink({ 
  href, 
  children 
}: { 
  href: string; 
  children: React.ReactNode; 
}) {
  return (
    <a
      href={href}
      className={ACCESSIBILITY.skipLink}
    >
      {children}
    </a>
  );
}

/**
 * Screen reader only text component
 */
export function ScreenReaderOnly({ 
  children 
}: { 
  children: React.ReactNode; 
}) {
  return (
    <span className={ACCESSIBILITY.srOnly}>
      {children}
    </span>
  );
}

/**
 * Accessible focus trap component
 */
export function FocusTrap({ 
  children,
  enabled = true,
  className = ''
}: { 
  children: React.ReactNode;
  enabled?: boolean;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

/**
 * Accessible announcement component for screen readers
 */
export function LiveAnnouncement({ 
  message,
  priority = 'polite',
  className = ''
}: { 
  message: string;
  priority?: 'polite' | 'assertive';
  className?: string;
}) {
  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className={clsx(ACCESSIBILITY.srOnly, className)}
    >
      {message}
    </div>
  );
}

/**
 * Consistent error boundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class UIConsistencyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UI Consistency Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
            UI Component Error
          </h3>
          <p className="text-xs text-red-600 dark:text-red-300">
            A component failed to render properly. Please refresh the page.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}