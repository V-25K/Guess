/**
 * User Profile Service
 * Handles all profile CRUD operations for users
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import type { Context } from '@devvit/server/server-context';
import { reddit } from '@devvit/web/server';
import { BaseService } from '../base.service.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { UserCacheService } from './user-cache.service.js';
import { calculateLevel } from '../../../shared/utils/level-calculator.js';
import type { UserProfile, UserProfileUpdate, GuestProfile, GuestProfileUpdate, AnyUserProfile, isGuestProfile } from '../../../shared/models/user.types.js';
import { deduplicateRequest, createDedupeKey } from '../../../shared/utils/request-deduplication.js';
import type { Result } from '../../../shared/utils/result.js';
import { ok, err, isOk } from '../../../shared/utils/result.js';
import type { AppError } from '../../../shared/models/errors.js';
import { validationError, databaseError } from '../../../shared/models/errors.js';
import { tryCatch } from '../../../shared/utils/result-adapters.js';

/**
 * UserProfileService handles all profile CRUD operations.
 * 
 * This service is responsible for:
 * - Getting user profiles (with auto-creation for new users)
 * - Creating new user profiles with default values
 * - Updating user profiles
 * - Checking challenge creation rate limits
 * - Getting user rank
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export class UserProfileService extends BaseService {
  constructor(
    context: Context,
    private userRepo: UserRepository,
    private cacheService: UserCacheService
  ) {
    super(context);
  }

  /**
   * Get user profile by ID, creating it if it doesn't exist
   * This ensures every user has a profile when they first interact with the game
   * Results are cached for 5 minutes to reduce database load
   * Deduplicates simultaneous requests for the same user
   * 
   * Requirements: 1.2
   */
  async getUserProfile(userId: string, username?: string): Promise<Result<UserProfile | null, AppError>> {
    // Validate userId - prevent creating profiles for invalid/anonymous users
    if (!userId || userId === 'anonymous' || userId.trim() === '') {
      this.logError('UserProfileService.getUserProfile', `Invalid userId: "${userId}"`);
      return err(validationError([{ field: 'userId', message: 'Invalid or anonymous userId' }]));
    }

    // Validate username if provided
    if (username && (username === 'anonymous' || username.trim() === '')) {
      this.logError('UserProfileService.getUserProfile', `Invalid username: "${username}" for user ${userId}`);
      return err(validationError([{ field: 'username', message: 'Invalid or anonymous username' }]));
    }

    // Check cache first
    const cachedResult = await this.cacheService.getCachedProfile(userId);

    if (isOk(cachedResult) && cachedResult.value) {
      const cachedProfile = cachedResult.value;

      // If we have a cached profile and it has an avatar (or we decide we don't need to force it every time), return it
      // For now, if avatar is missing, we'll try to fetch it to "repair" the cache
      if (cachedProfile.avatar_url) {
        this.logInfo('UserProfileService', `Returning cached profile (with avatar) for user ${userId}`);
        return ok(cachedProfile);
      }

      this.logInfo('UserProfileService', `Cached profile found for ${userId} but missing avatar. Fetching...`);

      // Attempt to fetch avatar to enrich cached profile using username
      try {
        if (cachedProfile.username) {
          const redditUser = await reddit.getUserByUsername(cachedProfile.username);
          if (redditUser) {
            const avatar = await redditUser.getSnoovatarUrl();
            if (avatar) {
              cachedProfile.avatar_url = avatar;
              // Update the cache with the enriched profile
              await this.cacheService.setCachedProfile(userId, cachedProfile);
            }
          }
        }
      } catch {
        // Silent failure - avatar is optional
      }

      // Return the profile (enriched or not)
      return ok(cachedProfile);
    }

    // Cache miss - proceed with DB fetch
    if (!isOk(cachedResult)) {
      this.logError('UserProfileService.getUserProfile', cachedResult.error);
    }

    const dedupeKey = createDedupeKey('getUserProfile', userId);

    return tryCatch(
      async () => {
        const profile = await deduplicateRequest(
          dedupeKey,
          async () => {
            const dbProfileResult = await this.userRepo.findById(userId);

            if (!isOk(dbProfileResult)) {
              throw new Error(`Failed to fetch profile: ${JSON.stringify(dbProfileResult.error)}`);
            }

            let dbProfile = dbProfileResult.value;

            if (dbProfile) {
              // Validate and correct level if needed (self-healing for formula changes or bugs)
              const correctLevel = calculateLevel(dbProfile.total_experience);
              if (dbProfile.level !== correctLevel) {
                this.logInfo(
                  'UserProfileService',
                  `Auto-correcting level for user ${userId}: ${dbProfile.level} → ${correctLevel} (${dbProfile.total_experience} XP)`
                );
                const updateResult = await this.userRepo.updateProfile(userId, { level: correctLevel });
                if (!isOk(updateResult)) {
                  throw new Error(`Failed to update level: ${JSON.stringify(updateResult.error)}`);
                }
                dbProfile.level = correctLevel;
              }

              if (username && dbProfile.username !== username) {
                this.logInfo('UserProfileService', `Updating stale username for user ${userId}: ${dbProfile.username} -> ${username}`);
                const updateResult = await this.userRepo.updateProfile(userId, { username });
                if (!isOk(updateResult)) {
                  throw new Error(`Failed to update username: ${JSON.stringify(updateResult.error)}`);
                }
                dbProfile.username = username;
              }
            } else if (username) {
              this.logInfo('UserProfileService', `Creating new profile for user ${userId}`);
              const createResult = await this.createUserProfile(userId, username);
              if (!isOk(createResult)) {
                throw new Error(`Failed to create profile: ${JSON.stringify(createResult.error)}`);
              }
              dbProfile = createResult.value;
            }

            // Fetch Reddit Avatar for Fresh Profile using username
            try {
              if (dbProfile && dbProfile.username) {
                const redditUser = await reddit.getUserByUsername(dbProfile.username);
                if (redditUser) {
                  const avatar = await redditUser.getSnoovatarUrl();
                  dbProfile.avatar_url = avatar;
                }
              }
            } catch {
              // Silent failure - avatar is optional
            }

            // Cache the profile on miss
            if (dbProfile) {
              const cacheResult = await this.cacheService.setCachedProfile(userId, dbProfile);
              // Log cache failures but don't fail the operation
              if (!isOk(cacheResult)) {
                this.logError('UserProfileService.getUserProfile', cacheResult.error);
              }
            }

            return dbProfile;
          }
        );

        return profile;
      },
      (error) => databaseError('getUserProfile', String(error))
    );
  }

  /**
   * Create a new user profile with default values
   * Validates userId and username to prevent creating invalid profiles
   * 
   * Requirements: 1.4
   */
  async createUserProfile(userId: string, username: string): Promise<Result<UserProfile, AppError>> {
    // Strict validation - prevent creating profiles for invalid users
    if (!userId || userId === 'anonymous' || userId.trim() === '') {
      this.logError('UserProfileService.createUserProfile', `Rejected invalid userId: "${userId}"`);
      return err(validationError([{ field: 'userId', message: 'Invalid or anonymous userId' }]));
    }

    if (!username || username === 'anonymous' || username.trim() === '') {
      this.logError('UserProfileService.createUserProfile', `Rejected invalid username: "${username}" for user ${userId}`);
      return err(validationError([{ field: 'username', message: 'Invalid or anonymous username' }]));
    }

    const newProfile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      username,
      total_points: 30, // New players start with 30 points
      total_experience: 0,
      level: 1,
      challenges_created: 0,
      challenges_attempted: 0,
      challenges_solved: 0,
      current_streak: 0,
      best_streak: 0,
      last_challenge_created_at: null,
      role: 'player',
      is_subscribed: false,
      subscribed_at: null,
    };

    const result = await this.userRepo.create(newProfile);

    if (isOk(result)) {
      this.logInfo('UserProfileService', `Created profile for user ${userId}`);
    }

    return result;
  }

  /**
   * Update user profile with partial updates
   * Invalidates cache on successful update
   * 
   * Requirements: 1.3
   */
  async updateUserProfile(userId: string, updates: UserProfileUpdate): Promise<Result<boolean, AppError>> {
    const result = await this.userRepo.updateProfile(userId, updates);

    if (isOk(result) && result.value) {
      // Invalidate cache using safe invalidation
      await this.cacheService.safeInvalidateCache(userId);
      this.logInfo('UserProfileService', `Updated profile for user ${userId} and invalidated cache`);
    }

    return result;
  }

  /**
   * Check if user can create a challenge (24-hour rate limit)
   * Returns whether they can create and time remaining if they can't
   * Fails closed on error to prevent rate limit bypass
   */
  async canCreateChallenge(userId: string): Promise<Result<{ canCreate: boolean; timeRemaining: number }, AppError>> {
    const profileResult = await this.userRepo.findById(userId);

    if (!isOk(profileResult)) {
      // Fail closed on error to prevent rate limit bypass
      this.logError('UserProfileService.canCreateChallenge', profileResult.error);
      return ok({ canCreate: false, timeRemaining: 0 });
    }

    const profile = profileResult.value;

    if (!profile || !profile.last_challenge_created_at) {
      return ok({ canCreate: true, timeRemaining: 0 });
    }

    // Allow mods to bypass rate limits
    if (profile.role === 'mod') {
      return ok({ canCreate: true, timeRemaining: 0 });
    }

    const lastCreatedAt = new Date(profile.last_challenge_created_at);
    const now = new Date();
    const timeSinceLastCreation = now.getTime() - lastCreatedAt.getTime();
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    if (timeSinceLastCreation >= twentyFourHoursInMs) {
      return ok({ canCreate: true, timeRemaining: 0 });
    }

    const timeRemaining = twentyFourHoursInMs - timeSinceLastCreation;
    return ok({ canCreate: false, timeRemaining });
  }

  /**
   * Get user's rank on the leaderboard
   */
  async getUserRank(userId: string): Promise<Result<number | null, AppError>> {
    return this.userRepo.getUserRank(userId);
  }

  // ============================================
  // Guest User Operations
  // ============================================

  /**
   * Check if a guest profile exists without creating it
   * Returns true if profile exists, false otherwise
   */
  async guestProfileExists(guestId: string): Promise<Result<boolean, AppError>> {
    const profileResult = await this.userRepo.findGuestById(guestId);
    
    if (!isOk(profileResult)) {
      return profileResult;
    }
    
    return ok(profileResult.value !== null);
  }

  /**
   * Get guest user profile by guest ID, creating it if it doesn't exist
   * Similar to getUserProfile but for guest users
   * 
   * Requirements: REQ-2.1, REQ-2.2
   */
  async getGuestProfile(guestId: string, guestProfile?: GuestProfile): Promise<Result<UserProfile | null, AppError>> {
    // Validate guestId - prevent creating profiles for invalid guest IDs
    if (!guestId || (!guestId.startsWith('guest_') && !guestId.startsWith('anon_')) || guestId.trim() === '') {
      this.logError('UserProfileService.getGuestProfile', `Invalid guestId: "${guestId}"`);
      return err(validationError([{ field: 'guestId', message: 'Invalid guest user ID format' }]));
    }

    // Check cache first
    const cachedResult = await this.cacheService.getCachedProfile(guestId);

    if (isOk(cachedResult) && cachedResult.value) {
      this.logInfo('UserProfileService', `Returning cached guest profile for ${guestId}`);
      return ok(cachedResult.value);
    }

    // Cache miss - proceed with DB fetch
    if (!isOk(cachedResult)) {
      this.logError('UserProfileService.getGuestProfile', cachedResult.error);
    }

    const dedupeKey = createDedupeKey('getGuestProfile', guestId);

    return tryCatch(
      async () => {
        const profile = await deduplicateRequest(
          dedupeKey,
          async () => {
            const dbProfileResult = await this.userRepo.findGuestById(guestId);

            if (!isOk(dbProfileResult)) {
              throw new Error(`Failed to fetch guest profile: ${JSON.stringify(dbProfileResult.error)}`);
            }

            let dbProfile = dbProfileResult.value;

            if (dbProfile) {
              // Validate and correct level if needed (self-healing for formula changes or bugs)
              const correctLevel = calculateLevel(dbProfile.total_experience);
              if (dbProfile.level !== correctLevel) {
                this.logInfo(
                  'UserProfileService',
                  `Auto-correcting level for guest ${guestId}: ${dbProfile.level} → ${correctLevel} (${dbProfile.total_experience} XP)`
                );
                const updateResult = await this.userRepo.updateGuestProfile(guestId, { level: correctLevel });
                if (!isOk(updateResult)) {
                  throw new Error(`Failed to update guest level: ${JSON.stringify(updateResult.error)}`);
                }
                dbProfile.level = correctLevel;
              }
            } else if (guestProfile) {
              this.logInfo('UserProfileService', `Creating new guest profile for ${guestId}`);
              const createResult = await this.createGuestProfile(guestProfile);
              if (!isOk(createResult)) {
                throw new Error(`Failed to create guest profile: ${JSON.stringify(createResult.error)}`);
              }
              dbProfile = createResult.value;
            }

            // Cache the profile on miss
            if (dbProfile) {
              const cacheResult = await this.cacheService.setCachedProfile(guestId, dbProfile);
              // Log cache failures but don't fail the operation
              if (!isOk(cacheResult)) {
                this.logError('UserProfileService.getGuestProfile', cacheResult.error);
              }
            }

            return dbProfile;
          }
        );

        return profile;
      },
      (error) => databaseError('getGuestProfile', String(error))
    );
  }

  /**
   * Create a new guest user profile with default values
   * Validates guest profile data before creation
   * 
   * Requirements: REQ-2.1, REQ-2.2, REQ-2.3
   */
  async createGuestProfile(guestProfile: GuestProfile): Promise<Result<UserProfile, AppError>> {
    // Validate guest profile data
    const validation = this.userRepo.validateGuestUser(guestProfile);
    if (!validation.isValid) {
      this.logError('UserProfileService.createGuestProfile', `Validation failed: ${validation.errors.join(', ')}`);
      return err(validationError(validation.errors.map(error => ({ field: 'guestProfile', message: error }))));
    }

    // Create the profile in database
    const result = await this.userRepo.createGuestProfile(guestProfile);

    if (isOk(result)) {
      this.logInfo('UserProfileService', `Created guest profile for ${guestProfile.id}`);
    }

    return result;
  }

  /**
   * Update guest user profile with partial updates
   * Invalidates cache on successful update
   * 
   * Requirements: REQ-2.1, REQ-2.2
   */
  async updateGuestProfile(guestId: string, updates: GuestProfileUpdate): Promise<Result<boolean, AppError>> {
    // Validate guest ID format
    if (!guestId || (!guestId.startsWith('guest_') && !guestId.startsWith('anon_'))) {
      this.logError('UserProfileService.updateGuestProfile', `Invalid guestId: "${guestId}"`);
      return err(validationError([{ field: 'guestId', message: 'Invalid guest user ID format' }]));
    }

    // Validate updates if they contain guest-specific fields
    if (updates.username && !updates.username.startsWith('guest_')) {
      return err(validationError([{ field: 'username', message: 'Guest username must start with "guest_"' }]));
    }

    if (updates.role && updates.role !== 'player') {
      return err(validationError([{ field: 'role', message: 'Guest users must have role "player"' }]));
    }

    const result = await this.userRepo.updateGuestProfile(guestId, updates);

    if (isOk(result) && result.value) {
      // Invalidate cache using safe invalidation
      await this.cacheService.safeInvalidateCache(guestId);
      this.logInfo('UserProfileService', `Updated guest profile for ${guestId} and invalidated cache`);
    }

    return result;
  }

  /**
   * Check if guest user can create a challenge (24-hour rate limit)
   * Returns whether they can create and time remaining if they can't
   * Fails closed on error to prevent rate limit bypass
   */
  async canGuestCreateChallenge(guestId: string): Promise<Result<{ canCreate: boolean; timeRemaining: number }, AppError>> {
    const profileResult = await this.userRepo.findGuestById(guestId);

    if (!isOk(profileResult)) {
      // Fail closed on error to prevent rate limit bypass
      this.logError('UserProfileService.canGuestCreateChallenge', profileResult.error);
      return ok({ canCreate: false, timeRemaining: 0 });
    }

    const profile = profileResult.value;

    if (!profile || !profile.last_challenge_created_at) {
      return ok({ canCreate: true, timeRemaining: 0 });
    }

    // Guest users are always players, so no role bypass
    const lastCreatedAt = new Date(profile.last_challenge_created_at);
    const now = new Date();
    const timeSinceLastCreation = now.getTime() - lastCreatedAt.getTime();
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    if (timeSinceLastCreation >= twentyFourHoursInMs) {
      return ok({ canCreate: true, timeRemaining: 0 });
    }

    const timeRemaining = twentyFourHoursInMs - timeSinceLastCreation;
    return ok({ canCreate: false, timeRemaining });
  }

  /**
   * Get guest user's rank on the leaderboard
   */
  async getGuestUserRank(guestId: string): Promise<Result<number | null, AppError>> {
    return this.userRepo.getGuestUserRank(guestId);
  }

  /**
   * Delete guest user profile
   */
  async deleteGuestProfile(guestId: string): Promise<Result<boolean, AppError>> {
    // Validate guest ID format
    if (!guestId || (!guestId.startsWith('guest_') && !guestId.startsWith('anon_'))) {
      this.logError('UserProfileService.deleteGuestProfile', `Invalid guestId: "${guestId}"`);
      return err(validationError([{ field: 'guestId', message: 'Invalid guest user ID format' }]));
    }

    const result = await this.userRepo.deleteGuestProfile(guestId);

    if (isOk(result) && result.value) {
      // Invalidate cache
      await this.cacheService.safeInvalidateCache(guestId);
      this.logInfo('UserProfileService', `Deleted guest profile for ${guestId} and invalidated cache`);
    }

    return result;
  }
}
