/**
 * Leaderboard Service
 * Handles all business logic related to leaderboard rankings and player statistics
 */

import type { Context } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { UserProfile } from '../../shared/models/user.types.js';
import { Cache, createCacheKey } from '../../shared/utils/cache.js';
import { createPaginatedResult, DEFAULT_PAGE_SIZE, type PaginatedResult } from '../../shared/utils/pagination.js';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
  level: number;
  challengesSolved: number;
  isCurrentUser: boolean;
};

export class LeaderboardService extends BaseService {
  private leaderboardCache: Cache<LeaderboardEntry[]>;
  private readonly LEADERBOARD_CACHE_TTL = 60 * 1000; // 1 minute cache

  constructor(
    context: Context,
    private userRepo: UserRepository
  ) {
    super(context);
    this.leaderboardCache = new Cache<LeaderboardEntry[]>(this.LEADERBOARD_CACHE_TTL);
  }

  /**
   * Get top players sorted by total points
   * Results are cached for 1 minute to reduce database load
   */
  async getTopPlayers(limit: number = 10, offset: number = 0): Promise<LeaderboardEntry[]> {
    const result = await this.withErrorHandling(
      async () => {
        const cacheKey = createCacheKey('leaderboard', limit, offset);
        
        const cached = this.leaderboardCache.get(cacheKey);
        if (cached) {
          this.logInfo('LeaderboardService', `Returning cached leaderboard (limit: ${limit}, offset: ${offset})`);
          return cached;
        }
        
        const users = await this.userRepo.findByPoints(limit, offset);
        
        const entries: LeaderboardEntry[] = users.map((user, index) => ({
          rank: offset + index + 1,
          userId: user.user_id,
          username: user.username,
          totalPoints: user.total_points,
          level: user.level,
          challengesSolved: user.challenges_solved,
          isCurrentUser: false,
        }));
        
        this.leaderboardCache.set(cacheKey, entries);
        this.logInfo('LeaderboardService', `Cached leaderboard (limit: ${limit}, offset: ${offset})`);
        
        return entries;
      },
      'Failed to get top players'
    );
    return result || [];
  }

  /**
   * Get a user's rank on the leaderboard
   * Returns null if user not found or has no points
   */
  async getUserRank(userId: string): Promise<number | null> {
    return this.withErrorHandling(
      async () => {
        return this.userRepo.getUserRank(userId);
      },
      'Failed to get user rank'
    );
  }

  /**
   * Refresh the leaderboard cache
   * Call this after significant point changes or on-demand
   */
  async refreshLeaderboard(): Promise<void> {
    try {
      this.logInfo('LeaderboardService', 'Refreshing leaderboard cache');
      
      this.leaderboardCache.clear();
      
      await this.getTopPlayers(10, 0);
      
      this.logInfo('LeaderboardService', 'Leaderboard cache refreshed');
    } catch (error) {
      this.logError('LeaderboardService.refreshLeaderboard', error);
    }
  }

  /**
   * Get leaderboard with current user highlighted
   * If user is not in top N, their entry is appended
   */
  async getLeaderboardWithUser(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ entries: LeaderboardEntry[]; userEntry: LeaderboardEntry | null }> {
    try {
      const topPlayers = await this.getTopPlayers(limit, offset);
      
      const entries = topPlayers.map(entry => ({
        ...entry,
        isCurrentUser: entry.userId === userId,
      }));
      
      const userInList = entries.some(entry => entry.userId === userId);
      
      let userEntry: LeaderboardEntry | null = null;
      
      if (!userInList) {
        const userProfile = await this.userRepo.findById(userId);
        const userRank = await this.getUserRank(userId);
        
        if (userProfile && userRank) {
          userEntry = {
            rank: userRank,
            userId: userProfile.user_id,
            username: userProfile.username,
            totalPoints: userProfile.total_points,
            level: userProfile.level,
            challengesSolved: userProfile.challenges_solved,
            isCurrentUser: true,
          };
        }
      }
      
      return { entries, userEntry };
    } catch (error) {
      this.logError('LeaderboardService.getLeaderboardWithUser', error);
      return { entries: [], userEntry: null };
    }
  }

  /**
   * Get leaderboard statistics
   * Useful for displaying overall game stats
   */
  async getLeaderboardStats(): Promise<{
    totalPlayers: number;
    topScore: number;
    averageScore: number;
  }> {
    try {
      const topPlayers = await this.getTopPlayers(1, 0);
      const topScore = topPlayers.length > 0 ? topPlayers[0].totalPoints : 0;
      
      return {
        totalPlayers: 0, // Would need COUNT query
        topScore,
        averageScore: 0, // Would need AVG query
      };
    } catch (error) {
      this.logError('LeaderboardService.getLeaderboardStats', error);
      return {
        totalPlayers: 0,
        topScore: 0,
        averageScore: 0,
      };
    }
  }

  /**
   * Clear the leaderboard cache
   * Useful for testing or manual cache invalidation
   */
  clearCache(): void {
    this.leaderboardCache.clear();
    this.logInfo('LeaderboardService', 'Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.leaderboardCache.size(),
      ttl: this.LEADERBOARD_CACHE_TTL,
    };
  }

  /**
   * Get top players with pagination support
   * Returns paginated results with metadata
   */
  async getTopPlayersPaginated(
    page: number = 1,
    pageSize: number = DEFAULT_PAGE_SIZE
  ): Promise<PaginatedResult<LeaderboardEntry>> {
    const result = await this.withErrorHandling(
      async () => {
        const limit = Math.max(1, Math.min(pageSize, 100));
        const offset = Math.max(0, (page - 1) * limit);
        
        const entries = await this.getTopPlayers(limit + 1, offset);
        
        const hasMore = entries.length > limit;
        const data = hasMore ? entries.slice(0, limit) : entries;
        
        return createPaginatedResult(data, limit, {
          currentOffset: offset,
        });
      },
      'Failed to get paginated leaderboard'
    );
    
    return result || createPaginatedResult([], pageSize);
  }
}
