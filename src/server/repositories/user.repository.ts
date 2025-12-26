/**
 * User Repository
 * Handles all database operations for user profiles
 */

import type { Context } from '@devvit/server/server-context';
import { BaseRepository } from './base.repository.js';
import type { UserProfile, UserProfileUpdate } from '../../shared/models/user.types.js';
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
    return this.insert<UserProfile>(this.TABLE, profile);
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
   */
  async findByPoints(limit: number = 10, offset: number = 0): Promise<Result<UserProfile[], AppError>> {
    return this.query<UserProfile>(this.TABLE, {
      order: 'total_points.desc',
      limit,
      offset,
    });
  }

  /**
   * Count users who have attempted at least one challenge.
   * This provides a more accurate count of "players" than just checking the leaderboard cache.
   */
  async countActivePlayers(): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        // Count users with challenges_attempted > 0
        const url = `${config.url}/rest/v1/${this.TABLE}?select=count&challenges_attempted=gt.0`;

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
   * Returns null if user not found
   * Uses optimized database function for better performance
   */
  async getUserRank(userId: string): Promise<Result<number | null, AppError>> {
    return tryCatch(
      async () => {
        // Try to use the optimized function first
        const result = await this.executeFunction<number>('get_user_rank_optimized', {
          p_user_id: userId,
        });

        if (isOk(result) && result.value !== null) {
          return result.value;
        }

        // Fallback to original implementation if function doesn't exist
        const userResult = await this.findById(userId);
        if (!isOk(userResult)) {
          throw new Error('Failed to fetch user');
        }

        const user = userResult.value;
        if (!user) {
          return null;
        }

        const config = await this.getSupabaseConfig();

        // Count users with more points than this user
        const url = `${config.url}/rest/v1/${this.TABLE}?select=count&total_points=gt.${user.total_points}`;

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
}
