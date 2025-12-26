/**
 * RateLimitService
 * Service for managing rate limits using Redis with sliding window algorithm
 * 
 * Requirements: 1.1, 1.2, 1.4, 7.1, 7.2
 */

import { redis } from '@devvit/web/server';

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the window */
  remaining: number;
  /** Timestamp when the rate limit resets (milliseconds) */
  resetTime: number;
  /** Current request count */
  current: number;
}

/**
 * Service for managing rate limits using Redis
 * Implements sliding window counter algorithm
 * 
 * Requirements: 1.1, 1.2, 1.4, 7.1, 7.2
 */
export class RateLimitService {
  private readonly keyPrefix = 'ratelimit';
  
  /**
   * Check if a request is within rate limit
   * 
   * Uses sliding window algorithm to provide smooth rate limiting:
   * - Considers requests from both current and previous windows
   * - Weights previous window requests proportionally
   * - Prevents burst attacks at window boundaries
   * 
   * @param key - Rate limit key (userId or IP)
   * @param limit - Maximum requests allowed
   * @param windowSeconds - Time window in seconds
   * @returns Rate limit check result
   * 
   * Requirements: 1.1, 1.2, 7.1, 7.2
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const windowMs = windowSeconds * 1000;
      const currentWindow = Math.floor(now / windowMs);
      const previousWindow = currentWindow - 1;
      
      // Redis keys for current and previous windows
      const currentKey = `${this.keyPrefix}:${key}:${currentWindow}`;
      const previousKey = `${this.keyPrefix}:${key}:${previousWindow}`;
      
      // Get counts from both windows
      const [currentCount, previousCount] = await Promise.all([
        this.getCount(currentKey),
        this.getCount(previousKey),
      ]);
      
      // Calculate weighted count using sliding window
      // This provides smooth rate limiting by considering how far we are into the current window
      const percentageInCurrentWindow = (now % windowMs) / windowMs;
      const weightedCount = 
        currentCount + 
        previousCount * (1 - percentageInCurrentWindow);
      
      const allowed = weightedCount < limit;
      const remaining = Math.max(0, limit - Math.ceil(weightedCount));
      const resetTime = (currentWindow + 1) * windowMs;
      
      // If allowed, increment counter atomically
      if (allowed) {
        await this.incrementCounter(currentKey, windowSeconds * 2);
      }
      
      return {
        allowed,
        remaining,
        resetTime,
        current: Math.ceil(weightedCount),
      };
    } catch (error) {
      // Fail open on error - allow request if rate limiting fails
      // This prevents rate limiting from becoming a single point of failure
      // Requirement: 1.4, 7.2
      console.error('Rate limit check error (failing open):', error);
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + (windowSeconds * 1000),
        current: 0,
      };
    }
  }
  
  /**
   * Get current count for a key
   * 
   * @param key - Redis key
   * @returns Current count or 0 if not found
   */
  private async getCount(key: string): Promise<number> {
    try {
      const value = await redis.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.error('Error getting rate limit count:', error);
      return 0;
    }
  }
  
  /**
   * Increment counter for a key atomically
   * 
   * Uses Redis transaction for atomic increment + expire to ensure:
   * - Counter is incremented exactly once
   * - TTL is set to prevent memory leaks
   * - Operations are atomic (no race conditions)
   * 
   * @param key - Redis key
   * @param ttlSeconds - Time to live in seconds (2x window for sliding window)
   * 
   * Requirements: 1.2, 1.3
   */
  private async incrementCounter(key: string, ttlSeconds: number): Promise<void> {
    try {
      // Use Redis transaction for atomic increment + expire
      const txn = await redis.watch(key);
      await txn.multi();
      await txn.incrBy(key, 1);
      await txn.expire(key, ttlSeconds);
      await txn.exec();
    } catch (error) {
      console.error('Error incrementing rate limit counter:', error);
      // Don't throw - fail open
    }
  }
}
