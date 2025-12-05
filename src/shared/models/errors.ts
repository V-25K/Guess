/**
 * Application Error Types
 * Standardized error types for consistent error handling across the application.
 */

/**
 * Error codes for application-specific errors
 */
export type AppErrorCode =
    | 'AUTH_REQUIRED'
    | 'RATE_LIMITED'
    | 'CHALLENGE_NOT_FOUND'
    | 'ATTEMPT_NOT_FOUND'
    | 'VALIDATION_FAILED'
    | 'NETWORK_ERROR'
    | 'AI_UNAVAILABLE'
    | 'CACHE_ERROR'
    | 'DATABASE_ERROR'
    | 'UNKNOWN_ERROR';

/**
 * Standardized application error interface
 */
export interface AppError {
    /** Unique error code for identification */
    code: AppErrorCode;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: Record<string, unknown>;
    /** Whether the user can retry the operation */
    recoverable: boolean;
    /** Original error if this wraps another error */
    cause?: Error;
}

/**
 * Create a standardized application error
 */
export function createAppError(
    code: AppErrorCode,
    message: string,
    options?: {
        details?: Record<string, unknown>;
        recoverable?: boolean;
        cause?: Error;
    }
): AppError {
    return {
        code,
        message,
        details: options?.details,
        recoverable: options?.recoverable ?? true,
        cause: options?.cause,
    };
}

/**
 * Check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error &&
        'recoverable' in error
    );
}

/**
 * Convert unknown errors to AppError
 */
export function toAppError(error: unknown, fallbackCode: AppErrorCode = 'UNKNOWN_ERROR'): AppError {
    if (isAppError(error)) {
        return error;
    }

    if (error instanceof Error) {
        return createAppError(fallbackCode, error.message, {
            cause: error,
            recoverable: true,
        });
    }

    return createAppError(fallbackCode, String(error), {
        recoverable: true,
    });
}

/**
 * Error messages for user display
 */
export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
    AUTH_REQUIRED: 'Please log in to continue.',
    RATE_LIMITED: 'You\'ve reached the limit. Please try again later.',
    CHALLENGE_NOT_FOUND: 'This challenge could not be found.',
    ATTEMPT_NOT_FOUND: 'Challenge attempt not found.',
    VALIDATION_FAILED: 'Invalid input. Please check your data.',
    NETWORK_ERROR: 'Connection error. Please check your internet.',
    AI_UNAVAILABLE: 'AI service temporarily unavailable.',
    CACHE_ERROR: 'Cache error. Please try again.',
    DATABASE_ERROR: 'Database error. Please try again.',
    UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: AppError | AppErrorCode): string {
    const code = typeof error === 'string' ? error : error.code;
    return ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR;
}
