/**
 * User Repository
 * Handles all database operations for user profiles
 */

import type { Context } from '@devvit/public-api';
import { BaseRepository } from './base.repository.js';
import type { UserProfile, UserProfileUpdate } from '../../shared/models/user.types.js';

export class UserRepository extends BaseRepository {
  private readonly TABLE = 'user_profiles';

  constructor(context: Context) {
    super(context);
  }

  /**
   * Find user profile by user ID
   */
  async findById(userId: string): Promise<UserProfile | null> {
    return this.queryOne<UserProfile>(this.TABLE, {
      filter: { user_id: `eq.${userId}` },
    });
  }

  /**
   * Create a new user profile
   */
  async create(profile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>): Promise<UserProfile | null> {
    return this.insert<UserProfile>(this.TABLE, profile);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: UserProfileUpdate): Promise<boolean> {
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
  async findByPoints(limit: number = 10, offset: number = 0): Promise<UserProfile[]> {
    return this.query<UserProfile>(this.TABLE, {
      order: 'total_points.desc',
      limit,
      offset,
    });
  }

  /**
   * Get user's rank based on total points
   * Returns null if user not found
   * Uses optimized database function for better performance
   */
  async getUserRank(userId: string): Promise<number | null> {
    try {
      // Try to use the optimized function first
      const result = await this.executeFunction<number>('get_user_rank_optimized', {
        p_user_id: userId,
      });
      
      if (result !== null) {
        return result;
      }
      
      // Fallback to original implementation if function doesn't exist
      const user = await this.findById(userId);
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
        return null;
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
    } catch (error) {
      return null;
    }
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
  ): Promise<UserProfile | null> {
    try {
      const result = await this.executeFunction<UserProfile>('batch_update_user_stats', {
        p_user_id: userId,
        p_points_delta: updates.pointsDelta || 0,
        p_exp_delta: updates.expDelta || 0,
        p_challenges_created_delta: updates.challengesCreatedDelta || 0,
        p_challenges_attempted_delta: updates.challengesAttemptedDelta || 0,
        p_challenges_solved_delta: updates.challengesSolvedDelta || 0,
      });
      
      return result;
    } catch (error) {
      return null;
    }
  }
}
