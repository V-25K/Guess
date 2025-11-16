/**
 * Base Service
 * Provides common error handling and utilities for all services
 */

import type { Context } from '@devvit/public-api';

export abstract class BaseService {
  constructor(protected context: Context) {}

  /**
   * Execute an operation with error handling
   * Returns null on error instead of throwing
   */
  protected async withErrorHandling<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      console.error(errorMessage, error);
      return null;
    }
  }

  /**
   * Execute an operation with error handling that returns a boolean
   * Returns false on error
   */
  protected async withBooleanErrorHandling(
    operation: () => Promise<boolean>,
    errorMessage: string
  ): Promise<boolean> {
    try {
      return await operation();
    } catch (error) {
      console.error(errorMessage, error);
      return false;
    }
  }

  /**
   * Execute an operation with retry logic and exponential backoff
   * 
   * @param operation - The async operation to retry
   * @param options - Retry configuration options
   * @returns The result of the operation
   * @throws The last error if all retries fail
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      exponentialBackoff?: boolean;
      onRetry?: (attempt: number, error: any) => void;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelayMs = 1000,
      maxDelayMs = 10000,
      exponentialBackoff = true,
      onRetry,
    } = options;
    
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt < maxRetries - 1) {
          // Calculate delay with exponential backoff
          let delay = exponentialBackoff
            ? initialDelayMs * Math.pow(2, attempt)
            : initialDelayMs;
          
          // Cap the delay at maxDelayMs
          delay = Math.min(delay, maxDelayMs);
          
          // Add jitter to prevent thundering herd
          const jitter = Math.random() * 0.3 * delay;
          delay = delay + jitter;
          
          this.logWarning(
            'RetryLogic',
            `Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${Math.round(delay)}ms...`
          );
          
          // Call onRetry callback if provided
          if (onRetry) {
            onRetry(attempt + 1, error);
          }
          
          await this.delay(delay);
        }
      }
    }
    
    this.logError('RetryLogic', `All ${maxRetries} attempts failed`);
    throw lastError;
  }

  /**
   * Delay execution for a specified time
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate required fields in an object
   */
  protected validateRequired<T extends Record<string, any>>(
    obj: T,
    requiredFields: (keyof T)[]
  ): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
        missingFields.push(field as string);
      }
    }
    
    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Log an error with context
   * @param context - Service or operation context
   * @param error - Error object or message
   */
  protected logError(context: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${context}] ${errorMessage}`);
  }

  /**
   * Log info message with context
   * @param context - Service or operation context
   * @param message - Info message
   */
  protected logInfo(context: string, message: string): void {
    console.log(`[${context}] ${message}`);
  }
  
  /**
   * Log warning with context
   * @param context - Service or operation context
   * @param message - Warning message
   */
  protected logWarning(context: string, message: string): void {
    console.warn(`[${context}] ${message}`);
  }
}
