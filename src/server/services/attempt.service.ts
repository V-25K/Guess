/**
 * Attempt Service
 * Handles all business logic related to challenge attempts, guesses, and completions
 */

import type { Context } from '@devvit/server/server-context';
import { BaseService } from './base.service.js';
import { AttemptRepository } from '../repositories/attempt.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from './user.service.js';
import { LocalValidationService } from './local-validation.service.js';
import { calculateAttemptRewardWithBonuses, calculatePotentialScore, getCreatorBonus } from '../../shared/utils/reward-calculator.js';
import type { ChallengeAttempt, ChallengeAttemptCreate, AttemptResult } from '../../shared/models/attempt.types.js';
import type { Result } from '../../shared/utils/result.js';
import { err, isOk } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { databaseError, internalError } from '../../shared/models/errors.js';
import { tryCatch } from '../../shared/utils/result-adapters.js';

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
  async recordAttempt(userId: string, challengeId: string): Promise<Result<boolean, AppError>> {
    return tryCatch(
      async () => {
        // Check if user has already attempted this challenge
        const existingAttemptResult = await this.attemptRepo.hasAttempted(userId, challengeId);

        if (!isOk(existingAttemptResult)) {
          throw new Error(`Failed to check existing attempt: ${JSON.stringify(existingAttemptResult.error)}`);
        }

        if (existingAttemptResult.value) {
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

        const attemptResult = await this.attemptRepo.create(attemptData);

        if (!isOk(attemptResult)) {
          throw new Error(`Failed to create attempt record: ${JSON.stringify(attemptResult.error)}`);
        }

        // Increment user's challenges attempted count
        const incrementResult = await this.userService.incrementChallengesAttempted(userId);
        if (!isOk(incrementResult)) {
          this.logError('AttemptService.recordAttempt', incrementResult.error);
        }

        // Increment challenge's unique player count
        if (this.challengeRepo) {
          const playersResult = await this.challengeRepo.incrementPlayersPlayed(challengeId);
          if (!isOk(playersResult)) {
            this.logError('AttemptService.recordAttempt', playersResult.error);
          }
        }

        this.logInfo('AttemptService', `Recorded attempt for user ${userId} on challenge ${challengeId}`);

        return true;
      },
      (error) => databaseError('recordAttempt', String(error))
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
  ): Promise<Result<AttemptResult, AppError>> {
    return tryCatch(
      async () => {
        // Get or create attempt record
        let attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        if (!isOk(attemptResult)) {
          throw new Error(`Failed to find attempt: ${JSON.stringify(attemptResult.error)}`);
        }

        let attempt = attemptResult.value;

        if (!attempt) {
          const recordResult = await this.recordAttempt(userId, challengeId);
          if (!isOk(recordResult)) {
            throw new Error(`Failed to record attempt: ${JSON.stringify(recordResult.error)}`);
          }

          attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);
          if (!isOk(attemptResult)) {
            throw new Error(`Failed to find attempt after creation: ${JSON.stringify(attemptResult.error)}`);
          }

          attempt = attemptResult.value;
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
          const updateResult = await this.attemptRepo.updateAttempt(attempt.id, {
            attempts_made: 1,
          });

          if (!isOk(updateResult)) {
            this.logError('AttemptService.submitGuess', updateResult.error);
          }

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
        const challengeResult = await this.challengeRepo!.findById(challengeId);
        if (!isOk(challengeResult)) {
          throw new Error(`Failed to find challenge: ${JSON.stringify(challengeResult.error)}`);
        }

        const challenge = challengeResult.value;
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
        const guessResult = await this.attemptRepo.createGuess({
          attempt_id: attempt.id,
          guess_text: guess,
          validation_result: validation.judgment || 'INCORRECT',
          ai_explanation: validation.explanation,
        });

        if (!isOk(guessResult)) {
          this.logError('AttemptService.submitGuess', guessResult.error);
        }

        // Update attempt count
        const updateCountResult = await this.attemptRepo.updateAttempt(attempt.id, {
          attempts_made: newAttemptCount,
        });

        if (!isOk(updateCountResult)) {
          throw new Error(`Failed to update attempt count: ${JSON.stringify(updateCountResult.error)}`);
        }

        if (validation.isCorrect) {
          // Get user profile for bonus context
          const userProfileResult = await this.userService.getUserProfile(userId);
          let userProfile = null;
          if (isOk(userProfileResult)) {
            userProfile = userProfileResult.value;
          } else {
            this.logError('AttemptService.submitGuess', userProfileResult.error);
          }

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
          const completionResult = await this.recordCompletion(
            userId,
            challengeId,
            newAttemptCount,
            rewardWithBonuses.totalPoints,
            rewardWithBonuses.totalExp
          );

          if (!isOk(completionResult)) {
            this.logError('AttemptService.submitGuess', completionResult.error);
          }

          // Increment user's streak
          const streakResult = await this.userService.incrementStreak(userId);
          if (!isOk(streakResult)) {
            this.logError('AttemptService.submitGuess', streakResult.error);
          }

          // Award creator bonus if solver is not the creator
          if (challenge.creator_id && challenge.creator_id !== userId) {
            const creatorBonus = getCreatorBonus();
            const awardResult = await this.userService.awardPoints(
              challenge.creator_id,
              creatorBonus.points,
              creatorBonus.exp
            );
            if (isOk(awardResult)) {
              this.logInfo(
                'AttemptService',
                `Awarded creator bonus to ${challenge.creator_id} for challenge ${challengeId}`
              );
            } else {
              this.logError('AttemptService.submitGuess', awardResult.error);
            }
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
          const gameOverResult = await this.attemptRepo.updateAttempt(attempt.id, {
            game_over: true,
          });

          if (!isOk(gameOverResult)) {
            this.logError('AttemptService.submitGuess', gameOverResult.error);
          }

          // Reset user's streak on game over
          const resetResult = await this.userService.resetStreak(userId);
          if (!isOk(resetResult)) {
            this.logError('AttemptService.submitGuess', resetResult.error);
          }

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
      },
      (error) => internalError('Failed to submit guess', error)
    );
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
  ): Promise<Result<boolean, AppError>> {
    return tryCatch(
      async () => {
        // Get the attempt record with retry
        const attemptResult = await this.withRetry(
          () => this.attemptRepo.findByUserAndChallenge(userId, challengeId),
          {
            maxRetries: 3,
            exponentialBackoff: true,
          }
        );

        if (!isOk(attemptResult)) {
          throw new Error(`Failed to find attempt: ${JSON.stringify(attemptResult.error)}`);
        }

        const attempt = attemptResult.value;
        if (!attempt) {
          this.logError('AttemptService.recordCompletion', 'Attempt record not found');
          throw new Error('Attempt record not found');
        }

        // Use atomic database function to update attempt and user profile
        // This ensures both operations succeed or both fail (transaction)
        const successResult = await this.withRetry(
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
                `Atomic completion retry ${attemptNum}: ${String(error)}`
              );
            },
          }
        );

        if (!isOk(successResult) || !successResult.value) {
          this.logError('AttemptService.recordCompletion', 'Failed to record completion after retries');
          throw new Error('Failed to record completion after retries');
        }

        // Invalidate user cache since profile was updated
        this.userService.invalidateUserCache(userId);

        // Increment challenge's players_completed count
        if (this.challengeRepo) {
          const incrementResult = await this.challengeRepo.incrementPlayersCompleted(challengeId);
          if (!isOk(incrementResult)) {
            this.logError('AttemptService.recordCompletion', incrementResult.error);
          }
        }

        this.logInfo(
          'AttemptService',
          `User ${userId} completed challenge ${challengeId} with ${attemptsMade} attempts. Earned ${points} points and ${experience} exp.`
        );

        return true;
      },
      (error) => databaseError('recordCompletion', String(error))
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
  ): Promise<Result<{ success: boolean; attempt?: ChallengeAttempt; error?: string; newTotalPoints?: number }, AppError>> {
    return tryCatch(
      async () => {
        // First, get user's current points
        const userProfileResult = await this.userService.getUserProfile(userId);

        if (!isOk(userProfileResult)) {
          return { success: false, error: 'Failed to get user profile' };
        }

        const userProfile = userProfileResult.value;
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

        let attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        if (!isOk(attemptResult)) {
          throw new Error(`Failed to find attempt: ${JSON.stringify(attemptResult.error)}`);
        }

        let attempt = attemptResult.value;

        // If no attempt exists, create one
        if (!attempt) {
          const createResult = await this.recordAttempt(userId, challengeId);

          if (isOk(createResult) && createResult.value) {
            attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);
            if (!isOk(attemptResult)) {
              throw new Error(`Failed to find attempt after creation: ${JSON.stringify(attemptResult.error)}`);
            }
            attempt = attemptResult.value;
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
        const deductResult = await this.userService.deductPoints(userId, hintCost);

        if (!isOk(deductResult) || !deductResult.value) {
          return { success: false, error: 'Failed to deduct points' };
        }

        // Add index to hints_used
        const newHintsUsed = [...hintsUsed, imageIndex];

        // Update attempt
        const updateResult = await this.attemptRepo.updateAttempt(attempt.id, {
          hints_used: newHintsUsed
        });

        if (isOk(updateResult) && updateResult.value) {
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
      },
      (error) => internalError('Failed to reveal hint', error)
    );
  }

  /**
   * Get all attempts by a user
   */
  async getUserAttempts(userId: string): Promise<Result<ChallengeAttempt[], AppError>> {
    return tryCatch(
      async () => {
        const attemptsResult = await this.attemptRepo.findByUser(userId);

        if (!isOk(attemptsResult)) {
          throw new Error(`Failed to find user attempts: ${JSON.stringify(attemptsResult.error)}`);
        }

        const attempts = attemptsResult.value;

        // Backward compatibility: Migrate old attempts that were solved but have attempts_made = 0
        const migratedAttempts = await Promise.all(
          attempts.map(async (attempt) => {
            if (attempt.is_solved && attempt.attempts_made === 0) {
              this.logInfo(
                'AttemptService.getUserAttempts',
                `Migrating legacy attempt: user=${userId}, challenge=${attempt.challenge_id}, setting attempts_made=1`
              );

              // Update the attempt to have attempts_made = 1 (assume solved on first attempt)
              const updateResult = await this.attemptRepo.updateAttempt(attempt.id, {
                attempts_made: 1,
              });

              if (!isOk(updateResult)) {
                this.logError('AttemptService.getUserAttempts', updateResult.error);
              }

              // Return updated attempt
              return { ...attempt, attempts_made: 1 };
            }
            return attempt;
          })
        );

        return migratedAttempts;
      },
      (error) => databaseError('getUserAttempts', String(error))
    );
  }

  /**
   * Get all attempts for a specific challenge
   */
  async getChallengeAttempts(challengeId: string): Promise<Result<ChallengeAttempt[], AppError>> {
    const result = await this.attemptRepo.findByChallenge(challengeId);
    
    if (!isOk(result)) {
      return err(databaseError('getChallengeAttempts', 'Failed to get challenge attempts'));
    }
    
    return result;
  }

  /**
   * Check if a user has attempted a challenge
   */
  async hasAttempted(userId: string, challengeId: string): Promise<Result<boolean, AppError>> {
    const result = await this.attemptRepo.hasAttempted(userId, challengeId);
    
    if (!isOk(result)) {
      this.logError('AttemptService.hasAttempted', result.error);
      return err(databaseError('hasAttempted', 'Failed to check if user has attempted challenge'));
    }
    
    return result;
  }

  /**
   * Check if a user has solved a challenge
   */
  async hasSolved(userId: string, challengeId: string): Promise<Result<boolean, AppError>> {
    const result = await this.attemptRepo.hasSolved(userId, challengeId);
    
    if (!isOk(result)) {
      this.logError('AttemptService.hasSolved', result.error);
      return err(databaseError('hasSolved', 'Failed to check if user has solved challenge'));
    }
    
    return result;
  }

  /**
   * Get completion status for a challenge
   * Returns attempt details if completed, null otherwise
   */
  async getCompletionStatus(userId: string, challengeId: string): Promise<Result<ChallengeAttempt | null, AppError>> {
    return tryCatch(
      async () => {
        const attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        if (!isOk(attemptResult)) {
          throw new Error(`Failed to find attempt: ${JSON.stringify(attemptResult.error)}`);
        }

        const attempt = attemptResult.value;

        // Return attempt only if it's completed
        if (attempt && attempt.is_solved) {
          // Backward compatibility: Migrate old attempts that were solved but have attempts_made = 0
          if (attempt.attempts_made === 0) {
            this.logInfo(
              'AttemptService.getCompletionStatus',
              `Migrating legacy attempt: user=${userId}, challenge=${challengeId}, setting attempts_made=1`
            );

            // Update the attempt to have attempts_made = 1 (assume solved on first attempt)
            const updateResult = await this.attemptRepo.updateAttempt(attempt.id, {
              attempts_made: 1,
            });

            if (!isOk(updateResult)) {
              this.logError('AttemptService.getCompletionStatus', updateResult.error);
            }

            // Update local copy
            attempt.attempts_made = 1;
          }

          return attempt;
        }

        return null;
      },
      (error) => databaseError('getCompletionStatus', String(error))
    );
  }

  /**
   * Get attempt status for a challenge (completed or game over)
   * Returns attempt details if completed OR game over, null if still in progress
   */
  async getAttemptStatus(userId: string, challengeId: string): Promise<Result<ChallengeAttempt | null, AppError>> {
    return tryCatch(
      async () => {
        const attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        if (!isOk(attemptResult)) {
          throw new Error(`Failed to find attempt: ${JSON.stringify(attemptResult.error)}`);
        }

        const attempt = attemptResult.value;

        // Return attempt if it's completed OR game over
        if (attempt && (attempt.is_solved || attempt.game_over)) {
          // Backward compatibility: Migrate old attempts that were solved but have attempts_made = 0
          if (attempt.is_solved && attempt.attempts_made === 0) {
            this.logInfo(
              'AttemptService.getAttemptStatus',
              `Migrating legacy attempt: user=${userId}, challenge=${challengeId}, setting attempts_made=1`
            );

            // Update the attempt to have attempts_made = 1 (assume solved on first attempt)
            const updateResult = await this.attemptRepo.updateAttempt(attempt.id, {
              attempts_made: 1,
            });

            if (!isOk(updateResult)) {
              this.logError('AttemptService.getAttemptStatus', updateResult.error);
            }

            // Update local copy
            attempt.attempts_made = 1;
          }

          return attempt;
        }

        return null;
      },
      (error) => databaseError('getAttemptStatus', String(error))
    );
  }

  /**
   * Get the current attempt for a user and challenge, regardless of status.
   */
  async getAttempt(userId: string, challengeId: string): Promise<Result<ChallengeAttempt | null, AppError>> {
    return tryCatch(
      async () => {
        const attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        if (!isOk(attemptResult)) {
          throw new Error(`Failed to find attempt: ${JSON.stringify(attemptResult.error)}`);
        }

        const attempt = attemptResult.value;

        if (attempt) {
          // Backward compatibility: Migrate old attempts that were solved but have attempts_made = 0
          if (attempt.is_solved && attempt.attempts_made === 0) {
            this.logInfo(
              'AttemptService.getAttempt',
              `Migrating legacy attempt: user=${userId}, challenge=${challengeId}, setting attempts_made=1`
            );

            // Update the attempt to have attempts_made = 1 (assume solved on first attempt)
            const updateResult = await this.attemptRepo.updateAttempt(attempt.id, {
              attempts_made: 1,
            });

            if (!isOk(updateResult)) {
              this.logError('AttemptService.getAttempt', updateResult.error);
            }

            // Update local copy
            attempt.attempts_made = 1;
          }
        }

        return attempt;
      },
      (error) => databaseError('getAttempt', String(error))
    );
  }

  /**
   * Update images revealed count for an attempt
   * Called when user reveals a new hint
   * Creates attempt record if it doesn't exist
   */
  async updateImagesRevealed(userId: string, challengeId: string, imagesRevealed: number): Promise<Result<boolean, AppError>> {
    return tryCatch(
      async () => {
        let attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        if (!isOk(attemptResult)) {
          throw new Error(`Failed to find attempt: ${JSON.stringify(attemptResult.error)}`);
        }

        let attempt = attemptResult.value;

        // Create attempt if it doesn't exist
        if (!attempt) {
          const createResult = await this.attemptRepo.create({
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

          if (!isOk(createResult)) {
            throw new Error(`Failed to create attempt record: ${JSON.stringify(createResult.error)}`);
          }

          return true;
        }

        // Update existing attempt
        const updateResult = await this.attemptRepo.updateAttempt(attempt.id, {
          images_revealed: imagesRevealed,
        });

        if (!isOk(updateResult)) {
          throw new Error(`Failed to update attempt: ${JSON.stringify(updateResult.error)}`);
        }

        return updateResult.value;
      },
      (error) => databaseError('updateImagesRevealed', String(error))
    );
  }

  /**
   * Give up on a challenge
   * Marks the challenge as game over without solving it
   * Resets the user's streak
   */
  async giveUpChallenge(userId: string, challengeId: string): Promise<Result<{ success: boolean; message: string }, AppError>> {
    return tryCatch(
      async () => {
        // Get or create attempt record
        let attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);

        if (!isOk(attemptResult)) {
          throw new Error(`Failed to find attempt: ${JSON.stringify(attemptResult.error)}`);
        }

        let attempt = attemptResult.value;

        if (!attempt) {
          const recordResult = await this.recordAttempt(userId, challengeId);
          if (!isOk(recordResult)) {
            throw new Error(`Failed to record attempt: ${JSON.stringify(recordResult.error)}`);
          }

          attemptResult = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);
          if (!isOk(attemptResult)) {
            throw new Error(`Failed to find attempt after creation: ${JSON.stringify(attemptResult.error)}`);
          }

          attempt = attemptResult.value;
          if (!attempt) {
            return { success: false, message: 'Failed to record attempt' };
          }
        }

        // Check if already solved or game over
        if (attempt.is_solved) {
          return { success: false, message: 'Challenge already completed' };
        }

        if (attempt.game_over) {
          return { success: false, message: 'Challenge already given up' };
        }

        // Mark as game over
        const updateResult = await this.attemptRepo.updateAttempt(attempt.id, {
          game_over: true,
          completed_at: new Date().toISOString(),
        });

        if (!isOk(updateResult)) {
          throw new Error(`Failed to update attempt: ${JSON.stringify(updateResult.error)}`);
        }

        // Reset user's streak
        const resetResult = await this.userService.resetStreak(userId);
        if (!isOk(resetResult)) {
          this.logError('AttemptService.giveUpChallenge', resetResult.error);
        }

        this.logInfo('AttemptService', `User ${userId} gave up on challenge ${challengeId}`);

        return { success: true, message: 'Challenge given up successfully' };
      },
      (error) => internalError('Failed to give up challenge', error)
    );
  }
}
