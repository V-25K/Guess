/**
 * Attempt Service
 * Handles all business logic related to challenge attempts, guesses, and completions
 */

import type { Context } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { AttemptRepository } from '../repositories/attempt.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from './user.service.js';
import { AIValidationService } from './ai-validation.service.js';
import { calculateAttemptReward, calculatePotentialScore } from '../../shared/utils/reward-calculator.js';
import type { ChallengeAttempt, ChallengeAttemptCreate, AttemptResult } from '../../shared/models/attempt.types.js';

export class AttemptService extends BaseService {
  private aiValidationService: AIValidationService;

  constructor(
    context: Context,
    private attemptRepo: AttemptRepository,
    private userService: UserService,
    private challengeRepo?: ChallengeRepository
  ) {
    super(context);
    // Initialize challengeRepo if not provided
    if (!this.challengeRepo) {
      this.challengeRepo = new ChallengeRepository(context);
    }
    // Initialize AI validation service
    this.aiValidationService = new AIValidationService(context);
  }

  /**
   * Record a new challenge attempt
   * This is called when a user first views/starts a challenge
   */
  async recordAttempt(userId: string, challengeId: string): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        // Check if user has already attempted this challenge
        const existingAttempt = await this.attemptRepo.hasAttempted(userId, challengeId);

        if (existingAttempt) {
          this.logInfo('AttemptService', `User ${userId} has already attempted challenge ${challengeId}`);
          return true; // Already recorded, return success
        }

        // Create new attempt record
        const attemptData: ChallengeAttemptCreate = {
          user_id: userId,
          challenge_id: challengeId,
          attempts_made: 0, // No attempts made yet
          images_revealed: 1, // First image is revealed by default (deprecated)
          is_solved: false,
          game_over: false,
          points_earned: 0,
          experience_earned: 0,
          completed_at: null,
        };

        const attempt = await this.attemptRepo.create(attemptData);

        if (!attempt) {
          this.logError('AttemptService.recordAttempt', 'Failed to create attempt record');
          return false;
        }

        // Increment user's challenges attempted count
        await this.userService.incrementChallengesAttempted(userId);

        // Increment challenge's unique player count
        if (this.challengeRepo) {
          await this.challengeRepo.incrementPlayersPlayed(challengeId);
        }

        this.logInfo('AttemptService', `Recorded attempt for user ${userId} on challenge ${challengeId}`);

        return true;
      },
      'Failed to record attempt'
    );
  }

  /**
   * Submit a guess for a challenge
   * Validates the answer via AI, tracks attempts, enforces 10-attempt limit
   */
  async submitGuess(
    userId: string,
    challengeId: string,
    guess: string
  ): Promise<AttemptResult> {
    try {
      // Get or create attempt record
      let attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

      if (!attempt) {
        await this.recordAttempt(userId, challengeId);
        attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);
        if (!attempt) {
          return {
            isCorrect: false,
            explanation: 'Failed to record attempt',
            attemptsRemaining: 0,
            potentialScore: 0,
            gameOver: true,
          };
        }
      }

      // Backward compatibility: Migrate old attempts that were solved but have attempts_made = 0
      if (attempt.is_solved && attempt.attempts_made === 0) {
        this.logInfo(
          'AttemptService.submitGuess',
          `Migrating legacy attempt: user=${userId}, challenge=${challengeId}, setting attempts_made=1`
        );

        // Update the attempt to have attempts_made = 1 (assume solved on first attempt)
        await this.attemptRepo.updateAttempt(attempt.id, {
          attempts_made: 1,
        });

        // Update local copy
        attempt.attempts_made = 1;
      }

      // Check if already solved or game over
      if (attempt.is_solved) {
        return {
          isCorrect: true,
          explanation: 'Challenge already completed',
          attemptsRemaining: 0,
          potentialScore: 0,
          gameOver: true,
          reward: {
            points: attempt.points_earned,
            experience: attempt.experience_earned,
          },
        };
      }

      if (attempt.game_over) {
        return {
          isCorrect: false,
          explanation: 'Game over - no attempts remaining',
          attemptsRemaining: 0,
          potentialScore: 0,
          gameOver: true,
        };
      }

      // Increment attempts
      const newAttemptCount = attempt.attempts_made + 1;

      // Validate answer with AI
      const challenge = await this.challengeRepo!.findById(challengeId);
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      // For attempt 7 only, fetch past guesses to help the AI generate a hint.
      // For other attempts, we keep the prompt minimal for lower token usage.
      let pastGuesses: string[] = [];
      if (newAttemptCount === 7) {
        const guesses = await this.attemptRepo.getGuessesByAttempt(attempt.id);
        pastGuesses = guesses.map((g) => g.guess_text);
      }

      const validation = await this.aiValidationService.validateAnswer(
        guess,
        challenge,
        newAttemptCount,
        pastGuesses
      );

      // Store guess in history
      await this.attemptRepo.createGuess({
        attempt_id: attempt.id,
        guess_text: guess,
        validation_result: validation.judgment || 'INCORRECT',
        ai_explanation: validation.explanation,
      });

      // Update attempt count
      await this.attemptRepo.updateAttempt(attempt.id, {
        attempts_made: newAttemptCount,
      });

      if (validation.isCorrect) {
        // Calculate reward based on attempts
        const reward = calculateAttemptReward(newAttemptCount, true);

        // Record completion
        await this.recordCompletion(
          userId,
          challengeId,
          newAttemptCount,
          reward.points,
          reward.exp
        );

        return {
          isCorrect: true,
          explanation: validation.explanation,
          attemptsRemaining: 0,
          potentialScore: 0,
          gameOver: true,
          reward: {
            points: reward.points,
            experience: reward.exp,
          },
        };
      }

      // Check if game over (10 attempts exhausted)
      if (newAttemptCount >= 10) {
        await this.attemptRepo.updateAttempt(attempt.id, {
          game_over: true,
        });

        return {
          isCorrect: false,
          explanation: validation.explanation + ' Game over - no attempts remaining.',
          attemptsRemaining: 0,
          potentialScore: 0,
          gameOver: true,
        };
      }

      // Incorrect but still has attempts
      const attemptsRemaining = 10 - newAttemptCount;
      const potentialScore = calculatePotentialScore(newAttemptCount);

      return {
        isCorrect: false,
        explanation: validation.explanation,
        attemptsRemaining,
        potentialScore,
        gameOver: false,
      };
    } catch (error) {
      this.logError('AttemptService.submitGuess', error);
      return {
        isCorrect: false,
        explanation: 'An error occurred while processing your guess',
        attemptsRemaining: 0,
        potentialScore: 0,
        gameOver: true,
      };
    }
  }

  /**
   * Record a successful challenge completion
   * Awards points and experience, updates statistics
   * Uses atomic database function to ensure data consistency
   */
  async recordCompletion(
    userId: string,
    challengeId: string,
    attemptsMade: number,
    points: number,
    experience: number
  ): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        // Get the attempt record with retry
        const attempt = await this.withRetry(
          () => this.attemptRepo.findByUserAndChallenge(userId, challengeId),
          {
            maxRetries: 3,
            exponentialBackoff: true,
          }
        );

        if (!attempt) {
          this.logError('AttemptService.recordCompletion', 'Attempt record not found');
          return false;
        }

        // Use atomic database function to update attempt and user profile
        // This ensures both operations succeed or both fail (transaction)
        const success = await this.withRetry(
          () => this.attemptRepo.recordCompletionAtomic(
            attempt.id,
            userId,
            attemptsMade,
            points,
            experience
          ),
          {
            maxRetries: 3,
            exponentialBackoff: true,
            onRetry: (attemptNum, error) => {
              this.logWarning(
                'AttemptService.recordCompletion',
                `Atomic completion retry ${attemptNum}: ${error.message}`
              );
            },
          }
        );

        if (!success) {
          this.logError('AttemptService.recordCompletion', 'Failed to record completion after retries');
          return false;
        }

        // Invalidate user cache since profile was updated
        this.userService.invalidateUserCache(userId);

        this.logInfo(
          'AttemptService',
          `User ${userId} completed challenge ${challengeId} with ${attemptsMade} attempts. Earned ${points} points and ${experience} exp.`
        );

        return true;
      },
      'Failed to record completion'
    );
  }

  /**
   * Get all attempts by a user
   */
  async getUserAttempts(userId: string): Promise<ChallengeAttempt[]> {
    const result = await this.withErrorHandling(
      async () => {
        const attempts = await this.attemptRepo.findByUser(userId);

        // Backward compatibility: Migrate old attempts that were solved but have attempts_made = 0
        const migratedAttempts = await Promise.all(
          attempts.map(async (attempt) => {
            if (attempt.is_solved && attempt.attempts_made === 0) {
              this.logInfo(
                'AttemptService.getUserAttempts',
                `Migrating legacy attempt: user=${userId}, challenge=${attempt.challenge_id}, setting attempts_made=1`
              );

              // Update the attempt to have attempts_made = 1 (assume solved on first attempt)
              await this.attemptRepo.updateAttempt(attempt.id, {
                attempts_made: 1,
              });

              // Return updated attempt
              return { ...attempt, attempts_made: 1 };
            }
            return attempt;
          })
        );

        return migratedAttempts;
      },
      'Failed to get user attempts'
    );
    return result || [];
  }

  /**
   * Get all attempts for a specific challenge
   */
  async getChallengeAttempts(challengeId: string): Promise<ChallengeAttempt[]> {
    const result = await this.withErrorHandling(
      async () => {
        return this.attemptRepo.findByChallenge(challengeId);
      },
      'Failed to get challenge attempts'
    );
    return result || [];
  }

  /**
   * Check if a user has attempted a challenge
   */
  async hasAttempted(userId: string, challengeId: string): Promise<boolean> {
    try {
      return await this.attemptRepo.hasAttempted(userId, challengeId);
    } catch (error) {
      this.logError('AttemptService.hasAttempted', error);
      return false;
    }
  }

  /**
   * Check if a user has solved a challenge
   */
  async hasSolved(userId: string, challengeId: string): Promise<boolean> {
    try {
      return await this.attemptRepo.hasSolved(userId, challengeId);
    } catch (error) {
      this.logError('AttemptService.hasSolved', error);
      return false;
    }
  }

  /**
   * Get completion status for a challenge
   * Returns attempt details if completed, null otherwise
   */
  async getCompletionStatus(userId: string, challengeId: string): Promise<ChallengeAttempt | null> {
    return this.withErrorHandling(
      async () => {
        const attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        // Return attempt only if it's completed
        if (attempt && attempt.is_solved) {
          // Backward compatibility: Migrate old attempts that were solved but have attempts_made = 0
          if (attempt.attempts_made === 0) {
            this.logInfo(
              'AttemptService.getCompletionStatus',
              `Migrating legacy attempt: user=${userId}, challenge=${challengeId}, setting attempts_made=1`
            );

            // Update the attempt to have attempts_made = 1 (assume solved on first attempt)
            await this.attemptRepo.updateAttempt(attempt.id, {
              attempts_made: 1,
            });

            // Update local copy
            attempt.attempts_made = 1;
          }

          return attempt;
        }

        return null;
      },
      'Failed to get completion status'
    );
  }

  /**
   * Get attempt status for a challenge (completed or game over)
   * Returns attempt details if completed OR game over, null if still in progress
   */
  async getAttemptStatus(userId: string, challengeId: string): Promise<ChallengeAttempt | null> {
    return this.withErrorHandling(
      async () => {
        const attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        // Return attempt if it's completed OR game over
        if (attempt && (attempt.is_solved || attempt.game_over)) {
          // Backward compatibility: Migrate old attempts that were solved but have attempts_made = 0
          if (attempt.is_solved && attempt.attempts_made === 0) {
            this.logInfo(
              'AttemptService.getAttemptStatus',
              `Migrating legacy attempt: user=${userId}, challenge=${challengeId}, setting attempts_made=1`
            );

            // Update the attempt to have attempts_made = 1 (assume solved on first attempt)
            await this.attemptRepo.updateAttempt(attempt.id, {
              attempts_made: 1,
            });

            // Update local copy
            attempt.attempts_made = 1;
          }

          return attempt;
        }

        return null;
      },
      'Failed to get attempt status'
    );
  }

  /**
   * Get the current attempt for a user and challenge, regardless of status.
   */
  async getAttempt(userId: string, challengeId: string): Promise<ChallengeAttempt | null> {
    return this.withErrorHandling(
      async () => {
        const attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        if (attempt) {
          // Backward compatibility: Migrate old attempts that were solved but have attempts_made = 0
          if (attempt.is_solved && attempt.attempts_made === 0) {
            this.logInfo(
              'AttemptService.getAttempt',
              `Migrating legacy attempt: user=${userId}, challenge=${challengeId}, setting attempts_made=1`
            );

            // Update the attempt to have attempts_made = 1 (assume solved on first attempt)
            await this.attemptRepo.updateAttempt(attempt.id, {
              attempts_made: 1,
            });

            // Update local copy
            attempt.attempts_made = 1;
          }
        }

        return attempt;
      },
      'Failed to get attempt'
    );
  }

  /**
   * Update images revealed count for an attempt
   * Called when user reveals a new hint
   * Creates attempt record if it doesn't exist
   */
  async updateImagesRevealed(userId: string, challengeId: string, imagesRevealed: number): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        let attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        // Create attempt if it doesn't exist
        if (!attempt) {
          attempt = await this.attemptRepo.create({
            user_id: userId,
            challenge_id: challengeId,
            attempts_made: 0,
            is_solved: false,
            game_over: false,
            images_revealed: imagesRevealed,
            points_earned: 0,
            experience_earned: 0,
            completed_at: null,
          });

          if (!attempt) {
            this.logError('AttemptService.updateImagesRevealed', 'Failed to create attempt record');
            return false;
          }

          return true;
        }

        // Update existing attempt
        return this.attemptRepo.updateAttempt(attempt.id, {
          images_revealed: imagesRevealed,
        });
      },
      'Failed to update images revealed'
    );
  }
}
