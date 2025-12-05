/**
 * Attempt Service
 * Handles all business logic related to challenge attempts, guesses, and completions
 */

import type { Context } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { AttemptRepository } from '../repositories/attempt.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from './user.service.js';
import { LocalValidationService } from './local-validation.service.js';
import { calculateAttemptRewardWithBonuses, calculatePotentialScore, getCreatorBonus } from '../../shared/utils/reward-calculator.js';
import type { ChallengeAttempt, ChallengeAttemptCreate, AttemptResult } from '../../shared/models/attempt.types.js';
import type { Bonus } from '../../shared/models/common.types.js';

export class AttemptService extends BaseService {
  private localValidationService: LocalValidationService;

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
    // Initialize local validation service (no AI calls needed)
    this.localValidationService = new LocalValidationService(context);
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
          hints_used: [],
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
   * Validates the answer using pre-generated answer sets (local, instant)
   * Tracks attempts, enforces 10-attempt limit
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

      // Get challenge with answer_set
      const challenge = await this.challengeRepo!.findById(challengeId);
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      // Ensure challenge has answer_set
      if (!challenge.answer_set) {
        this.logError(
          'AttemptService.submitGuess',
          `Challenge ${challengeId} missing answer_set - challenge may need to be regenerated`
        );
        throw new Error('Challenge missing answer set');
      }

      // Validate answer using LOCAL answer set matching (instant, no AI call)
      const validation = this.localValidationService.validateGuess(guess, challenge);

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
        // Get user profile for bonus context
        const userProfile = await this.userService.getUserProfile(userId);
        const isFirstClear = userProfile ? userProfile.challenges_solved === 0 : false;
        const currentStreak = userProfile?.current_streak || 0;

        // Calculate reward with bonuses
        const rewardWithBonuses = calculateAttemptRewardWithBonuses(
          newAttemptCount,
          true,
          {
            isFirstClear,
            currentStreak,
            attemptsMade: newAttemptCount,
          },
          attempt.hints_used ? attempt.hints_used.length : 0,
          challenge.image_url.split(',').length
        );

        // Record completion with total points (base + bonuses)
        await this.recordCompletion(
          userId,
          challengeId,
          newAttemptCount,
          rewardWithBonuses.totalPoints,
          rewardWithBonuses.totalExp
        );

        // Increment user's streak
        await this.userService.incrementStreak(userId);

        // Award creator bonus if solver is not the creator
        if (challenge.creator_id && challenge.creator_id !== userId) {
          const creatorBonus = getCreatorBonus();
          await this.userService.awardPoints(
            challenge.creator_id,
            creatorBonus.points,
            creatorBonus.exp
          );
          this.logInfo(
            'AttemptService',
            `Awarded creator bonus to ${challenge.creator_id} for challenge ${challengeId}`
          );
        }

        return {
          isCorrect: true,
          explanation: validation.explanation,
          attemptsRemaining: 0,
          potentialScore: 0,
          gameOver: true,
          reward: {
            points: rewardWithBonuses.points,
            experience: rewardWithBonuses.exp,
            bonuses: rewardWithBonuses.bonuses,
            totalPoints: rewardWithBonuses.totalPoints,
            totalExp: rewardWithBonuses.totalExp,
          },
        };
      }

      // Check if game over (10 attempts exhausted)
      if (newAttemptCount >= 10) {
        await this.attemptRepo.updateAttempt(attempt.id, {
          game_over: true,
        });

        // Reset user's streak on game over
        await this.userService.resetStreak(userId);

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
      const potentialScore = calculatePotentialScore(
        newAttemptCount,
        attempt.hints_used ? attempt.hints_used.length : 0,
        challenge.image_url.split(',').length
      );

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

        // Increment challenge's players_completed count
        if (this.challengeRepo) {
          await this.challengeRepo.incrementPlayersCompleted(challengeId);
        }

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
   * Reveal a hint for a specific image index
   * Deducts points from user's total_points
   * Returns detailed result with success/error information
   */
  async revealHint(
    userId: string,
    challengeId: string,
    imageIndex: number,
    hintCost: number
  ): Promise<{ success: boolean; attempt?: ChallengeAttempt; error?: string; newTotalPoints?: number }> {
    try {
      // First, get user's current points
      const userProfile = await this.userService.getUserProfile(userId);

      if (!userProfile) {
        return { success: false, error: 'User not found' };
      }

      // Check if user has enough points
      if (userProfile.total_points < hintCost) {
        return {
          success: false,
          error: `Not enough points. You have ${userProfile.total_points} points but need ${hintCost}.`
        };
      }

      let attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

      // If no attempt exists, create one
      if (!attempt) {
        const createSuccess = await this.recordAttempt(userId, challengeId);

        if (createSuccess) {
          attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);
        }
      }

      if (!attempt) {
        return { success: false, error: 'Failed to create attempt' };
      }

      // Initialize hints_used if null
      const hintsUsed = attempt.hints_used || [];

      // If already revealed, return current attempt (no point deduction)
      if (hintsUsed.includes(imageIndex)) {
        return {
          success: true,
          attempt,
          newTotalPoints: userProfile.total_points
        };
      }

      // Deduct points from user's total
      const deductSuccess = await this.userService.deductPoints(userId, hintCost);

      if (!deductSuccess) {
        return { success: false, error: 'Failed to deduct points' };
      }

      // Add index to hints_used
      const newHintsUsed = [...hintsUsed, imageIndex];

      // Update attempt
      const updateSuccess = await this.attemptRepo.updateAttempt(attempt.id, {
        hints_used: newHintsUsed
      });

      if (updateSuccess) {
        const newTotalPoints = userProfile.total_points - hintCost;
        this.logInfo(
          'AttemptService',
          `User ${userId} revealed hint ${imageIndex} for challenge ${challengeId}, spent ${hintCost} points. New balance: ${newTotalPoints}`
        );
        return {
          success: true,
          attempt: { ...attempt, hints_used: newHintsUsed },
          newTotalPoints
        };
      }

      return { success: false, error: 'Failed to update attempt' };
    } catch (error) {
      this.logError('AttemptService.revealHint', error);
      return { success: false, error: 'Failed to reveal hint' };
    }
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
