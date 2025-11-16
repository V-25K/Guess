/**
 * Attempt Service
 * Handles all business logic related to challenge attempts, guesses, and completions
 */

import type { Context } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { AttemptRepository } from '../repositories/attempt.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from './user.service.js';
import { calculateChallengeReward } from '../../shared/utils/reward-calculator.js';
import type { ChallengeAttempt, ChallengeAttemptCreate, AttemptResult } from '../../shared/models/attempt.types.js';

export class AttemptService extends BaseService {
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
          images_revealed: 1, // First image is revealed by default
          is_solved: false,
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
        
        this.logInfo('AttemptService', `Recorded attempt for user ${userId} on challenge ${challengeId}`);
        
        return true;
      },
      'Failed to record attempt'
    );
  }

  /**
   * Submit a guess for a challenge
   * This method does NOT validate the answer - that's done by AIValidationService
   * It only records the attempt and updates statistics if correct
   */
  async submitGuess(
    userId: string,
    challengeId: string,
    isCorrect: boolean,
    imagesRevealed: number
  ): Promise<AttemptResult> {
    try {
      // Check if user is the creator of this challenge
      const challenge = await this.challengeRepo!.findById(challengeId);
      
      if (challenge && challenge.creator_id === userId) {
        this.logWarning('AttemptService.submitGuess', `User ${userId} attempted to answer their own challenge ${challengeId}`);
        return {
          isCorrect: false,
          explanation: "You can't answer your own challenge!",
        };
      }
      
      // Get or create attempt record
      let attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);
      
      if (!attempt) {
        // Create attempt if it doesn't exist
        await this.recordAttempt(userId, challengeId);
        attempt = await this.attemptRepo.findByUserAndChallenge(userId, challengeId);
        
        if (!attempt) {
          return {
            isCorrect: false,
            explanation: 'Failed to record attempt',
          };
        }
      }
      
      // If already solved, don't process again
      if (attempt.is_solved) {
        return {
          isCorrect: true,
          explanation: 'Challenge already completed',
          reward: {
            points: attempt.points_earned,
            experience: attempt.experience_earned,
          },
        };
      }
      
      // Calculate reward based on performance
      const reward = calculateChallengeReward(imagesRevealed, isCorrect);
      
      if (isCorrect) {
        // Record completion
        await this.recordCompletion(
          userId,
          challengeId,
          imagesRevealed,
          reward.points,
          reward.exp
        );
        
        return {
          isCorrect: true,
          explanation: 'Correct! Challenge completed.',
          reward: {
            points: reward.points,
            experience: reward.exp,
          },
        };
      }
      
      // Incorrect guess - update images revealed count
      await this.attemptRepo.updateAttempt(attempt.id, {
        images_revealed: imagesRevealed,
      });
      
      return {
        isCorrect: false,
        explanation: 'Incorrect guess. Try revealing more hints.',
      };
    } catch (error) {
      this.logError('AttemptService.submitGuess', error);
      return {
        isCorrect: false,
        explanation: 'An error occurred while processing your guess',
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
    imagesRevealed: number,
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
            imagesRevealed,
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
          `User ${userId} completed challenge ${challengeId} with ${imagesRevealed} images revealed. Earned ${points} points and ${experience} exp.`
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
        return this.attemptRepo.findByUser(userId);
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
            is_solved: false,
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
