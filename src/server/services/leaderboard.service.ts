/**
 * Leaderboard Service
 * Handles all business logic related to leaderboard rankings and player statistics
 * Uses Redis sorted sets for O(log N) ranking operations
 */

import type { Context, RedisClient } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { UserRepository } from '../repositories/user.repository.js';
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

export type UserRankData = {
  rank: number | null;
  username: string;
  totalPoints: number;
  level: number;
};

export type PaginatedLeaderboardResult = {
  entries: LeaderboardEntry[];
  userRank: UserRankData | null;
  totalEntries: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

// Redis sorted set key for leaderboard
const LEADERBOARD_KEY = 'leaderboard:points';

export class LeaderboardService extends BaseService {
  private redis: RedisClient;

  constructor(
    context: Context,
    private userRepo: UserRepository
  ) {
    super(context);
    this.redis = context.redis;
  }

  /**
   * Add or update a user's score in the leaderboard sorted set
   * Uses zAdd for storing scores with key 'leaderboard:points'
   * Requirements: 9.1
   */
  async updateScore(userId: string, points: number): Promise<void> {
    try {
      await this.redis.zAdd(LEADERBOARD_KEY, { member: userId, score: points });
      this.logInfo('LeaderboardService', `Updated score for user ${userId}: ${points}`);
    } catch (error) {
      this.logError('LeaderboardService.updateScore', error);
      throw error;
    }
  }

  /**
   * Increment a user's score atomically using zIncrBy
   * Prevents race conditions with read-modify-write
   * Requirements: 9.4
   */
  async incrementScore(userId: string, delta: number): Promise<number> {
    try {
      const newScore = await this.redis.zIncrBy(LEADERBOARD_KEY, userId, delta);
      this.logInfo('LeaderboardService', `Incremented score for user ${userId} by ${delta}, new score: ${newScore}`);
      return newScore;
    } catch (error) {
      this.logError('LeaderboardService.incrementScore', error);
      throw error;
    }
  }

  /**
   * Get a user's score from the sorted set
   */
  async getUserScore(userId: string): Promise<number | null> {
    try {
      const score = await this.redis.zScore(LEADERBOARD_KEY, userId);
      return score ?? null;
    } catch (error) {
      this.logError('LeaderboardService.getUserScore', error);
      return null;
    }
  }

  /**
   * Get total player count from Redis sorted set using zCard
   * Returns total count for pagination calculation
   * Falls back to database if Redis is empty or fails
   * Requirements: 1.2
   */
  async getTotalPlayerCount(): Promise<number> {
    try {
      const count = await this.redis.zCard(LEADERBOARD_KEY);
      // If Redis has data, return it
      if (count > 0) {
        return count;
      }
      // Redis is empty - fall back to database
      const users = await this.userRepo.findByPoints(1000, 0);
      return users.length;
    } catch (error) {
      this.logError('LeaderboardService.getTotalPlayerCount', error);
      // Fall back to database count on error
      try {
        const users = await this.userRepo.findByPoints(1000, 0);
        return users.length;
      } catch (dbError) {
        this.logError('LeaderboardService.getTotalPlayerCount.fallback', dbError);
        return 0;
      }
    }
  }


  /**
   * Get top N players sorted by total points (descending)
   * Uses zRange with { by: 'rank', reverse: true } for O(log N) retrieval
   * Requirements: 9.2
   * 
   * Falls back to database query if Redis fails (Requirements: 7.1)
   */
  async getTopPlayers(limit: number = 10, offset: number = 0): Promise<LeaderboardEntry[]> {
    try {
      // Try Redis sorted set first
      const entries = await this.getTopPlayersFromRedis(limit, offset);
      if (entries.length > 0) {
        return entries;
      }

      // Fall back to database if Redis returns empty (might not be populated yet)
      return await this.getTopPlayersFromDatabase(limit, offset);
    } catch (error) {
      // Redis failed - fall back to database (Requirements: 7.1)
      this.logError('LeaderboardService.getTopPlayers', error);
      console.error('[LeaderboardService] Redis failed, falling back to database:', error);
      return await this.getTopPlayersFromDatabase(limit, offset);
    }
  }

  /**
   * Get top players from Redis sorted set
   * Uses zRange with { by: 'rank', reverse: true } for descending order
   * Implements standard competition ranking (1224) - ties share rank, next rank skips
   */
  private async getTopPlayersFromRedis(limit: number, offset: number): Promise<LeaderboardEntry[]> {
    // Get top players from sorted set in descending order (highest scores first)
    const start = offset;
    const end = offset + limit - 1;

    const members = await this.redis.zRange(LEADERBOARD_KEY, start, end, {
      by: 'rank',
      reverse: true
    });

    if (!members || members.length === 0) {
      return [];
    }

    // Fetch user details for each member
    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const userId = member.member;
      const score = member.score;

      // Get user profile for additional details
      const userProfile = await this.userRepo.findById(userId);

      if (userProfile) {
        // Calculate proper rank using standard competition ranking
        // Count how many players have a higher score than this player
        const rank = await this.getCompetitionRank(score);
        
        entries.push({
          rank: rank,
          userId: userProfile.user_id,
          username: userProfile.username,
          totalPoints: score,
          level: userProfile.level,
          challengesSolved: userProfile.challenges_solved,
          isCurrentUser: false,
        });
      }
    }

    return entries;
  }

  /**
   * Get competition rank for a given score
   * Standard competition ranking: rank = 1 + count of players with higher score
   * Players with same score share the same rank
   */
  private async getCompetitionRank(score: number): Promise<number> {
    try {
      // Use zRange with by: 'score' to get players with scores strictly greater than this score
      // We use score + 0.001 as the lower bound to exclude exact matches (exclusive)
      const playersWithHigherScore = await this.redis.zRange(
        LEADERBOARD_KEY,
        score + 0.001, // Exclusive: scores strictly greater than this
        '+inf',
        { by: 'score' }
      );
      
      // Rank = 1 + number of players with higher score
      return (playersWithHigherScore?.length || 0) + 1;
    } catch (error) {
      this.logError('LeaderboardService.getCompetitionRank', error);
      return 1; // Default to rank 1 on error
    }
  }

  /**
   * Fallback: Get top players from database
   * Used when Redis is unavailable (Requirements: 7.1)
   * Implements standard competition ranking (1224) - ties share rank
   */
  private async getTopPlayersFromDatabase(limit: number, offset: number): Promise<LeaderboardEntry[]> {
    const users = await this.userRepo.findByPoints(limit, offset);
    
    // Get all users to calculate proper competition ranks
    const allUsers = await this.userRepo.findByPoints(1000, 0);
    
    return users.map((user) => {
      // Count players with higher points for competition ranking
      const playersWithHigherScore = allUsers.filter(u => u.total_points > user.total_points).length;
      const rank = playersWithHigherScore + 1;
      
      return {
        rank,
        userId: user.user_id,
        username: user.username,
        totalPoints: user.total_points,
        level: user.level,
        challengesSolved: user.challenges_solved,
        isCurrentUser: false,
      };
    });
  }

  /**
   * Get a user's rank on the leaderboard (1-indexed)
   * Uses zRank and zCard to calculate reverse rank for descending order
   * Requirements: 9.3
   * 
   * Falls back to database query if Redis fails (Requirements: 7.1)
   */
  async getUserRank(userId: string): Promise<number | null> {
    try {
      // Try Redis first
      const rank = await this.getUserRankFromRedis(userId);
      if (rank !== null) {
        return rank;
      }

      // Fall back to database
      return await this.userRepo.getUserRank(userId);
    } catch (error) {
      // Redis failed - fall back to database (Requirements: 7.1)
      this.logError('LeaderboardService.getUserRank', error);
      console.error('[LeaderboardService] Redis failed for getUserRank, falling back to database:', error);
      return await this.userRepo.getUserRank(userId);
    }
  }

  /**
   * Get user rank from Redis sorted set using competition ranking
   * Standard competition ranking: rank = 1 + count of players with higher score
   * Players with same score share the same rank
   * Requirements: 9.3
   */
  private async getUserRankFromRedis(userId: string): Promise<number | null> {
    // Get the user's score first
    const userScore = await this.redis.zScore(LEADERBOARD_KEY, userId);

    if (userScore === null || userScore === undefined) {
      return null;
    }

    // Use competition ranking: count players with higher score + 1
    return await this.getCompetitionRank(userScore);
  }


  /**
   * Sync a user's score from database to Redis sorted set
   * Useful for initial population or recovery
   */
  async syncUserScore(userId: string): Promise<void> {
    try {
      const userProfile = await this.userRepo.findById(userId);
      if (userProfile) {
        await this.updateScore(userId, userProfile.total_points);
      }
    } catch (error) {
      this.logError('LeaderboardService.syncUserScore', error);
    }
  }

  /**
   * Refresh the leaderboard by syncing from database
   * Call this to populate Redis sorted set from database
   */
  async refreshLeaderboard(): Promise<void> {
    try {
      this.logInfo('LeaderboardService', 'Refreshing leaderboard from database');

      // Get all users with points from database
      const users = await this.userRepo.findByPoints(1000, 0);

      // Add each user to the sorted set
      for (const user of users) {
        await this.redis.zAdd(LEADERBOARD_KEY, {
          member: user.user_id,
          score: user.total_points
        });
      }

      this.logInfo('LeaderboardService', `Leaderboard refreshed with ${users.length} users`);
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
   * Get leaderboard with pagination metadata and current user's rank
   * Returns paginated entries with totalEntries, totalPages, hasNextPage, hasPreviousPage
   * Requirements: 1.2, 2.1
   */
  async getLeaderboardWithUserPaginated(
    userId: string,
    pageSize: number = 5,
    currentPage: number = 0
  ): Promise<PaginatedLeaderboardResult> {
    try {
      const offset = currentPage * pageSize;

      // Get total entries for pagination calculation
      const totalEntries = await this.getTotalPlayerCount();
      const totalPages = totalEntries > 0 ? Math.ceil(totalEntries / pageSize) : 0;

      // Get paginated entries
      const topPlayers = await this.getTopPlayers(pageSize, offset);

      const entries = topPlayers.map(entry => ({
        ...entry,
        isCurrentUser: entry.userId === userId,
      }));

      // Get user's rank data (always fetch for Your Rank Section)
      let userRank: UserRankData | null = null;
      const userProfile = await this.userRepo.findById(userId);
      const rank = await this.getUserRank(userId);

      if (userProfile) {
        userRank = {
          rank: rank,
          username: userProfile.username,
          totalPoints: userProfile.total_points,
          level: userProfile.level,
        };
      }

      return {
        entries,
        userRank,
        totalEntries,
        totalPages,
        currentPage,
        hasNextPage: currentPage < totalPages - 1,
        hasPreviousPage: currentPage > 0,
      };
    } catch (error) {
      this.logError('LeaderboardService.getLeaderboardWithUserPaginated', error);
      return {
        entries: [],
        userRank: null,
        totalEntries: 0,
        totalPages: 0,
        currentPage: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }
  }

  /**
   * Get leaderboard statistics
   */
  async getLeaderboardStats(): Promise<{
    totalPlayers: number;
    topScore: number;
    averageScore: number;
  }> {
    try {
      // Get total players from sorted set
      const totalPlayers = await this.redis.zCard(LEADERBOARD_KEY);

      // Get top player's score
      const topPlayers = await this.getTopPlayers(1, 0);
      const topScore = topPlayers.length > 0 ? topPlayers[0].totalPoints : 0;

      return {
        totalPlayers,
        topScore,
        averageScore: 0, // Would need to sum all scores
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
   * Clear the leaderboard cache (removes all entries from sorted set)
   */
  async clearCache(): Promise<void> {
    try {
      // Remove all entries by removing the key
      // Note: Devvit Redis doesn't have DEL for sorted sets, so we use zRemRangeByRank
      const count = await this.redis.zCard(LEADERBOARD_KEY);
      if (count > 0) {
        await this.redis.zRemRangeByRank(LEADERBOARD_KEY, 0, count - 1);
      }
      this.logInfo('LeaderboardService', 'Leaderboard cache cleared');
    } catch (error) {
      this.logError('LeaderboardService.clearCache', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: 0, // Would need async call to get zCard
      ttl: 0, // Sorted sets don't have TTL
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

  /**
   * Remove a user from the leaderboard
   */
  async removeUser(userId: string): Promise<void> {
    try {
      await this.redis.zRem(LEADERBOARD_KEY, [userId]);
      this.logInfo('LeaderboardService', `Removed user ${userId} from leaderboard`);
    } catch (error) {
      this.logError('LeaderboardService.removeUser', error);
    }
  }
}
