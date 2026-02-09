/**
 * API Error Types
 * Typed error classes for API error handling
 * 
 * Requirements:
 * - 6.2: Add typed interfaces for all API payloads
 * - 7.5: Implement error boundary and error handling
 */

/**
 * Error codes for API errors
 */
export enum ApiErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // HTTP errors
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Application errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * API error response structure from server
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Options for creating an ApiError
 */
export interface ApiErrorOptions {
  code: ApiErrorCode;
  message: string;
  status?: number;
  details?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Custom error class for API errors with typed error codes
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly details?: Record<string, unknown>;
  readonly cause?: Error;
  readonly isApiError = true;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
    
    // Set cause if provided
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Check if an error is an ApiError
   */
  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError || 
           (error !== null && 
            typeof error === 'object' && 
            'isApiError' in error && 
            (error as ApiError).isApiError === true);
  }

  /**
   * Create an ApiError from an HTTP response
   */
  static async fromResponse(response: Response, defaultMessage?: string): Promise<ApiError> {
    const status = response.status;
    let message = defaultMessage || `HTTP ${status}: Request failed`;
    let details: Record<string, unknown> | undefined;
    
    // Try to parse error response
    try {
      const data = await response.json() as ApiErrorResponse;
      if (data.error) {
        message = data.error;
      }
      if (data.details) {
        details = data.details;
      }
    } catch {
      // Ignore parse errors, use default message
    }

    const code = ApiError.getCodeFromStatus(status);
    
    return new ApiError({
      code,
      message,
      status,
      details,
    });
  }

  /**
   * Create an ApiError from a network error
   */
  static fromNetworkError(error: Error): ApiError {
    const isTimeout = error.name === 'AbortError' || 
                      error.message.toLowerCase().includes('timeout');
    
    return new ApiError({
      code: isTimeout ? ApiErrorCode.TIMEOUT : ApiErrorCode.NETWORK_ERROR,
      message: isTimeout 
        ? 'Request timed out. Please try again.' 
        : 'Network error. Please check your connection.',
      cause: error,
    });
  }

  /**
   * Get error code from HTTP status
   */
  static getCodeFromStatus(status: number): ApiErrorCode {
    switch (status) {
      case 400:
        return ApiErrorCode.BAD_REQUEST;
      case 401:
        return ApiErrorCode.UNAUTHORIZED;
      case 403:
        return ApiErrorCode.FORBIDDEN;
      case 404:
        return ApiErrorCode.NOT_FOUND;
      case 429:
        return ApiErrorCode.RATE_LIMITED;
      case 500:
        return ApiErrorCode.SERVER_ERROR;
      case 503:
        return ApiErrorCode.SERVICE_UNAVAILABLE;
      default:
        if (status >= 400 && status < 500) {
          return ApiErrorCode.BAD_REQUEST;
        }
        if (status >= 500) {
          return ApiErrorCode.SERVER_ERROR;
        }
        return ApiErrorCode.UNKNOWN;
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [
      ApiErrorCode.NETWORK_ERROR,
      ApiErrorCode.TIMEOUT,
      ApiErrorCode.SERVER_ERROR,
      ApiErrorCode.SERVICE_UNAVAILABLE,
    ].includes(this.code);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case ApiErrorCode.NETWORK_ERROR:
        return 'Unable to connect. Please check your internet connection.';
      case ApiErrorCode.TIMEOUT:
        return 'The request took too long. Please try again.';
      case ApiErrorCode.UNAUTHORIZED:
        return 'Please sign in to continue.';
      case ApiErrorCode.FORBIDDEN:
        return 'You don\'t have permission to do this.';
      case ApiErrorCode.NOT_FOUND:
        return 'The requested item was not found.';
      case ApiErrorCode.RATE_LIMITED:
        return 'Too many requests. Please wait a moment and try again.';
      case ApiErrorCode.SERVER_ERROR:
      case ApiErrorCode.SERVICE_UNAVAILABLE:
        return 'Something went wrong. Please try again later.';
      case ApiErrorCode.BAD_REQUEST:
        // Check if it's an authentication-related validation error
        if (this.message.includes('sign in') || this.message.includes('guest profile')) {
          return this.message; // Use the specific message from server
        }
        return 'Please check your input and try again.';
      case ApiErrorCode.VALIDATION_ERROR:
        // Check if it's an authentication-related validation error
        if (this.message.includes('sign in') || this.message.includes('guest profile')) {
          return this.message; // Use the specific message from server
        }
        return this.message || 'Please check your input and try again.';
      default:
        return this.message || 'Something went wrong. Please try again.';
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
    };
  }
}
