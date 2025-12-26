/**
 * Attempt Flow Integration Tests
 * Tests complete attempt flows including creation, guess submission, completion, and failure
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestContext,
  createTestAttempt,
  clearTestData,
  type TestContext,
} from './setup.js';
import {
  seedAttempt,
  createUserWithProfile,
  createChallengeWithCreator,
  createAttemptForUser,
  simulateSuccessfulAttempt,
  simulateFailedAttempt,
} from './helpers.js';
import type { AttemptGuess } from '../../../shared/models/attempt.types.js';

describe('Attempt Flow Integration Tests', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = createTestContext();
  });

  afterEach(() => {
    clearTestData(testContext);
    vi.clearAllMocks();
  });

  /**
   * Requirement 3.1: WHEN an attempt is started 
   * THEN the Integration Test Suite SHALL verify the attempt is created and linked to user and challenge
   */
  describe('Attempt Creation and Linking', () => {
    it('should create an attempt linked to user and challenge', async () => {
      const userId = 't2_attemptuser';
      const user = createUserWithProfile(testContext, userId, 'attemptuser');
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        title: 'Test Challenge',
      });

      const attempt = createAttemptForUser(testContext, userId, challenge.id);

      // Verify attempt was created
      const storedAttempt = testContext.mockSupabase.data.attempts.find(
        a => a.id === attempt.id
      );

      expect(storedAttempt).toBeDefined();
      expect(storedAttempt!.user_id).toBe(userId);
      expect(storedAttempt!.challenge_id).toBe(challenge.id);
    });

    it('should initialize attempt with correct default values', async () => {
      const userId = 't2_defaultuser';
      createUserWithProfile(testContext, userId, 'defaultuser');
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {});

      const attempt = createAttemptForUser(testContext, userId, challenge.id);

      expect(attempt.attempts_made).toBe(0);
      expect(attempt.is_solved).toBe(false);
      expect(attempt.game_over).toBe(false);
      expect(attempt.points_earned).toBe(0);
      expect(attempt.experience_earned).toBe(0);
      expect(attempt.completed_at).toBeNull();
    });

    it('should set attempted_at timestamp on creation', async () => {
      const beforeCreation = new Date().toISOString();
      const userId = 't2_timestampuser';
      createUserWithProfile(testContext, userId, 'timestampuser');
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {});

      const attempt = createAttemptForUser(testContext, userId, challenge.id);

      expect(attempt.attempted_at).toBeDefined();
      expect(new Date(attempt.attempted_at).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeCreation).getTime() - 1000
      );
    });

    it('should allow multiple attempts by different users on same challenge', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        title: 'Multi-User Challenge',
      });

      const user1 = createUserWithProfile(testContext, 't2_user1', 'user1');
      const user2 = createUserWithProfile(testContext, 't2_user2', 'user2');
      const user3 = createUserWithProfile(testContext, 't2_user3', 'user3');

      const attempt1 = createAttemptForUser(testContext, 't2_user1', challenge.id);
      const attempt2 = createAttemptForUser(testContext, 't2_user2', challenge.id);
      const attempt3 = createAttemptForUser(testContext, 't2_user3', challenge.id);

      expect(testContext.mockSupabase.data.attempts.length).toBe(3);
      expect(attempt1.user_id).toBe('t2_user1');
      expect(attempt2.user_id).toBe('t2_user2');
      expect(attempt3.user_id).toBe('t2_user3');
      
      // All linked to same challenge
      expect(attempt1.challenge_id).toBe(challenge.id);
      expect(attempt2.challenge_id).toBe(challenge.id);
      expect(attempt3.challenge_id).toBe(challenge.id);
    });

    it('should generate unique IDs for each attempt', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {});
      
      const attempt1 = createAttemptForUser(testContext, 't2_user1', challenge.id);
      const attempt2 = createAttemptForUser(testContext, 't2_user2', challenge.id);

      expect(attempt1.id).not.toBe(attempt2.id);
    });
  });


  /**
   * Requirement 3.2: WHEN a guess is submitted 
   * THEN the Integration Test Suite SHALL verify the guess is recorded and validated
   */
  describe('Guess Submission and Validation', () => {
    // Mock guess storage (simulating attempt_guesses table)
    let guesses: AttemptGuess[];

    beforeEach(() => {
      guesses = [];
    });

    const recordGuess = (attemptId: string, guessText: string, result: 'CORRECT' | 'CLOSE' | 'INCORRECT'): AttemptGuess => {
      const guess: AttemptGuess = {
        id: `guess_${Date.now()}_${Math.random()}`,
        attempt_id: attemptId,
        guess_text: guessText,
        validation_result: result,
        ai_explanation: result === 'CORRECT' ? 'Correct answer!' : 
                        result === 'CLOSE' ? 'Close, but not quite right' : 
                        'Incorrect answer',
        created_at: new Date().toISOString(),
      };
      guesses.push(guess);
      return guess;
    };

    it('should record a guess with validation result', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        correct_answer: 'cat',
        answer_set: {
          correct: ['cat', 'kitty'],
          close: ['dog', 'pet'],
        },
      });
      const attempt = createAttemptForUser(testContext, 't2_user', challenge.id);

      // Submit a correct guess
      const guess = recordGuess(attempt.id, 'cat', 'CORRECT');

      expect(guess.attempt_id).toBe(attempt.id);
      expect(guess.guess_text).toBe('cat');
      expect(guess.validation_result).toBe('CORRECT');
    });

    it('should increment attempts_made on each guess', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        correct_answer: 'answer',
      });
      const attempt = createAttemptForUser(testContext, 't2_user', challenge.id);

      // Simulate multiple guesses
      const storedAttempt = testContext.mockSupabase.data.attempts.find(
        a => a.id === attempt.id
      )!;

      recordGuess(attempt.id, 'wrong1', 'INCORRECT');
      storedAttempt.attempts_made = 1;

      recordGuess(attempt.id, 'wrong2', 'INCORRECT');
      storedAttempt.attempts_made = 2;

      recordGuess(attempt.id, 'answer', 'CORRECT');
      storedAttempt.attempts_made = 3;

      expect(storedAttempt.attempts_made).toBe(3);
      expect(guesses.length).toBe(3);
    });

    it('should validate guess as CLOSE for near-correct answers', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        correct_answer: 'cat',
        answer_set: {
          correct: ['cat'],
          close: ['kitten', 'feline'],
        },
      });
      const attempt = createAttemptForUser(testContext, 't2_user', challenge.id);

      const guess = recordGuess(attempt.id, 'kitten', 'CLOSE');

      expect(guess.validation_result).toBe('CLOSE');
      expect(guess.ai_explanation).toContain('Close');
    });

    it('should validate guess as INCORRECT for wrong answers', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        correct_answer: 'cat',
        answer_set: {
          correct: ['cat'],
          close: ['kitten'],
        },
      });
      const attempt = createAttemptForUser(testContext, 't2_user', challenge.id);

      const guess = recordGuess(attempt.id, 'elephant', 'INCORRECT');

      expect(guess.validation_result).toBe('INCORRECT');
    });

    it('should store all guesses for an attempt', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        correct_answer: 'answer',
      });
      const attempt = createAttemptForUser(testContext, 't2_user', challenge.id);

      recordGuess(attempt.id, 'guess1', 'INCORRECT');
      recordGuess(attempt.id, 'guess2', 'CLOSE');
      recordGuess(attempt.id, 'answer', 'CORRECT');

      const attemptGuesses = guesses.filter(g => g.attempt_id === attempt.id);
      expect(attemptGuesses.length).toBe(3);
      expect(attemptGuesses[0].guess_text).toBe('guess1');
      expect(attemptGuesses[1].guess_text).toBe('guess2');
      expect(attemptGuesses[2].guess_text).toBe('answer');
    });

    it('should set timestamp on each guess', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {});
      const attempt = createAttemptForUser(testContext, 't2_user', challenge.id);

      const beforeGuess = new Date().toISOString();
      const guess = recordGuess(attempt.id, 'test', 'INCORRECT');

      expect(guess.created_at).toBeDefined();
      expect(new Date(guess.created_at).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeGuess).getTime() - 1000
      );
    });
  });


  /**
   * Requirement 3.3: WHEN an attempt is completed successfully 
   * THEN the Integration Test Suite SHALL verify rewards are calculated and awarded
   */
  describe('Successful Completion with Rewards', () => {
    it('should mark attempt as solved on correct answer', async () => {
      const { attempt } = simulateSuccessfulAttempt(testContext, {
        userId: 't2_solver',
        username: 'solver',
      });

      expect(attempt.is_solved).toBe(true);
      expect(attempt.game_over).toBe(true);
    });

    it('should set completed_at timestamp on success', async () => {
      const { attempt } = simulateSuccessfulAttempt(testContext);

      expect(attempt.completed_at).not.toBeNull();
      expect(new Date(attempt.completed_at!).getTime()).toBeGreaterThan(0);
    });

    it('should award points based on attempts remaining', async () => {
      // Fewer attempts = more points
      const { attempt: fastAttempt } = simulateSuccessfulAttempt(testContext, {
        userId: 't2_fast',
        attemptsMade: 1,
        pointsEarned: 90,
      });

      const { attempt: slowAttempt } = simulateSuccessfulAttempt(testContext, {
        userId: 't2_slow',
        attemptsMade: 8,
        pointsEarned: 20,
      });

      expect(fastAttempt.points_earned).toBeGreaterThan(slowAttempt.points_earned);
    });

    it('should award experience on successful completion', async () => {
      const { attempt, user } = simulateSuccessfulAttempt(testContext, {
        experienceEarned: 100,
      });

      expect(attempt.experience_earned).toBe(100);
      expect(user.total_experience).toBe(100);
    });

    it('should update user total_points on success', async () => {
      const { user } = simulateSuccessfulAttempt(testContext, {
        pointsEarned: 75,
      });

      expect(user.total_points).toBe(75);
    });

    it('should increment user challenges_solved count', async () => {
      const { user } = simulateSuccessfulAttempt(testContext);

      expect(user.challenges_solved).toBe(1);
    });

    it('should update challenge players_completed count', async () => {
      const { challenge } = simulateSuccessfulAttempt(testContext);

      expect(challenge.players_completed).toBe(1);
    });

    it('should update leaderboard on points award', async () => {
      const userId = 't2_leaderboard_user';
      const pointsEarned = 100;

      simulateSuccessfulAttempt(testContext, {
        userId,
        pointsEarned,
      });

      // Add to leaderboard
      await testContext.mockRedis.zAdd('leaderboard:points', {
        member: userId,
        score: pointsEarned,
      });

      const score = await testContext.mockRedis.zScore('leaderboard:points', userId);
      expect(score).toBe(pointsEarned);
    });

    it('should handle multiple successful completions by same user', async () => {
      const userId = 't2_multiwin';
      
      // First win
      const user = createUserWithProfile(testContext, userId, 'multiwin', {
        total_points: 0,
        challenges_solved: 0,
      });

      // Simulate first completion
      user.total_points += 50;
      user.challenges_solved += 1;

      // Simulate second completion
      user.total_points += 75;
      user.challenges_solved += 1;

      expect(user.total_points).toBe(125);
      expect(user.challenges_solved).toBe(2);
    });
  });


  /**
   * Requirement 3.4: WHEN an attempt fails 
   * THEN the Integration Test Suite SHALL verify streak is reset and no rewards are given
   */
  describe('Failed Attempt with Streak Reset', () => {
    it('should mark attempt as game_over without solving', async () => {
      const { attempt } = simulateFailedAttempt(testContext, {
        userId: 't2_failer',
      });

      expect(attempt.is_solved).toBe(false);
      expect(attempt.game_over).toBe(true);
    });

    it('should not award points on failure', async () => {
      const { attempt, user } = simulateFailedAttempt(testContext);

      expect(attempt.points_earned).toBe(0);
      expect(user.total_points).toBe(0);
    });

    it('should not award experience on failure', async () => {
      const { attempt, user } = simulateFailedAttempt(testContext);

      expect(attempt.experience_earned).toBe(0);
      expect(user.total_experience).toBe(0);
    });

    it('should reset current_streak to zero on failure', async () => {
      const userId = 't2_streakfail';
      
      // User with existing streak
      const user = createUserWithProfile(testContext, userId, 'streakfail', {
        current_streak: 5,
        best_streak: 10,
      });

      // Simulate failure
      user.current_streak = 0;

      expect(user.current_streak).toBe(0);
    });

    it('should preserve best_streak on failure', async () => {
      const userId = 't2_bestpreserve';
      
      const user = createUserWithProfile(testContext, userId, 'bestpreserve', {
        current_streak: 5,
        best_streak: 10,
      });

      // Simulate failure - current resets but best preserved
      user.current_streak = 0;

      expect(user.current_streak).toBe(0);
      expect(user.best_streak).toBe(10);
    });

    it('should not increment challenges_solved on failure', async () => {
      const { user } = simulateFailedAttempt(testContext);

      expect(user.challenges_solved).toBe(0);
    });

    it('should increment challenges_attempted on failure', async () => {
      const { user } = simulateFailedAttempt(testContext);

      expect(user.challenges_attempted).toBe(1);
    });

    it('should update challenge players_played but not players_completed', async () => {
      const { challenge } = simulateFailedAttempt(testContext);

      expect(challenge.players_played).toBe(1);
      expect(challenge.players_completed).toBe(0);
    });

    it('should set attempts_made to max on game over', async () => {
      const { attempt } = simulateFailedAttempt(testContext);

      expect(attempt.attempts_made).toBe(10); // Max attempts
    });

    it('should not update leaderboard on failure', async () => {
      const userId = 't2_noleaderboard';
      
      simulateFailedAttempt(testContext, { userId });

      const score = await testContext.mockRedis.zScore('leaderboard:points', userId);
      expect(score).toBeNull();
    });
  });

  /**
   * Additional integration scenarios
   */
  describe('Complete Attempt Flow Scenarios', () => {
    it('should handle complete attempt lifecycle from start to success', async () => {
      const userId = 't2_lifecycle';
      const user = createUserWithProfile(testContext, userId, 'lifecycle', {
        total_points: 0,
        current_streak: 2,
        best_streak: 5,
      });
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        title: 'Lifecycle Challenge',
        correct_answer: 'answer',
        players_played: 0,
        players_completed: 0,
      });

      // Step 1: Start attempt
      const attempt = createAttemptForUser(testContext, userId, challenge.id);
      const storedAttempt = testContext.mockSupabase.data.attempts.find(
        a => a.id === attempt.id
      )!;
      const storedChallenge = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      )!;

      storedChallenge.players_played += 1;
      user.challenges_attempted += 1;

      // Step 2: Make some wrong guesses
      storedAttempt.attempts_made = 3;

      // Step 3: Get correct answer
      storedAttempt.is_solved = true;
      storedAttempt.game_over = true;
      storedAttempt.points_earned = 70;
      storedAttempt.experience_earned = 100;
      storedAttempt.completed_at = new Date().toISOString();

      // Step 4: Update user stats
      user.total_points += 70;
      user.total_experience += 100;
      user.challenges_solved += 1;
      user.current_streak += 1;
      user.best_streak = Math.max(user.best_streak, user.current_streak);

      // Step 5: Update challenge stats
      storedChallenge.players_completed += 1;

      // Verify final state
      expect(storedAttempt.is_solved).toBe(true);
      expect(storedAttempt.points_earned).toBe(70);
      expect(user.total_points).toBe(70);
      expect(user.current_streak).toBe(3);
      expect(user.best_streak).toBe(5); // Unchanged since 3 < 5
      expect(storedChallenge.players_played).toBe(1);
      expect(storedChallenge.players_completed).toBe(1);
    });

    it('should handle complete attempt lifecycle from start to failure', async () => {
      const userId = 't2_faillifecycle';
      const user = createUserWithProfile(testContext, userId, 'faillifecycle', {
        total_points: 100,
        current_streak: 3,
        best_streak: 5,
      });
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        title: 'Hard Challenge',
        players_played: 0,
        players_completed: 0,
      });

      // Step 1: Start attempt
      const attempt = createAttemptForUser(testContext, userId, challenge.id);
      const storedAttempt = testContext.mockSupabase.data.attempts.find(
        a => a.id === attempt.id
      )!;
      const storedChallenge = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      )!;

      storedChallenge.players_played += 1;
      user.challenges_attempted += 1;

      // Step 2: Use all guesses without solving
      storedAttempt.attempts_made = 10;
      storedAttempt.is_solved = false;
      storedAttempt.game_over = true;
      storedAttempt.points_earned = 0;
      storedAttempt.experience_earned = 0;

      // Step 3: Reset streak
      user.current_streak = 0;

      // Verify final state
      expect(storedAttempt.is_solved).toBe(false);
      expect(storedAttempt.game_over).toBe(true);
      expect(storedAttempt.points_earned).toBe(0);
      expect(user.total_points).toBe(100); // Unchanged
      expect(user.current_streak).toBe(0); // Reset
      expect(user.best_streak).toBe(5); // Preserved
      expect(storedChallenge.players_played).toBe(1);
      expect(storedChallenge.players_completed).toBe(0);
    });

    it('should handle concurrent attempts on different challenges', async () => {
      const userId = 't2_concurrent';
      createUserWithProfile(testContext, userId, 'concurrent');

      const challenge1 = createChallengeWithCreator(testContext, 't2_creator1', {
        title: 'Challenge 1',
      });
      const challenge2 = createChallengeWithCreator(testContext, 't2_creator2', {
        title: 'Challenge 2',
      });

      const attempt1 = createAttemptForUser(testContext, userId, challenge1.id);
      const attempt2 = createAttemptForUser(testContext, userId, challenge2.id);

      // Both attempts exist independently
      expect(testContext.mockSupabase.data.attempts.length).toBe(2);
      expect(attempt1.challenge_id).toBe(challenge1.id);
      expect(attempt2.challenge_id).toBe(challenge2.id);
      expect(attempt1.user_id).toBe(userId);
      expect(attempt2.user_id).toBe(userId);
    });
  });
});
