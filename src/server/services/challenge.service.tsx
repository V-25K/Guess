/**
* Challenge Service
* Handles all business logic related to challenge creation, retrieval, and management
* 
* Requirements: 1.3, 5.2, 8.1
*/

import type { Context, JSONValue } from '@devvit/public-api';
import { Devvit } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from './user.service.js';
import { getCreationReward } from '../../shared/utils/reward-calculator.js';
import type { Challenge, ChallengeCreate, ChallengeFilters } from '../../shared/models/challenge.types.js';
import { createPaginatedResult, DEFAULT_PAGE_SIZE, type PaginatedResult } from '../../shared/utils/pagination.js';
import { RedisCache } from '../utils/redis-cache.js';
import { TTL } from './cache.service.js';

/** Cache key for challenge feed - shared across all users */
export const FEED_CACHE_KEY = 'feed:challenges';

/** TTL for challenge feed cache (30 seconds) - Requirements: 8.1 */
export const FEED_CACHE_TTL = TTL.CHALLENGE_FEED;

export class ChallengeService extends BaseService {
  private feedCache: RedisCache;

  constructor(
    context: Context,
    private challengeRepo: ChallengeRepository,
    private userService: UserService
  ) {
    super(context);
    this.feedCache = new RedisCache(context.redis);
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

        // Validate image count (2-3 images)
        const imageUrls = challenge.image_url.split(',').map(url => url.trim()).filter(url => url.length > 0);
        if (imageUrls.length < 2 || imageUrls.length > 3) {
          this.logError(
            'ChallengeService.createChallenge',
            `Invalid image count: ${imageUrls.length}. Must be between 2 and 3.`
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

        // Note: Reddit post creation is handled separately to avoid ServerCallRequired errors
        // The post will be created by the client after successful challenge creation

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

        // Invalidate feed cache
        await this.invalidateFeedCache();

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
   * This should be called from a proper async context (not from within form handlers)
   * Returns the post ID if successful, null otherwise
   */
  async createRedditPostForChallenge(challengeId: string): Promise<string | null> {
    return this.withErrorHandling(
      async () => {
        const challenge = await this.challengeRepo.findById(challengeId);
        if (!challenge) {
          this.logError('ChallengeService.createRedditPostForChallenge', `Challenge ${challengeId} not found`);
          return null;
        }

        const postId = await this.createRedditPost(challenge);

        if (postId) {
          const updateSuccess = await this.challengeRepo.update(challenge.id, { reddit_post_id: postId });

          if (updateSuccess) {
            this.logInfo(
              'ChallengeService',
              `Reddit post created for challenge ${challenge.id}: ${postId}`
            );
          } else {
            this.logError(
              'ChallengeService.createRedditPostForChallenge',
              `Failed to update challenge ${challenge.id} with post ID ${postId}`
            );
          }
        }

        return postId;
      },
      'Failed to create Reddit post for challenge'
    );
  }

  /**
   * Create a Reddit post for a challenge (internal helper)
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

      // Submit post to Reddit with preview and challenge ID in postData
      const post = await this.context.reddit.submitPost({
        subredditName: subredditName,
        title: postTitle,
        preview: this.formatPostPreview(challenge),
        postData: {
          challengeId: challenge.id,
          openDirectly: true,
        },
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

    // Format: "🎯 [Challenge Title] by u/username"
    return `$${challenge.title}`;
  }

  /**
   * Format the Reddit post preview
   * Creates a simple loading preview - the actual challenge opens directly
   */
  private formatPostPreview(challenge: Challenge): JSX.Element {
    return (
      <vstack
        width="100%"
        height="100%"
        alignment="center middle"
        backgroundColor="#F6F7F8"
        padding="large"
        gap="medium"
      >
        <image
          url="logo.png"
          imageHeight={100}
          imageWidth={240}
          resizeMode="fit"
        />
        <text size="medium" color="#878a8c" alignment="center">
          by u/{challenge.creator_username}
        </text>
        <spacer size="medium" />
        <text size="small" color="#666666" alignment="center">
          Loading challenge...
        </text>
      </vstack>
    );
  }

  /**
   * Get challenges with optional filters
   * Returns paginated results
   * Uses context.cache() for main feed (no filters) - shared across all users
   * 
   * Requirements: 1.3, 8.1
   */
  async getChallenges(filters?: ChallengeFilters): Promise<Challenge[]> {
    const result = await this.withErrorHandling(
      async () => {
        // Only use context.cache() if no filters are applied (main feed)
        // This is non-personalized data safe to share across all users (Requirement 8.2)
        const isMainFeed = !filters || Object.keys(filters).length === 0;

        if (isMainFeed) {
          // Use context.cache() for shared feed data (Requirement 8.1)
          // Key: 'feed:challenges', TTL: 30 seconds
          const cachedFeed = await this.getCachedFeed();
          if (cachedFeed !== null) {
            return cachedFeed;
          }
        }

        // Fetch from database if not cached or filters applied
        const challenges = await this.challengeRepo.findAll(filters);
        return challenges;
      },
      'Failed to get challenges'
    );

    return result || [];
  }

  /**
   * Get cached challenge feed using context.cache()
   * 
   * Uses Devvit's context.cache() helper which combines Redis with local
   * in-memory write-through cache. Returns cached feed for all users within TTL.
   * Cache refresh happens transparently when one user makes the real request.
   * 
   * Requirements: 1.3, 8.1, 8.3
   * 
   * @returns Cached challenges or null on error
   */
  async getCachedFeed(): Promise<Challenge[] | null> {
    try {
      const challenges = await this.context.cache<Challenge[]>(
        async () => {
          this.logInfo('ChallengeService', 'Cache miss - fetching feed from database');
          const data = await this.challengeRepo.findAll();
          return data as unknown as JSONValue as Challenge[];
        },
        {
          key: FEED_CACHE_KEY,
          ttl: FEED_CACHE_TTL,
        }
      );

      this.logInfo('ChallengeService', 'Returning feed from context.cache()');
      return challenges;
    } catch (error) {
      // Return null as fallback on error (Requirement 8.3)
      this.logError('ChallengeService.getCachedFeed', error);
      return null;
    }
  }
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
        if (imageUrls.length < 2 || imageUrls.length > 3) {
          this.logError(
            'ChallengeService.uploadChallengeImages',
            `Invalid image count: ${imageUrls.length}. Must be between 2 and 3.`
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
      if (imageUrls.length > 3) {
        errors.push('Maximum 3 images allowed');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  /**
   * Invalidate the feed cache
   */
  async invalidateFeedCache(): Promise<void> {
    try {
      await this.feedCache.delete('feed:all');
      this.logInfo('ChallengeService', 'Invalidated feed cache');
    } catch (error) {
      this.logError('ChallengeService.invalidateFeedCache', error);
    }
  }
}
