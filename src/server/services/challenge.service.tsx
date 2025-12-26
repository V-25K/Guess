/**
* Challenge Service
* Handles all business logic related to challenge creation, retrieval, and management
* 
* Requirements: 1.3, 5.2, 8.1
*/

import type { Context } from '@devvit/server/server-context';
import { reddit } from '@devvit/web/server';
import { Devvit } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from './user.service.js';
import { AnswerSetGeneratorService, type AnswerSet } from './answer-set-generator.service.js';
import { getCreationReward } from '../../shared/utils/reward-calculator.js';
import type { Challenge, ChallengeCreate, ChallengeFilters } from '../../shared/models/challenge.types.js';
import { createPaginatedResult, DEFAULT_PAGE_SIZE, type PaginatedResult } from '../../shared/utils/pagination.js';
import { RedisCache } from '../utils/redis-cache.js';
import { TTL } from './cache.service.js';
import { BG_PRIMARY } from '../../client/constants/colors.js';
import type { Result } from '../../shared/utils/result.js';
import { ok, err, isOk } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { validationError, rateLimitError, databaseError, internalError } from '../../shared/models/errors.js';
import { tryCatch } from '../../shared/utils/result-adapters.js';

/** Cache key for challenge feed - shared across all users */
export const FEED_CACHE_KEY = 'feed:challenges';

/** TTL for challenge feed cache (30 seconds) - Requirements: 8.1 */
export const FEED_CACHE_TTL = TTL.CHALLENGE_FEED;

export class ChallengeService extends BaseService {
  private feedCache: RedisCache;
  private answerSetGenerator: AnswerSetGeneratorService;

  constructor(
    context: Context,
    private challengeRepo: ChallengeRepository,
    private userService: UserService
  ) {
    super(context);
    this.feedCache = new RedisCache();
    this.answerSetGenerator = new AnswerSetGeneratorService(context);
  }

  /**
   * Create a new challenge with validation
   * Awards creation points (5pts/10exp) on success
   * Creates a Reddit post for the challenge
   */
  async createChallenge(challenge: ChallengeCreate): Promise<Result<Challenge, AppError>> {
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
      return err(validationError(
        validation.missingFields.map(field => ({ field, message: 'Field is required' }))
      ));
    }

    // Validate image count (2-3 images)
    const imageUrls = challenge.image_url.split(',').map(url => url.trim()).filter(url => url.length > 0);
    if (imageUrls.length < 2 || imageUrls.length > 3) {
      this.logError(
        'ChallengeService.createChallenge',
        `Invalid image count: ${imageUrls.length}. Must be between 2 and 3.`
      );
      return err(validationError([
        { field: 'image_url', message: `Must have between 2 and 3 images, got ${imageUrls.length}` }
      ]));
    }

    // Validate tags (at least one theme required)
    if (!challenge.tags || challenge.tags.length === 0) {
      this.logError(
        'ChallengeService.createChallenge',
        'At least one theme is required'
      );
      return err(validationError([
        { field: 'tags', message: 'At least one theme is required' }
      ]));
    }

    // Validate title length
    if (challenge.title.length < 3 || challenge.title.length > 200) {
      this.logError(
        'ChallengeService.createChallenge',
        `Invalid title length: ${challenge.title.length}. Must be between 3 and 200 characters.`
      );
      return err(validationError([
        { field: 'title', message: `Must be between 3 and 200 characters, got ${challenge.title.length}` }
      ]));
    }

    // Validate answer length
    if (challenge.correct_answer.length < 1 || challenge.correct_answer.length > 500) {
      this.logError(
        'ChallengeService.createChallenge',
        `Invalid answer length: ${challenge.correct_answer.length}. Must be between 1 and 500 characters.`
      );
      return err(validationError([
        { field: 'correct_answer', message: `Must be between 1 and 500 characters, got ${challenge.correct_answer.length}` }
      ]));
    }

    // Check rate limit (24-hour window)
    const rateLimitCheckResult = await this.userService.canCreateChallenge(challenge.creator_id);
    if (!isOk(rateLimitCheckResult)) {
      return err(rateLimitCheckResult.error);
    }

    const rateLimitCheck = rateLimitCheckResult.value;
    if (!rateLimitCheck.canCreate) {
      const hoursRemaining = Math.ceil(rateLimitCheck.timeRemaining / (1000 * 60 * 60));
      this.logError(
        'ChallengeService.createChallenge',
        `Rate limit exceeded. User must wait ${hoursRemaining} more hours.`
      );
      return err(rateLimitError(rateLimitCheck.timeRemaining));
    }

    // Generate answer sets using AI if not provided by client (e.g. from preview step)
    if (challenge.answer_set) {
      this.logInfo('ChallengeService.createChallenge', 'Using client-provided answer set');
    } else {
      try {
        this.logInfo('ChallengeService.createChallenge', 'Generating answer sets with AI...');
        const answerSet = await this.answerSetGenerator.generateAnswerSet(challenge);

        // Add answer_set to challenge
        challenge.answer_set = answerSet;

        this.logInfo(
          'ChallengeService.createChallenge',
          `Answer set generated: ${answerSet.correct.length} correct, ${answerSet.close.length} close answers`
        );
      } catch (error) {
        this.logWarning(
          'ChallengeService.createChallenge',
          `Answer set generation failed: ${error instanceof Error ? error.message : String(error)}. Using fallback.`
        );
        // Use fallback answer set
        challenge.answer_set = this.answerSetGenerator.getFallbackAnswerSet(challenge);
      }
    }

    // Create the challenge in database with retry logic
    const createdChallengeResult = await this.withRetry(
      () => this.challengeRepo.create(challenge),
      {
        maxRetries: 3,
        exponentialBackoff: true,
        onRetry: (attempt, error) => {
          this.logWarning(
            'ChallengeService.createChallenge',
            `Database creation attempt ${attempt} failed: ${JSON.stringify(error)}`
          );
        },
      }
    );

    if (!isOk(createdChallengeResult)) {
      this.logError('ChallengeService.createChallenge', 'Failed to create challenge in database after retries');
      return err(createdChallengeResult.error);
    }

    const createdChallenge = createdChallengeResult.value;

    // Note: Reddit post creation is handled separately to avoid ServerCallRequired errors
    // The post will be created by the client after successful challenge creation

    // Award creation points and update statistics
    const reward = getCreationReward();
    const awardResult = await this.userService.awardPoints(
      challenge.creator_id,
      reward.points,
      reward.exp
    );

    // Log but don't fail if awarding points fails
    if (!isOk(awardResult)) {
      this.logError('ChallengeService.createChallenge', `Failed to award points: ${JSON.stringify(awardResult.error)}`);
    }

    // Update challenges created count and timestamp
    const incrementResult = await this.userService.incrementChallengesCreated(challenge.creator_id);
    
    // Log but don't fail if incrementing count fails
    if (!isOk(incrementResult)) {
      this.logError('ChallengeService.createChallenge', `Failed to increment challenges created: ${JSON.stringify(incrementResult.error)}`);
    }

    this.logInfo(
      'ChallengeService',
      `Challenge created by ${challenge.creator_username} (ID: ${createdChallenge.id})`
    );

    // Invalidate feed cache
    await this.invalidateFeedCache();

    return ok(createdChallenge);
  }

  /**
   * Generate answer set preview for user review
   * Does NOT save to database
   */
  async generateAnswerSetPreview(challenge: ChallengeCreate): Promise<Result<AnswerSet, AppError>> {
    return tryCatch(
      async () => {
        this.logInfo('ChallengeService.generateAnswerSetPreview', 'Generating preview...');
        return await this.answerSetGenerator.generateAnswerSet(challenge);
      },
      (error) => internalError('Failed to generate answer set preview', error)
    );
  }

  /**
   * Update challenge with Reddit post ID
   * Used when post is created separately from challenge creation
   */
  async updateChallengePostId(challengeId: string, postId: string): Promise<Result<boolean, AppError>> {
    const result = await this.challengeRepo.update(challengeId, { reddit_post_id: postId });

    if (isOk(result) && result.value) {
      this.logInfo(
        'ChallengeService',
        `Updated challenge ${challengeId} with post ID ${postId}`
      );
    } else if (isOk(result)) {
      this.logError(
        'ChallengeService.updateChallengePostId',
        `Failed to update challenge ${challengeId} with post ID`
      );
    }

    return result;
  }

  /**
   * Create a Reddit post for a challenge
   * This should be called from a proper async context (not from within form handlers)
   * Returns the post ID if successful, null otherwise
   */
  async createRedditPostForChallenge(challengeId: string): Promise<Result<string | null, AppError>> {
    return tryCatch(
      async () => {
        const challengeResult = await this.challengeRepo.findById(challengeId);
        if (!isOk(challengeResult)) {
          throw new Error(`Failed to fetch challenge: ${JSON.stringify(challengeResult.error)}`);
        }

        const challenge = challengeResult.value;
        if (!challenge) {
          this.logError('ChallengeService.createRedditPostForChallenge', `Challenge ${challengeId} not found`);
          return null;
        }

        const postId = await this.createRedditPost(challenge);

        if (postId) {
          const updateResult = await this.challengeRepo.update(challenge.id, { reddit_post_id: postId });

          if (isOk(updateResult) && updateResult.value) {
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
      (error) => internalError('Failed to create Reddit post for challenge', error)
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

      // Create a custom post with the webview, passing challenge ID as post data
      // openDirectly: true tells the client to load this challenge immediately
      const post = await reddit.submitCustomPost({
        subredditName,
        title: postTitle,
        entry: 'default',
        postData: {
          challengeId: challenge.id,
          openDirectly: true,
        },
      });

      this.logInfo('ChallengeService.createRedditPost', `Created Reddit post ${post.id} for challenge ${challenge.id}`);
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
        backgroundColor={BG_PRIMARY}
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
  async getChallenges(filters?: ChallengeFilters): Promise<Result<Challenge[], AppError>> {
    return tryCatch(
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
        const challengesResult = await this.challengeRepo.findAll(filters);
        if (!isOk(challengesResult)) {
          throw new Error(`Failed to fetch challenges: ${JSON.stringify(challengesResult.error)}`);
        }
        return challengesResult.value;
      },
      (error) => databaseError('getChallenges', String(error))
    );
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
      // Try to get from cache first
      const cached = await this.feedCache.get<Challenge[]>(FEED_CACHE_KEY);
      if (cached) {
        this.logInfo('ChallengeService', 'Returning feed from Redis cache');
        return cached;
      }

      // Cache miss - fetch from database
      this.logInfo('ChallengeService', 'Cache miss - fetching feed from database');
      const challengesResult = await this.challengeRepo.findAll();
      
      if (!isOk(challengesResult)) {
        this.logError('ChallengeService.getCachedFeed', challengesResult.error);
        return null;
      }

      const challenges = challengesResult.value;
      
      // Store in cache
      await this.feedCache.set(FEED_CACHE_KEY, challenges, FEED_CACHE_TTL);
      
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
  ): Promise<Result<PaginatedResult<Challenge>, AppError>> {
    return tryCatch(
      async () => {
        // Calculate offset
        const limit = Math.max(1, Math.min(pageSize, 100));
        const offset = Math.max(0, (page - 1) * limit);

        // Fetch challenges with one extra to check if there are more
        const challengesResult = await this.challengeRepo.findAll({
          ...filters,
          limit: limit + 1,
          offset,
        });

        if (!isOk(challengesResult)) {
          throw new Error(`Failed to fetch challenges: ${JSON.stringify(challengesResult.error)}`);
        }

        const challenges = challengesResult.value;

        // Check if there are more results
        const hasMore = challenges.length > limit;
        const data = hasMore ? challenges.slice(0, limit) : challenges;

        return createPaginatedResult(data, limit, {
          currentOffset: offset,
        });
      },
      (error) => databaseError('getChallengesPaginated', String(error))
    );
  }

  /**
   * Get a single challenge by ID
   */
  async getChallengeById(id: string): Promise<Result<Challenge | null, AppError>> {
    return this.challengeRepo.findById(id);
  }

  /**
   * Get a single challenge by Reddit post ID
   */
  async getChallengeByPostId(postId: string): Promise<Result<Challenge | null, AppError>> {
    return this.challengeRepo.findByPostId(postId);
  }

  /**
   * Get all challenges created by a specific user
   */
  async getChallengesByCreator(creatorId: string): Promise<Result<Challenge[], AppError>> {
    return this.challengeRepo.findByCreator(creatorId);
  }

  /**
   * Upload challenge images to storage
   * This is a placeholder - actual implementation depends on storage solution
   * For now, assumes images are already uploaded and URLs are provided
   */
  async uploadChallengeImages(imageUrls: string[]): Promise<Result<string[], AppError>> {
    // Validate image count
    if (imageUrls.length < 2 || imageUrls.length > 3) {
      this.logError(
        'ChallengeService.uploadChallengeImages',
        `Invalid image count: ${imageUrls.length}. Must be between 2 and 3.`
      );
      return err(validationError([
        { field: 'imageUrls', message: `Must have between 2 and 3 images, got ${imageUrls.length}` }
      ]));
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
      return err(validationError([
        { field: 'imageUrls', message: 'Some image URLs are invalid' }
      ]));
    }

    return ok(validUrls);
  }

  /**
   * Delete a challenge with ownership check
   * Only the creator can delete their own challenges
   */
  async deleteChallenge(id: string, userId: string): Promise<Result<boolean, AppError>> {
    // Get the challenge to verify ownership
    const challengeResult = await this.challengeRepo.findById(id);

    if (!isOk(challengeResult)) {
      return err(challengeResult.error);
    }

    const challenge = challengeResult.value;
    if (!challenge) {
      this.logError('ChallengeService.deleteChallenge', `Challenge ${id} not found`);
      return err(validationError([
        { field: 'id', message: `Challenge ${id} not found` }
      ]));
    }

    // Verify ownership
    if (challenge.creator_id !== userId) {
      this.logError(
        'ChallengeService.deleteChallenge',
        `User ${userId} is not the creator of challenge ${id}`
      );
      return err(validationError([
        { field: 'userId', message: 'User is not the creator of this challenge' }
      ]));
    }

    // Delete the challenge
    const deleteResult = await this.challengeRepo.deleteChallenge(id);

    if (isOk(deleteResult) && deleteResult.value) {
      this.logInfo('ChallengeService', `Challenge ${id} deleted by user ${userId}`);
    }

    return deleteResult;
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
      errors.push('At least one theme is required');
    }

    // Check field lengths
    if (challenge.title && (challenge.title.length < 3 || challenge.title.length > 200)) {
      errors.push('Title must be between 3 and 200 characters');
    }

    if (challenge.correct_answer && (challenge.correct_answer.length < 1 || challenge.correct_answer.length > 500)) {
      errors.push('Answer must be between 1 and 500 characters');
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
