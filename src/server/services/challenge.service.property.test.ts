/**
 * Property-Based Tests for ChallengeService
 * **Feature: ui-ux-mobile-improvements, Property 4: Challenge Data Completeness**
 * **Validates: Requirements 6.1, 6.2**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ChallengeService } from './challenge.service.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from './user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { Context } from '@devvit/server/server-context';
import type { Challenge } from '../../shared/models/challenge.types.js';
import { isOk, ok } from '../../shared/utils/result.js';
import {
  createMockContext,
  createMockChallenge,
  setupRepositoryTest,
  teardownRepositoryTest,
} from '../test-utils/index.js';

// Mock @devvit/web/server settings
vi.mock('@devvit/web/server', () => ({
  settings: {
    get: vi.fn(),
  },
}));

import { settings } from '@devvit/web/server';

describe('ChallengeService Property-Based Tests', () => {
  let service: ChallengeService;
  let mockContext: Context;
  let mockChallengeRepo: ChallengeRepository;
  let mockUserService: UserService;
  let mockUserRepo: UserRepository;

  beforeEach(() => {
    const testContext = setupRepositoryTest();
    mockContext = testContext.mockContext;

    vi.mocked(settings.get).mockImplementation((key: string) => {
      if (key === 'SUPABASE_URL') return Promise.resolve('https://test.supabase.co');
      if (key === 'SUPABASE_ANON_KEY') return Promise.resolve('test-anon-key');
      return Promise.resolve(null);
    });

    mockChallengeRepo = new ChallengeRepository(mockContext);
    mockUserRepo = new UserRepository(mockContext);
    mockUserService = new UserService(mockContext, mockUserRepo);
    service = new ChallengeService(mockContext, mockChallengeRepo, mockUserService);
  });

  afterEach(() => {
    teardownRepositoryTest();
  });


  /**
   * **Feature: ui-ux-mobile-improvements, Property 4: Challenge Data Completeness**
   *
   * *For any* challenge fetched from the API, the response should include both
   * players_played and players_completed as non-negative integers.
   *
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Property 4: Challenge Data Completeness', () => {
    it('should include players_played and players_completed as non-negative integers for any challenge', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random non-negative integers for players_played and players_completed
          fc.nat({ max: 10000 }), // players_played
          fc.nat({ max: 10000 }), // players_completed
          async (playersPlayed, playersCompleted) => {
            // Ensure players_completed <= players_played (logical constraint)
            const actualPlayersCompleted = Math.min(playersCompleted, playersPlayed);

            // Create a mock challenge with the generated values
            const mockChallenge = createMockChallenge({
              players_played: playersPlayed,
              players_completed: actualPlayersCompleted,
            });

            // Mock the repository to return this challenge
            vi.spyOn(mockChallengeRepo, 'findById').mockResolvedValueOnce(
              ok(mockChallenge)
            );

            // Fetch the challenge through the service
            const result = await service.getChallengeById(mockChallenge.id);

            // Verify the result is Ok
            expect(isOk(result)).toBe(true);

            if (isOk(result) && result.value) {
              const challenge = result.value;

              // Property: players_played must be present and a non-negative integer
              expect(challenge.players_played).toBeDefined();
              expect(typeof challenge.players_played).toBe('number');
              expect(Number.isInteger(challenge.players_played)).toBe(true);
              expect(challenge.players_played).toBeGreaterThanOrEqual(0);

              // Property: players_completed must be present and a non-negative integer
              expect(challenge.players_completed).toBeDefined();
              expect(typeof challenge.players_completed).toBe('number');
              expect(Number.isInteger(challenge.players_completed)).toBe(true);
              expect(challenge.players_completed).toBeGreaterThanOrEqual(0);

              // Property: players_completed should not exceed players_played
              expect(challenge.players_completed).toBeLessThanOrEqual(challenge.players_played);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include players_played and players_completed in all challenges from findAll', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an array of 1-10 challenges with random statistics
          fc.array(
            fc.record({
              players_played: fc.nat({ max: 10000 }),
              players_completed: fc.nat({ max: 10000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (challengeStats) => {
            // Create mock challenges with the generated statistics
            const mockChallenges: Challenge[] = challengeStats.map((stats) => {
              const playersPlayed = stats.players_played;
              const playersCompleted = Math.min(stats.players_completed, playersPlayed);
              return createMockChallenge({
                players_played: playersPlayed,
                players_completed: playersCompleted,
              });
            });

            // Mock the repository to return these challenges
            vi.spyOn(mockChallengeRepo, 'findAll').mockResolvedValueOnce(
              ok(mockChallenges)
            );

            // Fetch challenges through the service
            const result = await service.getChallenges();

            // Verify the result is Ok
            expect(isOk(result)).toBe(true);

            if (isOk(result)) {
              const challenges = result.value;

              // Property: Every challenge must have valid players_played and players_completed
              for (const challenge of challenges) {
                // players_played must be present and a non-negative integer
                expect(challenge.players_played).toBeDefined();
                expect(typeof challenge.players_played).toBe('number');
                expect(Number.isInteger(challenge.players_played)).toBe(true);
                expect(challenge.players_played).toBeGreaterThanOrEqual(0);

                // players_completed must be present and a non-negative integer
                expect(challenge.players_completed).toBeDefined();
                expect(typeof challenge.players_completed).toBe('number');
                expect(Number.isInteger(challenge.players_completed)).toBe(true);
                expect(challenge.players_completed).toBeGreaterThanOrEqual(0);

                // players_completed should not exceed players_played
                expect(challenge.players_completed).toBeLessThanOrEqual(challenge.players_played);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
