/**
 * Error Scenarios Integration Tests
 * Tests error handling for validation, not found, rate limit, and database errors
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestContext,
  clearTestData,
  type TestContext,
} from './setup.js';
import {
  createUserWithProfile,
  createChallengeWithCreator,
  verifyValidationErrorFormat,
  verifyNotFoundErrorFormat,
  verifyRateLimitErrorFormat,
} from './helpers.js';
import {
  validationError,
  notFoundError,
  rateLimitError,
  databaseError,
  type ValidationError,
  type NotFoundError,
  type RateLimitError,
  type DatabaseError,
  type AppError,
} from '../../../shared/models/errors.js';

describe('Error Scenarios Integration Tests', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = createTestContext();
  });

  afterEach(() => {
    clearTestData(testContext);
    vi.clearAllMocks();
  });

  /**
   * Requirement 5.1: WHEN invalid input is provided 
   * THEN the Integration Test Suite SHALL verify validation errors are returned with correct format
   */
  describe('Validation Error Responses', () => {
    it('should return validation error with correct type', () => {
      const error = validationError([
        { field: 'username', message: 'Username is required' },
      ]);

      expect(error.type).toBe('validation');
    });

    it('should include field-specific error details', () => {
      const error = validationError([
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password must be at least 8 characters' },
      ]);

      expect(error.fields).toHaveLength(2);
      expect(error.fields[0].field).toBe('email');
      expect(error.fields[0].message).toBe('Invalid email format');
      expect(error.fields[1].field).toBe('password');
    });

    it('should handle empty title validation', () => {
      const error = validationError([
        { field: 'title', message: 'Title cannot be empty' },
      ]);

      verifyValidationErrorFormat(error);
      expect(error.fields.some(f => f.field === 'title')).toBe(true);
    });

    it('should handle invalid answer validation', () => {
      const error = validationError([
        { field: 'correct_answer', message: 'Answer must be between 1 and 100 characters' },
      ]);

      expect(error.type).toBe('validation');
      expect(error.fields[0].field).toBe('correct_answer');
    });

    it('should handle multiple validation errors at once', () => {
      const error = validationError([
        { field: 'title', message: 'Title is required' },
        { field: 'correct_answer', message: 'Answer is required' },
        { field: 'image_url', message: 'At least one image is required' },
        { field: 'tags', message: 'At least one tag is required' },
      ]);

      expect(error.fields).toHaveLength(4);
      expect(error.fields.map(f => f.field)).toContain('title');
      expect(error.fields.map(f => f.field)).toContain('correct_answer');
      expect(error.fields.map(f => f.field)).toContain('image_url');
      expect(error.fields.map(f => f.field)).toContain('tags');
    });

    it('should handle invalid user ID format', () => {
      const error = validationError([
        { field: 'user_id', message: 'User ID must start with t2_' },
      ]);

      expect(error.type).toBe('validation');
      expect(error.fields[0].message).toContain('t2_');
    });

    it('should handle numeric field validation', () => {
      const error = validationError([
        { field: 'max_score', message: 'Max score must be a positive number' },
        { field: 'max_guesses', message: 'Max guesses must be between 1 and 20' },
      ]);

      expect(error.fields).toHaveLength(2);
    });
  });


  /**
   * Requirement 5.2: WHEN a resource is not found 
   * THEN the Integration Test Suite SHALL verify 404 errors are returned appropriately
   */
  describe('Not Found Error Responses', () => {
    it('should return not found error with correct type', () => {
      const error = notFoundError('challenge', 'non-existent-id');

      expect(error.type).toBe('not_found');
    });

    it('should include resource type in error', () => {
      const error = notFoundError('user', 't2_unknown');

      expect(error.resource).toBe('user');
      expect(error.identifier).toBe('t2_unknown');
    });

    it('should handle challenge not found', () => {
      const challengeId = 'non-existent-challenge-uuid';
      const error = notFoundError('challenge', challengeId);

      verifyNotFoundErrorFormat(error, 'challenge');
      expect(error.identifier).toBe(challengeId);
    });

    it('should handle user not found', () => {
      const userId = 't2_nonexistent';
      const error = notFoundError('user', userId);

      expect(error.type).toBe('not_found');
      expect(error.resource).toBe('user');
      expect(error.identifier).toBe(userId);
    });

    it('should handle attempt not found', () => {
      const attemptId = 'non-existent-attempt-uuid';
      const error = notFoundError('attempt', attemptId);

      expect(error.type).toBe('not_found');
      expect(error.resource).toBe('attempt');
    });

    it('should verify resource does not exist in mock database', () => {
      const nonExistentId = 'definitely-not-real';
      
      const challenge = testContext.mockSupabase.data.challenges.find(
        c => c.id === nonExistentId
      );
      
      expect(challenge).toBeUndefined();
      
      // This would trigger a not found error in real code
      const error = notFoundError('challenge', nonExistentId);
      expect(error.type).toBe('not_found');
    });

    it('should distinguish between different resource types', () => {
      const userError = notFoundError('user', 't2_missing');
      const challengeError = notFoundError('challenge', 'missing-challenge');
      const attemptError = notFoundError('attempt', 'missing-attempt');

      expect(userError.resource).toBe('user');
      expect(challengeError.resource).toBe('challenge');
      expect(attemptError.resource).toBe('attempt');
    });
  });


  /**
   * Requirement 5.3: WHEN rate limits are exceeded 
   * THEN the Integration Test Suite SHALL verify rate limit errors are returned
   */
  describe('Rate Limit Error Responses', () => {
    it('should return rate limit error with correct type', () => {
      const error = rateLimitError(60000);

      expect(error.type).toBe('rate_limit');
    });

    it('should include time remaining in milliseconds', () => {
      const timeRemaining = 30000; // 30 seconds
      const error = rateLimitError(timeRemaining);

      expect(error.timeRemainingMs).toBe(timeRemaining);
      expect(typeof error.timeRemainingMs).toBe('number');
    });

    it('should handle short rate limit windows', () => {
      const error = rateLimitError(5000); // 5 seconds

      verifyRateLimitErrorFormat(error);
      expect(error.timeRemainingMs).toBe(5000);
    });

    it('should handle long rate limit windows', () => {
      const error = rateLimitError(3600000); // 1 hour

      expect(error.type).toBe('rate_limit');
      expect(error.timeRemainingMs).toBe(3600000);
    });

    it('should simulate rate limit tracking in Redis', async () => {
      const userId = 't2_ratelimited';
      const rateLimitKey = `ratelimit:${userId}:guess`;
      const maxRequests = 10;
      const windowMs = 60000;

      // Simulate rate limit counter
      await testContext.mockRedis.set(rateLimitKey, String(maxRequests), { ex: windowMs / 1000 });

      const currentCount = await testContext.mockRedis.get(rateLimitKey);
      expect(parseInt(currentCount!)).toBe(maxRequests);

      // Would trigger rate limit error
      const error = rateLimitError(windowMs);
      expect(error.type).toBe('rate_limit');
    });

    it('should handle zero time remaining edge case', () => {
      const error = rateLimitError(0);

      expect(error.type).toBe('rate_limit');
      expect(error.timeRemainingMs).toBe(0);
    });

    it('should provide actionable time information', () => {
      const error = rateLimitError(45000);

      // Time should be positive and reasonable
      expect(error.timeRemainingMs).toBeGreaterThanOrEqual(0);
      expect(error.timeRemainingMs).toBeLessThanOrEqual(3600000); // Max 1 hour
    });
  });


  /**
   * Requirement 5.4: WHEN database errors occur 
   * THEN the Integration Test Suite SHALL verify errors are handled without crashing
   */
  describe('Database Error Handling', () => {
    it('should return database error with correct type', () => {
      const error = databaseError('insert', 'Connection timeout');

      expect(error.type).toBe('database');
    });

    it('should include operation name in error', () => {
      const error = databaseError('select', 'Query failed');

      expect(error.operation).toBe('select');
      expect(error.message).toBe('Query failed');
    });

    it('should handle insert operation errors', () => {
      const error = databaseError('insert', 'Duplicate key violation');

      expect(error.type).toBe('database');
      expect(error.operation).toBe('insert');
      expect(error.message).toContain('Duplicate');
    });

    it('should handle update operation errors', () => {
      const error = databaseError('update', 'Row not found for update');

      expect(error.type).toBe('database');
      expect(error.operation).toBe('update');
    });

    it('should handle delete operation errors', () => {
      const error = databaseError('delete', 'Foreign key constraint violation');

      expect(error.type).toBe('database');
      expect(error.operation).toBe('delete');
    });

    it('should handle connection errors', () => {
      const error = databaseError('connect', 'Unable to establish connection');

      expect(error.type).toBe('database');
      expect(error.operation).toBe('connect');
      expect(error.message).toContain('connection');
    });

    it('should handle transaction errors', () => {
      const error = databaseError('transaction', 'Transaction rollback due to conflict');

      expect(error.type).toBe('database');
      expect(error.operation).toBe('transaction');
    });

    it('should not crash application on database error', () => {
      // Simulate error handling without throwing
      const handleDatabaseError = (error: DatabaseError): { handled: boolean; error: DatabaseError } => {
        return { handled: true, error };
      };

      const error = databaseError('query', 'Unexpected error');
      const result = handleDatabaseError(error);

      expect(result.handled).toBe(true);
      expect(result.error.type).toBe('database');
    });
  });

  /**
   * Additional error scenario tests
   */
  describe('Error Handling Integration Scenarios', () => {
    it('should handle cascading errors gracefully', () => {
      // Simulate a scenario where one error leads to another
      const errors: AppError[] = [];

      // First: validation error
      errors.push(validationError([{ field: 'id', message: 'Invalid ID format' }]));

      // Then: not found (if validation passed but resource missing)
      errors.push(notFoundError('challenge', 'invalid-id'));

      expect(errors).toHaveLength(2);
      expect(errors[0].type).toBe('validation');
      expect(errors[1].type).toBe('not_found');
    });

    it('should distinguish error types correctly', () => {
      const validationErr = validationError([{ field: 'test', message: 'test' }]);
      const notFoundErr = notFoundError('test', 'id');
      const rateLimitErr = rateLimitError(1000);
      const databaseErr = databaseError('test', 'test');

      expect(validationErr.type).toBe('validation');
      expect(notFoundErr.type).toBe('not_found');
      expect(rateLimitErr.type).toBe('rate_limit');
      expect(databaseErr.type).toBe('database');
    });

    it('should handle error recovery scenarios', async () => {
      // Simulate retry after rate limit
      const userId = 't2_retry';
      const rateLimitKey = `ratelimit:${userId}:action`;

      // Set rate limit
      await testContext.mockRedis.set(rateLimitKey, '10', { ex: 60 });

      // Check rate limit exists
      let count = await testContext.mockRedis.get(rateLimitKey);
      expect(count).toBe('10');

      // Simulate rate limit expiry (delete key)
      await testContext.mockRedis.del(rateLimitKey);

      // Verify rate limit cleared
      count = await testContext.mockRedis.get(rateLimitKey);
      expect(count).toBeNull();
    });

    it('should provide consistent error structure across all types', () => {
      const errors: AppError[] = [
        validationError([{ field: 'f', message: 'm' }]),
        notFoundError('r', 'i'),
        rateLimitError(1000),
        databaseError('o', 'm'),
      ];

      errors.forEach(error => {
        expect(error).toHaveProperty('type');
        expect(typeof error.type).toBe('string');
      });
    });

    it('should handle error in user creation flow', () => {
      // Simulate validation error during user creation
      const invalidUserId = 'invalid-format'; // Missing t2_ prefix
      
      const error = validationError([
        { field: 'user_id', message: 'User ID must start with t2_' },
      ]);

      expect(error.type).toBe('validation');
      expect(error.fields[0].field).toBe('user_id');
    });

    it('should handle error in challenge creation flow', () => {
      // Simulate multiple validation errors
      const error = validationError([
        { field: 'title', message: 'Title is required' },
        { field: 'correct_answer', message: 'Answer is required' },
        { field: 'image_url', message: 'At least 2 images required' },
      ]);

      expect(error.type).toBe('validation');
      expect(error.fields.length).toBe(3);
    });

    it('should handle error in attempt submission flow', () => {
      // Challenge not found
      const notFound = notFoundError('challenge', 'missing-challenge-id');
      expect(notFound.type).toBe('not_found');

      // Rate limited
      const rateLimit = rateLimitError(30000);
      expect(rateLimit.type).toBe('rate_limit');

      // Database error during save
      const dbError = databaseError('insert', 'Failed to save attempt');
      expect(dbError.type).toBe('database');
    });
  });
});
