/**
 * Property-Based Tests for UserRepository
 * **Feature: repository-tests, Property 1: CRUD Success Returns Ok**
 * **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 3.1**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { UserRepository } from './user.repository.js';
import type { Context } from '@devvit/server/server-context';
import { isOk } from '../../shared/utils/result.js';
import type { UserProfile } from '../../shared/models/user.types.js';
import { 
  createMockFetchSuccess,
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

describe('UserRepository Property-Based Tests', () => {
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

  describe('Property 1: CRUD Success Returns Ok', () => {
    it('should return Ok for any successful create operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user_id: fc.string({ minLength: 1, maxLength: 50 }),
            username: fc.string({ minLength: 1, maxLength: 50 }),
            total_points: fc.integer({ min: 0, max: 100000 }),
            total_experience: fc.integer({ min: 0, max: 100000 }),
            level: fc.integer({ min: 1, max: 100 }),
            challenges_created: fc.integer({ min: 0, max: 1000 }),
            challenges_attempted: fc.integer({ min: 0, max: 10000 }),
            challenges_solved: fc.integer({ min: 0, max: 10000 }),
            current_streak: fc.integer({ min: 0, max: 365 }),
            best_streak: fc.integer({ min: 0, max: 365 }),
            last_challenge_created_at: fc.oneof(
              fc.constant(null), 
              fc.constant('2024-01-01T00:00:00.000Z')
            ),
            role: fc.constantFrom('player' as const, 'mod' as const),
          }),
          async (profile) => {
            const mockCreatedProfile: UserProfile = {
              ...profile,
              id: 'generated-id',
              created_at: '2024-01-01T00:00:00.000Z',
              updated_at: '2024-01-01T00:00:00.000Z',
            };

            mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockCreatedProfile]));

            const result = await repository.create(profile);
            
            expect(isOk(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return Ok for any successful read operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.record({
            id: fc.string(),
            user_id: fc.string(),
            username: fc.string(),
            total_points: fc.integer({ min: 0 }),
            total_experience: fc.integer({ min: 0 }),
            level: fc.integer({ min: 1 }),
            challenges_created: fc.integer({ min: 0 }),
            challenges_attempted: fc.integer({ min: 0 }),
            challenges_solved: fc.integer({ min: 0 }),
            current_streak: fc.integer({ min: 0 }),
            best_streak: fc.integer({ min: 0 }),
            last_challenge_created_at: fc.oneof(
              fc.constant(null), 
              fc.constant('2024-01-01T00:00:00.000Z')
            ),
            role: fc.constantFrom('player' as const, 'mod' as const),
            created_at: fc.constant('2024-01-01T00:00:00.000Z'),
            updated_at: fc.constant('2024-01-01T00:00:00.000Z'),
          }),
          async (userId, mockUser) => {
            mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockUser]));

            const result = await repository.findById(userId);
            
            expect(isOk(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return Ok for any successful update operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.record({
            total_points: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
            total_experience: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
            level: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
            current_streak: fc.option(fc.integer({ min: 0, max: 365 }), { nil: undefined }),
            best_streak: fc.option(fc.integer({ min: 0, max: 365 }), { nil: undefined }),
          }),
          async (userId, updates) => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              headers: new Headers(),
            } as Response);

            const result = await repository.updateProfile(userId, updates);
            
            expect(isOk(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return Ok for any successful delete operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (userId) => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              headers: new Headers(),
            } as Response);

            const result = await repository['delete']('user_profiles', { user_id: userId });
            
            expect(isOk(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
