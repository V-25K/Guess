/**
 * User Service
 * Handles all business logic related to user profiles, progression, and statistics
 */

import type { Context } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { calculateLevel, getExpToNextLevel } from '../../shared/utils/level-calculator.js';
import type { UserProfile, UserProfileUpdate } from '../../shared/models/user.types.js';
import { Cache, createCacheKey } from '../../shared/utils/cache.js';
import { deduplicateRequest, createDedupeKey } from '../../shared/utils/request-deduplication.js';

export class UserService extends BaseService {
  private profileCache: Cache<UserProfile>;
  private readonly PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    context: Context,
    private userRepo: UserRepository
  ) {
    super(context);
    this.profileCache = new Cache<UserProfile>(this.PROFILE_CACHE_TTL);
  }

  /**
   * Get user profile by ID, creating it if it doesn't exist
   * This ensures every user has a profile when they first interact with the game
   * Results are cached for 5 minutes to reduce database load
   * Deduplicates simultaneous requests for the same user
   */
  async getUserProfile(userId: string, username?: string): Promise<UserProfile | null> {
    return this.withErrorHandling(
      async () => {
        const cacheKey = createCacheKey('profile', userId);
        
        const cached = this.profileCache.get(cacheKey);
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
              if (username && dbProfile.username !== username) {
                this.logInfo('UserService', `Updating stale username for user ${userId}: ${dbProfile.username} -> ${username}`);
                await this.userRepo.updateProfile(userId, { username });
                dbProfile.username = username;
              }
            } else if (username) {
              this.logInfo('UserService', `Creating new profile for user ${userId}`);
              dbProfile = await this.createUserProfile(userId, username);
            }
            
            if (dbProfile) {
              this.profileCache.set(cacheKey, dbProfile);
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
   */
  async createUserProfile(userId: string, username: string): Promise<UserProfile | null> {
    return this.withErrorHandling(
      async () => {
        const newProfile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> = {
          user_id: userId,
          username,
          total_points: 0,
          total_experience: 0,
          level: 1,
          challenges_created: 0,
          challenges_attempted: 0,
          challenges_solved: 0,
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
   */
  async updateUserProfile(userId: string, updates: UserProfileUpdate): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        const success = await this.userRepo.updateProfile(userId, updates);
        
        if (success) {
          // Invalidate cache
          const cacheKey = createCacheKey('profile', userId);
          this.profileCache.delete(cacheKey);
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
          this.invalidateUserCache(userId);
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
   */
  invalidateUserCache(userId: string): void {
    const cacheKey = createCacheKey('profile', userId);
    this.profileCache.delete(cacheKey);
    this.logInfo('UserService', `Invalidated cache for user ${userId}`);
  }

  /**
   * Clear all cached profiles
   */
  clearAllCache(): void {
    this.profileCache.clear();
    this.logInfo('UserService', 'Cleared all profile cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.profileCache.size(),
      ttl: this.PROFILE_CACHE_TTL,
    };
  }
}
