/**
 * Property-based tests for Repository Deletion Methods
 * **Feature: data-deletion-handlers, Property 4: Repository Deletion Consistency**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 * 
 * Tests that all repository deletion methods return correct Result types
 * and handle both existing and non-existing records correctly.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Context } from '@devvit/server/server-context';
import { isOk, isErr } from '../../shared/utils/result.js';
import { UserRepository } from './user.repository.js';
import { AttemptRepository } from './attempt.repository.js';
import { ChallengeRepository } from './challenge.repository.js';

// Mock @devvit/web/server settings
vi.mock('@devvit/web/server', () => ({
  settings: {
    get: vi.fn(),
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
      effects: {
        enabled: false,
      },
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
const redditUserIdArb = fc.string({ minLength: 5, maxLength: 10 }).map(s => `t2_${s.replace(/[^a-z0-9]/gi, 'x')}`);
const redditPostIdArb = fc.string({ minLength: 5, maxLength: 10 }).map(s => `t3_${s.replace(/[^a-z0-9]/gi, 'x')}`);

describe('Repository Deletion Property Tests', () => {
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

  describe('Property 4: Repository Deletion Consistency', () => {
    describe('UserRepository.deleteProfile', () => {
      it('returns Ok(true) for any valid user ID when deletion succeeds', async () => {
        await fc.assert(
          fc.asyncProperty(
            redditUserIdArb,
            async (userId) => {
              const repository = new UserRepository(mockContext);
              
              mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Map(),
              });

              const result = await repository.deleteProfile(userId);
              
              expect(isOk(result)).toBe(true);
              if (isOk(result)) {
                expect(result.value).toBe(true);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('returns Err on database error for any user ID', async () => {
        await fc.assert(
          fc.asyncProperty(
            redditUserIdArb,
            fc.integer({ min: 400, max: 599 }),
            async (userId, statusCode) => {
              const repository = new UserRepository(mockContext);
              
              mockFetch.mockResolvedValueOnce({
                ok: false,
                status: statusCode,
                statusText: 'Error',
              });

              const result = await repository.deleteProfile(userId);
              
              expect(isErr(result)).toBe(true);
              if (isErr(result)) {
                expect(result.error.type).toBe('database');
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('AttemptRepository.deleteByUserId', () => {
      it('returns Ok with count for any valid user ID when deletion succeeds', async () => {
        await fc.assert(
          fc.asyncProperty(
            redditUserIdArb,
            fc.integer({ min: 0, max: 100 }),
            async (userId, deletedCount) => {
              const repository = new AttemptRepository(mockContext);
              
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => Array(deletedCount).fill({ id: 'test' }),
                headers: new Map(),
              });

              const result = await repository.deleteByUserId(userId);
              
              expect(isOk(result)).toBe(true);
              if (isOk(result)) {
                expect(typeof result.value).toBe('number');
                expect(result.value).toBe(deletedCount);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('returns Err on database error for any user ID', async () => {
        await fc.assert(
          fc.asyncProperty(
            redditUserIdArb,
            fc.integer({ min: 400, max: 599 }),
            async (userId, statusCode) => {
              const repository = new AttemptRepository(mockContext);
              
              mockFetch.mockResolvedValueOnce({
                ok: false,
                status: statusCode,
                statusText: 'Error',
              });

              const result = await repository.deleteByUserId(userId);
              
              expect(isErr(result)).toBe(true);
              if (isErr(result)) {
                expect(result.error.type).toBe('database');
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('ChallengeRepository.deleteByCreatorId', () => {
      it('returns Ok with count for any valid creator ID when deletion succeeds', async () => {
        await fc.assert(
          fc.asyncProperty(
            redditUserIdArb,
            fc.integer({ min: 0, max: 100 }),
            async (creatorId, deletedCount) => {
              const repository = new ChallengeRepository(mockContext);
              
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => Array(deletedCount).fill({ id: 'test' }),
                headers: new Map(),
              });

              const result = await repository.deleteByCreatorId(creatorId);
              
              expect(isOk(result)).toBe(true);
              if (isOk(result)) {
                expect(typeof result.value).toBe('number');
                expect(result.value).toBe(deletedCount);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('returns Err on database error for any creator ID', async () => {
        await fc.assert(
          fc.asyncProperty(
            redditUserIdArb,
            fc.integer({ min: 400, max: 599 }),
            async (creatorId, statusCode) => {
              const repository = new ChallengeRepository(mockContext);
              
              mockFetch.mockResolvedValueOnce({
                ok: false,
                status: statusCode,
                statusText: 'Error',
              });

              const result = await repository.deleteByCreatorId(creatorId);
              
              expect(isErr(result)).toBe(true);
              if (isErr(result)) {
                expect(result.error.type).toBe('database');
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Idempotency: Deletion of non-existent records succeeds', () => {
      it('deleteProfile returns Ok(true) even when no profile exists', async () => {
        await fc.assert(
          fc.asyncProperty(
            redditUserIdArb,
            async (userId) => {
              const repository = new UserRepository(mockContext);
              
              mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Map(),
              });

              const result = await repository.deleteProfile(userId);
              
              expect(isOk(result)).toBe(true);
              if (isOk(result)) {
                expect(result.value).toBe(true);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('deleteByUserId returns Ok(0) when no attempts exist', async () => {
        await fc.assert(
          fc.asyncProperty(
            redditUserIdArb,
            async (userId) => {
              const repository = new AttemptRepository(mockContext);
              
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
                headers: new Map(),
              });

              const result = await repository.deleteByUserId(userId);
              
              expect(isOk(result)).toBe(true);
              if (isOk(result)) {
                expect(result.value).toBe(0);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('deleteByCreatorId returns Ok(0) when no challenges exist', async () => {
        await fc.assert(
          fc.asyncProperty(
            redditUserIdArb,
            async (creatorId) => {
              const repository = new ChallengeRepository(mockContext);
              
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
                headers: new Map(),
              });

              const result = await repository.deleteByCreatorId(creatorId);
              
              expect(isOk(result)).toBe(true);
              if (isOk(result)) {
                expect(result.value).toBe(0);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
