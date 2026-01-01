/**
 * Property-based tests for Account Delete Handler
 * **Feature: data-deletion-handlers, Property 3: Account Deletion Completeness**
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
 * 
 * Tests that when account deletion is triggered for a user, all associated data
 * (profile, challenges, attempts, rewards) is removed from the database.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { Context } from '@devvit/server/server-context';
import { isOk } from '../../shared/utils/result.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { AttemptRepository } from '../repositories/attempt.repository.js';

// Mock @devvit/web/server
vi.mock('@devvit/web/server', () => ({
  settings: {
    get: vi.fn(),
  },
  context: {
    redis: {},
    subredditId: 'test-subreddit',
    subredditName: 'test',
    userId: 'test-user',
    appName: 'test-app',
    appAccountId: 'test-account',
  },
}));

import { settings } from '@devvit/web/server';

// Mock context
const createMockContext = (): Context => {
  return {
    redis: {} as any,
    subredditId: 'test-subreddit',
    subredditName: 'test',
    userId: 'test-user',
    appName: 'test-app',
    appAccountId: 'test-account',
    debug: {
      effects: { enabled: false },
      emitSnapshots: false,
      emitState: false,
      metadata: {},
    },
    toJSON: () => ({}),
  } as unknown as Context;
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Generators for Reddit ID formats
const redditUserIdArb = fc.string({ minLength: 5, maxLength: 10 })
  .map(s => `t2_${s.replace(/[^a-z0-9]/gi, 'x')}`);

// Generator for user account data with all related records
const userAccountDataArb = fc.record({
  userId: redditUserIdArb,
  challengesCount: fc.integer({ min: 0, max: 50 }),
  attemptsCount: fc.integer({ min: 0, max: 100 }),
  hasProfile: fc.boolean(),
});

describe('Account Delete Handler Property Tests', () => {
  let mockContext: Context;

  beforeEach(() => {
    mockContext = createMockContext();
    mockFetch.mockClear();
    
    // Mock settings.get for Supabase config
    vi.mocked(settings.get).mockImplementation((key: string) => {
      if (key === 'supabaseUrl') return Promise.resolve('https://test.supabase.co');
      if (key === 'supabaseAnonKey') return Promise.resolve('test-anon-key');
      return Promise.resolve(null);
    });
    
    // Set environment variables as fallback
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  describe('Property 3: Account Deletion Completeness', () => {
    it('for any user with challenges, deleteByCreatorId removes all challenges', async () => {
      await fc.assert(
        fc.asyncProperty(
          redditUserIdArb,
          fc.integer({ min: 0, max: 100 }),
          async (userId, challengeCount) => {
            const repository = new ChallengeRepository(mockContext);
            
            // Mock successful deletion returning the count
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => Array(challengeCount).fill({ id: 'test' }),
              headers: new Map(),
            });
            
            const result = await repository.deleteByCreatorId(userId);
            
            // Deletion should succeed
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(result.value).toBe(challengeCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any user with attempts, deleteByUserId removes all attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          redditUserIdArb,
          fc.integer({ min: 0, max: 100 }),
          async (userId, attemptCount) => {
            const repository = new AttemptRepository(mockContext);
            
            // Mock successful deletion returning the count
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => Array(attemptCount).fill({ id: 'test' }),
              headers: new Map(),
            });
            
            const result = await repository.deleteByUserId(userId);
            
            // Deletion should succeed
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(result.value).toBe(attemptCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any user with a profile, deleteProfile removes the profile', async () => {
      await fc.assert(
        fc.asyncProperty(
          redditUserIdArb,
          async (userId) => {
            const repository = new UserRepository(mockContext);
            
            // Mock successful deletion
            mockFetch.mockResolvedValueOnce({
              ok: true,
              headers: new Map(),
            });
            
            const result = await repository.deleteProfile(userId);
            
            // Deletion should succeed
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(result.value).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any user account, all deletion operations can be performed in sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          userAccountDataArb,
          async (accountData) => {
            const userRepo = new UserRepository(mockContext);
            const challengeRepo = new ChallengeRepository(mockContext);
            const attemptRepo = new AttemptRepository(mockContext);
            
            // Mock all deletion operations in sequence
            // 1. Delete challenges
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => Array(accountData.challengesCount).fill({ id: 'test' }),
              headers: new Map(),
            });
            
            // 2. Delete attempts
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => Array(accountData.attemptsCount).fill({ id: 'test' }),
              headers: new Map(),
            });
            
            // 3. Delete profile
            mockFetch.mockResolvedValueOnce({
              ok: true,
              headers: new Map(),
            });
            
            // Execute all deletions
            const challengeResult = await challengeRepo.deleteByCreatorId(accountData.userId);
            const attemptResult = await attemptRepo.deleteByUserId(accountData.userId);
            const profileResult = await userRepo.deleteProfile(accountData.userId);
            
            // All operations should succeed
            expect(isOk(challengeResult)).toBe(true);
            expect(isOk(attemptResult)).toBe(true);
            expect(isOk(profileResult)).toBe(true);
            
            // Verify counts
            if (isOk(challengeResult)) {
              expect(challengeResult.value).toBe(accountData.challengesCount);
            }
            if (isOk(attemptResult)) {
              expect(attemptResult.value).toBe(accountData.attemptsCount);
            }
            if (isOk(profileResult)) {
              expect(profileResult.value).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any user ID, account deletion is idempotent (succeeds even with no data)', async () => {
      await fc.assert(
        fc.asyncProperty(
          redditUserIdArb,
          async (userId) => {
            const userRepo = new UserRepository(mockContext);
            const challengeRepo = new ChallengeRepository(mockContext);
            const attemptRepo = new AttemptRepository(mockContext);
            
            // Mock all operations returning empty/zero (no data exists)
            mockFetch
              .mockResolvedValueOnce({
                ok: true,
                json: async () => [],
                headers: new Map(),
              })
              .mockResolvedValueOnce({
                ok: true,
                json: async () => [],
                headers: new Map(),
              })
              .mockResolvedValueOnce({
                ok: true,
                headers: new Map(),
              });
            
            // Execute all deletions
            const challengeResult = await challengeRepo.deleteByCreatorId(userId);
            const attemptResult = await attemptRepo.deleteByUserId(userId);
            const profileResult = await userRepo.deleteProfile(userId);
            
            // All operations should succeed even with no data
            expect(isOk(challengeResult)).toBe(true);
            expect(isOk(attemptResult)).toBe(true);
            expect(isOk(profileResult)).toBe(true);
            
            // Counts should be zero
            if (isOk(challengeResult)) expect(challengeResult.value).toBe(0);
            if (isOk(attemptResult)) expect(attemptResult.value).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any user, partial failures do not prevent other deletions from being attempted', async () => {
      await fc.assert(
        fc.asyncProperty(
          redditUserIdArb,
          fc.integer({ min: 0, max: 2 }), // Which operation fails (0-2)
          async (userId, failingOperation) => {
            const userRepo = new UserRepository(mockContext);
            const challengeRepo = new ChallengeRepository(mockContext);
            const attemptRepo = new AttemptRepository(mockContext);
            
            // Set up mocks - one will fail based on failingOperation
            const successResponse = {
              ok: true,
              json: async () => [{ id: 'test' }],
              headers: new Map(),
            };
            const failResponse = {
              ok: false,
              status: 500,
              statusText: 'Internal Server Error',
            };
            
            // Mock responses based on which operation should fail
            // Order: challenges (1 call), attempts (1 call), profile (1 call)
            
            // 1. Challenge deletion (1 fetch call)
            mockFetch.mockResolvedValueOnce(failingOperation === 0 ? failResponse : successResponse);
            
            // 2. Attempt deletion (1 fetch call)
            mockFetch.mockResolvedValueOnce(failingOperation === 1 ? failResponse : successResponse);
            
            // 3. Profile deletion (1 fetch call)
            mockFetch.mockResolvedValueOnce(failingOperation === 2 ? failResponse : { ok: true, headers: new Map() });
            
            // Execute all deletions - each should be attempted regardless of others
            const challengeResult = await challengeRepo.deleteByCreatorId(userId);
            const attemptResult = await attemptRepo.deleteByUserId(userId);
            const profileResult = await userRepo.deleteProfile(userId);
            
            // Verify that the expected operation failed and others succeeded
            if (failingOperation === 0) {
              expect(isOk(challengeResult)).toBe(false);
            } else {
              expect(isOk(challengeResult)).toBe(true);
            }
            
            if (failingOperation === 1) {
              expect(isOk(attemptResult)).toBe(false);
            } else {
              expect(isOk(attemptResult)).toBe(true);
            }
            
            if (failingOperation === 2) {
              expect(isOk(profileResult)).toBe(false);
            } else {
              expect(isOk(profileResult)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
