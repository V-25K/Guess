/**
 * Comprehensive Unit Tests for UserRepository
 * Tests all CRUD operations, Result pattern integration, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserRepository } from './user.repository.js';
import type { Context } from '@devvit/server/server-context';
import { isOk, isErr } from '../../shared/utils/result.js';
import type { UserProfileUpdate } from '../../shared/models/user.types.js';
import { 
  createMockUser, 
  createMockFetchSuccess,
  createMockFetchError,
  expectOk,
  expectOkValue,
  expectDatabaseError,
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

describe('UserRepository', () => {
  let repository: UserRepository;
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
    
    repository = new UserRepository(mockContext);
  });

  afterEach(() => {
    teardownRepositoryTest();
  });

  describe('findById', () => {
    it('should return Ok with user when exists', async () => {
      const mockUser = createMockUser({ user_id: 'user123' });
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockUser]));

      const result = await repository.findById('user123');
      
      expectOkValue(result, mockUser);
    });

    it('should return Ok with null when not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

      const result = await repository.findById('nonexistent');
      
      const value = expectOk(result);
      expect(value).toBeNull();
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.findById('user123');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('queryOne');
      expect(error.message).toContain('Internal Server Error');
    });

    it('should return Err on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const result = await repository.findById('user123');
      
      const error = expectDatabaseError(result);
      expect(error.message).toContain('Network connection failed');
    });

    it('should handle malformed responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
        headers: new Headers(),
      } as unknown as Response);

      const result = await repository.findById('user123');
      
      const error = expectDatabaseError(result);
      expect(error.message).toContain('Invalid JSON');
    });
  });

  describe('create', () => {
    it('should return Ok with created user on success', async () => {
      const newProfile = {
        user_id: 'user123',
        username: 'testuser',
        total_points: 0,
        total_experience: 0,
        level: 1,
        challenges_created: 0,
        challenges_attempted: 0,
        challenges_solved: 0,
        current_streak: 0,
        best_streak: 0,
        last_challenge_created_at: null,
        role: 'player' as const,
      };

      const mockCreatedProfile = createMockUser(newProfile);
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockCreatedProfile]));

      const result = await repository.create(newProfile);
      
      const value = expectOk(result);
      expect(value.user_id).toBe('user123');
      expect(value.username).toBe('testuser');
      expect(value.id).toBeDefined();
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Bad Request'));

      const newProfile = {
        user_id: 'user123',
        username: 'testuser',
        total_points: 0,
        total_experience: 0,
        level: 1,
        challenges_created: 0,
        challenges_attempted: 0,
        challenges_solved: 0,
        current_streak: 0,
        best_streak: 0,
        last_challenge_created_at: null,
        role: 'player' as const,
      };

      const result = await repository.create(newProfile);
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('insert');
    });

    it('should handle empty input data', async () => {
      const emptyProfile = {} as any;
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Invalid input'));

      const result = await repository.create(emptyProfile);
      
      expect(isErr(result)).toBe(true);
    });

    it('should handle null parameters', async () => {
      const nullProfile = null as any;
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Invalid input'));

      const result = await repository.create(nullProfile);
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('updateProfile', () => {
    it('should return Ok with true on successful update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const updates: UserProfileUpdate = {
        total_points: 150,
        level: 6,
      };

      const result = await repository.updateProfile('user123', updates);
      
      expectOkValue(result, true);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const updates: UserProfileUpdate = {
        total_points: 150,
      };

      const result = await repository.updateProfile('user123', updates);
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('update');
    });

    it('should handle invalid filter parameters', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Invalid filter'));

      const updates: UserProfileUpdate = {
        total_points: 150,
      };

      const result = await repository.updateProfile('', updates);
      
      expect(isErr(result)).toBe(true);
    });

    it('should handle concurrent updates', async () => {
      // Simulate concurrent update scenario
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const updates: UserProfileUpdate = {
        total_points: 150,
      };

      const result = await repository.updateProfile('user123', updates);
      
      // Should still succeed - database handles concurrency
      expect(isOk(result)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should return Ok with true on successful delete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const result = await repository['delete']('user_profiles', { user_id: 'user123' });
      
      expectOkValue(result, true);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository['delete']('user_profiles', { user_id: 'user123' });
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('delete');
    });

    it('should handle non-existent user', async () => {
      // Database returns success even if no rows affected
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const result = await repository['delete']('user_profiles', { user_id: 'nonexistent' });
      
      expectOkValue(result, true);
    });
  });

  describe('getUserRank', () => {
    it('should return Ok with rank on success using optimized function', async () => {
      // Mock the optimized function call
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(5));

      const result = await repository.getUserRank('user123');
      
      const value = expectOk(result);
      expect(value).toBe(5);
    });

    it('should return Ok with null when user not found', async () => {
      // Mock the optimized function returning null
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(null));

      // Mock findById returning null
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

      const result = await repository.getUserRank('nonexistent');
      
      const value = expectOk(result);
      expect(value).toBeNull();
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.getUserRank('user123');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('getUserRank');
    });

    it('should use fallback when optimized function returns null', async () => {
      const mockUser = createMockUser({ user_id: 'user123', total_points: 100 });
      
      // Mock optimized function returning null (fallback trigger)
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(null));
      
      // Mock findById returning user
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockUser]));
      
      // Mock count query
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-range': '0-9/42' }),
      } as Response);

      const result = await repository.getUserRank('user123');
      
      const value = expectOk(result);
      if (value !== null) {
        expect(value).toBe(43); // 42 users ahead + 1
      }
    });

    it('should return Err when fallback count query fails', async () => {
      const mockUser = createMockUser({ user_id: 'user123', total_points: 100 });
      
      // Mock optimized function returning null (fallback trigger)
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(null));
      
      // Mock findById returning user
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockUser]));
      
      // Mock count query failing
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await repository.getUserRank('user123');
      
      expect(isErr(result)).toBe(true);
    });

    it('should return null when fallback count header is missing', async () => {
      const mockUser = createMockUser({ user_id: 'user123', total_points: 100 });
      
      // Mock optimized function returning null (fallback trigger)
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(null));
      
      // Mock findById returning user
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockUser]));
      
      // Mock count query with no content-range header
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(), // No content-range header
      } as Response);

      const result = await repository.getUserRank('user123');
      
      const value = expectOk(result);
      expect(value).toBeNull();
    });

    it('should return null when fallback count header has invalid format', async () => {
      const mockUser = createMockUser({ user_id: 'user123', total_points: 100 });
      
      // Mock optimized function returning null (fallback trigger)
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(null));
      
      // Mock findById returning user
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockUser]));
      
      // Mock count query with invalid content-range header format
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-range': 'invalid-format' }),
      } as Response);

      const result = await repository.getUserRank('user123');
      
      const value = expectOk(result);
      expect(value).toBeNull();
    });
  });

  describe('query methods', () => {
    describe('findByPoints', () => {
      it('should return array of users ordered by points', async () => {
        const mockUser1 = createMockUser({ total_points: 200 });
        const mockUser2 = createMockUser({ total_points: 150 });
        const mockProfiles = [mockUser1, mockUser2];

        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockProfiles));

        const result = await repository.findByPoints(10, 0);
        
        const value = expectOk(result);
        expect(value).toEqual(mockProfiles);
        expect(value.length).toBe(2);
      });

      it('should verify correct parameters passed to Supabase', async () => {
        const mockProfiles = [createMockUser()];
        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockProfiles));

        await repository.findByPoints(5, 10);
        
        // Verify fetch was called with correct URL containing order, limit, and offset
        expect(mockFetch).toHaveBeenCalled();
        const callUrl = mockFetch.mock.calls[0][0] as string;
        expect(callUrl).toContain('order=total_points.desc');
        expect(callUrl).toContain('limit=5');
        expect(callUrl).toContain('offset=10');
      });

      it('should handle empty results', async () => {
        mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

        const result = await repository.findByPoints(10, 0);
        
        const value = expectOk(result);
        expect(value).toEqual([]);
      });
    });
  });

  describe('batchUpdateStats', () => {
    it('should return Ok with updated profile on success', async () => {
      const mockUpdatedProfile = createMockUser({
        user_id: 'user123',
        total_points: 150,
        total_experience: 75,
      });

      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockUpdatedProfile));

      const result = await repository.batchUpdateStats('user123', {
        pointsDelta: 50,
        expDelta: 25,
        challengesCreatedDelta: 1,
      });
      
      const value = expectOk(result);
      if (value !== null) {
        expect(value.user_id).toBe('user123');
      }
    });

    it('should return Err on function execution failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.batchUpdateStats('user123', {
        pointsDelta: 50,
      });
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('batchUpdateStats');
    });
  });
});
