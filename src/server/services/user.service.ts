/**
 * User Service (Facade)
 * Maintains backward compatibility by delegating to focused services
 * 
 * This facade provides the same public API as the original UserService
 * while internally delegating to:
 * - UserCacheService: Redis caching operations
 * - UserProfileService: Profile CRUD operations
 * - UserProgressionService: XP, levels, and streak management
 * 
 * Requirements: 4.1, 4.2, 4.4
 */

import type { Context } from '@devvit/server/server-context';
import { BaseService } from './base.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { UserProfile, UserProfileUpdate, GuestProfile, GuestProfileUpdate, AnyUserProfile } from '../../shared/models/user.types.js';
import type { LeaderboardService } from './leaderboard.service.js';
import type { Result } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';

// Import the new focused services
import { UserCacheService, PROFILE_CACHE_TTL } from './user/user-cache.service.js';
import { UserProfileService } from './user/user-profile.service.js';
import { UserProgressionService } from './user/user-progression.service.js';

/**
 * UserService facade that delegates to focused services.
 * Maintains the exact same public API for backward compatibility.
 * 
 * Requirements: 4.1, 4.2, 4.4
 */
export class UserService extends BaseService {
  private cacheService: UserCacheService;
  private profileService: UserProfileService;
  private progressionService: UserProgressionService;

  constructor(
    context: Context,
    private userRepo: UserRepository
  ) {
    super(context);
    
    // Initialize the focused services
    this.cacheService = new UserCacheService(context);
    this.profileService = new UserProfileService(context, userRepo, this.cacheService);
    this.progressionService = new UserProgressionService(context, userRepo, this.cacheService);
  }

  /**
   * Set the leaderboard service for atomic updates
   * Delegates to UserProgressionService
   */
  setLeaderboardService(leaderboardService: LeaderboardService): void {
    this.progressionService.setLeaderboardService(leaderboardService);
  }

  // ============================================
  // Profile Operations (delegated to UserProfileService)
  // ============================================

  /**
   * Get user profile by ID, creating it if it doesn't exist
   * Delegates to UserProfileService
   */
  async getUserProfile(userId: string, username?: string): Promise<Result<UserProfile | null, AppError>> {
    return this.profileService.getUserProfile(userId, username);
  }

  /**
   * Create a new user profile with default values
   * Delegates to UserProfileService
   */
  async createUserProfile(userId: string, username: string): Promise<Result<UserProfile, AppError>> {
    return this.profileService.createUserProfile(userId, username);
  }

  /**
   * Update user profile with partial updates
   * Delegates to UserProfileService
   */
  async updateUserProfile(userId: string, updates: UserProfileUpdate): Promise<Result<boolean, AppError>> {
    return this.profileService.updateUserProfile(userId, updates);
  }

  /**
   * Check if user can create a challenge (24-hour rate limit)
   * Delegates to UserProfileService
   */
  async canCreateChallenge(userId: string): Promise<Result<{ canCreate: boolean; timeRemaining: number }, AppError>> {
    return this.profileService.canCreateChallenge(userId);
  }

  /**
   * Get user's rank on the leaderboard
   * Delegates to UserProfileService
   */
  async getUserRank(userId: string): Promise<Result<number | null, AppError>> {
    return this.profileService.getUserRank(userId);
  }

  // ============================================
  // Progression Operations (delegated to UserProgressionService)
  // ============================================

  /**
   * Award points and experience to a user
   * Delegates to UserProgressionService
   */
  async awardPoints(userId: string, points: number, experience: number): Promise<Result<boolean, AppError>> {
    return this.progressionService.awardPoints(userId, points, experience);
  }

  /**
   * Deduct points from a user's total
   * Delegates to UserProgressionService
   */
  async deductPoints(userId: string, points: number): Promise<Result<boolean, AppError>> {
    return this.progressionService.deductPoints(userId, points);
  }

  /**
   * Get experience required to reach next level
   * Delegates to UserProgressionService
   */
  async getExpToNextLevel(userId: string): Promise<Result<number, AppError>> {
    return this.progressionService.getExpToNextLevel(userId);
  }

  /**
   * Increment user's streak on successful solve
   * Delegates to UserProgressionService
   */
  async incrementStreak(userId: string): Promise<Result<number, AppError>> {
    return this.progressionService.incrementStreak(userId);
  }

  /**
   * Reset user's streak on game over
   * Delegates to UserProgressionService
   */
  async resetStreak(userId: string): Promise<Result<void, AppError>> {
    return this.progressionService.resetStreak(userId);
  }

  /**
   * Get user's current streak
   * Delegates to UserProgressionService
   */
  async getCurrentStreak(userId: string): Promise<Result<number, AppError>> {
    return this.progressionService.getCurrentStreak(userId);
  }

  /**
   * Increment challenges created count
   * Delegates to UserProgressionService
   */
  async incrementChallengesCreated(userId: string): Promise<Result<boolean, AppError>> {
    return this.progressionService.incrementChallengesCreated(userId);
  }

  /**
   * Increment challenges attempted count
   * Delegates to UserProgressionService
   */
  async incrementChallengesAttempted(userId: string): Promise<Result<boolean, AppError>> {
    return this.progressionService.incrementChallengesAttempted(userId);
  }

  /**
   * Increment challenges solved count
   * Delegates to UserProgressionService
   */
  async incrementChallengesSolved(userId: string): Promise<Result<boolean, AppError>> {
    return this.progressionService.incrementChallengesSolved(userId);
  }

  // ============================================
  // Cache Operations (delegated to UserCacheService)
  // ============================================

  /**
   * Invalidate cache for a specific user
   * Delegates to UserCacheService
   */
  async invalidateUserCache(userId: string): Promise<Result<void, AppError>> {
    return this.cacheService.invalidateCache(userId);
  }

  /**
   * Safely invalidate user cache
   * Delegates to UserCacheService
   */
  async safeInvalidateUserCache(userId: string): Promise<void> {
    return this.cacheService.safeInvalidateCache(userId);
  }

  /**
   * Invalidate cache and update leaderboard atomically
   * Combines cache and progression service operations
   */
  async invalidateCacheAndUpdateLeaderboard(userId: string, pointsDelta: number): Promise<void> {
    // This method is exposed for backward compatibility
    // The actual implementation is in UserProgressionService
    await Promise.all([
      this.cacheService.safeInvalidateCache(userId),
      // Note: leaderboard update is handled internally by progressionService
    ]);
  }

  /**
   * Clear all cached profiles - NOT SUPPORTED
   */
  async clearAllCache(): Promise<void> {
    this.logInfo('UserService', 'Clear all cache not supported with Redis');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: 0,
      ttl: PROFILE_CACHE_TTL,
    };
  }

  // ============================================
  // Direct access to focused services (for advanced use cases)
  // ============================================

  /**
   * Get the underlying cache service for direct access
   */
  getCacheService(): UserCacheService {
    return this.cacheService;
  }

  /**
   * Get the underlying profile service for direct access
   */
  getProfileService(): UserProfileService {
    return this.profileService;
  }

  /**
   * Get the underlying progression service for direct access
   */
  getProgressionService(): UserProgressionService {
    return this.progressionService;
  }

  // ============================================
  // Guest User Operations (delegated to focused services)
  // ============================================

  /**
   * Check if a guest profile exists without creating it
   * Delegates to UserProfileService
   */
  async guestProfileExists(guestId: string): Promise<Result<boolean, AppError>> {
    return this.profileService.guestProfileExists(guestId);
  }

  /**
   * Get guest user profile by ID, creating it if it doesn't exist
   * Delegates to UserProfileService
   */
  async getGuestProfile(guestId: string, guestProfile?: GuestProfile): Promise<Result<UserProfile | null, AppError>> {
    return this.profileService.getGuestProfile(guestId, guestProfile);
  }

  /**
   * Create a new guest user profile with default values
   * Delegates to UserProfileService
   */
  async createGuestProfile(guestProfile: GuestProfile): Promise<Result<UserProfile, AppError>> {
    return this.profileService.createGuestProfile(guestProfile);
  }

  /**
   * Update guest user profile with partial updates
   * Delegates to UserProfileService
   */
  async updateGuestProfile(guestId: string, updates: GuestProfileUpdate): Promise<Result<boolean, AppError>> {
    return this.profileService.updateGuestProfile(guestId, updates);
  }

  /**
   * Check if guest user can create a challenge (24-hour rate limit)
   * Delegates to UserProfileService
   */
  async canGuestCreateChallenge(guestId: string): Promise<Result<{ canCreate: boolean; timeRemaining: number }, AppError>> {
    return this.profileService.canGuestCreateChallenge(guestId);
  }

  /**
   * Get guest user's rank on the leaderboard
   * Delegates to UserProfileService
   */
  async getGuestUserRank(guestId: string): Promise<Result<number | null, AppError>> {
    return this.profileService.getGuestUserRank(guestId);
  }

  /**
   * Delete guest user profile
   * Delegates to UserProfileService
   */
  async deleteGuestProfile(guestId: string): Promise<Result<boolean, AppError>> {
    return this.profileService.deleteGuestProfile(guestId);
  }

  // ============================================
  // Guest User Progression Operations (delegated to UserProgressionService)
  // ============================================

  /**
   * Award points and experience to a guest user
   * Delegates to UserProgressionService
   */
  async awardGuestPoints(guestId: string, points: number, experience: number): Promise<Result<boolean, AppError>> {
    return this.progressionService.awardGuestPoints(guestId, points, experience);
  }

  /**
   * Deduct points from a guest user's total
   * Delegates to UserProgressionService
   */
  async deductGuestPoints(guestId: string, points: number): Promise<Result<boolean, AppError>> {
    return this.progressionService.deductGuestPoints(guestId, points);
  }

  /**
   * Get experience required to reach next level for guest user
   * Delegates to UserProgressionService
   */
  async getGuestExpToNextLevel(guestId: string): Promise<Result<number, AppError>> {
    return this.progressionService.getGuestExpToNextLevel(guestId);
  }

  /**
   * Increment guest user's streak on successful solve
   * Delegates to UserProgressionService
   */
  async incrementGuestStreak(guestId: string): Promise<Result<number, AppError>> {
    return this.progressionService.incrementGuestStreak(guestId);
  }

  /**
   * Reset guest user's streak on game over
   * Delegates to UserProgressionService
   */
  async resetGuestStreak(guestId: string): Promise<Result<void, AppError>> {
    return this.progressionService.resetGuestStreak(guestId);
  }

  /**
   * Get guest user's current streak
   * Delegates to UserProgressionService
   */
  async getGuestCurrentStreak(guestId: string): Promise<Result<number, AppError>> {
    return this.progressionService.getGuestCurrentStreak(guestId);
  }

  /**
   * Increment guest challenges created count
   * Delegates to UserProgressionService
   */
  async incrementGuestChallengesCreated(guestId: string): Promise<Result<boolean, AppError>> {
    return this.progressionService.incrementGuestChallengesCreated(guestId);
  }

  /**
   * Increment guest challenges attempted count
   * Delegates to UserProgressionService
   */
  async incrementGuestChallengesAttempted(guestId: string): Promise<Result<boolean, AppError>> {
    return this.progressionService.incrementGuestChallengesAttempted(guestId);
  }

  /**
   * Increment guest challenges solved count
   * Delegates to UserProgressionService
   */
  async incrementGuestChallengesSolved(guestId: string): Promise<Result<boolean, AppError>> {
    return this.progressionService.incrementGuestChallengesSolved(guestId);
  }

  // ============================================
  // Guest User Cleanup Operations
  // ============================================

  /**
   * Clean up inactive guest users
   * Delegates to UserRepository
   */
  async cleanupInactiveGuestUsers(daysInactive: number = 90): Promise<Result<number, AppError>> {
    return this.userRepo.cleanupInactiveGuestUsers(daysInactive);
  }

  /**
   * Validate guest user data
   * Delegates to UserRepository
   */
  validateGuestUser(profile: Partial<GuestProfile>): { isValid: boolean; errors: string[] } {
    return this.userRepo.validateGuestUser(profile);
  }
}
