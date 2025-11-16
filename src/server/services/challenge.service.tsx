/**
 * Challenge Service
 * Handles all business logic related to challenge creation, retrieval, and management
 */

import type { Context } from '@devvit/public-api';
import { Devvit } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from './user.service.js';
import { getCreationReward } from '../../shared/utils/reward-calculator.js';
import type { Challenge, ChallengeCreate, ChallengeFilters } from '../../shared/models/challenge.types.js';
import { createPaginatedResult, DEFAULT_PAGE_SIZE, type PaginatedResult } from '../../shared/utils/pagination.js';

export class ChallengeService extends BaseService {
  constructor(
    context: Context,
    private challengeRepo: ChallengeRepository,
    private userService: UserService
  ) {
    super(context);
  }

  /**
   * Create a new challenge with validation
   * Awards creation points (5pts/10exp) on success
   * Creates a Reddit post for the challenge
   */
  async createChallenge(challenge: ChallengeCreate): Promise<Challenge | null> {
    return this.withErrorHandling(
      async () => {
        // Validate required fields
        const validation = this.validateRequired(challenge, [
          'creator_id',
          'creator_username',
          'title',
          'image_url',
          'correct_answer',
          'tags',
        ]);
        
        if (!validation.isValid) {
          this.logError(
            'ChallengeService.createChallenge',
            `Missing required fields: ${validation.missingFields.join(', ')}`
          );
          return null;
        }
        
        // Validate image count (2-5 images)
        const imageUrls = challenge.image_url.split(',').map(url => url.trim()).filter(url => url.length > 0);
        if (imageUrls.length < 2 || imageUrls.length > 5) {
          this.logError(
            'ChallengeService.createChallenge',
            `Invalid image count: ${imageUrls.length}. Must be between 2 and 5.`
          );
          return null;
        }
        
        // Validate tags (at least one tag required)
        if (!challenge.tags || challenge.tags.length === 0) {
          this.logError(
            'ChallengeService.createChallenge',
            'At least one tag is required'
          );
          return null;
        }
        
        // Validate title length
        if (challenge.title.length < 3 || challenge.title.length > 200) {
          this.logError(
            'ChallengeService.createChallenge',
            `Invalid title length: ${challenge.title.length}. Must be between 3 and 200 characters.`
          );
          return null;
        }
        
        // Validate answer length
        if (challenge.correct_answer.length < 1 || challenge.correct_answer.length > 500) {
          this.logError(
            'ChallengeService.createChallenge',
            `Invalid answer length: ${challenge.correct_answer.length}. Must be between 1 and 500 characters.`
          );
          return null;
        }
        
        // Check rate limit (24-hour window)
        const rateLimitCheck = await this.userService.canCreateChallenge(challenge.creator_id);
        if (!rateLimitCheck.canCreate) {
          const hoursRemaining = Math.ceil(rateLimitCheck.timeRemaining / (1000 * 60 * 60));
          this.logError(
            'ChallengeService.createChallenge',
            `Rate limit exceeded. User must wait ${hoursRemaining} more hours.`
          );
          return null;
        }
        
        // Create the challenge in database with retry logic
        const createdChallenge = await this.withRetry(
          () => this.challengeRepo.create(challenge),
          {
            maxRetries: 3,
            exponentialBackoff: true,
            onRetry: (attempt, error) => {
              this.logWarning(
                'ChallengeService.createChallenge',
                `Database creation attempt ${attempt} failed: ${error.message}`
              );
            },
          }
        );
        
        if (!createdChallenge) {
          this.logError('ChallengeService.createChallenge', 'Failed to create challenge in database after retries');
          return null;
        }
        
        // Create Reddit post for the challenge
        const postId = await this.createRedditPost(createdChallenge);
        
        // Update challenge with post ID if post was created successfully
        if (postId) {
          const updateSuccess = await this.challengeRepo.update(createdChallenge.id, { reddit_post_id: postId });
          
          if (updateSuccess) {
            // Only update in-memory object if database update succeeded
            createdChallenge.reddit_post_id = postId;
            this.logInfo(
              'ChallengeService',
              `Reddit post created for challenge ${createdChallenge.id}: ${postId}`
            );
          } else {
            this.logError(
              'ChallengeService.createChallenge',
              `Failed to update challenge ${createdChallenge.id} with post ID ${postId}`
            );
            // Don't set reddit_post_id on the object to match database state
          }
        } else {
          this.logError(
            'ChallengeService.createChallenge',
            `Failed to create Reddit post for challenge ${createdChallenge.id}`
          );
          // Continue anyway - challenge is still valid without a post
        }
        
        // Award creation points and update statistics
        const reward = getCreationReward();
        await this.userService.awardPoints(
          challenge.creator_id,
          reward.points,
          reward.exp
        );
        
        // Update challenges created count and timestamp
        await this.userService.incrementChallengesCreated(challenge.creator_id);
        
        this.logInfo(
          'ChallengeService',
          `Challenge created by ${challenge.creator_username} (ID: ${createdChallenge.id})`
        );
        
        return createdChallenge;
      },
      'Failed to create challenge'
    );
  }

  /**
   * Update challenge with Reddit post ID
   * Used when post is created separately from challenge creation
   */
  async updateChallengePostId(challengeId: string, postId: string): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        const success = await this.challengeRepo.update(challengeId, { reddit_post_id: postId });
        
        if (success) {
          this.logInfo(
            'ChallengeService',
            `Updated challenge ${challengeId} with post ID ${postId}`
          );
        } else {
          this.logError(
            'ChallengeService.updateChallengePostId',
            `Failed to update challenge ${challengeId} with post ID`
          );
        }
        
        return success;
      },
      'Failed to update challenge post ID'
    );
  }

  /**
   * Create a Reddit post for a challenge
   * Returns the post ID if successful, null otherwise
   */
  private async createRedditPost(challenge: Challenge): Promise<string | null> {
    try {
      // Get subreddit name from context
      const subredditName = this.context.subredditName;
      
      if (!subredditName) {
        this.logError('ChallengeService.createRedditPost', 'No subreddit name available');
        return null;
      }
      
      // Format post title
      const postTitle = this.formatPostTitle(challenge);
      
      // Submit post to Reddit with preview
      const post = await this.context.reddit.submitPost({
        subredditName: subredditName,
        title: postTitle,
        preview: this.formatPostPreview(challenge),
      });
      
      return post.id;
    } catch (error) {
      this.logError('ChallengeService.createRedditPost', `Error creating Reddit post: ${error}`);
      return null;
    }
  }

  /**
   * Format the Reddit post title
   * Creates an engaging title with emojis and challenge info
   */
  private formatPostTitle(challenge: Challenge): string {
    // Add emoji based on first tag
    const tagEmojis: Record<string, string> = {
      anime: '🎌',
      general: '🎯',
      sport: '⚽',
      movies: '🎬',
      music: '🎵',
      gaming: '🎮',
      nature: '🌿',
      food: '🍕',
      technology: '💻',
      art: '🎨',
    };
    
    const emoji = challenge.tags[0] ? (tagEmojis[challenge.tags[0]] || '🎯') : '🎯';
    
    // Format: "🎯 [Challenge Title] by u/username"
    return `${emoji} ${challenge.title} by u/${challenge.creator_username}`;
  }

  /**
   * Format the Reddit post preview
   * Creates a preview block showing challenge details
   */
  private formatPostPreview(challenge: Challenge): JSX.Element {
    const imageCount = challenge.image_url.split(',').length;
    const tagText = challenge.tags.join(', ');
    
    return (
      <vstack padding="medium" gap="medium" backgroundColor="#F6F7F8">
        {/* Header */}
        <vstack gap="small">
          <text size="xxlarge" weight="bold" color="#FF4500">
            🎮 New Challenge Available!
          </text>
          <text size="large" weight="bold" color="#1c1c1c">
            {challenge.title}
          </text>
        </vstack>
        
        {/* Challenge info */}
        <vstack gap="small" padding="medium" backgroundColor="#FFFFFF" cornerRadius="medium">
          <hstack gap="small">
            <text size="medium" weight="bold" color="#0079D3">
              👤 Creator:
            </text>
            <text size="medium" color="#1c1c1c">
              u/{challenge.creator_username}
            </text>
          </hstack>
          
          <hstack gap="small">
            <text size="medium" weight="bold" color="#0079D3">
              🖼️ Images:
            </text>
            <text size="medium" color="#1c1c1c">
              {imageCount} hints to reveal
            </text>
          </hstack>
          
          <hstack gap="small">
            <text size="medium" weight="bold" color="#0079D3">
              🏷️ Tags:
            </text>
            <text size="medium" color="#1c1c1c">
              {tagText}
            </text>
          </hstack>
          
          {challenge.description && (
            <vstack gap="small">
              <text size="medium" weight="bold" color="#0079D3">
                📝 Description:
              </text>
              <text size="small" color="#666666">
                {challenge.description}
              </text>
            </vstack>
          )}
        </vstack>
        
        {/* Rewards info */}
        <vstack gap="small" padding="medium" backgroundColor="#E8F5E9" cornerRadius="medium">
          <text size="medium" weight="bold" color="#2E7D32">
            💰 Rewards
          </text>
          <text size="small" color="#1B5E20">
            • Solve with 1 image: 20 points, 10 exp
          </text>
          <text size="small" color="#1B5E20">
            • Solve with 2+ images: 10 points, 5 exp
          </text>
          <text size="small" color="#1B5E20">
            • Comment on this post: Creator gets 1 point, 1 exp
          </text>
        </vstack>
        
        {/* Call to action */}
        <vstack alignment="center middle" padding="medium">
          <text size="large" weight="bold" color="#FF4500">
            🎯 Click to Play!
          </text>
          <text size="small" color="#878a8c">
            Tap this post to start the challenge
          </text>
        </vstack>
      </vstack>
    );
  }

  /**
   * Get challenges with optional filters
   * Returns paginated results
   */
  async getChallenges(filters?: ChallengeFilters): Promise<Challenge[]> {
    const result = await this.withErrorHandling(
      async () => {
        return this.challengeRepo.findAll(filters);
      },
      'Failed to get challenges'
    );
    return result || [];
  }

  /**
   * Get challenges with pagination support
   * Returns paginated results with metadata
   */
  async getChallengesPaginated(
    filters?: ChallengeFilters,
    page: number = 1,
    pageSize: number = DEFAULT_PAGE_SIZE
  ): Promise<PaginatedResult<Challenge>> {
    const result = await this.withErrorHandling(
      async () => {
        // Calculate offset
        const limit = Math.max(1, Math.min(pageSize, 100));
        const offset = Math.max(0, (page - 1) * limit);
        
        // Fetch challenges with one extra to check if there are more
        const challenges = await this.challengeRepo.findAll({
          ...filters,
          limit: limit + 1,
          offset,
        });
        
        // Check if there are more results
        const hasMore = challenges.length > limit;
        const data = hasMore ? challenges.slice(0, limit) : challenges;
        
        return createPaginatedResult(data, limit, {
          currentOffset: offset,
        });
      },
      'Failed to get paginated challenges'
    );
    
    return result || createPaginatedResult([], pageSize);
  }

  /**
   * Get a single challenge by ID
   */
  async getChallengeById(id: string): Promise<Challenge | null> {
    return this.withErrorHandling(
      async () => {
        return this.challengeRepo.findById(id);
      },
      'Failed to get challenge by ID'
    );
  }

  /**
   * Get a single challenge by Reddit post ID
   */
  async getChallengeByPostId(postId: string): Promise<Challenge | null> {
    return this.withErrorHandling(
      async () => {
        return this.challengeRepo.findByPostId(postId);
      },
      'Failed to get challenge by post ID'
    );
  }

  /**
   * Get all challenges created by a specific user
   */
  async getChallengesByCreator(creatorId: string): Promise<Challenge[]> {
    const result = await this.withErrorHandling(
      async () => {
        return this.challengeRepo.findByCreator(creatorId);
      },
      'Failed to get challenges by creator'
    );
    return result || [];
  }

  /**
   * Upload challenge images to storage
   * This is a placeholder - actual implementation depends on storage solution
   * For now, assumes images are already uploaded and URLs are provided
   */
  async uploadChallengeImages(imageUrls: string[]): Promise<string[]> {
    const result = await this.withErrorHandling(
      async () => {
        // Validate image count
        if (imageUrls.length < 2 || imageUrls.length > 5) {
          this.logError(
            'ChallengeService.uploadChallengeImages',
            `Invalid image count: ${imageUrls.length}. Must be between 2 and 5.`
          );
          return [];
        }
        
        // Validate URLs
        const validUrls = imageUrls.filter(url => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        });
        
        if (validUrls.length !== imageUrls.length) {
          this.logError(
            'ChallengeService.uploadChallengeImages',
            'Some image URLs are invalid'
          );
        }
        
        return validUrls;
      },
      'Failed to upload challenge images'
    );
    return result || [];
  }

  /**
   * Delete a challenge with ownership check
   * Only the creator can delete their own challenges
   */
  async deleteChallenge(id: string, userId: string): Promise<boolean> {
    return this.withBooleanErrorHandling(
      async () => {
        // Get the challenge to verify ownership
        const challenge = await this.challengeRepo.findById(id);
        
        if (!challenge) {
          this.logError('ChallengeService.deleteChallenge', `Challenge ${id} not found`);
          return false;
        }
        
        // Verify ownership
        if (challenge.creator_id !== userId) {
          this.logError(
            'ChallengeService.deleteChallenge',
            `User ${userId} is not the creator of challenge ${id}`
          );
          return false;
        }
        
        // Delete the challenge
        const success = await this.challengeRepo.deleteChallenge(id);
        
        if (success) {
          this.logInfo('ChallengeService', `Challenge ${id} deleted by user ${userId}`);
        }
        
        return success;
      },
      'Failed to delete challenge'
    );
  }

  /**
   * Validate challenge data before creation
   * Returns validation errors if any
   */
  validateChallengeData(challenge: ChallengeCreate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    if (!challenge.title || challenge.title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    if (!challenge.correct_answer || challenge.correct_answer.trim().length === 0) {
      errors.push('Answer is required');
    }
    
    if (!challenge.image_url || challenge.image_url.trim().length === 0) {
      errors.push('At least one image is required');
    }
    
    if (!challenge.tags || challenge.tags.length === 0) {
      errors.push('At least one tag is required');
    }
    
    // Check field lengths
    if (challenge.title && (challenge.title.length < 3 || challenge.title.length > 200)) {
      errors.push('Title must be between 3 and 200 characters');
    }
    
    if (challenge.correct_answer && (challenge.correct_answer.length < 1 || challenge.correct_answer.length > 500)) {
      errors.push('Answer must be between 1 and 500 characters');
    }
    
    if (challenge.description && challenge.description.length > 1000) {
      errors.push('Description must be less than 1000 characters');
    }
    
    // Check image count
    if (challenge.image_url) {
      const imageUrls = challenge.image_url.split(',').map(url => url.trim()).filter(url => url.length > 0);
      if (imageUrls.length < 2) {
        errors.push('At least 2 images are required');
      }
      if (imageUrls.length > 5) {
        errors.push('Maximum 5 images allowed');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
