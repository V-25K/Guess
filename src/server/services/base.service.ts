/**
 * Base Service
 * Provides common error handling and utilities for all services
 */

import type { Context } from '@devvit/server/server-context';
import type { Result } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { isOk } from '../../shared/utils/result.js';

export abstract class BaseService {
  constructor(protected context: Context) { }

  /**
   * Execute an operation with retry logic and exponential backoff
   * Updated to work with Result types
   * 
   * @param operation - The async operation to retry (returns Result)
   * @param options - Retry configuration options
   * @returns The Result of the operation
   */
  protected async withRetry<T>(
    operation: () => Promise<Result<T, AppError>>,
    options: {
      maxRetries?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      exponentialBackoff?: boolean;
      onRetry?: (attempt: number, error: AppError) => void;
    } = {}
  ): Promise<Result<T, AppError>> {
    const {
      maxRetries = 3,
      initialDelayMs = 1000,
      maxDelayMs = 10000,
      exponentialBackoff = true,
      onRetry,
    } = options;

    let lastResult: Result<T, AppError> | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // If successful, return immediately
        if (isOk(result)) {
          return result;
        }
        
        // Store the error result
        lastResult = result;

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
            onRetry(attempt + 1, result.error);
          }

          await this.delay(delay);
        }
      } catch (error) {
        // Unexpected error - this shouldn't happen with Result pattern
        // but we handle it for safety
        this.logError('RetryLogic', error);
        
        // If this is the last attempt, we need to return something
        // This is an edge case that shouldn't normally occur
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        await this.delay(initialDelayMs);
      }
    }

    this.logError('RetryLogic', `All ${maxRetries} attempts failed`);
    
    // Return the last error result
    // TypeScript knows lastResult must be defined here because we always set it in the loop
    return lastResult!;
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
   * Structured logging helper
   */
  private log(level: 'info' | 'warn' | 'error', context: string, message: string, metadata?: Record<string, any>): void {
    const logEntry = {
      level,
      context,
      message,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    const logString = JSON.stringify(logEntry);

    if (level === 'error') {
      console.error(logString);
    } else if (level === 'warn') {
      console.warn(logString);
    } else {
      // console.log(logString);
    }
  }

  /**
   * Log an error with context and metadata
   * Updated to handle both AppError (from Result pattern) and legacy errors
   */
  protected logError(context: string, error: unknown, metadata?: Record<string, any>): void {
    let errorMessage: string;
    let errorDetails: Record<string, any> = {};

    // Check if this is an AppError from Result pattern
    if (this.isAppError(error)) {
      errorMessage = this.formatAppError(error);
      errorDetails = { errorType: error.type, ...this.getAppErrorDetails(error) };
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = { stack: error.stack };
    } else {
      errorMessage = String(error);
      errorDetails = { rawError: error };
    }

    this.log('error', context, errorMessage, {
      ...metadata,
      ...errorDetails,
    });
  }

  /**
   * Type guard to check if an error is an AppError
   */
  private isAppError(error: unknown): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      typeof (error as any).type === 'string'
    );
  }

  /**
   * Format an AppError into a readable message
   */
  private formatAppError(error: AppError): string {
    switch (error.type) {
      case 'validation':
        return `Validation error: ${error.fields.map(f => `${f.field}: ${f.message}`).join(', ')}`;
      case 'not_found':
        return `${error.resource} not found: ${error.identifier}`;
      case 'rate_limit':
        return `Rate limit exceeded. Retry after ${error.timeRemainingMs}ms`;
      case 'database':
        return `Database error in ${error.operation}: ${error.message}`;
      case 'external_api':
        return `External API error (${error.service}): ${error.message}`;
      case 'internal':
        return `Internal error: ${error.message}`;
    }
  }

  /**
   * Extract additional details from an AppError for logging
   */
  private getAppErrorDetails(error: AppError): Record<string, any> {
    switch (error.type) {
      case 'validation':
        return { fields: error.fields };
      case 'not_found':
        return { resource: error.resource, identifier: error.identifier };
      case 'rate_limit':
        return { timeRemainingMs: error.timeRemainingMs };
      case 'database':
        return { operation: error.operation, message: error.message };
      case 'external_api':
        return { service: error.service, statusCode: error.statusCode, message: error.message };
      case 'internal':
        return { message: error.message, cause: error.cause };
    }
  }

  /**
   * Log info message with context and metadata
   */
  protected logInfo(context: string, message: string, metadata?: Record<string, any>): void {
    this.log('info', context, message, metadata);
  }

  /**
   * Log warning with context and metadata
   */
  protected logWarning(context: string, message: string, metadata?: Record<string, any>): void {
    this.log('warn', context, message, metadata);
  }
}
