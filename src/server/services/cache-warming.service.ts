/**
 * Cache Warming Service
 * Proactively warms caches to improve initial request performance
 * 
 * Uses Devvit scheduler for periodic cache warming and
 * can be triggered manually or on startup
 * 
 * Requirements: Phase 4.5 - Cache Warming
 */

import type { Context } from '@devvit/server/server-context';
import { redis } from '@devvit/web/server';
import { BaseService } from './base.service.js';
import { metrics } from '../utils/metrics.js';
import type { Result } from '../../shared/utils/result.js';
import { ok, err } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { internalError } from '../../shared/models/errors.js';

/**
 * Cache warming configuration
 */
export type CacheWarmingConfig = {
  /** Whether cache warming is enabled */
  enabled: boolean;
  /** TTL for warmed cache entries in milliseconds */
  defaultTtl: number;
  /** Maximum items to warm per category */
  maxItemsPerCategory: number;
  /** Batch size for warming operations */
  batchSize: number;
};

/**
 * Cache warming result
 */
export type WarmingResult = {
  category: string;
  itemsWarmed: number;
  durationMs: number;
  success: boolean;
  error?: string;
};

/**
 * Overall warming status
 */
export type WarmingStatus = {
  lastRun: string | null;
  results: WarmingResult[];
  totalItemsWarmed: number;
  totalDurationMs: number;
};

const DEFAULT_CONFIG: CacheWarmingConfig = {
  enabled: true,
  defaultTtl: 60_000, // 1 minute
  maxItemsPerCategory: 100,
  batchSize: 10,
};

// Redis keys for cache warming
const WARMING_STATUS_KEY = 'cache:warming:status';
const WARMING_LOCK_KEY = 'cache:warming:lock';
const LEADERBOARD_CACHE_KEY = 'cache:leaderboard:top';
const CHALLENGES_CACHE_KEY = 'cache:challenges:recent';

/**
 * Cache Warming Service
 * Proactively populates caches to improve performance
 */
export class CacheWarmingService extends BaseService {
  private config: CacheWarmingConfig;
  private supabaseUrl: string | null = null;
  private supabaseKey: string | null = null;

  constructor(context: Context, config?: Partial<CacheWarmingConfig>) {
    super(context);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set Supabase configuration for database queries
   */
  setSupabaseConfig(url: string, key: string): void {
    this.supabaseUrl = url;
    this.supabaseKey = key;
  }

  /**
   * Run all cache warming operations
   * Uses a lock to prevent concurrent warming
   */
  async warmAll(): Promise<Result<WarmingStatus, AppError>> {
    if (!this.config.enabled) {
      return ok({
        lastRun: null,
        results: [],
        totalItemsWarmed: 0,
        totalDurationMs: 0,
      });
    }

    // Try to acquire lock
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      return err(internalError('Cache warming already in progress'));
    }

    const startTime = Date.now();

    try {
      const results: WarmingResult[] = [];

      // Warm leaderboard cache
      const leaderboardResult = await this.warmLeaderboard();
      results.push(leaderboardResult);

      // Warm recent challenges cache
      const challengesResult = await this.warmRecentChallenges();
      results.push(challengesResult);

      const totalDurationMs = Date.now() - startTime;
      const totalItemsWarmed = results.reduce((sum, r) => sum + r.itemsWarmed, 0);

      const status: WarmingStatus = {
        lastRun: new Date().toISOString(),
        results,
        totalItemsWarmed,
        totalDurationMs,
      };

      // Store warming status
      await this.saveWarmingStatus(status);

      // Record metrics
      await metrics.recordHistogram('cache_warming_duration_ms', totalDurationMs);
      await metrics.setGauge('cache_warming_items', totalItemsWarmed);

      return ok(status);
    } catch (error) {
      return err(internalError('Cache warming failed', error));
    } finally {
      // Release lock
      await this.releaseLock();
    }
  }

  /**
   * Warm the leaderboard cache
   */
  private async warmLeaderboard(): Promise<WarmingResult> {
    const startTime = Date.now();
    const category = 'leaderboard';

    try {
      if (!this.supabaseUrl || !this.supabaseKey) {
        return {
          category,
          itemsWarmed: 0,
          durationMs: Date.now() - startTime,
          success: false,
          error: 'Database configuration not available',
        };
      }

      // Fetch top users from database
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/user_profiles?select=user_id,username,total_points,level,challenges_solved&order=total_points.desc&limit=${this.config.maxItemsPerCategory}`,
        {
          method: 'GET',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Database query failed: ${response.status}`);
      }

      const users = await response.json();

      // Populate Redis sorted set for leaderboard
      const LEADERBOARD_KEY = 'leaderboard:points';
      for (const user of users) {
        await redis.zAdd(LEADERBOARD_KEY, {
          member: user.user_id,
          score: user.total_points,
        });
      }

      // Also cache the formatted leaderboard data
      await redis.set(LEADERBOARD_CACHE_KEY, JSON.stringify(users), {
        expiration: new Date(Date.now() + this.config.defaultTtl),
      });

      const durationMs = Date.now() - startTime;

      return {
        category,
        itemsWarmed: users.length,
        durationMs,
        success: true,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      return {
        category,
        itemsWarmed: 0,
        durationMs,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Warm the recent challenges cache
   */
  private async warmRecentChallenges(): Promise<WarmingResult> {
    const startTime = Date.now();
    const category = 'challenges';

    try {
      if (!this.supabaseUrl || !this.supabaseKey) {
        return {
          category,
          itemsWarmed: 0,
          durationMs: Date.now() - startTime,
          success: false,
          error: 'Database configuration not available',
        };
      }

      // Fetch recent challenges from database
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/challenges?select=*&order=created_at.desc&limit=${this.config.maxItemsPerCategory}`,
        {
          method: 'GET',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Database query failed: ${response.status}`);
      }

      const challenges = await response.json();

      // Cache the challenges list
      await redis.set(CHALLENGES_CACHE_KEY, JSON.stringify(challenges), {
        expiration: new Date(Date.now() + this.config.defaultTtl),
      });

      // Also cache individual challenges for quick lookup
      for (const challenge of challenges) {
        const cacheKey = `cache:challenge:${challenge.id}`;
        await redis.set(cacheKey, JSON.stringify(challenge), {
          expiration: new Date(Date.now() + this.config.defaultTtl * 2), // Longer TTL for individual items
        });
      }

      const durationMs = Date.now() - startTime;

      return {
        category,
        itemsWarmed: challenges.length,
        durationMs,
        success: true,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      return {
        category,
        itemsWarmed: 0,
        durationMs,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the last warming status
   */
  async getWarmingStatus(): Promise<WarmingStatus | null> {
    try {
      const status = await redis.get(WARMING_STATUS_KEY);
      return status ? JSON.parse(status) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save warming status to Redis
   */
  private async saveWarmingStatus(status: WarmingStatus): Promise<void> {
    try {
      await redis.set(WARMING_STATUS_KEY, JSON.stringify(status), {
        expiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
    } catch {
      // Silently fail - status saving is not critical
    }
  }

  /**
   * Acquire a lock to prevent concurrent warming
   */
  private async acquireLock(): Promise<boolean> {
    try {
      // Use Redis SET with NX (only set if not exists) for atomic lock
      const lockValue = Date.now().toString();
      
      // Check if lock exists
      const existing = await redis.get(WARMING_LOCK_KEY);
      if (existing) {
        // Lock exists - check if it's stale (older than 5 minutes)
        const lockTime = parseInt(existing, 10);
        if (Date.now() - lockTime < 5 * 60 * 1000) {
          return false; // Lock is still valid
        }
        // Lock is stale, we can take it
      }

      // Set the lock
      await redis.set(WARMING_LOCK_KEY, lockValue, {
        expiration: new Date(Date.now() + 5 * 60 * 1000), // 5 minute TTL
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Release the warming lock
   */
  private async releaseLock(): Promise<void> {
    try {
      await redis.del(WARMING_LOCK_KEY);
    } catch {
      // Silently fail - lock will expire anyway
    }
  }

  /**
   * Check if cache warming is needed
   * Returns true if last warming was more than TTL ago
   */
  async isWarmingNeeded(): Promise<boolean> {
    const status = await this.getWarmingStatus();
    
    if (!status || !status.lastRun) {
      return true;
    }

    const lastRunTime = new Date(status.lastRun).getTime();
    const timeSinceLastRun = Date.now() - lastRunTime;
    
    // Warm if last run was more than TTL ago
    return timeSinceLastRun > this.config.defaultTtl;
  }
}

/**
 * Create a cache warming service instance
 */
export function createCacheWarmingService(context: Context): CacheWarmingService {
  return new CacheWarmingService(context);
}
