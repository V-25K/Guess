/**
 * Subscription Hook
 * Manages subreddit subscription state with Redis caching and database persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { ApiError } from '../api/errors';

export type SubscriptionStatus = {
  isSubscribed: boolean;
  subscribedAt: string | null;
  source: 'redis' | 'database' | 'unknown';
};

export type SubscriptionState = {
  status: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
};

export type SubscriptionResult = {
  success: boolean;
  isSubscribed: boolean;
  message: string;
  wasAlreadySubscribed?: boolean;
};

export function useSubscription(guestId?: string, hasUser: boolean = false) {
  const [state, setState] = useState<SubscriptionState>({
    status: null,
    loading: true,
    error: null,
  });

  // Cache key for local storage
  const cacheKey = `subscription_${guestId || 'auth'}`;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Check if we have cached data
  const getCachedStatus = useCallback((): SubscriptionStatus | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          return data;
        }
        // Remove expired cache
        localStorage.removeItem(cacheKey);
      }
    } catch (error) {
      // Ignore cache errors
      localStorage.removeItem(cacheKey);
    }
    return null;
  }, [cacheKey]);

  // Cache status data
  const setCachedStatus = useCallback((status: SubscriptionStatus) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data: status,
        timestamp: Date.now()
      }));
    } catch (error) {
      // Ignore cache errors
    }
  }, [cacheKey]);

  // Check subscription status
  const checkStatus = useCallback(async () => {
    // First check local cache
    const cachedStatus = getCachedStatus();
    if (cachedStatus) {
      setState({
        status: cachedStatus,
        loading: false,
        error: null,
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams();
      if (guestId) {
        params.append('guestId', guestId);
      }

      const response = await fetch(`/api/subscription/status?${params.toString()}`);
      
      if (!response.ok) {
        throw await ApiError.fromResponse(response);
      }

      const status: SubscriptionStatus = await response.json();
      
      // Cache the result
      setCachedStatus(status);
      
      setState({
        status,
        loading: false,
        error: null,
      });
    } catch (error) {
      // Don't log errors for unauthenticated users as they're expected
      if (hasUser) {
        console.error('Failed to check subscription status:', error);
      }
      
      setState({
        status: {
          isSubscribed: false,
          subscribedAt: null,
          source: 'unknown',
        },
        loading: false,
        error: null, // Don't store errors since we're not displaying them inline
      });
    }
  }, [guestId, hasUser, getCachedStatus, setCachedStatus]);

  // Subscribe to subreddit
  const subscribe = useCallback(async (): Promise<SubscriptionResult> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const body: { guestId?: string } = {};
      if (guestId) {
        body.guestId = guestId;
      }

      const response = await fetch('/api/subscription/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError({
          code: ApiError.getCodeFromStatus(response.status),
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        });
      }

      const result: SubscriptionResult = await response.json();

      // Update local state and cache
      const newStatus: SubscriptionStatus = {
        isSubscribed: result.isSubscribed,
        subscribedAt: result.isSubscribed ? new Date().toISOString() : null,
        source: 'database' as const,
      };
      
      setCachedStatus(newStatus);
      
      setState(prev => ({
        ...prev,
        status: newStatus,
        loading: false,
        error: null,
      }));

      return result;
    } catch (error) {
      let errorMessage = 'Failed to subscribe';
      if (ApiError.isApiError(error)) {
        // For validation errors about authentication, provide a better message
        if (error.code === 'BAD_REQUEST' && error.message.includes('sign in')) {
          errorMessage = 'Please sign in to join the community';
        } else {
          errorMessage = error.getUserMessage();
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      return {
        success: false,
        isSubscribed: false,
        message: errorMessage,
      };
    }
  }, [guestId, setCachedStatus]);

  // Invalidate cache (useful when subscription might have changed outside the app)
  const invalidateCache = useCallback(async () => {
    try {
      // Clear local cache
      localStorage.removeItem(cacheKey);
      
      const body: { guestId?: string } = {};
      if (guestId) {
        body.guestId = guestId;
      }

      await fetch('/api/subscription/invalidate-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // Refresh status after invalidating cache
      await checkStatus();
    } catch (error) {
      console.error('Failed to invalidate subscription cache:', error);
    }
  }, [guestId, checkStatus, cacheKey]);

  // Refresh subscription status
  const refresh = useCallback(() => {
    checkStatus();
  }, [checkStatus]);

  // Load initial status only if we have a user
  useEffect(() => {
    // Only check status if we have a user (authenticated or guest)
    if (hasUser) {
      checkStatus();
    }
  }, [hasUser, checkStatus]);

  return {
    ...state,
    subscribe,
    refresh,
    invalidateCache,
    isSubscribed: state.status?.isSubscribed ?? false,
    subscribedAt: state.status?.subscribedAt ?? null,
    source: state.status?.source ?? 'unknown',
  };
}