/**
 * Unit tests for ChallengeService Result-based methods
 * 
 * Tests the Result pattern implementation for challenge operations.
 * Requirements: 3.1, 3.2, 3.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChallengeService } from './challenge.service.js';
import type { Context } from '@devvit/server/server-context';
import type { ChallengeCreate, Challenge } from '../../shared/models/challenge.types.js';
import { isOk, isErr, ok, err } from '../../shared/utils/result.js';
import { databaseError } from '../../shared/models/errors.js';

// Mock dependencies
vi.mock('../repositories/challenge.repository.js');
vi.mock('./user.service.js');

describe('ChallengeService Result Methods', () => {
  let challengeService: ChallengeService;
  let mockChallengeRepo: any;
  let mockUserService: any;
  let mockContext: Context;

  beforeEach(() => {
    // Create mock context
    mockContext = {} as Context;

    // Create mock repository
    mockChallengeRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      findByCreator: vi.fn(),
      findByPostId: vi.fn(),
      update: vi.fn(),
      deleteChallenge: vi.fn(),
    };

    // Create mock user service
    mockUserService = {
      canCreateChallenge: vi.fn(),
      awardPoints: vi.fn(),
      incrementChallengesCreated: vi.fn(),
    };

    // Create service instance
    challengeService = new ChallengeService(
      mockContext,
      mockChallengeRepo,
      mockUserService
    );
  });

  describe('createChallenge', () => {
    const validChallenge: ChallengeCreate = {
      creator_id: 'user123',
      creator_username: 'testuser',
      title: 'Test Challenge',
      image_url: 'https://example.com/img1.jpg,https://example.com/img2.jpg',
      correct_answer: 'Test Answer',
      tags: ['test'],
      max_score: 100,
      score_deduction_per_hint: 10,
      answer_set: {
        correct: ['Test Answer'],
        close: ['Test'],
      },
    };

    it('should return Ok with challenge on success', async () => {
      // Arrange
      const createdChallenge: Challenge = {
        id: 'challenge123',
        ...validChallenge,
        image_url: validChallenge.image_url,
        reddit_post_id: null,
        players_played: 0,
        players_completed: 0,
        created_at: new Date().toISOString(),
      };

      mockUserService.canCreateChallenge.mockResolvedValue(
        ok({ canCreate: true, timeRemaining: 0 })
      );
      mockChallengeRepo.create.mockResolvedValue(ok(createdChallenge));
      mockUserService.awardPoints.mockResolvedValue(ok(true));
      mockUserService.incrementChallengesCreated.mockResolvedValue(ok(true));

      // Act
      const result = await challengeService.createChallenge(validChallenge);

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.id).toBe('challenge123');
        expect(result.value.title).toBe('Test Challenge');
      }
    });

    it('should return Err with ValidationError on invalid data - missing fields', async () => {
      // Arrange
      const invalidChallenge: ChallengeCreate = {
        creator_id: '',
        creator_username: '',
        title: '',
        image_url: '',
        correct_answer: '',
        tags: [],
        max_score: 100,
        score_deduction_per_hint: 10,
      };

      // Act
      const result = await challengeService.createChallenge(invalidChallenge);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('validation');
        if (result.error.type === 'validation') {
          expect(result.error.fields.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return Err with ValidationError on invalid image count', async () => {
      // Arrange
      const invalidChallenge: ChallengeCreate = {
        ...validChallenge,
        image_url: 'https://example.com/img1.jpg', // Only 1 image
      };

      // Act
      const result = await challengeService.createChallenge(invalidChallenge);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('validation');
        if (result.error.type === 'validation') {
          const imageError = result.error.fields.find(f => f.field === 'image_url');
          expect(imageError).toBeDefined();
          expect(imageError?.message).toContain('2 and 3 images');
        }
      }
    });

    it('should return Err with ValidationError on empty tags', async () => {
      // Arrange
      const invalidChallenge: ChallengeCreate = {
        ...validChallenge,
        tags: [],
      };

      // Act
      const result = await challengeService.createChallenge(invalidChallenge);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('validation');
        if (result.error.type === 'validation') {
          const tagError = result.error.fields.find(f => f.field === 'tags');
          expect(tagError).toBeDefined();
        }
      }
    });

    it('should return Err with ValidationError on invalid title length', async () => {
      // Arrange
      const invalidChallenge: ChallengeCreate = {
        ...validChallenge,
        title: 'ab', // Too short (< 3 chars)
      };

      // Act
      const result = await challengeService.createChallenge(invalidChallenge);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('validation');
        if (result.error.type === 'validation') {
          const titleError = result.error.fields.find(f => f.field === 'title');
          expect(titleError).toBeDefined();
          expect(titleError?.message).toContain('3 and 200 characters');
        }
      }
    });

    it('should return Err with RateLimitError when rate limited', async () => {
      // Arrange
      const timeRemaining = 3600000; // 1 hour
      mockUserService.canCreateChallenge.mockResolvedValue(
        ok({ canCreate: false, timeRemaining })
      );

      // Act
      const result = await challengeService.createChallenge(validChallenge);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('rate_limit');
        if (result.error.type === 'rate_limit') {
          expect(result.error.timeRemainingMs).toBe(timeRemaining);
        }
      }
    });

    it('should return Err when repository create fails', async () => {
      // Arrange
      mockUserService.canCreateChallenge.mockResolvedValue(
        ok({ canCreate: true, timeRemaining: 0 })
      );
      mockChallengeRepo.create.mockResolvedValue(
        err(databaseError('create', 'Database connection failed'))
      );

      // Act
      const result = await challengeService.createChallenge(validChallenge);

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
      }
    });
  });

  describe('getChallenges', () => {
    it('should return Ok with challenges array', async () => {
      // Arrange
      const mockChallenges: Challenge[] = [
        {
          id: 'challenge1',
          creator_id: 'user1',
          creator_username: 'user1',
          title: 'Challenge 1',
          image_url: 'https://example.com/img1.jpg,https://example.com/img2.jpg',
          correct_answer: 'Answer 1',
          tags: ['test'],
          max_score: 100,
          score_deduction_per_hint: 10,
          answer_set: { correct: ['Answer 1'], close: [] },
          reddit_post_id: null,
          players_played: 0,
          players_completed: 0,
          created_at: new Date().toISOString(),
        },
      ];

      mockChallengeRepo.findAll.mockResolvedValue(ok(mockChallenges));

      // Act
      const result = await challengeService.getChallenges();

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].id).toBe('challenge1');
      }
    });

    it('should return Err when repository fails', async () => {
      // Arrange
      mockChallengeRepo.findAll.mockResolvedValue(
        err(databaseError('findAll', 'Connection timeout'))
      );

      // Act
      const result = await challengeService.getChallenges();

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
      }
    });
  });

  describe('getChallengeById', () => {
    it('should return Ok with challenge when found', async () => {
      // Arrange
      const mockChallenge: Challenge = {
        id: 'challenge123',
        creator_id: 'user1',
        creator_username: 'user1',
        title: 'Test Challenge',
        image_url: 'https://example.com/img1.jpg,https://example.com/img2.jpg',
        correct_answer: 'Answer',
        tags: ['test'],
        max_score: 100,
        score_deduction_per_hint: 10,
        answer_set: { correct: ['Answer'], close: [] },
        reddit_post_id: null,
        players_played: 0,
        players_completed: 0,
        created_at: new Date().toISOString(),
      };

      mockChallengeRepo.findById.mockResolvedValue(ok(mockChallenge));

      // Act
      const result = await challengeService.getChallengeById('challenge123');

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value?.id).toBe('challenge123');
      }
    });

    it('should return Ok with null when not found', async () => {
      // Arrange
      mockChallengeRepo.findById.mockResolvedValue(ok(null));

      // Act
      const result = await challengeService.getChallengeById('nonexistent');

      // Assert
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it('should return Err when repository fails', async () => {
      // Arrange
      mockChallengeRepo.findById.mockResolvedValue(
        err(databaseError('findById', 'Database error'))
      );

      // Act
      const result = await challengeService.getChallengeById('challenge123');

      // Assert
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
      }
    });
  });
});
