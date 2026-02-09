/**
 * ErrorFeedback Component
 * Provides consistent error messaging and user feedback across all components
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - UI consistency and accessibility standards
 */

import React from 'react';
import { clsx } from 'clsx';
import { POPUP_STYLES, BUTTON_STYLES, ACCESSIBILITY } from '../../utils/ui-consistency';
import type { NavigationResult } from '../../types/navigation.types';

/**
 * Error feedback severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info' | 'success';

/**
 * Error feedback configuration
 */
export interface ErrorFeedbackConfig {
  /** Error title */
  title: string;
  /** Error message */
  message: string;
  /** Severity level */
  severity: ErrorSeverity;
  /** Whether to show technical details */
  showTechnicalDetails?: boolean;
  /** Auto-dismiss timeout in milliseconds */
  autoDismissMs?: number;
  /** Fallback action options */
  fallbackOptions?: string[];
  /** Callback when user selects a fallback option */
  onFallbackAction?: (action: string) => void;
  /** Callback when error is dismissed */
  onDismiss?: () => void;
  /** Whether the error can be retried */
  canRetry?: boolean;
  /** Retry callback */
  onRetry?: () => void;
  /** Additional technical details */
  technicalDetails?: string;
}

/**
 * Props for ErrorFeedback component
 */
export interface ErrorFeedbackProps extends ErrorFeedbackConfig {
  /** Whether the error feedback is visible */
  isVisible: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get severity-specific styling
 */
function getSeverityStyles(severity: ErrorSeverity) {
  const styles = {
    error: {
      iconContainer: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
      icon: '❌',
      titleColor: 'text-red-800 dark:text-red-300',
      messageColor: 'text-red-700 dark:text-red-400',
      borderColor: 'border-red-200 dark:border-red-500/30'
    },
    warning: {
      iconContainer: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
      icon: '⚠️',
      titleColor: 'text-yellow-800 dark:text-yellow-300',
      messageColor: 'text-yellow-700 dark:text-yellow-400',
      borderColor: 'border-yellow-200 dark:border-yellow-500/30'
    },
    info: {
      iconContainer: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
      icon: 'ℹ️',
      titleColor: 'text-blue-800 dark:text-blue-300',
      messageColor: 'text-blue-700 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-500/30'
    },
    success: {
      iconContainer: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
      icon: '✅',
      titleColor: 'text-green-800 dark:text-green-300',
      messageColor: 'text-green-700 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-500/30'
    }
  };

  return styles[severity];
}

/**
 * ErrorFeedback Component
 * Displays consistent error messages with fallback options
 */
export const ErrorFeedback: React.FC<ErrorFeedbackProps> = ({
  isVisible,
  title,
  message,
  severity,
  showTechnicalDetails = false,
  autoDismissMs,
  fallbackOptions = [],
  onFallbackAction,
  onDismiss,
  canRetry = false,
  onRetry,
  technicalDetails,
  className
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const severityStyles = getSeverityStyles(severity);

  // Auto-dismiss functionality
  React.useEffect(() => {
    if (isVisible && autoDismissMs && onDismiss) {
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoDismissMs, onDismiss]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && onDismiss) {
      onDismiss();
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      className={POPUP_STYLES.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-title"
      aria-describedby="error-message"
      onKeyDown={handleKeyDown}
    >
      <div className={clsx(POPUP_STYLES.container, severityStyles.borderColor, className)}>
        {/* Header */}
        <div className={POPUP_STYLES.header}>
          <div className="flex items-start gap-3">
            <div className={clsx(POPUP_STYLES.iconContainer, severityStyles.iconContainer)}>
              <span role="img" aria-hidden="true" className="text-lg">
                {severityStyles.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 
                id="error-title"
                className={clsx(POPUP_STYLES.title, severityStyles.titleColor)}
              >
                {title}
              </h2>
              {autoDismissMs && (
                <p className="text-xs text-neutral-500 dark:text-white/50 mt-1">
                  Auto-dismissing in {Math.ceil(autoDismissMs / 1000)}s
                </p>
              )}
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={clsx(
                  'p-1 rounded-full',
                  'text-neutral-400 hover:text-neutral-600',
                  'dark:text-white/40 dark:hover:text-white/60',
                  'hover:bg-neutral-100 dark:hover:bg-white/10',
                  'focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078]',
                  ACCESSIBILITY.touchTarget
                )}
                aria-label="Dismiss error"
              >
                <span className="text-lg">×</span>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={POPUP_STYLES.content}>
          <p 
            id="error-message"
            className={clsx(POPUP_STYLES.message, severityStyles.messageColor)}
          >
            {message}
          </p>

          {/* Technical Details */}
          {showTechnicalDetails && technicalDetails && (
            <div className="mt-3">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={clsx(
                  'text-xs text-neutral-500 dark:text-white/50',
                  'hover:text-neutral-700 dark:hover:text-white/70',
                  'focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078]',
                  'rounded px-1'
                )}
                aria-expanded={isExpanded}
                aria-controls="technical-details"
              >
                {isExpanded ? '▼' : '▶'} Technical Details
              </button>
              {isExpanded && (
                <div 
                  id="technical-details"
                  className="mt-2 p-2 bg-neutral-50 dark:bg-white/5 rounded text-xs text-neutral-600 dark:text-white/60 font-mono"
                >
                  {technicalDetails}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        {(fallbackOptions.length > 0 || canRetry) && (
          <div className={POPUP_STYLES.footer}>
            <div className="space-y-2">
              {/* Retry Button */}
              {canRetry && onRetry && (
                <button
                  onClick={onRetry}
                  className={clsx(
                    BUTTON_STYLES.base,
                    BUTTON_STYLES.variants.primary,
                    BUTTON_STYLES.sizes.sm,
                    'w-full'
                  )}
                >
                  Try Again
                </button>
              )}

              {/* Fallback Options */}
              {fallbackOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => onFallbackAction?.(option)}
                  className={POPUP_STYLES.actionButton}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Hook for managing error feedback state
 */
export function useErrorFeedback() {
  const [errorConfig, setErrorConfig] = React.useState<ErrorFeedbackConfig | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  const showError = React.useCallback((config: ErrorFeedbackConfig) => {
    setErrorConfig(config);
    setIsVisible(true);
  }, []);

  const hideError = React.useCallback(() => {
    setIsVisible(false);
    // Clear config after animation completes
    setTimeout(() => setErrorConfig(null), 200);
  }, []);

  const showNavigationError = React.useCallback((result: NavigationResult) => {
    if (result.success || !result.error) return;

    const config: ErrorFeedbackConfig = {
      title: result.errorContext?.title || 'Navigation Error',
      message: result.errorMessage || 'An error occurred during navigation',
      severity: result.errorContext?.severity || 'error',
      showTechnicalDetails: result.errorContext?.showTechnicalDetails || false,
      autoDismissMs: result.errorContext?.autoDismissMs,
      fallbackOptions: result.fallbackOptions || [],
      canRetry: result.errorContext?.canRetry || false,
      technicalDetails: result.error ? `Error Type: ${result.error}` : undefined,
      onDismiss: hideError
    };

    showError(config);
  }, [showError, hideError]);

  return {
    errorConfig,
    isVisible,
    showError,
    hideError,
    showNavigationError
  };
}

/**
 * ErrorFeedbackProvider Context
 * Provides error feedback functionality throughout the app
 */
const ErrorFeedbackContext = React.createContext<{
  showError: (config: ErrorFeedbackConfig) => void;
  hideError: () => void;
  showNavigationError: (result: NavigationResult) => void;
} | null>(null);

export const ErrorFeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { errorConfig, isVisible, showError, hideError, showNavigationError } = useErrorFeedback();

  return (
    <ErrorFeedbackContext.Provider value={{ showError, hideError, showNavigationError }}>
      {children}
      {errorConfig && (
        <ErrorFeedback
          {...errorConfig}
          isVisible={isVisible}
        />
      )}
    </ErrorFeedbackContext.Provider>
  );
};

/**
 * Hook to use error feedback context
 */
export function useErrorFeedbackContext() {
  const context = React.useContext(ErrorFeedbackContext);
  if (!context) {
    throw new Error('useErrorFeedbackContext must be used within ErrorFeedbackProvider');
  }
  return context;
}

/**
 * Utility function to create consistent error feedback from navigation results
 */
export function createErrorFeedbackFromNavigationResult(
  result: NavigationResult,
  onFallbackAction?: (action: string) => void,
  onRetry?: () => void
): ErrorFeedbackConfig | null {
  if (result.success || !result.error) return null;

  return {
    title: result.errorContext?.title || 'Navigation Error',
    message: result.errorMessage || 'An error occurred during navigation',
    severity: result.errorContext?.severity || 'error',
    showTechnicalDetails: result.errorContext?.showTechnicalDetails || false,
    autoDismissMs: result.errorContext?.autoDismissMs,
    fallbackOptions: result.fallbackOptions || [],
    canRetry: result.errorContext?.canRetry || false,
    technicalDetails: result.error ? `Error Type: ${result.error}\nTimestamp: ${result.errorContext?.timestamp || new Date()}` : undefined,
    onFallbackAction,
    onRetry
  };
}