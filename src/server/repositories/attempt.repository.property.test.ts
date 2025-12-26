/**
 * Property-Based Tests for AttemptRepository
 * Tests universal properties that should hold across all inputs
 * 
 * **Feature: repository-tests, Property 6: Empty Input Handled Gracefully**
 * **Validates: Requirements 4.1**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AttemptRepository } from './attempt.repository.js';
import type { Context } from '@devvit/server/server-context';
import { isOk, isErr } from '../../shared/utils/result.js';
import type { ChallengeAttemptCreate, AttemptGuessCreate } from '../../shared/models/attempt.types.js';
import { 
  createMockFetchSuccess,
  createMockFetchError,
  setupRepositoryTest,
  teardownRepositoryTest
} from '../test-utils/index.js';

// Mock @devvit/web/server settings
vi.mock('@devvit/web/server', () => ({
  settings: {
    get: vi.fn(),
  },
}));

import { settings } from '@devvit/web/server';

describe('AttemptRepository - Property Tests', () => {
  let repository: AttemptRepository;
  let mockContext: Context;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const testContext = setupRepositoryTest();
    mockContext = testContext.mockContext;
    mockFetch = testContext.mockFetch;
    
    // Mock settings.get for Supabase config
    vi.mocked(settings.get).mockImplementation((key: string) => {
      if (key === 'SUPABASE_URL') return Promise.resolve('https://test.supabase.co');
      if (key === 'SUPABASE_ANON_KEY') return Promise.resolve('test-anon-key');
      return Promise.resolve(null);
    });
    
    repository = new AttemptRepository(mockContext);
  });

  afterEach(() => {
    teardownRepositoryTest();
  });

  describe('Property 6: Empty Input Handled Gracefully', () => {
    it('should handle empty attempt input without throwing', () => {
      fc.assert(
        fc.asyncProperty(fc.constant({}), async (emptyInput) => {
          // Mock database error response for invalid input
          mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Invalid input'));

          const result = await repository.create(emptyInput as ChallengeAttemptCreate);
          
          // Should return Err, not throw
          expect(isErr(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty guess input without throwing', () => {
      fc.assert(
        fc.asyncProperty(fc.constant({}), async (emptyInput) => {
          // Mock database error response for invalid input
          mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Invalid input'));

          const result = await repository.createGuess(emptyInput as AttemptGuessCreate);
          
          // Should return Err, not throw
          expect(isErr(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty string parameters without throwing', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), fc.string(), async (userId, challengeId) => {
          // Mock empty result
          mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

          const result = await repository.findByUserAndChallenge(userId, challengeId);
          
          // Should return Ok with null or Err, not throw
          expect(isOk(result) || isErr(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle various user IDs without throwing', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), async (userId) => {
          // Mock empty result
          mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

          const result = await repository.findByUser(userId);
          
          // Should return Ok or Err, not throw
          expect(isOk(result) || isErr(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle various challenge IDs without throwing', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), async (challengeId) => {
          // Mock empty result
          mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

          const result = await repository.findByChallenge(challengeId);
          
          // Should return Ok or Err, not throw
          expect(isOk(result) || isErr(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle hasAttempted with various inputs without throwing', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), fc.string(), async (userId, challengeId) => {
          // Mock result
          mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

          const result = await repository.hasAttempted(userId, challengeId);
          
          // Should return Ok or Err, not throw
          expect(isOk(result) || isErr(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle hasSolved with various inputs without throwing', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), fc.string(), async (userId, challengeId) => {
          // Mock result
          mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

          const result = await repository.hasSolved(userId, challengeId);
          
          // Should return Ok or Err, not throw
          expect(isOk(result) || isErr(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
