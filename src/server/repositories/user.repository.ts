/**
 * User Repository
 * Handles all database operations for user profiles
 */

import type { Context } from '@devvit/server/server-context';
import { BaseRepository } from './base.repository.js';
import type { UserProfile, UserProfileUpdate, GuestProfile, GuestProfileUpdate, AnyUserProfile, isGuestProfile } from '../../shared/models/user.types.js';
import type { Result } from '../../shared/utils/result.js';
import { isOk } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { databaseError } from '../../shared/models/errors.js';
import { tryCatch } from '../../shared/utils/result-adapters.js';

export class UserRepository extends BaseRepository {
  private readonly TABLE = 'user_profiles';

  constructor(context: Context) {
    super(context);
  }

  /**
   * Find user profile by user ID
   */
  async findById(userId: string): Promise<Result<UserProfile | null, AppError>> {
    return this.queryOne<UserProfile>(this.TABLE, {
      filter: { user_id: `eq.${userId}` },
    });
  }

  /**
   * Create a new user profile
   */
  async create(profile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>): Promise<Result<UserProfile, AppError>> {
    // Set default subscription values if not provided
    const profileWithDefaults = {
      ...profile,
      is_subscribed: profile.is_subscribed ?? false,
      subscribed_at: profile.subscribed_at ?? null,
    };
    
    return this.insert<UserProfile>(this.TABLE, profileWithDefaults);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: UserProfileUpdate): Promise<Result<boolean, AppError>> {
    // Add updated_at timestamp
    const data = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return super.update(this.TABLE, { user_id: userId }, data);
  }

  /**
   * Find users ordered by points for leaderboard
   * Excludes moderators from the leaderboard
   */
  async findByPoints(limit: number = 10, offset: number = 0): Promise<Result<UserProfile[], AppError>> {
    return this.query<UserProfile>(this.TABLE, {
      filter: { role: 'eq.player' },
      order: 'total_points.desc',
      limit,
      offset,
    });
  }

  /**
   * Count users who have attempted at least one challenge.
   * This provides a more accurate count of "players" than just checking the leaderboard cache.
   * Excludes moderators from the count.
   */
  async countActivePlayers(): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        // Count users with challenges_attempted > 0 and role = 'player' (exclude mods)
        const url = `${config.url}/rest/v1/${this.TABLE}?select=count&challenges_attempted=gt.0&role=eq.player`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const countHeader = response.headers.get('content-range');
        if (countHeader) {
          const match = countHeader.match(/\/(\d+)$/);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
        return 0;
      },
      (error) => databaseError('countActivePlayers', String(error))
    );
  }

  /**
   * Get user's rank based on total points
   * Returns null if user not found or if user is a moderator
   * Uses optimized database function for better performance
   * Excludes moderators from rank calculation
   */
  async getUserRank(userId: string): Promise<Result<number | null, AppError>> {
    return tryCatch(
      async () => {
        // First check if user is a moderator - mods don't get ranks
        const userResult = await this.findById(userId);
        if (!isOk(userResult)) {
          throw new Error('Failed to fetch user');
        }

        const user = userResult.value;
        if (!user) {
          return null;
        }

        // Moderators don't appear on leaderboard, so no rank
        if (user.role === 'mod') {
          return null;
        }

        // Try to use the optimized function first
        const result = await this.executeFunction<number>('get_user_rank_optimized', {
          p_user_id: userId,
        });

        if (isOk(result) && result.value !== null) {
          return result.value;
        }

        // Fallback to original implementation if function doesn't exist
        const config = await this.getSupabaseConfig();

        // Count non-mod users with more points than this user
        const url = `${config.url}/rest/v1/${this.TABLE}?select=count&total_points=gt.${user.total_points}&role=eq.player`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const countHeader = response.headers.get('content-range');
        if (countHeader) {
          const match = countHeader.match(/\/(\d+)$/);
          if (match) {
            const usersAhead = parseInt(match[1], 10);
            return usersAhead + 1; // Rank is 1-based
          }
        }

        return null;
      },
      (error) => databaseError('getUserRank', String(error))
    );
  }

  /**
   * Batch update user statistics using database function
   * More efficient than multiple separate updates
   */
  async batchUpdateStats(
    userId: string,
    updates: {
      pointsDelta?: number;
      expDelta?: number;
      challengesCreatedDelta?: number;
      challengesAttemptedDelta?: number;
      challengesSolvedDelta?: number;
    }
  ): Promise<Result<UserProfile | null, AppError>> {
    return tryCatch(
      async () => {
        const result = await this.executeFunction<UserProfile>('batch_update_user_stats', {
          p_user_id: userId,
          p_points_delta: updates.pointsDelta || 0,
          p_exp_delta: updates.expDelta || 0,
          p_challenges_created_delta: updates.challengesCreatedDelta || 0,
          p_challenges_attempted_delta: updates.challengesAttemptedDelta || 0,
          p_challenges_solved_delta: updates.challengesSolvedDelta || 0,
        });

        if (!isOk(result)) {
          throw new Error('Failed to execute batch update function');
        }

        return result.value;
      },
      (error) => databaseError('batchUpdateStats', String(error))
    );
  }

  /**
   * Delete user profile by Reddit user ID
   * Returns true if deletion was successful (or profile didn't exist)
   * @param userId - Reddit user ID (t2_* format)
   * @returns Result<boolean, AppError>
   */
  async deleteProfile(userId: string): Promise<Result<boolean, AppError>> {
    return this.delete(this.TABLE, { user_id: userId });
  }

  // ============================================
  // Guest User Operations
  // ============================================

  /**
   * Create a new guest user profile
   * Guest users have is_guest = true and guest_ prefixed usernames
   */
  async createGuestProfile(profile: Omit<GuestProfile, 'created_at' | 'updated_at'>): Promise<Result<UserProfile, AppError>> {
    // Convert GuestProfile to UserProfile format for database storage
    const dbProfile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> = {
      user_id: profile.id, // Guest profile.id becomes user_id in database
      username: profile.username,
      total_points: profile.total_points,
      total_experience: profile.total_experience,
      level: profile.level,
      challenges_created: profile.challenges_created,
      challenges_attempted: profile.challenges_attempted,
      challenges_solved: profile.challenges_solved,
      current_streak: profile.current_streak,
      best_streak: profile.best_streak,
      last_challenge_created_at: profile.last_challenge_created_at,
      role: profile.role,
      is_subscribed: profile.is_subscribed ?? false,
      subscribed_at: profile.subscribed_at ?? null,
    };

    // Add is_guest flag for database
    const guestDbProfile = {
      ...dbProfile,
      is_guest: true, // Store as boolean for database compatibility
    };

    return this.insert<UserProfile>(this.TABLE, guestDbProfile);
  }

  /**
   * Find guest user profile by guest ID
   */
  async findGuestById(guestId: string): Promise<Result<UserProfile | null, AppError>> {
    return this.queryOne<UserProfile>(this.TABLE, {
      filter: { 
        user_id: `eq.${guestId}`,
        is_guest: 'eq.true'
      },
    });
  }

  /**
   * Update guest user profile
   */
  async updateGuestProfile(guestId: string, updates: GuestProfileUpdate): Promise<Result<boolean, AppError>> {
    // Convert GuestProfileUpdate to UserProfileUpdate format
    const dbUpdates: UserProfileUpdate = {
      username: updates.username,
      total_points: updates.total_points,
      total_experience: updates.total_experience,
      level: updates.level,
      challenges_created: updates.challenges_created,
      challenges_attempted: updates.challenges_attempted,
      challenges_solved: updates.challenges_solved,
      current_streak: updates.current_streak,
      best_streak: updates.best_streak,
      last_challenge_created_at: updates.last_challenge_created_at,
      role: updates.role,
      is_subscribed: updates.is_subscribed,
      subscribed_at: updates.subscribed_at,
      updated_at: new Date().toISOString(),
    };

    return super.update(this.TABLE, { 
      user_id: guestId,
      is_guest: 'true' // Convert boolean to string for query
    }, dbUpdates);
  }

  /**
   * Find guest users ordered by points for leaderboard
   * Only includes guest users (is_guest = true)
   */
  async findGuestsByPoints(limit: number = 10, offset: number = 0): Promise<Result<UserProfile[], AppError>> {
    return this.query<UserProfile>(this.TABLE, {
      filter: { 
        role: 'eq.player',
        is_guest: 'eq.true'
      },
      order: 'total_points.desc',
      limit,
      offset,
    });
  }

  /**
   * Count active guest users who have attempted at least one challenge
   */
  async countActiveGuestPlayers(): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        // Count guest users with challenges_attempted > 0
        const url = `${config.url}/rest/v1/${this.TABLE}?select=count&challenges_attempted=gt.0&is_guest=eq.true&role=eq.player`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const countHeader = response.headers.get('content-range');
        if (countHeader) {
          const match = countHeader.match(/\/(\d+)$/);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
        return 0;
      },
      (error) => databaseError('countActiveGuestPlayers', String(error))
    );
  }

  /**
   * Get guest user's rank based on total points
   * Returns null if guest user not found
   */
  async getGuestUserRank(guestId: string): Promise<Result<number | null, AppError>> {
    return tryCatch(
      async () => {
        // First check if guest user exists
        const userResult = await this.findGuestById(guestId);
        if (!isOk(userResult)) {
          throw new Error('Failed to fetch guest user');
        }

        const user = userResult.value;
        if (!user) {
          return null;
        }

        const config = await this.getSupabaseConfig();

        // Count guest users with more points than this user
        const url = `${config.url}/rest/v1/${this.TABLE}?select=count&total_points=gt.${user.total_points}&is_guest=eq.true&role=eq.player`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const countHeader = response.headers.get('content-range');
        if (countHeader) {
          const match = countHeader.match(/\/(\d+)$/);
          if (match) {
            const usersAhead = parseInt(match[1], 10);
            return usersAhead + 1; // Rank is 1-based
          }
        }

        return null;
      },
      (error) => databaseError('getGuestUserRank', String(error))
    );
  }

  /**
   * Batch update guest user statistics using database function
   */
  async batchUpdateGuestStats(
    guestId: string,
    updates: {
      pointsDelta?: number;
      expDelta?: number;
      challengesCreatedDelta?: number;
      challengesAttemptedDelta?: number;
      challengesSolvedDelta?: number;
    }
  ): Promise<Result<UserProfile | null, AppError>> {
    return tryCatch(
      async () => {
        const result = await this.executeFunction<UserProfile>('batch_update_user_stats', {
          p_user_id: guestId,
          p_points_delta: updates.pointsDelta || 0,
          p_exp_delta: updates.expDelta || 0,
          p_challenges_created_delta: updates.challengesCreatedDelta || 0,
          p_challenges_attempted_delta: updates.challengesAttemptedDelta || 0,
          p_challenges_solved_delta: updates.challengesSolvedDelta || 0,
        });

        if (!isOk(result)) {
          throw new Error('Failed to execute batch update function for guest user');
        }

        return result.value;
      },
      (error) => databaseError('batchUpdateGuestStats', String(error))
    );
  }

  /**
   * Delete guest user profile by guest ID
   */
  async deleteGuestProfile(guestId: string): Promise<Result<boolean, AppError>> {
    return this.delete(this.TABLE, { 
      user_id: guestId,
      is_guest: 'true' // Convert boolean to string for query
    });
  }

  /**
   * Clean up inactive guest users
   * Uses the database cleanup function created in Task 2.1
   */
  async cleanupInactiveGuestUsers(daysInactive: number = 90): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        const result = await this.executeFunction<number>('cleanup_inactive_guest_users', {
          p_days_inactive: daysInactive,
        });

        if (!isOk(result)) {
          throw new Error('Failed to execute cleanup function');
        }

        return result.value || 0;
      },
      (error) => databaseError('cleanupInactiveGuestUsers', String(error))
    );
  }

  /**
   * Get subscription analytics counts
   */
  async getSubscriptionCounts(): Promise<Result<{ total: number; subscribed: number }, AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        
        // Get total count
        const totalUrl = `${config.url}/rest/v1/${this.TABLE}?select=count`;
        const totalResponse = await fetch(totalUrl, {
          method: 'GET',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact',
          },
        });

        if (!totalResponse.ok) {
          throw new Error(`HTTP ${totalResponse.status}: ${totalResponse.statusText}`);
        }

        const totalCountHeader = totalResponse.headers.get('content-range');
        const totalCount = totalCountHeader ? parseInt(totalCountHeader.match(/\/(\d+)$/)?.[1] || '0', 10) : 0;

        // Get subscribed count
        const subscribedUrl = `${config.url}/rest/v1/${this.TABLE}?select=count&is_subscribed=eq.true`;
        const subscribedResponse = await fetch(subscribedUrl, {
          method: 'GET',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact',
          },
        });

        if (!subscribedResponse.ok) {
          throw new Error(`HTTP ${subscribedResponse.status}: ${subscribedResponse.statusText}`);
        }

        const subscribedCountHeader = subscribedResponse.headers.get('content-range');
        const subscribedCount = subscribedCountHeader ? parseInt(subscribedCountHeader.match(/\/(\d+)$/)?.[1] || '0', 10) : 0;

        return {
          total: totalCount,
          subscribed: subscribedCount,
        };
      },
      (error) => databaseError('getSubscriptionCounts', String(error))
    );
  }

  validateGuestUser(profile: Partial<GuestProfile>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate guest ID format - accept both guest_ and anon_ prefixes
    if (profile.id && !profile.id.startsWith('guest_') && !profile.id.startsWith('anon_')) {
      errors.push('Guest user ID must start with "guest_" or "anon_"');
    }

    // Validate username format - accept both guest_ and anon_ prefixes for IDs, but guest_ for usernames
    if (profile.username && !profile.username.startsWith('guest_')) {
      errors.push('Guest username must start with "guest_"');
    }

    // Validate role (guests must be players)
    if (profile.role && profile.role !== 'player') {
      errors.push('Guest users must have role "player"');
    }

    // Validate numeric constraints
    if (profile.total_points !== undefined && profile.total_points < 0) {
      errors.push('Total points cannot be negative');
    }

    if (profile.total_experience !== undefined && profile.total_experience < 0) {
      errors.push('Total experience cannot be negative');
    }

    if (profile.level !== undefined && profile.level < 1) {
      errors.push('Level must be at least 1');
    }

    if (profile.challenges_attempted !== undefined && profile.challenges_solved !== undefined) {
      if (profile.challenges_solved > profile.challenges_attempted) {
        errors.push('Challenges solved cannot exceed challenges attempted');
      }
    }

    if (profile.current_streak !== undefined && profile.best_streak !== undefined) {
      if (profile.current_streak > profile.best_streak) {
        errors.push('Current streak cannot exceed best streak');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
