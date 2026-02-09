/**
 * Subscription Service
 * Handles subreddit subscription logic with Redis caching and database persistence
 * 
 * This service implements a dual-storage approach:
 * - Redis: Fast access and caching (with TTL)
 * - Database: Persistent storage and source of truth
 */

import type { Context } from '@devvit/server/server-context';
import { BaseService } from './base.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { UserService } from './user.service.js';
import type { Result } from '../../shared/utils/result.js';
import { isOk } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { databaseError, internalError } from '../../shared/models/errors.js';
import { tryCatch } from '../../shared/utils/result-adapters.js';
import { reddit } from '@devvit/web/server';

export type SubscriptionStatus = {
  isSubscribed: boolean;
  subscribedAt: string | null;
  source: 'redis' | 'database' | 'unknown';
};

export type SubscriptionResult = {
  success: boolean;
  isSubscribed: boolean;
  message: string;
  wasAlreadySubscribed?: boolean;
};

export class SubscriptionService extends BaseService {
  private static readonly REDIS_KEY_PREFIX = 'subscription:';
  private static readonly REDIS_TTL = 86400 * 7; // 7 days
  private static readonly REDIS_LOCK_TTL = 30; // 30 seconds for locks

  constructor(
    context: Context,
    private userRepo: UserRepository,
    private userService: UserService
  ) {
    super(context);
  }

  /**
   * Get Redis client from context
   * Uses type assertion since Context type might not include redis property
   */
  private get redis() {
    const redisClient = (this.context as any).redis;
    if (!redisClient) {
      this.logWarning('SubscriptionService', 'Redis client not available in context');
    }
    return redisClient;
  }

  /**
   * Get Redis key for user subscription status
   */
  private getRedisKey(userId: string): string {
    return `${SubscriptionService.REDIS_KEY_PREFIX}${userId}`;
  }

  /**
   * Get Redis lock key for subscription operations
   */
  private getLockKey(userId: string): string {
    return `${SubscriptionService.REDIS_KEY_PREFIX}lock:${userId}`;
  }

  /**
   * Check if user is subscribed to the current subreddit
   * Uses Redis cache first, falls back to database
   */
  async getSubscriptionStatus(userId: string): Promise<Result<SubscriptionStatus, AppError>> {
    return tryCatch(
      async () => {
        // First check Redis cache
        try {
          const redisClient = this.redis;
          if (redisClient) {
            const redisValue = await redisClient.get(this.getRedisKey(userId));
            if (redisValue !== null) {
              const cached = JSON.parse(redisValue);
              return {
                isSubscribed: cached.isSubscribed,
                subscribedAt: cached.subscribedAt,
                source: 'redis' as const,
              };
            }
          } else {
            this.logWarning('SubscriptionService.getSubscriptionStatus', 'Redis not available, skipping cache');
          }
        } catch (error) {
          this.logWarning('SubscriptionService.getSubscriptionStatus', `Redis cache miss: ${String(error)}`);
        }

        // Fallback to database
        const userResult = await this.userService.getUserProfile(userId);
        if (!isOk(userResult)) {
          // Try guest profile if regular user not found
          const guestResult = await this.userService.getGuestProfile(userId);
          if (!isOk(guestResult) || !guestResult.value) {
            return {
              isSubscribed: false,
              subscribedAt: null,
              source: 'unknown' as const,
            };
          }
          
          const guestProfile = guestResult.value;
          
          // Cache the result in Redis
          await this.cacheSubscriptionStatus(userId, guestProfile.is_subscribed, guestProfile.subscribed_at);
          
          return {
            isSubscribed: guestProfile.is_subscribed,
            subscribedAt: guestProfile.subscribed_at,
            source: 'database' as const,
          };
        }

        const userProfile = userResult.value;
        if (!userProfile) {
          return {
            isSubscribed: false,
            subscribedAt: null,
            source: 'unknown' as const,
          };
        }

        // Cache the result in Redis
        await this.cacheSubscriptionStatus(userId, userProfile.is_subscribed, userProfile.subscribed_at);

        return {
          isSubscribed: userProfile.is_subscribed,
          subscribedAt: userProfile.subscribed_at,
          source: 'database' as const,
        };
      },
      (error) => internalError('Failed to get subscription status', error)
    );
  }

  /**
   * Subscribe user to the current subreddit
   * Handles both authenticated and guest users
   */
  async subscribeToSubreddit(userId: string): Promise<Result<SubscriptionResult, AppError>> {
    return tryCatch(
      async () => {
        // Acquire lock to prevent concurrent subscription attempts
        const lockKey = this.getLockKey(userId);
        let lockAcquired = false;
        
        try {
          const redisClient = this.redis;
          if (redisClient) {
            lockAcquired = await redisClient.set(
              lockKey, 
              'locked', 
              { EX: SubscriptionService.REDIS_LOCK_TTL, NX: true }
            );
          } else {
            this.logWarning('SubscriptionService.subscribeToSubreddit', 'Redis not available, proceeding without lock');
            lockAcquired = true; // Proceed without lock if Redis is not available
          }
        } catch (error) {
          this.logWarning('SubscriptionService.subscribeToSubreddit', `Failed to acquire Redis lock: ${String(error)}`);
          lockAcquired = true; // Proceed without lock if Redis fails
        }

        if (!lockAcquired) {
          return {
            success: false,
            isSubscribed: false,
            message: 'Subscription operation in progress, please try again',
          };
        }

        try {
          // Check current subscription status
          const statusResult = await this.getSubscriptionStatus(userId);
          if (isOk(statusResult) && statusResult.value.isSubscribed) {
            return {
              success: true,
              isSubscribed: true,
              message: 'Already subscribed to community',
              wasAlreadySubscribed: true,
            };
          }

          // Attempt to subscribe via Reddit API
          let subscriptionSuccessful = false;
          let errorMessage = '';

          try {
            // Check if we have the necessary context and permissions
            if (!this.context) {
              throw new Error('Context not available');
            }

            // Attempt the subscription
            await reddit.subscribeToCurrentSubreddit();
            subscriptionSuccessful = true;
            this.logInfo('SubscriptionService', `Reddit API subscription successful for user ${userId}`);
          } catch (error) {
            const errorStr = String(error);
            this.logError('SubscriptionService.subscribeToSubreddit', `Reddit API error: ${errorStr}`);
            
            // Check if error indicates user is already subscribed
            if (
              errorStr.includes('already subscribed') ||
              errorStr.includes('SUBREDDIT_ALREADY_SUBSCRIBED') ||
              errorStr.includes('USER_ALREADY_SUBSCRIBED')
            ) {
              subscriptionSuccessful = true;
              this.logInfo('SubscriptionService', `User ${userId} was already subscribed`);
            } else if (
              errorStr.includes('permission') ||
              errorStr.includes('unauthorized') ||
              errorStr.includes('forbidden')
            ) {
              errorMessage = 'Permission denied. Please make sure you are logged in to Reddit.';
            } else if (
              errorStr.includes('network') ||
              errorStr.includes('timeout') ||
              errorStr.includes('connection')
            ) {
              errorMessage = 'Network error. Please check your connection and try again.';
            } else {
              errorMessage = 'Unable to subscribe to community. Please try again later.';
            }
          }

          if (!subscriptionSuccessful) {
            // If Reddit API failed, we can still track the subscription intent in our database
            // This allows users to see they've "joined" even if Reddit API is having issues
            this.logWarning('SubscriptionService.subscribeToSubreddit', 
              `Reddit API failed for user ${userId}, but tracking subscription intent: ${errorMessage}`);
            
            // Update database with subscription status anyway
            const now = new Date().toISOString();
            const updateResult = await this.updateSubscriptionInDatabase(userId, true, now);

            if (isOk(updateResult) && updateResult.value) {
              // Update Redis cache
              await this.cacheSubscriptionStatus(userId, true, now);
              
              return {
                success: true,
                isSubscribed: true,
                message: 'Subscription recorded! You may need to manually join the subreddit on Reddit.',
                wasAlreadySubscribed: false,
              };
            }

            return {
              success: false,
              isSubscribed: false,
              message: errorMessage || 'Failed to subscribe to community',
            };
          }

          // Update database with subscription status
          const now = new Date().toISOString();
          const updateResult = await this.updateSubscriptionInDatabase(userId, true, now);

          if (!isOk(updateResult)) {
            this.logError('SubscriptionService.subscribeToSubreddit', updateResult.error);
            // Still return success since Reddit subscription worked
          }

          // Update Redis cache
          await this.cacheSubscriptionStatus(userId, true, now);

          this.logInfo('SubscriptionService', `User ${userId} successfully subscribed to subreddit`);

          return {
            success: true,
            isSubscribed: true,
            message: 'Successfully joined community!',
            wasAlreadySubscribed: false,
          };

        } finally {
          // Release lock
          try {
            const redisClient = this.redis;
            if (redisClient) {
              await redisClient.del(lockKey);
            }
          } catch (error) {
            this.logWarning('SubscriptionService.subscribeToSubreddit', `Failed to release Redis lock: ${String(error)}`);
          }
        }
      },
      (error) => internalError('Failed to subscribe to subreddit', error)
    );
  }

  /**
   * Update subscription status in database for both regular and guest users
   */
  private async updateSubscriptionInDatabase(
    userId: string, 
    isSubscribed: boolean, 
    subscribedAt: string | null
  ): Promise<Result<boolean, AppError>> {
    return tryCatch(
      async () => {
        // Try to update regular user first
        const userUpdateResult = await this.userRepo.updateProfile(userId, {
          is_subscribed: isSubscribed,
          subscribed_at: subscribedAt,
        });

        if (isOk(userUpdateResult) && userUpdateResult.value) {
          return true;
        }

        // If regular user update failed, try guest user
        const guestUpdateResult = await this.userRepo.updateGuestProfile(userId, {
          is_subscribed: isSubscribed,
          subscribed_at: subscribedAt,
        });

        if (isOk(guestUpdateResult) && guestUpdateResult.value) {
          return true;
        }

        // If both failed, log the errors
        this.logError('SubscriptionService.updateSubscriptionInDatabase', 
          `Failed to update subscription for user ${userId}: regular user error: ${!isOk(userUpdateResult) ? JSON.stringify(userUpdateResult.error) : 'unknown'}, guest user error: ${!isOk(guestUpdateResult) ? JSON.stringify(guestUpdateResult.error) : 'unknown'}`);

        return false;
      },
      (error) => databaseError('updateSubscriptionInDatabase', String(error))
    );
  }

  /**
   * Cache subscription status in Redis with TTL
   */
  private async cacheSubscriptionStatus(
    userId: string, 
    isSubscribed: boolean, 
    subscribedAt: string | null
  ): Promise<void> {
    try {
      const redisClient = this.redis;
      if (!redisClient) {
        this.logWarning('SubscriptionService.cacheSubscriptionStatus', 'Redis not available, skipping cache');
        return;
      }

      const cacheData = {
        isSubscribed,
        subscribedAt,
        cachedAt: new Date().toISOString(),
      };

      await redisClient.set(
        this.getRedisKey(userId),
        JSON.stringify(cacheData),
        { EX: SubscriptionService.REDIS_TTL }
      );
    } catch (error) {
      this.logWarning('SubscriptionService.cacheSubscriptionStatus', `Failed to cache: ${String(error)}`);
    }
  }

  /**
   * Invalidate subscription cache for a user
   * Useful when subscription status changes outside the app
   */
  async invalidateSubscriptionCache(userId: string): Promise<Result<boolean, AppError>> {
    return tryCatch(
      async () => {
        await this.redis.del(this.getRedisKey(userId));
        return true;
      },
      (error) => internalError('Failed to invalidate subscription cache', error)
    );
  }

  /**
   * Bulk check subscription status for multiple users
   * Useful for analytics or batch operations
   */
  async getBulkSubscriptionStatus(userIds: string[]): Promise<Result<Record<string, SubscriptionStatus>, AppError>> {
    return tryCatch(
      async () => {
        const results: Record<string, SubscriptionStatus> = {};
        
        // Process in batches to avoid overwhelming Redis/DB
        const batchSize = 50;
        for (let i = 0; i < userIds.length; i += batchSize) {
          const batch = userIds.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (userId) => {
            const statusResult = await this.getSubscriptionStatus(userId);
            return {
              userId,
              status: isOk(statusResult) ? statusResult.value : {
                isSubscribed: false,
                subscribedAt: null,
                source: 'unknown' as const,
              },
            };
          });

          const batchResults = await Promise.all(batchPromises);
          
          for (const { userId, status } of batchResults) {
            results[userId] = status;
          }
        }

        return results;
      },
      (error) => internalError('Failed to get bulk subscription status', error)
    );
  }

  /**
   * Get subscription analytics
   * Returns counts of subscribed vs unsubscribed users
   */
  async getSubscriptionAnalytics(): Promise<Result<{
    totalUsers: number;
    subscribedUsers: number;
    unsubscribedUsers: number;
    subscriptionRate: number;
  }, AppError>> {
    return tryCatch(
      async () => {
        // Get counts from database using the new method
        const countsResult = await this.userRepo.getSubscriptionCounts();

        if (!isOk(countsResult)) {
          throw new Error('Failed to get subscription analytics from database');
        }

        const { total: totalUsers, subscribed: subscribedUsers } = countsResult.value;
        const unsubscribedUsers = totalUsers - subscribedUsers;
        const subscriptionRate = totalUsers > 0 ? (subscribedUsers / totalUsers) * 100 : 0;

        return {
          totalUsers,
          subscribedUsers,
          unsubscribedUsers,
          subscriptionRate: Math.round(subscriptionRate * 100) / 100, // Round to 2 decimal places
        };
      },
      (error) => databaseError('getSubscriptionAnalytics', String(error))
    );
  }

  /**
   * Cleanup expired Redis cache entries
   * This is automatically handled by Redis TTL, but can be called manually
   */
  async cleanupExpiredCache(): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        // Redis handles TTL automatically, but we can scan for any orphaned keys
        // This is more of a maintenance operation
        let cleanedCount = 0;
        
        // Note: In a production environment, you might want to implement
        // a more sophisticated cleanup using Redis SCAN command
        // For now, we'll just return 0 as Redis handles TTL automatically
        
        return cleanedCount;
      },
      (error) => internalError('Failed to cleanup expired cache', error)
    );
  }
}