/**
 * User Service
 * Handles all business logic related to user profiles, progression, and statistics
 * 
 * Uses Redis caching with 5-minute TTL for profile data.
 * Cache keys follow namespace format: user:{userId}:profile
 * 
 * Requirements: 4.1, 4.4, 6.2, 6.3
 */

import type { Context, RedisClient } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { calculateLevel, getExpToNextLevel } from '../../shared/utils/level-calculator.js';
import type { UserProfile, UserProfileUpdate } from '../../shared/models/user.types.js';
import { CacheKeyBuilder } from '../../shared/utils/cache.js';
import { deduplicateRequest, createDedupeKey } from '../../shared/utils/request-deduplication.js';
import type { LeaderboardService } from './leaderboard.service.js';

/** TTL for user profile cache (5 minutes) - Requirements: 4.4 */
const PROFILE_CACHE_TTL = 5 * 60 * 1000;

export class UserService extends BaseService {
  private redis: RedisClient;
  private leaderboardService: LeaderboardService | null = null;

  constructor(
    context: Context,
    private userRepo: UserRepository
  ) {
    super(context);
    this.redis = context.redis;
  }

  /**
   * Set the leaderboard service for atomic updates
   * This allows UserService to update leaderboard when points change
   */
  setLeaderboardService(leaderboardService: LeaderboardService): void {
    this.leaderboardService = leaderboardService;
  }

  /**
   * Create a cache key for user profile using namespace format
   * Format: user:{userId}:profile
   * Requirements: 6.4
   */
  private createProfileCacheKey(userId: string): string {
    return CacheKeyBuilder.createKey('user', userId, 'profile');
  }

  /**
   * Get user profile from Redis cache
   * Requirements: 4.1
   */
  private async getCachedProfile(userId: string): Promise<UserProfile | null> {
    try {
      const cacheKey = this.createProfileCacheKey(userId);
      const value = await this.redis.get(cacheKey);

      if (!value) {
        return null;
      }

      return JSON.parse(value) as UserProfile;
    } catch (error) {
      this.logError('UserService.getCachedProfile', error);
      return null;
    }
  }

  /**
   * Set user profile in Redis cache with 5-minute TTL
   * Requirements: 4.4
   */
  private async setCachedProfile(userId: string, profile: UserProfile): Promise<void> {
    try {
      const cacheKey = this.createProfileCacheKey(userId);
      const serialized = JSON.stringify(profile);

      await this.redis.set(cacheKey, serialized, {
        expiration: new Date(Date.now() + PROFILE_CACHE_TTL),
      });
    } catch (error) {
      // Log but don't throw - cache failures should not crash the application
      this.logError('UserService.setCachedProfile', error);
    }
  }

  /**
   * Get user profile by ID, creating it if it doesn't exist
   * This ensures every user has a profile when they first interact with the game
   * Results are cached for 5 minutes to reduce database load
   * Deduplicates simultaneous requests for the same user
   * 
   * Requirements: 4.1, 4.4
   */
  async getUserProfile(userId: string, username?: string): Promise<UserProfile | null> {
    return this.withErrorHandling(
      async () => {
        // Validate userId - prevent creating profiles for invalid/anonymous users
        if (!userId || userId === 'anonymous' || userId.trim() === '') {
          this.logError('UserService.getUserProfile', `Invalid userId: "${userId}"`);
          return null;
        }

        // Validate username if provided
        if (username && (username === 'anonymous' || username.trim() === '')) {
          this.logError('UserService.getUserProfile', `Invalid username: "${username}" for user ${userId}`);
          return null;
        }

        // Check cache first (Requirements: 4.1)
        const cached = await this.getCachedProfile(userId);
        if (cached) {
          this.logInfo('UserService', `Returning cached profile for user ${userId}`);
          return cached;
        }

        const dedupeKey = createDedupeKey('getUserProfile', userId);
        const profile = await deduplicateRequest(
          dedupeKey,
          async () => {
            let dbProfile = await this.userRepo.findById(userId);

            if (dbProfile) {
              // Validate and correct level if needed (self-healing for formula changes or bugs)
              const correctLevel = calculateLevel(dbProfile.total_experience);
              if (dbProfile.level !== correctLevel) {
                this.logInfo(
                  'UserService',
                  `Auto-correcting level for user ${userId}: ${dbProfile.level} → ${correctLevel} (${dbProfile.total_experience} XP)`
                );
                await this.userRepo.updateProfile(userId, { level: correctLevel });
                dbProfile.level = correctLevel;
              }

              if (username && dbProfile.username !== username) {
                this.logInfo('UserService', `Updating stale username for user ${userId}: ${dbProfile.username} -> ${username}`);
                await this.userRepo.updateProfile(userId, { username });
                dbProfile.username = username;
              }
            } else if (username) {
              this.logInfo('UserService', `Creating new profile for user ${userId}`);
              dbProfile = await this.createUserProfile(userId, username);
            }

            // Cache the profile on miss (Requirements: 4.4)
            if (dbProfile) {
              await this.setCachedProfile(userId, dbProfile);
            }

            return dbProfile;
          }
        );

        return profile;
      },
      'Failed to get user profile'
    );
  }

  /**
   * Create a new user profile with default values
   * Validates userId and username to prevent creating invalid profiles
   */
  async createUserProfile(userId: string, username: string): Promise<UserProfile | null> {
    return this.withErrorHandling(
      async () => {
        // Strict validation - prevent creating profiles for invalid users
        if (!userId || userId === 'anonymous' || userId.trim() === '') {
          this.logError('UserService.createUserProfile', `Rejected invalid userId: "${userId}"`);
          return null;
        }

        if (!username || username === 'anonymous' || username.trim() === '') {
          this.logError('UserService.createUserProfile', `Rejected invalid username: "${username}" for user ${userId}`);
          return null;
        }

        const newProfile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> = {
          user_id: userId,
          username,
          total_points: 0,
          total_experience: 0,
          level: 1,
          challenges_created: 0,
          challenges_attempted: 0,
          challenges_solved: 0,
          current_streak: 0,
          best_streak: 0,
          last_challenge_created_at: null,
          role: 'player',
        };

        const profile = await this.userRepo.create(newProfile);

        if (profile) {
          this.logInfo('UserService', `Created profile for user ${userId}`);
        }

        return profile;
      },
      'Failed to create user profile'
    );
  }

  /**
   * Update user profile with partial updates
   * Invalidates cache on successful update
   * 
   * Requirements: 6.2
   */
  async updateUserProfile(userId: string, updates: UserProfileUpdate): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        const success = await this.userRepo.updateProfile(userId, updates);

        if (success) {
          // Invalidate cache using safe invalidation (Requirements: 6.3)
          await this.safeInvalidateUserCache(userId);
          this.logInfo('UserService', `Updated profile for user ${userId} and invalidated cache`);
        }

        return success;
      },
      'Failed to update user profile'
    );
  }

  /**
   * Check if user can create a challenge (24-hour rate limit)
   * Returns whether they can create and time remaining if they can't
   * Fails closed on error to prevent rate limit bypass
   */
  async canCreateChallenge(userId: string): Promise<{ canCreate: boolean; timeRemaining: number }> {
    try {
      const profile = await this.userRepo.findById(userId);

      if (!profile || !profile.last_challenge_created_at) {
        return { canCreate: true, timeRemaining: 0 };
      }

      // Allow mods to bypass rate limits
      if (profile.role === 'mod') {
        return { canCreate: true, timeRemaining: 0 };
      }

      const lastCreatedAt = new Date(profile.last_challenge_created_at);
      const now = new Date();
      const timeSinceLastCreation = now.getTime() - lastCreatedAt.getTime();
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

      if (timeSinceLastCreation >= twentyFourHoursInMs) {
        return { canCreate: true, timeRemaining: 0 };
      }

      const timeRemaining = twentyFourHoursInMs - timeSinceLastCreation;
      return { canCreate: false, timeRemaining };
    } catch (error) {
      this.logError('UserService.canCreateChallenge', error);
      return { canCreate: false, timeRemaining: 0 };
    }
  }

  /**
   * Award points and experience to a user, automatically calculating new level
   * This is the core progression mechanic
   * Uses retry logic to ensure points are awarded reliably
   * 
   * Invalidates profile cache AND updates leaderboard sorted set atomically.
   * Both operations complete before the function returns.
   * 
   * Requirements: 6.2
   */
  async awardPoints(userId: string, points: number, experience: number): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        // Use retry logic for fetching profile
        const profile = await this.withRetry(
          () => this.userRepo.findById(userId),
          {
            maxRetries: 3,
            exponentialBackoff: true,
          }
        );

        if (!profile) {
          this.logError('UserService.awardPoints', `Profile not found for user ${userId}`);
          return false;
        }

        const newTotalPoints = profile.total_points + points;
        const newTotalExperience = profile.total_experience + experience;

        const newLevel = calculateLevel(newTotalExperience);

        const leveledUp = newLevel > profile.level;

        if (leveledUp) {
          this.logInfo('UserService', `User ${userId} leveled up to level ${newLevel}!`);
        }

        const success = await this.withRetry(
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
                'UserService.awardPoints',
                `Profile update attempt ${attempt} failed: ${error.message}`
              );
            },
          }
        );

        if (success) {
          // Invalidate profile cache AND update leaderboard atomically (Requirements: 6.2)
          // Both operations must complete before returning
          await this.invalidateCacheAndUpdateLeaderboard(userId, points);

          this.logInfo(
            'UserService',
            `Awarded ${points} points and ${experience} exp to user ${userId}`
          );
        }

        return success;
      },
      'Failed to award points'
    );
  }

  /**
   * Deduct points from a user's total (for hint purchases)
   * Similar to awardPoints but with negative value
   * Invalidates profile cache AND updates leaderboard sorted set atomically.
   * 
   * Requirements: 6.2
   */
  async deductPoints(userId: string, points: number): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        // Use retry logic for fetching profile
        const profile = await this.withRetry(
          () => this.userRepo.findById(userId),
          {
            maxRetries: 3,
            exponentialBackoff: true,
          }
        );

        if (!profile) {
          this.logError('UserService.deductPoints', `Profile not found for user ${userId}`);
          return false;
        }

        // Check if user has enough points
        if (profile.total_points < points) {
          this.logError('UserService.deductPoints', `User ${userId} has insufficient points: ${profile.total_points} < ${points}`);
          return false;
        }

        const newTotalPoints = profile.total_points - points;

        const success = await this.withRetry(
          () => this.userRepo.updateProfile(userId, {
            total_points: newTotalPoints,
          }),
          {
            maxRetries: 3,
            exponentialBackoff: true,
            onRetry: (attempt, error) => {
              this.logWarning(
                'UserService.deductPoints',
                `Profile update attempt ${attempt} failed: ${error.message}`
              );
            },
          }
        );

        if (success) {
          // Invalidate profile cache AND update leaderboard atomically (Requirements: 6.2)
          // Use negative delta for leaderboard
          await this.invalidateCacheAndUpdateLeaderboard(userId, -points);

          this.logInfo(
            'UserService',
            `Deducted ${points} points from user ${userId}. New balance: ${newTotalPoints}`
          );
        }

        return success;
      },
      'Failed to deduct points'
    );
  }

  /**
   * Invalidate user profile cache AND update leaderboard sorted set atomically
   * Both operations complete before the function returns.
   * 
   * Requirements: 6.2
   */
  async invalidateCacheAndUpdateLeaderboard(userId: string, pointsDelta: number): Promise<void> {
    // Run both operations and wait for both to complete
    // Use Promise.all to ensure both complete before returning
    await Promise.all([
      this.safeInvalidateUserCache(userId),
      this.safeUpdateLeaderboard(userId, pointsDelta),
    ]);
  }

  /**
   * Safely update leaderboard sorted set
   * Catches errors and logs them without throwing (Requirements: 6.3)
   */
  private async safeUpdateLeaderboard(userId: string, pointsDelta: number): Promise<void> {
    try {
      if (this.leaderboardService) {
        await this.leaderboardService.incrementScore(userId, pointsDelta);
        this.logInfo('UserService', `Updated leaderboard for user ${userId} by ${pointsDelta} points`);
      }
    } catch (error) {
      // Log but don't throw - leaderboard update failures should not crash (Requirements: 6.3)
      this.logError('UserService.safeUpdateLeaderboard', error);
    }
  }

  /**
   * Get experience required to reach next level for a user
   */
  async getExpToNextLevel(userId: string): Promise<number> {
    try {
      const profile = await this.userRepo.findById(userId);

      if (!profile) {
        return 0;
      }

      return getExpToNextLevel(profile.total_experience, profile.level);
    } catch (error) {
      this.logError('UserService.getExpToNextLevel', error);
      return 0;
    }
  }

  /**
   * Increment challenges created count and update last creation timestamp
   */
  async incrementChallengesCreated(userId: string): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        const profile = await this.userRepo.findById(userId);

        if (!profile) {
          return false;
        }

        const success = await this.userRepo.updateProfile(userId, {
          challenges_created: profile.challenges_created + 1,
          last_challenge_created_at: new Date().toISOString(),
        });

        if (success) {
          this.invalidateUserCache(userId);
        }

        return success;
      },
      'Failed to increment challenges created'
    );
  }

  /**
   * Increment challenges attempted count
   */
  async incrementChallengesAttempted(userId: string): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        const profile = await this.userRepo.findById(userId);

        if (!profile) {
          return false;
        }

        const success = await this.userRepo.updateProfile(userId, {
          challenges_attempted: profile.challenges_attempted + 1,
        });

        if (success) {
          this.invalidateUserCache(userId);
        }

        return success;
      },
      'Failed to increment challenges attempted'
    );
  }

  /**
   * Increment challenges solved count
   */
  async incrementChallengesSolved(userId: string): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        const profile = await this.userRepo.findById(userId);

        if (!profile) {
          return false;
        }

        const success = await this.userRepo.updateProfile(userId, {
          challenges_solved: profile.challenges_solved + 1,
        });

        if (success) {
          this.invalidateUserCache(userId);
        }

        return success;
      },
      'Failed to increment challenges solved'
    );
  }

  /**
   * Get user's rank on the leaderboard
   */
  async getUserRank(userId: string): Promise<number | null> {
    return this.withErrorHandling(
      async () => {
        return this.userRepo.getUserRank(userId);
      },
      'Failed to get user rank'
    );
  }

  /**
   * Invalidate cache for a specific user
   * Uses Redis to delete the cached profile
   * 
   * Requirements: 6.2
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const cacheKey = this.createProfileCacheKey(userId);
      await this.redis.del(cacheKey);
      this.logInfo('UserService', `Invalidated cache for user ${userId}`);
    } catch (error) {
      this.logError('UserService.invalidateUserCache', error);
      throw error;
    }
  }

  /**
   * Safely invalidate user cache - catches errors and logs them without throwing
   * This ensures cache invalidation failures don't crash the application.
   * 
   * Requirements: 6.3
   */
  async safeInvalidateUserCache(userId: string): Promise<void> {
    try {
      await this.invalidateUserCache(userId);
    } catch (error) {
      // Log but don't throw - invalidation failures should not crash (Requirements: 6.3)
      this.logError('UserService.safeInvalidateUserCache', `Cache invalidation failed for user ${userId}`);
    }
  }

  /**
   * Clear all cached profiles - NOT SUPPORTED IN REDIS IMPLEMENTATION
   * This would require scanning keys which is expensive
   */
  async clearAllCache(): Promise<void> {
    this.logInfo('UserService', 'Clear all cache not supported with Redis');
  }

  /**
   * Get cache statistics - NOT SUPPORTED IN REDIS IMPLEMENTATION
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: 0,
      ttl: PROFILE_CACHE_TTL,
    };
  }

  /**
   * Increment user's streak on successful solve
   * Returns the new streak value
   */
  async incrementStreak(userId: string): Promise<number> {
    try {
      const profile = await this.userRepo.findById(userId);
      if (!profile) {
        return 0;
      }

      const newStreak = (profile.current_streak || 0) + 1;
      const bestStreak = Math.max(profile.best_streak || 0, newStreak);

      await this.userRepo.updateProfile(userId, {
        current_streak: newStreak,
        best_streak: bestStreak,
      });

      this.invalidateUserCache(userId);
      this.logInfo('UserService', `User ${userId} streak increased to ${newStreak}`);

      return newStreak;
    } catch (error) {
      this.logError('UserService.incrementStreak', error);
      return 0;
    }
  }

  /**
   * Reset user's streak on game over (failed challenge)
   */
  async resetStreak(userId: string): Promise<void> {
    try {
      const profile = await this.userRepo.findById(userId);
      if (!profile || (profile.current_streak || 0) === 0) {
        return;
      }

      await this.userRepo.updateProfile(userId, {
        current_streak: 0,
      });

      this.invalidateUserCache(userId);
      this.logInfo('UserService', `User ${userId} streak reset`);
    } catch (error) {
      this.logError('UserService.resetStreak', error);
    }
  }

  /**
   * Get user's current streak
   */
  async getCurrentStreak(userId: string): Promise<number> {
    try {
      const profile = await this.userRepo.findById(userId);
      return profile?.current_streak || 0;
    } catch (error) {
      this.logError('UserService.getCurrentStreak', error);
      return 0;
    }
  }
}
