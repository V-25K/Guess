/**
 * AttemptService Tests
 * Tests for challenge attempts, guess submission, and completion logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttemptService } from './attempt.service.js';
import { AttemptRepository } from '../repositories/attempt.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from './user.service.js';
import type { Context } from '@devvit/server/server-context';
import type { ChallengeAttempt } from '../../shared/models/attempt.types.js';
import type { Challenge } from '../../shared/models/challenge.types.js';
import { ok, err, isOk } from '../../shared/utils/result.js';
import { databaseError } from '../../shared/models/errors.js';

// Mock dependencies
const createMockContext = (): Context => ({
    redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
    settings: { getAll: vi.fn() },
    subredditId: 't5_test' as `t5_${string}`,
} as unknown as Context);

const createMockAttemptRepo = () => ({
    create: vi.fn(),
    findByUserAndChallenge: vi.fn(),
    findByUser: vi.fn(),
    findByChallenge: vi.fn(),
    hasAttempted: vi.fn(),
    hasSolved: vi.fn(),
    updateAttempt: vi.fn(),
    createGuess: vi.fn(),
    recordCompletionAtomic: vi.fn(),
});

const createMockUserService = () => ({
    getUserProfile: vi.fn(),
    incrementChallengesAttempted: vi.fn(),
    incrementStreak: vi.fn(),
    resetStreak: vi.fn(),
    awardPoints: vi.fn(),
    deductPoints: vi.fn(),
    invalidateUserCache: vi.fn().mockReturnValue(undefined),
});

const createMockChallengeRepo = () => ({
    findById: vi.fn(),
    incrementPlayersPlayed: vi.fn(),
    incrementPlayersCompleted: vi.fn(),
});

// Helper to create test attempt
const createTestAttempt = (overrides?: Partial<ChallengeAttempt>): ChallengeAttempt => ({
    id: 'attempt-1',
    user_id: 'user-1',
    challenge_id: 'challenge-1',
    attempts_made: 0,
    images_revealed: 1,
    is_solved: false,
    game_over: false,
    points_earned: 0,
    experience_earned: 0,
    attempted_at: new Date().toISOString(),
    completed_at: null,
    hints_used: [],
    ...overrides,
});

// Helper to create test challenge
const createTestChallenge = (overrides?: Partial<Challenge>): Challenge => ({
    id: 'challenge-1',
    creator_id: 'creator-1',
    creator_username: 'creator',
    title: 'Test Challenge',
    image_url: 'https://example.com/image.jpg',
    tags: ['test'],
    correct_answer: 'pokemon',
    answer_set: {
        correct: ['pokemon', 'pocket monsters'],
        close: ['games', 'nintendo'],
    },
    max_score: 100,
    score_deduction_per_hint: 10,
    reddit_post_id: null,
    players_played: 0,
    players_completed: 0,
    created_at: new Date().toISOString(),
    ...overrides,
});

describe('AttemptService', () => {
    let service: AttemptService;
    let mockContext: Context;
    let mockAttemptRepo: ReturnType<typeof createMockAttemptRepo>;
    let mockUserService: ReturnType<typeof createMockUserService>;
    let mockChallengeRepo: ReturnType<typeof createMockChallengeRepo>;

    beforeEach(() => {
        mockContext = createMockContext();
        mockAttemptRepo = createMockAttemptRepo();
        mockUserService = createMockUserService();
        mockChallengeRepo = createMockChallengeRepo();

        service = new AttemptService(
            mockContext,
            mockAttemptRepo as unknown as AttemptRepository,
            mockUserService as unknown as UserService,
            mockChallengeRepo as unknown as ChallengeRepository
        );
    });

    describe('recordAttempt', () => {
        it('should return Ok(true) if user already attempted', async () => {
            mockAttemptRepo.hasAttempted.mockResolvedValue(ok(true));

            const result = await service.recordAttempt('user-1', 'challenge-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toBe(true);
            }
            expect(mockAttemptRepo.create).not.toHaveBeenCalled();
        });

        it('should create new attempt record for first attempt', async () => {
            mockAttemptRepo.hasAttempted.mockResolvedValue(ok(false));
            mockAttemptRepo.create.mockResolvedValue(ok(createTestAttempt()));
            mockUserService.incrementChallengesAttempted.mockResolvedValue(ok(true));
            mockChallengeRepo.incrementPlayersPlayed.mockResolvedValue(ok(true));

            const result = await service.recordAttempt('user-1', 'challenge-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toBe(true);
            }
            expect(mockAttemptRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 'user-1',
                    challenge_id: 'challenge-1',
                    attempts_made: 0,
                    is_solved: false,
                })
            );
            expect(mockUserService.incrementChallengesAttempted).toHaveBeenCalledWith('user-1');
        });

        it('should return Err if attempt creation fails', async () => {
            mockAttemptRepo.hasAttempted.mockResolvedValue(ok(false));
            mockAttemptRepo.create.mockResolvedValue(err(databaseError('create', 'Failed to create')));

            const result = await service.recordAttempt('user-1', 'challenge-1');

            expect(isOk(result)).toBe(false);
        });
    });

    describe('submitGuess', () => {
        it('should return already completed for solved challenges', async () => {
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(
                ok(createTestAttempt({ is_solved: true, points_earned: 100, attempts_made: 1 }))
            );

            const result = await service.submitGuess('user-1', 'challenge-1', 'guess');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value.isCorrect).toBe(true);
                expect(result.value.gameOver).toBe(true);
                expect(result.value.explanation).toBe('Challenge already completed');
            }
        });

        it('should return game over for exhausted attempts', async () => {
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(
                ok(createTestAttempt({ game_over: true }))
            );

            const result = await service.submitGuess('user-1', 'challenge-1', 'guess');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value.isCorrect).toBe(false);
                expect(result.value.gameOver).toBe(true);
                expect(result.value.attemptsRemaining).toBe(0);
            }
        });

        it('should return correct for matching answer', async () => {
            const testAttempt = createTestAttempt();
            // Mock findByUserAndChallenge to return the same attempt for both submitGuess and recordCompletion calls
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(ok(testAttempt));
            mockChallengeRepo.findById.mockResolvedValue(ok(createTestChallenge()));
            mockAttemptRepo.createGuess.mockResolvedValue(ok({} as any));
            mockAttemptRepo.updateAttempt.mockResolvedValue(ok(true));
            mockUserService.getUserProfile.mockResolvedValue(ok({ challenges_solved: 0, current_streak: 0 } as any));
            mockAttemptRepo.recordCompletionAtomic.mockResolvedValue(ok(true));
            mockUserService.incrementStreak.mockResolvedValue(ok(true));
            mockChallengeRepo.incrementPlayersCompleted.mockResolvedValue(ok(true));
            mockUserService.awardPoints.mockResolvedValue(ok(true));

            const result = await service.submitGuess('user-1', 'challenge-1', 'pokemon');

            if (!isOk(result)) {
                console.error('submitGuess returned error:', result.error);
                if (result.error.type === 'internal' && result.error.cause) {
                    console.error('Error cause:', result.error.cause);
                }
            }
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value.isCorrect).toBe(true);
                expect(result.value.gameOver).toBe(true);
                expect(result.value.reward).toBeDefined();
                expect(result.value.reward?.points).toBeGreaterThan(0);
            }
        });

        it('should decrement attempts remaining for wrong answer', async () => {
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(ok(createTestAttempt()));
            mockChallengeRepo.findById.mockResolvedValue(ok(createTestChallenge()));
            mockAttemptRepo.createGuess.mockResolvedValue(ok({} as any));
            mockAttemptRepo.updateAttempt.mockResolvedValue(ok(true));

            const result = await service.submitGuess('user-1', 'challenge-1', 'wrong answer');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value.isCorrect).toBe(false);
                expect(result.value.gameOver).toBe(false);
                expect(result.value.attemptsRemaining).toBe(9); // 10 - 1
            }
        });

        it('should trigger game over at 10 attempts', async () => {
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(
                ok(createTestAttempt({ attempts_made: 9 }))
            );
            mockChallengeRepo.findById.mockResolvedValue(ok(createTestChallenge()));
            mockAttemptRepo.createGuess.mockResolvedValue(ok({} as any));
            mockAttemptRepo.updateAttempt.mockResolvedValue(ok(true));
            mockUserService.resetStreak.mockResolvedValue(ok(true));

            const result = await service.submitGuess('user-1', 'challenge-1', 'wrong');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value.isCorrect).toBe(false);
                expect(result.value.gameOver).toBe(true);
                expect(result.value.attemptsRemaining).toBe(0);
            }
            expect(mockUserService.resetStreak).toHaveBeenCalledWith('user-1');
        });

        it('should return error for challenge without answer_set', async () => {
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(ok(createTestAttempt()));
            mockChallengeRepo.findById.mockResolvedValue(
                ok(createTestChallenge({ answer_set: undefined }))
            );

            const result = await service.submitGuess('user-1', 'challenge-1', 'guess');

            expect(isOk(result)).toBe(false);
        });

        it('should award creator bonus on correct answer', async () => {
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(ok(createTestAttempt()));
            mockChallengeRepo.findById.mockResolvedValue(
                ok(createTestChallenge({ creator_id: 'different-creator' }))
            );
            mockAttemptRepo.createGuess.mockResolvedValue(ok({} as any));
            mockAttemptRepo.updateAttempt.mockResolvedValue(ok(true));
            mockUserService.getUserProfile.mockResolvedValue(ok({ challenges_solved: 0, current_streak: 0 } as any));
            mockAttemptRepo.recordCompletionAtomic.mockResolvedValue(ok(true));
            mockUserService.incrementStreak.mockResolvedValue(ok(true));
            mockUserService.awardPoints.mockResolvedValue(ok(true));
            mockChallengeRepo.incrementPlayersCompleted.mockResolvedValue(ok(true));

            await service.submitGuess('user-1', 'challenge-1', 'pokemon');

            // Creator bonus awarded to different-creator
            expect(mockUserService.awardPoints).toHaveBeenCalledWith(
                'different-creator',
                expect.any(Number),
                expect.any(Number)
            );
        });
    });

    describe('getUserAttempts', () => {
        it('should return empty array for user with no attempts', async () => {
            mockAttemptRepo.findByUser.mockResolvedValue(ok([]));

            const result = await service.getUserAttempts('user-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toEqual([]);
            }
        });

        it('should return all user attempts', async () => {
            const attempts = [
                createTestAttempt({ challenge_id: 'c1' }),
                createTestAttempt({ challenge_id: 'c2', is_solved: true }),
            ];
            mockAttemptRepo.findByUser.mockResolvedValue(ok(attempts));
            mockAttemptRepo.updateAttempt.mockResolvedValue(ok(true));

            const result = await service.getUserAttempts('user-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toHaveLength(2);
            }
        });

        it('should migrate legacy attempts with attempts_made=0 when solved', async () => {
            const legacyAttempt = createTestAttempt({
                is_solved: true,
                attempts_made: 0
            });
            mockAttemptRepo.findByUser.mockResolvedValue(ok([legacyAttempt]));
            mockAttemptRepo.updateAttempt.mockResolvedValue(ok(true));

            const result = await service.getUserAttempts('user-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value[0].attempts_made).toBe(1);
            }
            expect(mockAttemptRepo.updateAttempt).toHaveBeenCalledWith(
                legacyAttempt.id,
                { attempts_made: 1 }
            );
        });
    });

    describe('hasAttempted', () => {
        it('should return Ok(true) for existing attempt', async () => {
            mockAttemptRepo.hasAttempted.mockResolvedValue(ok(true));

            const result = await service.hasAttempted('user-1', 'challenge-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toBe(true);
            }
        });

        it('should return Ok(false) for non-existing attempt', async () => {
            mockAttemptRepo.hasAttempted.mockResolvedValue(ok(false));

            const result = await service.hasAttempted('user-1', 'challenge-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toBe(false);
            }
        });
    });

    describe('hasSolved', () => {
        it('should return Ok(true) for solved challenge', async () => {
            mockAttemptRepo.hasSolved.mockResolvedValue(ok(true));

            const result = await service.hasSolved('user-1', 'challenge-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toBe(true);
            }
        });
    });

    describe('getCompletionStatus', () => {
        it('should return Ok(null) for non-completed attempt', async () => {
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(
                ok(createTestAttempt({ is_solved: false }))
            );

            const result = await service.getCompletionStatus('user-1', 'challenge-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toBeNull();
            }
        });

        it('should return Ok with attempt for completed challenge', async () => {
            const completedAttempt = createTestAttempt({
                is_solved: true,
                attempts_made: 3,
                points_earned: 80
            });
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(ok(completedAttempt));

            const result = await service.getCompletionStatus('user-1', 'challenge-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toEqual(completedAttempt);
            }
        });
    });

    describe('getAttemptStatus', () => {
        it('should return Ok with attempt for game over', async () => {
            const gameOverAttempt = createTestAttempt({
                is_solved: false,
                game_over: true
            });
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(ok(gameOverAttempt));

            const result = await service.getAttemptStatus('user-1', 'challenge-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toEqual(gameOverAttempt);
            }
        });

        it('should return Ok(null) for in-progress attempt', async () => {
            mockAttemptRepo.findByUserAndChallenge.mockResolvedValue(
                ok(createTestAttempt({ is_solved: false, game_over: false }))
            );

            const result = await service.getAttemptStatus('user-1', 'challenge-1');

            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toBeNull();
            }
        });
    });
});
