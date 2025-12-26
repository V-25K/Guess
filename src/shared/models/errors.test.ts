/**
 * Unit tests for error constructor functions
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { describe, it, expect } from 'vitest';
import {
    validationError,
    notFoundError,
    rateLimitError,
    databaseError,
    externalApiError,
    internalError,
    type ValidationError,
    type NotFoundError,
    type RateLimitError,
    type DatabaseError,
    type ExternalApiError,
    type InternalError,
} from './errors.js';

describe('Error Constructors', () => {
    describe('validationError', () => {
        it('should create a validation error with field names and messages', () => {
            // Requirement 6.2: WHEN a validation error occurs THEN the system SHALL include field names and validation messages
            const fields = [
                { field: 'email', message: 'Invalid email format' },
                { field: 'password', message: 'Password too short' },
            ];

            const error: ValidationError = validationError(fields);

            expect(error.type).toBe('validation');
            expect(error.fields).toEqual(fields);
            expect(error.fields).toHaveLength(2);
            expect(error.fields[0].field).toBe('email');
            expect(error.fields[0].message).toBe('Invalid email format');
            expect(error.fields[1].field).toBe('password');
            expect(error.fields[1].message).toBe('Password too short');
        });

        it('should handle single field validation error', () => {
            const fields = [{ field: 'username', message: 'Username required' }];

            const error: ValidationError = validationError(fields);

            expect(error.type).toBe('validation');
            expect(error.fields).toHaveLength(1);
            expect(error.fields[0].field).toBe('username');
            expect(error.fields[0].message).toBe('Username required');
        });

        it('should handle empty fields array', () => {
            const error: ValidationError = validationError([]);

            expect(error.type).toBe('validation');
            expect(error.fields).toEqual([]);
            expect(error.fields).toHaveLength(0);
        });
    });

    describe('notFoundError', () => {
        it('should create a not found error with resource type and identifier', () => {
            // Requirement 6.3: WHEN a not found error occurs THEN the system SHALL include the resource type and identifier
            const error: NotFoundError = notFoundError('User', 'user-123');

            expect(error.type).toBe('not_found');
            expect(error.resource).toBe('User');
            expect(error.identifier).toBe('user-123');
        });

        it('should handle different resource types', () => {
            const challengeError: NotFoundError = notFoundError('Challenge', 'challenge-456');
            const attemptError: NotFoundError = notFoundError('Attempt', 'attempt-789');

            expect(challengeError.resource).toBe('Challenge');
            expect(challengeError.identifier).toBe('challenge-456');
            expect(attemptError.resource).toBe('Attempt');
            expect(attemptError.identifier).toBe('attempt-789');
        });
    });

    describe('rateLimitError', () => {
        it('should create a rate limit error with time remaining', () => {
            // Requirement 6.4: WHEN a rate limit error occurs THEN the system SHALL include time remaining information
            const timeRemainingMs = 5000;

            const error: RateLimitError = rateLimitError(timeRemainingMs);

            expect(error.type).toBe('rate_limit');
            expect(error.timeRemainingMs).toBe(5000);
        });

        it('should handle zero time remaining', () => {
            const error: RateLimitError = rateLimitError(0);

            expect(error.type).toBe('rate_limit');
            expect(error.timeRemainingMs).toBe(0);
        });

        it('should handle large time remaining values', () => {
            const error: RateLimitError = rateLimitError(3600000); // 1 hour

            expect(error.type).toBe('rate_limit');
            expect(error.timeRemainingMs).toBe(3600000);
        });
    });

    describe('databaseError', () => {
        it('should create a database error with operation and message', () => {
            // Requirement 6.5: WHEN a database error occurs THEN the system SHALL include the operation type and error message
            const error: DatabaseError = databaseError('redis.get', 'Connection timeout');

            expect(error.type).toBe('database');
            expect(error.operation).toBe('redis.get');
            expect(error.message).toBe('Connection timeout');
        });

        it('should handle different database operations', () => {
            const getError: DatabaseError = databaseError('redis.get', 'Key not found');
            const setError: DatabaseError = databaseError('redis.set', 'Write failed');
            const delError: DatabaseError = databaseError('redis.del', 'Delete failed');

            expect(getError.operation).toBe('redis.get');
            expect(getError.message).toBe('Key not found');
            expect(setError.operation).toBe('redis.set');
            expect(setError.message).toBe('Write failed');
            expect(delError.operation).toBe('redis.del');
            expect(delError.message).toBe('Delete failed');
        });
    });

    describe('externalApiError', () => {
        it('should create an external API error with service name and status code', () => {
            // Requirement 6.6: WHEN an external API error occurs THEN the system SHALL include the service name and status code
            const error: ExternalApiError = externalApiError('reddit', 'API rate limit exceeded', 429);

            expect(error.type).toBe('external_api');
            expect(error.service).toBe('reddit');
            expect(error.message).toBe('API rate limit exceeded');
            expect(error.statusCode).toBe(429);
        });

        it('should handle external API error without status code', () => {
            const error: ExternalApiError = externalApiError('openai', 'Service unavailable');

            expect(error.type).toBe('external_api');
            expect(error.service).toBe('openai');
            expect(error.message).toBe('Service unavailable');
            expect(error.statusCode).toBeUndefined();
        });

        it('should handle different external services', () => {
            const redditError: ExternalApiError = externalApiError('reddit', 'Unauthorized', 401);
            const openaiError: ExternalApiError = externalApiError('openai', 'Model not found', 404);

            expect(redditError.service).toBe('reddit');
            expect(redditError.statusCode).toBe(401);
            expect(openaiError.service).toBe('openai');
            expect(openaiError.statusCode).toBe(404);
        });
    });

    describe('internalError', () => {
        it('should create an internal error with message and optional cause', () => {
            // Requirement 6.6: WHEN an internal error occurs THEN the system SHALL include message and optional cause
            const cause = new Error('Original error');
            const error: InternalError = internalError('Unexpected error occurred', cause);

            expect(error.type).toBe('internal');
            expect(error.message).toBe('Unexpected error occurred');
            expect(error.cause).toBe(cause);
        });

        it('should handle internal error without cause', () => {
            const error: InternalError = internalError('Something went wrong');

            expect(error.type).toBe('internal');
            expect(error.message).toBe('Something went wrong');
            expect(error.cause).toBeUndefined();
        });

        it('should handle different cause types', () => {
            const errorCause = new Error('Error cause');
            const stringCause = 'String cause';
            const objectCause = { code: 'ERR_001', details: 'Details' };

            const error1: InternalError = internalError('Error 1', errorCause);
            const error2: InternalError = internalError('Error 2', stringCause);
            const error3: InternalError = internalError('Error 3', objectCause);

            expect(error1.cause).toBe(errorCause);
            expect(error2.cause).toBe(stringCause);
            expect(error3.cause).toBe(objectCause);
        });
    });
});
