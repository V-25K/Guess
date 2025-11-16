/**
 * useRetry Hook
 * Provides retry functionality with user feedback
 */

import type { Context } from '@devvit/public-api';

export interface RetryState {
  isRetrying: boolean;
  retryCount: number;
  maxRetries: number;
  errorMessage: string;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  exponentialBackoff?: boolean;
  showToast?: boolean;
}

/**
 * Hook for executing operations with retry logic and user feedback
 * 
 * @example
 * ```tsx
 * const { execute, state, reset } = useRetry(context);
 * 
 * const handleSubmit = async () => {
 *   const result = await execute(
 *     async () => await submitData(),
 *     { maxRetries: 3, showToast: true }
 *   );
 * };
 * ```
 */
export function useRetry(context: Context) {
  const { useState } = context;
  
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries, setMaxRetries] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * Execute an operation with retry logic
   */
  const execute = async <T,>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T | null> => {
    const {
      maxRetries: maxRetriesOption = 3,
      initialDelayMs = 1000,
      exponentialBackoff = true,
      showToast = true,
    } = options;

    setIsRetrying(true);
    setRetryCount(0);
    setMaxRetries(maxRetriesOption);
    setErrorMessage('');

    let lastError: any;

    for (let attempt = 0; attempt < maxRetriesOption; attempt++) {
      try {
        const result = await operation();
        
        // Success - reset state
        setIsRetrying(false);
        setRetryCount(0);
        setMaxRetries(0);
        setErrorMessage('');
        
        if (showToast && attempt > 0) {
          context.ui.showToast(`✅ Operation succeeded after ${attempt + 1} attempt${attempt > 0 ? 's' : ''}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Update retry count
        setRetryCount(attempt + 1);
        
        // Don't retry on the last attempt
        if (attempt < maxRetriesOption - 1) {
          // Calculate delay with exponential backoff
          let delay = exponentialBackoff
            ? initialDelayMs * Math.pow(2, attempt)
            : initialDelayMs;
          
          // Add jitter
          const jitter = Math.random() * 0.3 * delay;
          delay = delay + jitter;
          
          if (showToast) {
            context.ui.showToast(`⚠️ Attempt ${attempt + 1} failed. Retrying...`);
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    const error = lastError instanceof Error ? lastError : new Error(String(lastError));
    
    setIsRetrying(false);
    setRetryCount(maxRetriesOption);
    setMaxRetries(maxRetriesOption);
    setErrorMessage(error.message);
    
    if (showToast) {
      context.ui.showToast(`❌ Operation failed after ${maxRetriesOption} attempts`);
    }
    
    return null;
  };

  /**
   * Reset the retry state
   */
  const reset = () => {
    setIsRetrying(false);
    setRetryCount(0);
    setMaxRetries(0);
    setErrorMessage('');
  };

  return {
    execute,
    state: {
      isRetrying,
      retryCount,
      maxRetries,
      errorMessage,
    },
    reset,
  };
}
