/**
 * Comment Service
 * Handles all business logic related to comment tracking and creator rewards
 */

import type { Context } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { UserService } from './user.service.js';
import { getCommentReward } from '../../shared/utils/reward-calculator.js';
import type { CommentReward, CommentRewardCreate } from '../../shared/models/comment.types.js';

export class CommentService extends BaseService {
  constructor(
    context: Context,
    private commentRepo: CommentRepository,
    private userService: UserService
  ) {
    super(context);
  }

  /**
   * Track a comment and award the challenge creator
   * Prevents duplicate rewards and self-commenting rewards
   * Uses atomic database function to ensure data consistency
   */
  async trackComment(
    challengeId: string,
    commentId: string,
    commenterId: string,
    creatorId: string
  ): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        const reward = getCommentReward();
        
        const success = await this.withRetry(
          () => this.commentRepo.trackCommentAtomic(
            challengeId,
            creatorId,
            commenterId,
            commentId,
            reward.points,
            reward.exp
          ),
          {
            maxRetries: 3,
            exponentialBackoff: true,
            onRetry: (attemptNum, error) => {
              this.logWarning(
                'CommentService.trackComment',
                `Atomic comment tracking retry ${attemptNum}: ${error.message}`
              );
            },
          }
        );
        
        if (success) {
          this.userService.invalidateUserCache(creatorId);
          
          this.logInfo(
            'CommentService',
            `Awarded ${reward.points} points and ${reward.exp} exp to creator ${creatorId} for comment ${commentId}`
          );
        } else {
          this.logInfo(
            'CommentService',
            `Comment ${commentId} was not rewarded (duplicate or self-comment)`
          );
        }
        
        return success;
      },
      'Failed to track comment'
    );
  }

  /**
   * Award comment reward to challenge creator
   * Awards 1pt/1exp per comment
   */
  async awardCommentReward(creatorId: string, points: number, experience: number): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        const success = await this.userService.awardPoints(creatorId, points, experience);
        
        if (success) {
          this.logInfo(
            'CommentService',
            `Awarded ${points} points and ${experience} exp to creator ${creatorId}`
          );
        }
        
        return success;
      },
      'Failed to award comment reward'
    );
  }

  /**
   * Get the count of comments (rewards) for a challenge
   */
  async getCommentCount(challengeId: string): Promise<number> {
    try {
      return await this.commentRepo.getCommentCount(challengeId);
    } catch (error) {
      this.logError('CommentService.getCommentCount', error);
      return 0;
    }
  }

  /**
   * Get all comment rewards for a specific challenge
   */
  async getChallengeComments(challengeId: string): Promise<CommentReward[]> {
    const result = await this.withErrorHandling(
      async () => {
        return this.commentRepo.findByChallenge(challengeId);
      },
      'Failed to get challenge comments'
    );
    return result || [];
  }

  /**
   * Check if a comment has already been rewarded
   */
  async hasCommentBeenRewarded(commentId: string): Promise<boolean> {
    try {
      return await this.commentRepo.hasCommentBeenRewarded(commentId);
    } catch (error) {
      this.logError('CommentService.hasCommentBeenRewarded', error);
      return false;
    }
  }

  /**
   * Get total comment rewards earned by a creator
   * Useful for displaying creator statistics
   */
  async getCreatorCommentRewards(creatorId: string): Promise<{ totalComments: number; totalPoints: number; totalExp: number }> {
    try {
      const stats = await this.commentRepo.getCreatorStats(creatorId);
      
      return {
        totalComments: stats?.totalComments || 0,
        totalPoints: stats?.totalPoints || 0,
        totalExp: stats?.totalExp || 0,
      };
    } catch (error) {
      this.logError('CommentService.getCreatorCommentRewards', error);
      return {
        totalComments: 0,
        totalPoints: 0,
        totalExp: 0,
      };
    }
  }
}
