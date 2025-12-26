/**
 * Property-Based Tests for UserRepository Error Handling
 * **Feature: repository-tests, Property 2: Database Errors Return Err**
 * **Validates: Requirements 3.2, 3.3**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { UserRepository } from './user.repository.js';
import type { Context } from '@devvit/server/server-context';
import { isErr } from '../../shared/utils/result.js';
import { 
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

describe('UserRepository Error Handling Property Tests', () => {
  let repository: UserRepository;
  let mockContext: Context;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const testContext = setupRepositoryTest();
    mockContext = testContext.mockContext;
    mockFetch = testContext.mockFetch;
    
    vi.mocked(settings.get).mockImplementation((key: string) => {
      if (key === 'SUPABASE_URL') return Promise.resolve('https://test.supabase.co');
      if (key === 'SUPABASE_ANON_KEY') return Promise.resolve('test-anon-key');
      return Promise.resolve(null);
    });
    
    repository = new UserRepository(mockContext);
  });

  afterEach(() => {
    teardownRepositoryTest();
  });

  describe('Property 2: Database Errors Return Err', () => {
    it('should return Err with DatabaseError for any database error on create', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 599 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.record({
            user_id: fc.string({ minLength: 1 }),
            username: fc.string({ minLength: 1 }),
            total_points: fc.integer({ min: 0 }),
            total_experience: fc.integer({ min: 0 }),
            level: fc.integer({ min: 1 }),
            challenges_created: fc.integer({ min: 0 }),
            challenges_attempted: fc.integer({ min: 0 }),
            challenges_solved: fc.integer({ min: 0 }),
            current_streak: fc.integer({ min: 0 }),
            best_streak: fc.integer({ min: 0 }),
            last_challenge_created_at: fc.constant(null),
            role: fc.constantFrom('player' as const, 'mod' as const),
          }),
          async (statusCode, errorMessage, profile) => {
            mockFetch.mockResolvedValueOnce(createMockFetchError(statusCode, errorMessage));

            const result = await repository.create(profile);
            
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
              expect(result.error.type).toBe('database');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return Err with DatabaseError for any database error on read', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 599 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (statusCode, errorMessage, userId) => {
            mockFetch.mockResolvedValueOnce(createMockFetchError(statusCode, errorMessage));

            const result = await repository.findById(userId);
            
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
              expect(result.error.type).toBe('database');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return Err with DatabaseError for any database error on update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 599 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.record({
            total_points: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
            level: fc.option(fc.integer({ min: 1 }), { nil: undefined }),
          }),
          async (statusCode, errorMessage, userId, updates) => {
            mockFetch.mockResolvedValueOnce(createMockFetchError(statusCode, errorMessage));

            const result = await repository.updateProfile(userId, updates);
            
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
              expect(result.error.type).toBe('database');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return Err with DatabaseError for any network error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (errorMessage, userId) => {
            mockFetch.mockRejectedValueOnce(new Error(errorMessage));

            const result = await repository.findById(userId);
            
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
              expect(result.error.type).toBe('database');
              // Error message may be nested, just verify it's a database error
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
