/**
 * Unit tests for UserService Result methods
 * Tests the Result-based error handling in UserService
 * 
 * Requirements: 3.1, 3.2, 3.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { Context } from '@devvit/server/server-context';
import { ok, err, isOk } from '../../shared/utils/result.js';
import { validationError, databaseError } from '../../shared/models/errors.js';
import type { UserProfile } from '../../shared/models/user.types.js';

// Mock Redis
vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock request deduplication
vi.mock('../../shared/utils/request-deduplication.js', () => ({
  deduplicateRequest: vi.fn((key, fn) => fn()),
  createDedupeKey: vi.fn((prefix, id) => `${prefix}:${id}`),
}));

describe('UserService Result Methods', () => {
  let userService: UserService;
  let mockUserRepo: UserRepository;
  let mockContext: Context;

  const mockProfile: UserProfile = {
    id: "1",
    user_id: 'user123',
    username: 'testuser',
    total_points: 100,
    total_experience: 500,
    level: 5,
    challenges_created: 10,
    challenges_attempted: 20,
    challenges_solved: 15,
    current_streak: 3,
    best_streak: 5,
    last_challenge_created_at: null,
    role: 'player',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    mockContext = {} as Context;
    mockUserRepo = new UserRepository(mockContext);
    userService = new UserService(mockContext, mockUserRepo);
  });

  describe('getUserProfile', () => {
    /**
     * Test getUserProfile returns Ok with profile on success
     * Requirements: 3.1, 3.2
     */
    it('should return Ok with profile on success', async () => {
      // Mock the repository to return a profile
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(ok(mockProfile));
      // Mock updateProfile in case level correction is needed
      vi.spyOn(mockUserRepo, 'updateProfile').mockResolvedValue(ok(true));

      const result = await userService.getUserProfile('user123', 'testuser');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeDefined();
        expect(result.value?.user_id).toBe('user123');
      }
    });

    /**
     * Test getUserProfile returns Err when user not found
     * Requirements: 3.1, 3.2
     */
    it('should return Err when repository fails', async () => {
      const dbError = databaseError('findById', 'Connection failed');
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(err(dbError));

      const result = await userService.getUserProfile('user123');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('database');
      }
    });

    /**
     * Test getUserProfile validates userId
     * Requirements: 3.1, 3.2
     */
    it('should return Err for invalid userId', async () => {
      const result = await userService.getUserProfile('');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('validation');
        expect(result.error).toMatchObject({
          type: 'validation',
          fields: [{ field: 'userId', message: 'Invalid or anonymous userId' }],
        });
      }
    });

    /**
     * Test getUserProfile validates username
     * Requirements: 3.1, 3.2
     */
    it('should return Err for invalid username', async () => {
      const result = await userService.getUserProfile('user123', 'anonymous');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('validation');
      }
    });
  });

  describe('createUserProfile', () => {
    /**
     * Test createUserProfile returns Ok with new profile
     * Requirements: 3.1, 3.2
     */
    it('should return Ok with new profile on success', async () => {
      vi.spyOn(mockUserRepo, 'create').mockResolvedValue(ok(mockProfile));

      const result = await userService.createUserProfile('user123', 'testuser');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockProfile);
      }
    });

    /**
     * Test createUserProfile validates userId
     * Requirements: 3.1, 3.2
     */
    it('should return Err for invalid userId', async () => {
      const result = await userService.createUserProfile('', 'testuser');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('validation');
      }
    });

    /**
     * Test createUserProfile validates username
     * Requirements: 3.1, 3.2
     */
    it('should return Err for invalid username', async () => {
      const result = await userService.createUserProfile('user123', '');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('validation');
      }
    });
  });

  describe('awardPoints', () => {
    /**
     * Test awardPoints returns Ok(true) on success
     * Requirements: 3.1, 3.2
     */
    it('should return Ok(true) on success', async () => {
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(ok(mockProfile));
      vi.spyOn(mockUserRepo, 'updateProfile').mockResolvedValue(ok(true));

      const result = await userService.awardPoints('user123', 50, 100);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    /**
     * Test awardPoints returns Err when profile not found
     * Requirements: 3.1, 3.2
     */
    it('should return Err when profile not found', async () => {
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(ok(null));

      const result = await userService.awardPoints('user123', 50, 100);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('database');
      }
    });

    /**
     * Test awardPoints returns Err when update fails
     * Requirements: 3.1, 3.2
     */
    it('should return Err when update fails', async () => {
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(ok(mockProfile));
      const dbError = databaseError('updateProfile', 'Update failed');
      vi.spyOn(mockUserRepo, 'updateProfile').mockResolvedValue(err(dbError));

      const result = await userService.awardPoints('user123', 50, 100);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('database');
      }
    });
  });

  describe('deductPoints', () => {
    /**
     * Test deductPoints returns Ok(true) on success
     * Requirements: 3.1, 3.2
     */
    it('should return Ok(true) on success', async () => {
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(ok(mockProfile));
      vi.spyOn(mockUserRepo, 'updateProfile').mockResolvedValue(ok(true));

      const result = await userService.deductPoints('user123', 50);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    /**
     * Test deductPoints returns Err on insufficient points
     * Requirements: 3.1, 3.2
     */
    it('should return Err on insufficient points', async () => {
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(ok(mockProfile));

      const result = await userService.deductPoints('user123', 200);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('validation');
        expect(result.error).toMatchObject({
          type: 'validation',
          fields: [{ field: 'points', message: 'Insufficient points' }],
        });
      }
    });
  });

  describe('retry logic', () => {
    /**
     * Test retry logic preserves Result semantics
     * Requirements: 3.1, 3.2, 3.5
     */
    it('should retry on failure and eventually succeed', async () => {
      const dbError = databaseError('findById', 'Temporary failure');
      
      // Fail twice, then succeed
      vi.spyOn(mockUserRepo, 'findById')
        .mockResolvedValueOnce(err(dbError))
        .mockResolvedValueOnce(err(dbError))
        .mockResolvedValueOnce(ok(mockProfile));
      
      vi.spyOn(mockUserRepo, 'updateProfile').mockResolvedValue(ok(true));

      const result = await userService.awardPoints('user123', 50, 100);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    /**
     * Test retry logic returns Err after max retries
     * Requirements: 3.1, 3.2, 3.5
     */
    it('should return Err after max retries', async () => {
      const dbError = databaseError('findById', 'Persistent failure');
      
      // Always fail
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(err(dbError));

      const result = await userService.awardPoints('user123', 50, 100);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('database');
      }
    });
  });

  describe('updateUserProfile', () => {
    /**
     * Test updateUserProfile returns Ok(true) on success
     * Requirements: 3.1, 3.2
     */
    it('should return Ok(true) on success', async () => {
      vi.spyOn(mockUserRepo, 'updateProfile').mockResolvedValue(ok(true));

      const result = await userService.updateUserProfile('user123', { level: 6 });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    /**
     * Test updateUserProfile propagates errors
     * Requirements: 3.1, 3.2
     */
    it('should propagate errors from repository', async () => {
      const dbError = databaseError('updateProfile', 'Update failed');
      vi.spyOn(mockUserRepo, 'updateProfile').mockResolvedValue(err(dbError));

      const result = await userService.updateUserProfile('user123', { level: 6 });

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('database');
      }
    });
  });

  describe('getUserRank', () => {
    /**
     * Test getUserRank returns Ok with rank
     * Requirements: 3.1, 3.2
     */
    it('should return Ok with rank on success', async () => {
      vi.spyOn(mockUserRepo, 'getUserRank').mockResolvedValue(ok(5));

      const result = await userService.getUserRank('user123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(5);
      }
    });

    /**
     * Test getUserRank propagates errors
     * Requirements: 3.1, 3.2
     */
    it('should propagate errors from repository', async () => {
      const dbError = databaseError('getUserRank', 'Query failed');
      vi.spyOn(mockUserRepo, 'getUserRank').mockResolvedValue(err(dbError));

      const result = await userService.getUserRank('user123');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('database');
      }
    });
  });

  describe('incrementStreak', () => {
    /**
     * Test incrementStreak returns Ok with new streak value
     * Requirements: 3.1, 3.2
     */
    it('should return Ok with new streak value on success', async () => {
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(ok(mockProfile));
      vi.spyOn(mockUserRepo, 'updateProfile').mockResolvedValue(ok(true));

      const result = await userService.incrementStreak('user123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(4); // current_streak was 3
      }
    });

    /**
     * Test incrementStreak propagates errors
     * Requirements: 3.1, 3.2
     */
    it('should propagate errors from repository', async () => {
      const dbError = databaseError('findById', 'Query failed');
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(err(dbError));

      const result = await userService.incrementStreak('user123');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.type).toBe('database');
      }
    });
  });

  describe('canCreateChallenge', () => {
    /**
     * Test canCreateChallenge returns Ok with rate limit info
     * Requirements: 3.1, 3.2
     */
    it('should return Ok with canCreate true when no rate limit', async () => {
      const profileWithoutLastCreated = { ...mockProfile, last_challenge_created_at: null };
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(ok(profileWithoutLastCreated));

      const result = await userService.canCreateChallenge('user123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.canCreate).toBe(true);
        expect(result.value.timeRemaining).toBe(0);
      }
    });

    /**
     * Test canCreateChallenge fails closed on error
     * Requirements: 3.1, 3.2
     */
    it('should fail closed on repository error', async () => {
      const dbError = databaseError('findById', 'Query failed');
      vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(err(dbError));

      const result = await userService.canCreateChallenge('user123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.canCreate).toBe(false);
        expect(result.value.timeRemaining).toBe(0);
      }
    });
  });
});
