/**
 * Comprehensive Unit Tests for ChallengeRepository
 * Tests all CRUD operations, Result pattern integration, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChallengeRepository } from './challenge.repository.js';
import type { Context } from '@devvit/server/server-context';
import { isOk, isErr } from '../../shared/utils/result.js';
import type { ChallengeCreate } from '../../shared/models/challenge.types.js';
import { 
  createMockChallenge, 
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

describe('ChallengeRepository', () => {
  let repository: ChallengeRepository;
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
    
    repository = new ChallengeRepository(mockContext);
  });

  afterEach(() => {
    teardownRepositoryTest();
  });

  describe('findById', () => {
    it('should return Ok with challenge when exists', async () => {
      const mockChallenge = createMockChallenge({ id: 'challenge123' });
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockChallenge]));

      const result = await repository.findById('challenge123');
      
      expectOkValue(result, mockChallenge);
    });

    it('should return Ok with null when not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

      const result = await repository.findById('nonexistent');
      
      const value = expectOk(result);
      expect(value).toBeNull();
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.findById('challenge123');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('queryOne');
      expect(error.message).toContain('Internal Server Error');
    });

    it('should return Err on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const result = await repository.findById('challenge123');
      
      const error = expectDatabaseError(result);
      expect(error.message).toContain('Network connection failed');
    });
  });

  describe('create', () => {
    it('should return Ok with created challenge on success', async () => {
      const newChallenge: ChallengeCreate = {
        creator_id: 'user123',
        creator_username: 'testuser',
        title: 'Test Challenge',
        image_url: 'https://example.com/image.jpg',
        image_descriptions: ['desc1', 'desc2', 'desc3', 'desc4'],
        tags: ['nature', 'technology'],
        correct_answer: 'test answer',
        answer_explanation: 'This is the explanation',
        answer_set: {
          correct: ['test answer', 'test'],
          close: ['testing', 'tester']
        },
        max_score: 100,
        score_deduction_per_hint: 10,
      };

      const mockCreatedChallenge = createMockChallenge(newChallenge);
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockCreatedChallenge]));

      const result = await repository.create(newChallenge);
      
      const value = expectOk(result);
      expect(value.creator_id).toBe('user123');
      expect(value.title).toBe('Test Challenge');
      expect(value.id).toBeDefined();
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Bad Request'));

      const newChallenge: ChallengeCreate = {
        creator_id: 'user123',
        creator_username: 'testuser',
        title: 'Test Challenge',
        image_url: 'https://example.com/image.jpg',
        image_descriptions: ['desc1', 'desc2', 'desc3', 'desc4'],
        tags: ['nature'],
        correct_answer: 'test answer',
        answer_explanation: 'This is the explanation',
        answer_set: {
          correct: ['test answer'],
          close: ['testing']
        },
        max_score: 100,
        score_deduction_per_hint: 10,
      };

      const result = await repository.create(newChallenge);
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('insert');
    });

    it('should handle empty input data', async () => {
      const emptyChallenge = {} as any;
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Invalid input'));

      const result = await repository.create(emptyChallenge);
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('update', () => {
    it('should return Ok with true on successful update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const updates = {
        title: 'Updated Challenge Title',
        players_played: 10,
      };

      const result = await repository.update('challenge123', updates);
      
      expectOkValue(result, true);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const updates = {
        title: 'Updated Challenge Title',
      };

      const result = await repository.update('challenge123', updates);
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('update');
    });

    it('should handle invalid filter parameters', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Invalid filter'));

      const updates = {
        title: 'Updated Challenge Title',
      };

      const result = await repository.update('', updates);
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('deleteChallenge', () => {
    it('should return Ok with true on successful delete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const result = await repository.deleteChallenge('challenge123');
      
      expectOkValue(result, true);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.deleteChallenge('challenge123');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('delete');
    });
  });

  describe('query methods', () => {
    describe('findByCreator', () => {
      it('should return correct results', async () => {
        const mockChallenge1 = createMockChallenge({ creator_id: 'user123' });
        const mockChallenge2 = createMockChallenge({ creator_id: 'user123' });
        const mockChallenges = [mockChallenge1, mockChallenge2];

        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockChallenges));

        const result = await repository.findByCreator('user123');
        
        const value = expectOk(result);
        expect(value).toEqual(mockChallenges);
        expect(value.length).toBe(2);
      });

      it('should verify correct filter parameters', async () => {
        const mockChallenges = [createMockChallenge()];
        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockChallenges));

        await repository.findByCreator('user123');
        
        // Verify fetch was called with correct URL containing creator filter
        expect(mockFetch).toHaveBeenCalled();
        const callUrl = mockFetch.mock.calls[0][0] as string;
        expect(callUrl).toContain('creator_id=eq.user123');
      });

      it('should verify correct sorting parameters', async () => {
        const mockChallenges = [createMockChallenge()];
        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockChallenges));

        await repository.findByCreator('user123');
        
        // Verify fetch was called with correct URL containing order
        expect(mockFetch).toHaveBeenCalled();
        const callUrl = mockFetch.mock.calls[0][0] as string;
        expect(callUrl).toContain('order=created_at.desc');
      });
    });

    describe('findAll', () => {
      it('should return filtered results by tags', async () => {
        const mockChallenge1 = createMockChallenge({ tags: ['nature', 'technology'] });
        const mockChallenge2 = createMockChallenge({ tags: ['nature', 'art'] });
        const mockChallenges = [mockChallenge1, mockChallenge2];

        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockChallenges));

        const result = await repository.findAll({ tags: ['nature'] });
        
        const value = expectOk(result);
        expect(value).toEqual(mockChallenges);
      });

      it('should verify correct filter parameters for tags', async () => {
        const mockChallenges = [createMockChallenge()];
        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockChallenges));

        await repository.findAll({ tags: ['nature', 'technology'] });
        
        // Verify fetch was called with correct URL containing tag filter
        expect(mockFetch).toHaveBeenCalled();
        const callUrl = mockFetch.mock.calls[0][0] as string;
        expect(callUrl).toContain('tags=cs.{nature,technology}');
      });

      it('should verify correct filter parameters for creator', async () => {
        const mockChallenges = [createMockChallenge()];
        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockChallenges));

        await repository.findAll({ creatorId: 'user123' });
        
        // Verify fetch was called with correct URL containing creator filter
        expect(mockFetch).toHaveBeenCalled();
        const callUrl = mockFetch.mock.calls[0][0] as string;
        expect(callUrl).toContain('creator_id=eq.user123');
      });

      it('should verify correct sorting parameters', async () => {
        const mockChallenges = [createMockChallenge()];
        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockChallenges));

        await repository.findAll();
        
        // Verify fetch was called with correct URL containing order
        expect(mockFetch).toHaveBeenCalled();
        const callUrl = mockFetch.mock.calls[0][0] as string;
        expect(callUrl).toContain('order=created_at.desc');
      });

      it('should handle pagination parameters', async () => {
        const mockChallenges = [createMockChallenge()];
        mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockChallenges));

        await repository.findAll({ limit: 10, offset: 20 });
        
        // Verify fetch was called with correct URL containing pagination
        expect(mockFetch).toHaveBeenCalled();
        const callUrl = mockFetch.mock.calls[0][0] as string;
        expect(callUrl).toContain('limit=10');
        expect(callUrl).toContain('offset=20');
      });
    });
  });

  describe('incrementPlayersPlayed', () => {
    it('should return Ok with true on successful increment', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(true));

      const result = await repository.incrementPlayersPlayed('challenge123');
      
      expectOkValue(result, true);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.incrementPlayersPlayed('challenge123');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('executeBooleanFunction');
    });
  });

  describe('incrementPlayersCompleted', () => {
    it('should return Ok with true on successful increment', async () => {
      const mockChallenge = createMockChallenge({ 
        id: 'challenge123',
        players_completed: 5 
      });
      
      // Mock findById
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockChallenge]));
      
      // Mock update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const result = await repository.incrementPlayersCompleted('challenge123');
      
      expectOkValue(result, true);
    });

    it('should return Err when challenge not found', async () => {
      // Mock findById returning null
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

      const result = await repository.incrementPlayersCompleted('nonexistent');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('incrementPlayersCompleted');
      expect(error.message).toContain('Challenge not found');
    });

    it('should return Err on findById database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.incrementPlayersCompleted('challenge123');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('incrementPlayersCompleted');
    });

    it('should return Err on update database error', async () => {
      const mockChallenge = createMockChallenge({ 
        id: 'challenge123',
        players_completed: 5 
      });
      
      // Mock findById success
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockChallenge]));
      
      // Mock update failure
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Update failed'));

      const result = await repository.incrementPlayersCompleted('challenge123');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('incrementPlayersCompleted');
    });

    it('should handle null players_completed value', async () => {
      const mockChallenge = createMockChallenge({ 
        id: 'challenge123',
        players_completed: 0
      });
      
      // Mock findById
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockChallenge]));
      
      // Mock update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const result = await repository.incrementPlayersCompleted('challenge123');
      
      expectOkValue(result, true);
    });
  });

  describe('findByPostId', () => {
    it('should return Ok with challenge when exists', async () => {
      const mockChallenge = createMockChallenge({ reddit_post_id: 'post123' });
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockChallenge]));

      const result = await repository.findByPostId('post123');
      
      expectOkValue(result, mockChallenge);
    });

    it('should return Ok with null when not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

      const result = await repository.findByPostId('nonexistent');
      
      const value = expectOk(result);
      expect(value).toBeNull();
    });
  });

  describe('findAll error handling', () => {
    it('should return Err when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.findAll();
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('findAll');
      expect(error.message).toContain('Internal Server Error');
    });

    it('should return Err on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const result = await repository.findAll();
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('findAll');
      expect(error.message).toContain('Network connection failed');
    });
  });
});
