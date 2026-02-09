/**
 * AccessDeniedPopup Component
 * Consistent popup messaging system for access denial
 * 
 * Requirements: 3.1, 3.2, 3.3 - Consistent popup messaging across all entry points
 */

import React from 'react';
import { clsx } from 'clsx';
import type { AccessControlResult, AccessEntryPoint } from '../../services/AccessControlManager';
import { POPUP_STYLES, getButtonClasses } from '../../utils/ui-consistency';

export interface AccessDeniedPopupProps {
  /** Whether the popup is visible */
  isVisible: boolean;
  
  /** Access control result with denial details */
  accessResult: AccessControlResult;
  
  /** Entry point that triggered the access denial */
  entryPoint: AccessEntryPoint;
  
  /** Callback when popup is dismissed */
  onDismiss: () => void;
  
  /** Callback when user selects a suggested action */
  onActionSelect?: (action: string) => void;
  
  /** Callback for handling redirects */
  onRedirect?: (targetView: 'menu' | 'login' | 'profile') => void;
  
  /** Custom title for the popup */
  title?: string;
}

/**
 * AccessDeniedPopup Component
 * Displays consistent access denial messages with suggested actions
 */
export const AccessDeniedPopup: React.FC<AccessDeniedPopupProps> = ({
  isVisible,
  accessResult,
  entryPoint,
  onDismiss,
  onActionSelect,
  onRedirect,
  title = 'Access Restricted'
}) => {
  const [redirectCountdown, setRedirectCountdown] = React.useState<number | null>(null);

  // Handle automatic redirects
  React.useEffect(() => {
    if (!isVisible || accessResult.granted || !accessResult.redirect) {
      setRedirectCountdown(null);
      return;
    }

    const { delay = 0, showMessageBeforeRedirect = false } = accessResult.redirect;

    if (showMessageBeforeRedirect && delay > 0) {
      // Show countdown for delayed redirects
      const countdownSeconds = Math.ceil(delay / 1000);
      setRedirectCountdown(countdownSeconds);

      const countdownInterval = setInterval(() => {
        setRedirectCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            if (onRedirect) {
              onRedirect(accessResult.redirect!.targetView);
            }
            onDismiss();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    } else if (delay === 0) {
      // Immediate redirect
      const timer = setTimeout(() => {
        if (onRedirect) {
          onRedirect(accessResult.redirect!.targetView);
        }
        onDismiss();
      }, 100); // Small delay to ensure popup is visible briefly

      return () => clearTimeout(timer);
    }
  }, [isVisible, accessResult, onRedirect, onDismiss]);

  if (!isVisible || accessResult.granted) {
    return null;
  }

  const handleActionClick = (action: string) => {
    // Handle special redirect actions
    if (action === 'Return to menu' && onRedirect) {
      onRedirect('menu');
      onDismiss();
      return;
    }
    
    if (action === 'Log in again' && onRedirect) {
      onRedirect('login');
      onDismiss();
      return;
    }
    
    if (action === 'Check your current level in Profile' && onRedirect) {
      onRedirect('profile');
      onDismiss();
      return;
    }

    if (onActionSelect) {
      onActionSelect(action);
    }
    onDismiss();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onDismiss();
    }
  };

  const getIconForReason = (reason: AccessControlResult['reason']) => {
    switch (reason) {
      case 'GUEST_USER':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      
      case 'INSUFFICIENT_LEVEL':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      
      case 'SESSION_EXPIRED':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
    }
  };

  return (
    <div
      className={POPUP_STYLES.overlay}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-denied-title"
      aria-describedby="access-denied-message"
    >
      <div
        className={POPUP_STYLES.container}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={POPUP_STYLES.header}>
          <div className="flex items-center gap-3 mb-3">
            <div className={POPUP_STYLES.iconContainer}>
              {getIconForReason(accessResult.reason)}
            </div>
            <h2 
              id="access-denied-title"
              className={POPUP_STYLES.title}
            >
              {title}
            </h2>
          </div>
          
          <p 
            id="access-denied-message"
            className={POPUP_STYLES.message}
          >
            {accessResult.message}
            {redirectCountdown !== null && (
              <span className="block mt-2 text-xs text-neutral-500 dark:text-white/50">
                Redirecting in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
              </span>
            )}
          </p>
        </div>

        {/* Suggested Actions */}
        {accessResult.suggestedActions && accessResult.suggestedActions.length > 0 && (
          <div className={POPUP_STYLES.content}>
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide mb-2">
              What you can do:
            </h3>
            <div className="space-y-2">
              {accessResult.suggestedActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleActionClick(action)}
                  className={POPUP_STYLES.actionButton}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={POPUP_STYLES.footer}>
          <button
            onClick={onDismiss}
            disabled={redirectCountdown !== null && redirectCountdown > 0}
            className={getButtonClasses(
              'primary',
              'md',
              true,
              false,
              redirectCountdown !== null && redirectCountdown > 0 ? 'opacity-60 cursor-not-allowed' : ''
            )}
          >
            {redirectCountdown !== null && redirectCountdown > 0 
              ? `Redirecting in ${redirectCountdown}...` 
              : 'Got it'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for managing access denied popup state
 */
export const useAccessDeniedPopup = () => {
  const [popupState, setPopupState] = React.useState<{
    isVisible: boolean;
    accessResult: AccessControlResult | null;
    entryPoint: AccessEntryPoint | null;
  }>({
    isVisible: false,
    accessResult: null,
    entryPoint: null
  });

  const showAccessDeniedPopup = (
    accessResult: AccessControlResult, 
    entryPoint: AccessEntryPoint
  ) => {
    setPopupState({
      isVisible: true,
      accessResult,
      entryPoint
    });
  };

  const hideAccessDeniedPopup = () => {
    setPopupState({
      isVisible: false,
      accessResult: null,
      entryPoint: null
    });
  };

  return {
    popupState,
    showAccessDeniedPopup,
    hideAccessDeniedPopup
  };
};