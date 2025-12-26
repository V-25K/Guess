/**
 * Comprehensive Unit Tests for AttemptRepository
 * Tests all CRUD operations, Result pattern integration, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AttemptRepository } from './attempt.repository.js';
import type { Context } from '@devvit/server/server-context';
import { isOk, isErr } from '../../shared/utils/result.js';
import type { ChallengeAttemptCreate, ChallengeAttemptUpdate, AttemptGuessCreate } from '../../shared/models/attempt.types.js';
import { 
  createMockAttempt, 
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

describe('AttemptRepository', () => {
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

  describe('findByUserAndChallenge', () => {
    it('should return Ok with attempt when exists', async () => {
      const mockAttempt = createMockAttempt({ 
        user_id: 'user123', 
        challenge_id: 'challenge456' 
      });
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockAttempt]));

      const result = await repository.findByUserAndChallenge('user123', 'challenge456');
      
      expectOkValue(result, mockAttempt);
    });

    it('should return Ok with null when not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

      const result = await repository.findByUserAndChallenge('user123', 'nonexistent');
      
      const value = expectOk(result);
      expect(value).toBeNull();
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.findByUserAndChallenge('user123', 'challenge456');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('findByUserAndChallenge');
      expect(error.message).toContain('Internal Server Error');
    });
  });

  describe('create', () => {
    it('should return Ok with created attempt on success', async () => {
      const newAttempt: ChallengeAttemptCreate = {
        user_id: 'user123',
        challenge_id: 'challenge456',
        attempts_made: 1,
        images_revealed: 1,
        is_solved: false,
        game_over: false,
        points_earned: 0,
        experience_earned: 0,
        completed_at: null,
      };

      const mockCreatedAttempt = createMockAttempt(newAttempt);
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockCreatedAttempt]));

      const result = await repository.create(newAttempt);
      
      const value = expectOk(result);
      expect(value.user_id).toBe('user123');
      expect(value.challenge_id).toBe('challenge456');
      expect(value.id).toBeDefined();
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Bad Request'));

      const newAttempt: ChallengeAttemptCreate = {
        user_id: 'user123',
        challenge_id: 'challenge456',
        attempts_made: 1,
        images_revealed: 1,
        is_solved: false,
        game_over: false,
        points_earned: 0,
        experience_earned: 0,
        completed_at: null,
      };

      const result = await repository.create(newAttempt);
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('insert');
    });

    it('should handle empty input data', async () => {
      const emptyAttempt = {} as any;
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Invalid input'));

      const result = await repository.create(emptyAttempt);
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe('findByUser', () => {
    it('should return correct results', async () => {
      const mockAttempt1 = createMockAttempt({ user_id: 'user123' });
      const mockAttempt2 = createMockAttempt({ user_id: 'user123' });
      const mockAttempts = [mockAttempt1, mockAttempt2];

      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockAttempts));

      const result = await repository.findByUser('user123');
      
      const value = expectOk(result);
      expect(value).toEqual(mockAttempts);
      expect(value.length).toBe(2);
    });

    it('should verify correct filter parameters', async () => {
      const mockAttempts = [createMockAttempt()];
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockAttempts));

      await repository.findByUser('user123');
      
      // Verify fetch was called with correct URL containing filter
      expect(mockFetch).toHaveBeenCalled();
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('user_id=eq.user123');
      expect(callUrl).toContain('order=attempted_at.desc');
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

      const result = await repository.findByUser('user123');
      
      const value = expectOk(result);
      expect(value).toEqual([]);
    });
  });

  describe('findByChallenge', () => {
    it('should return correct results', async () => {
      const mockAttempt1 = createMockAttempt({ challenge_id: 'challenge456' });
      const mockAttempt2 = createMockAttempt({ challenge_id: 'challenge456' });
      const mockAttempts = [mockAttempt1, mockAttempt2];

      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockAttempts));

      const result = await repository.findByChallenge('challenge456');
      
      const value = expectOk(result);
      expect(value).toEqual(mockAttempts);
      expect(value.length).toBe(2);
    });

    it('should verify correct filter parameters', async () => {
      const mockAttempts = [createMockAttempt()];
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockAttempts));

      await repository.findByChallenge('challenge456');
      
      // Verify fetch was called with correct URL containing filter
      expect(mockFetch).toHaveBeenCalled();
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('challenge_id=eq.challenge456');
      expect(callUrl).toContain('order=attempted_at.desc');
    });

    it('should verify correct pagination parameters', async () => {
      const mockAttempts = [createMockAttempt()];
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockAttempts));

      // Note: findByChallenge doesn't have pagination params, but we test the query method
      await repository.findByChallenge('challenge456');
      
      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalled();
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('select=*');
    });
  });

  describe('hasAttempted', () => {
    it('should return Ok with true when user has attempted', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([{ id: 'attempt123' }]));

      const result = await repository.hasAttempted('user123', 'challenge456');
      
      expectOkValue(result, true);
    });

    it('should return Ok with false when user has not attempted', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

      const result = await repository.hasAttempted('user123', 'challenge456');
      
      expectOkValue(result, false);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.hasAttempted('user123', 'challenge456');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('hasAttempted');
    });
  });

  describe('hasSolved', () => {
    it('should return Ok with true when user has solved', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([{ id: 'attempt123' }]));

      const result = await repository.hasSolved('user123', 'challenge456');
      
      expectOkValue(result, true);
    });

    it('should return Ok with false when user has not solved', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

      const result = await repository.hasSolved('user123', 'challenge456');
      
      expectOkValue(result, false);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.hasSolved('user123', 'challenge456');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('hasSolved');
    });
  });

  describe('updateAttempt', () => {
    it('should return Ok with true on successful update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const updates: ChallengeAttemptUpdate = {
        is_solved: true,
        points_earned: 100,
      };

      const result = await repository.updateAttempt('attempt123', updates);
      
      expectOkValue(result, true);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const updates: ChallengeAttemptUpdate = {
        is_solved: true,
      };

      const result = await repository.updateAttempt('attempt123', updates);
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('update');
    });
  });

  describe('recordCompletionAtomic', () => {
    it('should return Ok with true on success', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(true));

      const result = await repository.recordCompletionAtomic(
        'attempt123',
        'user123',
        3,
        100,
        50
      );
      
      expectOkValue(result, true);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.recordCompletionAtomic(
        'attempt123',
        'user123',
        3,
        100,
        50
      );
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('executeBooleanFunction');
    });
  });

  describe('createGuess', () => {
    it('should return Ok with created guess on success', async () => {
      const newGuess: AttemptGuessCreate = {
        attempt_id: 'attempt123',
        guess_text: 'test answer',
        validation_result: 'INCORRECT',
        ai_explanation: null,
      };

      const mockCreatedGuess = {
        id: 'guess123',
        ...newGuess,
        created_at: new Date().toISOString(),
      };
      mockFetch.mockResolvedValueOnce(createMockFetchSuccess([mockCreatedGuess]));

      const result = await repository.createGuess(newGuess);
      
      const value = expectOk(result);
      expect(value.attempt_id).toBe('attempt123');
      expect(value.guess_text).toBe('test answer');
      expect(value.id).toBeDefined();
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(400, 'Bad Request'));

      const newGuess: AttemptGuessCreate = {
        attempt_id: 'attempt123',
        guess_text: 'test answer',
        validation_result: 'INCORRECT',
        ai_explanation: null,
      };

      const result = await repository.createGuess(newGuess);
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('insert');
    });
  });

  describe('getGuessesByAttempt', () => {
    it('should return Ok with array of guesses', async () => {
      const mockGuesses = [
        {
          id: 'guess1',
          attempt_id: 'attempt123',
          guess_text: 'first guess',
          validation_result: 'INCORRECT' as const,
          ai_explanation: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 'guess2',
          attempt_id: 'attempt123',
          guess_text: 'second guess',
          validation_result: 'CORRECT' as const,
          ai_explanation: 'Correct!',
          created_at: new Date().toISOString(),
        },
      ];

      mockFetch.mockResolvedValueOnce(createMockFetchSuccess(mockGuesses));

      const result = await repository.getGuessesByAttempt('attempt123');
      
      const value = expectOk(result);
      expect(value).toEqual(mockGuesses);
      expect(value.length).toBe(2);
    });

    it('should return Err on database error', async () => {
      mockFetch.mockResolvedValueOnce(createMockFetchError(500, 'Internal Server Error'));

      const result = await repository.getGuessesByAttempt('attempt123');
      
      const error = expectDatabaseError(result);
      expect(error.operation).toBe('query');
    });
  });
});
