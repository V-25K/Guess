/**
 * Subscription Button Component
 * Smart button that handles subreddit subscription with proper state management
 */

import { useState } from 'react';
import { useSubscription } from '../../hooks/useSubscription.js';
import { Button } from './Button.js';
import { useToast } from './Toast/ToastProvider.js';
import { ApiError } from '../../api/errors.js';

export interface SubscriptionButtonProps {
  guestId?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  showToast?: boolean;
  onSubscriptionChange?: (isSubscribed: boolean) => void;
  /** Whether there's a current user (authenticated or guest) */
  hasUser?: boolean;
}

export function SubscriptionButton({
  guestId,
  className,
  size = 'md',
  variant = 'primary',
  showToast = true,
  onSubscriptionChange,
  hasUser = false,
}: SubscriptionButtonProps) {
  const {
    isSubscribed: hookIsSubscribed,
    loading,
    error,
    subscribe,
    refresh,
    source,
  } = useSubscription(guestId, hasUser);

  const [actionLoading, setActionLoading] = useState(false);
  const [localIsSubscribed, setLocalIsSubscribed] = useState(false);
  
  // Use local state if we've successfully subscribed, otherwise use hook state
  const isSubscribed = localIsSubscribed || hookIsSubscribed;
  
  // Always call the hook, but only use it if showToast is true
  let displayToast: ((message: string, type?: 'success' | 'error' | 'warning' | 'info') => void) | null = null;
  try {
    const { showToast: toastFn } = useToast();
    displayToast = showToast ? toastFn : null;
  } catch {
    // useToast not available (not wrapped in ToastProvider)
    displayToast = null;
  }

  const handleSubscribe = async () => {
    if (isSubscribed || actionLoading) return;

    setActionLoading(true);

    try {
      const result = await subscribe();

      if (result.success && result.isSubscribed) {
        // Immediately update local state
        setLocalIsSubscribed(true);
        
        if (displayToast) {
          displayToast(result.message, 'success');
        }
        
        onSubscriptionChange?.(true);
        
        // Also refresh the hook state
        refresh();
      } else {
        if (displayToast) {
          displayToast(result.message, 'error');
        }
      }
    } catch (error) {
      let errorMessage = 'Failed to join community';
      if (ApiError.isApiError(error)) {
        errorMessage = error.getUserMessage();
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (displayToast) {
        displayToast(errorMessage, 'error');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    if (actionLoading) return 'Joining...';
    if (isSubscribed) return '✓ Joined';
    return 'Join Community';
  };

  const getButtonVariant = () => {
    if (isSubscribed) return 'secondary'; // Use secondary for joined state
    return variant;
  };

  const isDisabled = loading || actionLoading || isSubscribed;

  return (
    <>
      <div className="relative">
        {/* Sparkling effect for unsubscribed state - improved colors and removed pulse */}
        {!isSubscribed && !loading && !actionLoading && (
          <>
            <div 
              className="absolute w-1 h-1 bg-white rounded-full animate-ping"
              style={{
                top: '-2px',
                left: '10%',
                animationDelay: '0s',
                animationDuration: '2s'
              }}
            />
            <div 
              className="absolute w-1 h-1 bg-white rounded-full animate-ping"
              style={{
                top: '50%',
                right: '-2px',
                animationDelay: '0.5s',
                animationDuration: '2s'
              }}
            />
            <div 
              className="absolute w-1 h-1 bg-white rounded-full animate-ping"
              style={{
                bottom: '-2px',
                left: '30%',
                animationDelay: '1s',
                animationDuration: '2s'
              }}
            />
            <div 
              className="absolute w-1 h-1 bg-white rounded-full animate-ping"
              style={{
                top: '20%',
                left: '-2px',
                animationDelay: '1.5s',
                animationDuration: '2s'
              }}
            />
          </>
        )}
        
        <Button
          onClick={handleSubscribe}
          disabled={isDisabled}
          className={`${className} ${!isSubscribed ? 'text-shadow-sm' : ''}`}
          style={{
            textShadow: !isSubscribed ? '0 1px 2px rgba(0, 0, 0, 0.8)' : undefined,
          }}
          size={size}
          variant={getButtonVariant()}
          title={
            isSubscribed 
              ? `Joined community${source !== 'unknown' ? ` (${source})` : ''}` 
              : 'Click to join the community'
          }
        >
          {getButtonText()}
        </Button>
      </div>
    </>
  );
}

/**
 * Compact version of the subscription button for smaller spaces
 */
export function CompactSubscriptionButton({
  guestId,
  className,
  onSubscriptionChange,
  hasUser = false,
}: Pick<SubscriptionButtonProps, 'guestId' | 'className' | 'onSubscriptionChange' | 'hasUser'>) {
  return (
    <SubscriptionButton
      guestId={guestId}
      hasUser={hasUser}
      className={className}
      size="sm"
      variant="ghost"
      showToast={false}
      onSubscriptionChange={onSubscriptionChange}
    />
  );
}

/**
 * Subscription status indicator (read-only)
 */
export function SubscriptionStatus({ 
  guestId, 
  className,
  hasUser = false,
}: Pick<SubscriptionButtonProps, 'guestId' | 'className' | 'hasUser'>) {
  const { isSubscribed, loading, source } = useSubscription(guestId, hasUser);

  if (loading) {
    return (
      <div className={`text-gray-500 text-sm ${className}`}>
        Checking subscription...
      </div>
    );
  }

  return (
    <div className={`text-sm ${className}`}>
      <span className={isSubscribed ? 'text-green-600' : 'text-gray-500'}>
        {isSubscribed ? '✓ Joined' : 'Not joined'}
      </span>
      {source !== 'unknown' && (
        <span className="text-gray-400 ml-1">
          ({source})
        </span>
      )}
    </div>
  );
}