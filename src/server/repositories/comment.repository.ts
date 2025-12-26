/**
 * Comment Repository
 * Handles all database operations for comment rewards
 */

import type { Context } from '@devvit/server/server-context';
import { BaseRepository } from './base.repository.js';
import type { CommentReward, CommentRewardCreate } from '../../shared/models/comment.types.js';
import { unwrapOr } from '../../shared/utils/result.js';

export class CommentRepository extends BaseRepository {
  private readonly TABLE = 'comment_rewards';

  constructor(context: Context) {
    super(context);
  }

  /**
   * Create a new comment reward record
   */
  async create(commentReward: CommentRewardCreate): Promise<CommentReward | null> {
    const result = await this.insert<CommentReward>(this.TABLE, commentReward);
    return unwrapOr(result, null);
  }

  /**
   * Find all comment rewards for a specific challenge
   */
  async findByChallenge(challengeId: string): Promise<CommentReward[]> {
    const result = await this.query<CommentReward>(this.TABLE, {
      filter: { challenge_id: `eq.${challengeId}` },
      order: 'created_at.desc',
    });
    return unwrapOr(result, []);
  }

  /**
   * Get the count of comments (rewards) for a challenge
   */
  async getCommentCount(challengeId: string): Promise<number> {
    const result = await this.count(this.TABLE, { challenge_id: challengeId });
    return unwrapOr(result, 0);
  }

  /**
   * Check if a comment has already been rewarded
   */
  async hasCommentBeenRewarded(commentId: string): Promise<boolean> {
    try {
      const config = await this.getSupabaseConfig();
      const url = `${config.url}/rest/v1/${this.TABLE}?comment_id=eq.${commentId}&select=id&limit=1`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Track comment reward atomically
   * Uses Postgres function to create reward and update creator profile in a single transaction
   */
  async trackCommentAtomic(
    challengeId: string,
    creatorId: string,
    commenterId: string,
    commentId: string,
    points: number,
    experience: number
  ): Promise<boolean> {
    const result = await this.executeBooleanFunction('track_comment_reward', {
      p_challenge_id: challengeId,
      p_creator_id: creatorId,
      p_commenter_id: commenterId,
      p_comment_id: commentId,
      p_points: points,
      p_experience: experience,
    });
    return unwrapOr(result, false);
  }

  /**
   * Get aggregated comment reward statistics for a creator
   * Uses Postgres function for efficient aggregation
   */
  async getCreatorStats(creatorId: string): Promise<{ totalComments: number; totalPoints: number; totalExp: number } | null> {
    type StatsResult = Array<{
      total_comments: string;
      total_points: string;
      total_exp: string;
    }>;

    const result = await this.executeFunction<StatsResult>('get_creator_comment_stats', {
      p_creator_id: creatorId,
    });

    const stats = unwrapOr(result, null);
    if (!stats || stats.length === 0) {
      return null;
    }

    // Convert bigint strings to numbers
    return {
      totalComments: parseInt(stats[0].total_comments, 10),
      totalPoints: parseInt(stats[0].total_points, 10),
      totalExp: parseInt(stats[0].total_exp, 10),
    };
  }
}
