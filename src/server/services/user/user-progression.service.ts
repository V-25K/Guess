/**
 * User Progression Service
 * Handles all XP, level, and streak management for users
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import type { Context } from '@devvit/server/server-context';
import { BaseService } from '../base.service.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { UserCacheService } from './user-cache.service.js';
import { calculateLevel, getExpToNextLevel } from '../../../shared/utils/level-calculator.js';
import type { Result } from '../../../shared/utils/result.js';
import { ok, err, isOk } from '../../../shared/utils/result.js';
import type { AppError } from '../../../shared/models/errors.js';
import { validationError, databaseError } from '../../../shared/models/errors.js';
import type { LeaderboardService } from '../leaderboard.service.js';

/**
 * UserProgressionService handles all XP, level, and streak management.
 * 
 * This service is responsible for:
 * - Awarding and deducting points
 * - Calculating experience and levels
 * - Managing streaks (increment, reset, get)
 * - Tracking challenge statistics
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export class UserProgressionService extends BaseService {
  private leaderboardService: LeaderboardService | null = null;

  constructor(
    context: Context,
    private userRepo: UserRepository,
    private cacheService: UserCacheService
  ) {
    super(context);
  }

  /**
   * Set the leaderboard service for atomic updates
   * This allows UserProgressionService to update leaderboard when points change
   */
  setLeaderboardService(leaderboardService: LeaderboardService): void {
    this.leaderboardService = leaderboardService;
  }

  /**
   * Award points and experience to a user, automatically calculating new level
   * This is the core progression mechanic
   * Uses retry logic to ensure points are awarded reliably
   * 
   * Invalidates profile cache AND updates leaderboard sorted set atomically.
   * Both operations complete before the function returns.
   * 
   * Requirements: 2.2
   */
  async awardPoints(userId: string, points: number, experience: number): Promise<Result<boolean, AppError>> {
    // Use retry logic for fetching profile
    const profileResult = await this.withRetry(
      () => this.userRepo.findById(userId),
      {
        maxRetries: 3,
        exponentialBackoff: true,
      }
    );

    if (!isOk(profileResult)) {
      this.logError('UserProgressionService.awardPoints', profileResult.error);
      return profileResult;
    }

    const profile = profileResult.value;

    if (!profile) {
      this.logError('UserProgressionService.awardPoints', `Profile not found for user ${userId}`);
      return err(databaseError('awardPoints', 'Profile not found'));
    }

    const newTotalPoints = profile.total_points + points;
    const newTotalExperience = profile.total_experience + experience;

    const newLevel = calculateLevel(newTotalExperience);

    const leveledUp = newLevel > profile.level;

    if (leveledUp) {
      this.logInfo('UserProgressionService', `User ${userId} leveled up to level ${newLevel}!`);
    }

    const updateResult = await this.withRetry(
      () => this.userRepo.updateProfile(userId, {
        total_points: newTotalPoints,
        total_experience: newTotalExperience,
        level: newLevel,
      }),
      {
        maxRetries: 3,
        exponentialBackoff: true,
        onRetry: (attempt, error) => {
          this.logWarning(
            'UserProgressionService.awardPoints',
            `Profile update attempt ${attempt} failed`
          );
          this.logError('UserProgressionService.awardPoints', error);
        },
      }
    );

    if (!isOk(updateResult)) {
      return updateResult;
    }

    if (updateResult.value) {
      // Invalidate profile cache AND update leaderboard atomically
      // Both operations must complete before returning
      await this.invalidateCacheAndUpdateLeaderboard(userId, points);

      this.logInfo(
        'UserProgressionService',
        `Awarded ${points} points and ${experience} exp to user ${userId}`
      );
    }

    return updateResult;
  }

  /**
   * Deduct points from a user's total (for hint purchases)
   * Similar to awardPoints but with negative value
   * Invalidates profile cache AND updates leaderboard sorted set atomically.
   * 
   * Requirements: 2.3
   */
  async deductPoints(userId: string, points: number): Promise<Result<boolean, AppError>> {
    // Use retry logic for fetching profile
    const profileResult = await this.withRetry(
      () => this.userRepo.findById(userId),
      {
        maxRetries: 3,
        exponentialBackoff: true,
      }
    );

    if (!isOk(profileResult)) {
      this.logError('UserProgressionService.deductPoints', profileResult.error);
      return profileResult;
    }

    const profile = profileResult.value;

    if (!profile) {
      this.logError('UserProgressionService.deductPoints', `Profile not found for user ${userId}`);
      return err(databaseError('deductPoints', 'Profile not found'));
    }

    // Check if user has enough points
    if (profile.total_points < points) {
      this.logError('UserProgressionService.deductPoints', `User ${userId} has insufficient points: ${profile.total_points} < ${points}`);
      return err(validationError([{ field: 'points', message: 'Insufficient points' }]));
    }

    const newTotalPoints = profile.total_points - points;

    const updateResult = await this.withRetry(
      () => this.userRepo.updateProfile(userId, {
        total_points: newTotalPoints,
      }),
      {
        maxRetries: 3,
        exponentialBackoff: true,
        onRetry: (attempt, error) => {
          this.logWarning(
            'UserProgressionService.deductPoints',
            `Profile update attempt ${attempt} failed`
          );
          this.logError('UserProgressionService.deductPoints', error);
        },
      }
    );

    if (!isOk(updateResult)) {
      return updateResult;
    }

    if (updateResult.value) {
      // Invalidate profile cache AND update leaderboard atomically
      // Use negative delta for leaderboard
      await this.invalidateCacheAndUpdateLeaderboard(userId, -points);

      this.logInfo(
        'UserProgressionService',
        `Deducted ${points} points from user ${userId}. New balance: ${newTotalPoints}`
      );
    }

    return updateResult;
  }

  /**
   * Get experience required to reach next level for a user
   */
  async getExpToNextLevel(userId: string): Promise<Result<number, AppError>> {
    const profileResult = await this.userRepo.findById(userId);

    if (!isOk(profileResult)) {
      this.logError('UserProgressionService.getExpToNextLevel', profileResult.error);
      return profileResult;
    }

    const profile = profileResult.value;

    if (!profile) {
      return ok(0);
    }

    return ok(getExpToNextLevel(profile.total_experience, profile.level));
  }

  /**
   * Increment user's streak on successful solve
   * Returns the new streak value
   * 
   * Requirements: 2.4
   */
  async incrementStreak(userId: string): Promise<Result<number, AppError>> {
    const profileResult = await this.userRepo.findById(userId);
    
    if (!isOk(profileResult)) {
      this.logError('UserProgressionService.incrementStreak', profileResult.error);
      return profileResult;
    }

    const profile = profileResult.value;
    
    if (!profile) {
      return ok(0);
    }

    const newStreak = (profile.current_streak || 0) + 1;
    const bestStreak = Math.max(profile.best_streak || 0, newStreak);

    const updateResult = await this.userRepo.updateProfile(userId, {
      current_streak: newStreak,
      best_streak: bestStreak,
    });

    if (!isOk(updateResult)) {
      return updateResult;
    }

    await this.cacheService.safeInvalidateCache(userId);
    this.logInfo('UserProgressionService', `User ${userId} streak increased to ${newStreak}`);

    return ok(newStreak);
  }

  /**
   * Reset user's streak on game over (failed challenge)
   * 
   * Requirements: 2.5
   */
  async resetStreak(userId: string): Promise<Result<void, AppError>> {
    const profileResult = await this.userRepo.findById(userId);
    
    if (!isOk(profileResult)) {
      this.logError('UserProgressionService.resetStreak', profileResult.error);
      return profileResult;
    }

    const profile = profileResult.value;
    
    if (!profile || (profile.current_streak || 0) === 0) {
      return ok(undefined);
    }

    const updateResult = await this.userRepo.updateProfile(userId, {
      current_streak: 0,
    });

    if (!isOk(updateResult)) {
      return updateResult;
    }

    await this.cacheService.safeInvalidateCache(userId);
    this.logInfo('UserProgressionService', `User ${userId} streak reset`);

    return ok(undefined);
  }

  /**
   * Get user's current streak
   */
  async getCurrentStreak(userId: string): Promise<Result<number, AppError>> {
    const profileResult = await this.userRepo.findById(userId);
    
    if (!isOk(profileResult)) {
      this.logError('UserProgressionService.getCurrentStreak', profileResult.error);
      return profileResult;
    }

    return ok(profileResult.value?.current_streak || 0);
  }

  /**
   * Increment challenges created count and update last creation timestamp
   */
  async incrementChallengesCreated(userId: string): Promise<Result<boolean, AppError>> {
    const profileResult = await this.userRepo.findById(userId);

    if (!isOk(profileResult)) {
      return profileResult;
    }

    const profile = profileResult.value;

    if (!profile) {
      return err(databaseError('incrementChallengesCreated', 'Profile not found'));
    }

    const updateResult = await this.userRepo.updateProfile(userId, {
      challenges_created: profile.challenges_created + 1,
      last_challenge_created_at: new Date().toISOString(),
    });

    if (isOk(updateResult) && updateResult.value) {
      await this.cacheService.safeInvalidateCache(userId);
    }

    return updateResult;
  }

  /**
   * Increment challenges attempted count
   */
  async incrementChallengesAttempted(userId: string): Promise<Result<boolean, AppError>> {
    const profileResult = await this.userRepo.findById(userId);

    if (!isOk(profileResult)) {
      return profileResult;
    }

    const profile = profileResult.value;

    if (!profile) {
      return err(databaseError('incrementChallengesAttempted', 'Profile not found'));
    }

    const updateResult = await this.userRepo.updateProfile(userId, {
      challenges_attempted: profile.challenges_attempted + 1,
    });

    if (isOk(updateResult) && updateResult.value) {
      await this.cacheService.safeInvalidateCache(userId);
    }

    return updateResult;
  }

  /**
   * Increment challenges solved count
   */
  async incrementChallengesSolved(userId: string): Promise<Result<boolean, AppError>> {
    const profileResult = await this.userRepo.findById(userId);

    if (!isOk(profileResult)) {
      return profileResult;
    }

    const profile = profileResult.value;

    if (!profile) {
      return err(databaseError('incrementChallengesSolved', 'Profile not found'));
    }

    const updateResult = await this.userRepo.updateProfile(userId, {
      challenges_solved: profile.challenges_solved + 1,
    });

    if (isOk(updateResult) && updateResult.value) {
      await this.cacheService.safeInvalidateCache(userId);
    }

    return updateResult;
  }

  /**
   * Invalidate user profile cache AND update leaderboard sorted set atomically
   * Both operations complete before the function returns.
   */
  private async invalidateCacheAndUpdateLeaderboard(userId: string, pointsDelta: number): Promise<void> {
    // Run both operations and wait for both to complete
    // Use Promise.all to ensure both complete before returning
    await Promise.all([
      this.cacheService.safeInvalidateCache(userId),
      this.safeUpdateLeaderboard(userId, pointsDelta),
    ]);
  }

  /**
   * Safely update leaderboard sorted set
   * Catches errors and logs them without throwing
   */
  private async safeUpdateLeaderboard(userId: string, pointsDelta: number): Promise<void> {
    try {
      if (this.leaderboardService) {
        const result = await this.leaderboardService.incrementScore(userId, pointsDelta);
        if (isOk(result)) {
          this.logInfo('UserProgressionService', `Updated leaderboard for user ${userId} by ${pointsDelta} points`);
        } else {
          this.logError('UserProgressionService.safeUpdateLeaderboard', result.error);
        }
      }
    } catch (error) {
      // Log but don't throw - leaderboard update failures should not crash
      this.logError('UserProgressionService.safeUpdateLeaderboard', error);
    }
  }
}
