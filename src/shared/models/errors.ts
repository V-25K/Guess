/**
 * Application Error Types
 * Standardized error types for consistent error handling across the application.
 * Based on Result<T, E> pattern design.
 */

/**
 * Validation error - indicates invalid input data
 */
export interface ValidationError {
    type: 'validation';
    fields: Array<{ field: string; message: string }>;
}

/**
 * Not found error - indicates a resource could not be found
 */
export interface NotFoundError {
    type: 'not_found';
    resource: string;
    identifier: string;
}

/**
 * Rate limit error - indicates too many requests
 */
export interface RateLimitError {
    type: 'rate_limit';
    timeRemainingMs: number;
}

/**
 * Database error - indicates a database operation failure
 */
export interface DatabaseError {
    type: 'database';
    operation: string;
    message: string;
}

/**
 * External API error - indicates an external service failure
 */
export interface ExternalApiError {
    type: 'external_api';
    service: string;
    statusCode?: number;
    message: string;
}

/**
 * Internal error - indicates an unexpected internal failure
 */
export interface InternalError {
    type: 'internal';
    message: string;
    cause?: unknown;
}

/**
 * Discriminated union of all application error types
 */
export type AppError =
    | ValidationError
    | NotFoundError
    | RateLimitError
    | DatabaseError
    | ExternalApiError
    | InternalError;

/**
 * Create a validation error
 */
export function validationError(
    fields: Array<{ field: string; message: string }>
): ValidationError {
    return {
        type: 'validation',
        fields,
    };
}

/**
 * Create a not found error
 */
export function notFoundError(resource: string, identifier: string): NotFoundError {
    return {
        type: 'not_found',
        resource,
        identifier,
    };
}

/**
 * Create a rate limit error
 */
export function rateLimitError(timeRemainingMs: number): RateLimitError {
    return {
        type: 'rate_limit',
        timeRemainingMs,
    };
}

/**
 * Create a database error
 */
export function databaseError(operation: string, message: string): DatabaseError {
    return {
        type: 'database',
        operation,
        message,
    };
}

/**
 * Create an external API error
 */
export function externalApiError(
    service: string,
    message: string,
    statusCode?: number
): ExternalApiError {
    return {
        type: 'external_api',
        service,
        message,
        statusCode,
    };
}

/**
 * Create an internal error
 */
export function internalError(message: string, cause?: unknown): InternalError {
    return {
        type: 'internal',
        message,
        cause,
    };
}
