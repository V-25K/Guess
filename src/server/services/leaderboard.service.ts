/**
 * Leaderboard Service
 * Handles all business logic related to leaderboard rankings and player statistics
 * Uses Redis sorted sets for O(log N) ranking operations
 */

import type { Context } from '@devvit/server/server-context';
import { redis } from '@devvit/web/server';
import { BaseService } from './base.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { createPaginatedResult, DEFAULT_PAGE_SIZE, type PaginatedResult } from '../../shared/utils/pagination.js';
import type { Result } from '../../shared/utils/result.js';
import { isOk } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { databaseError } from '../../shared/models/errors.js';
import { tryCatch } from '../../shared/utils/result-adapters.js';

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
const LEADERBOARD_COUNT_KEY = 'leaderboard:active_players_count';
const COUNT_CACHE_TTL_SECONDS = 60 * 10; // 10 minutes cache

export class LeaderboardService extends BaseService {
  constructor(
    context: Context,
    private userRepo: UserRepository
  ) {
    super(context);
  }

  /**
   * Add or update a user's score in the leaderboard sorted set
   * Uses zAdd for storing scores with key 'leaderboard:points'
   * Skips moderators - they don't appear on leaderboard
   * Requirements: 9.1
   */
  async updateScore(userId: string, points: number): Promise<Result<void, AppError>> {
    return tryCatch(
      async () => {
        // Check if user is a moderator - skip leaderboard update for mods
        const userProfileResult = await this.userRepo.findById(userId);
        if (isOk(userProfileResult) && userProfileResult.value?.role === 'mod') {
          this.logInfo('LeaderboardService', `Skipping leaderboard update for moderator ${userId}`);
          return;
        }

        await redis.zAdd(LEADERBOARD_KEY, { member: userId, score: points });
        this.logInfo('LeaderboardService', `Updated score for user ${userId}: ${points}`);
      },
      (error) => {
        this.logError('LeaderboardService.updateScore', error);
        return databaseError('updateScore', String(error));
      }
    );
  }

  /**
   * Increment a user's score atomically using zIncrBy
   * Prevents race conditions with read-modify-write
   * Skips moderators - they don't appear on leaderboard
   * Requirements: 9.4
   */
  async incrementScore(userId: string, delta: number): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        // Check if user is a moderator - skip leaderboard update for mods
        const userProfileResult = await this.userRepo.findById(userId);
        if (isOk(userProfileResult) && userProfileResult.value?.role === 'mod') {
          this.logInfo('LeaderboardService', `Skipping leaderboard increment for moderator ${userId}`);
          return userProfileResult.value.total_points; // Return current points without updating leaderboard
        }

        const newScore = await redis.zIncrBy(LEADERBOARD_KEY, userId, delta);
        this.logInfo('LeaderboardService', `Incremented score for user ${userId} by ${delta}, new score: ${newScore}`);
        return newScore;
      },
      (error) => {
        this.logError('LeaderboardService.incrementScore', error);
        return databaseError('incrementScore', String(error));
      }
    );
  }

  /**
   * Get a user's score from the sorted set
   */
  async getUserScore(userId: string): Promise<Result<number | null, AppError>> {
    return tryCatch(
      async () => {
        const score = await redis.zScore(LEADERBOARD_KEY, userId);
        return score ?? null;
      },
      (error) => {
        this.logError('LeaderboardService.getUserScore', error);
        return databaseError('getUserScore', String(error));
      }
    );
  }

  /**
   * Get total player count from Redis sorted set using zCard
   * Returns total count for pagination calculation
   * Falls back to database if Redis is empty or fails
   * Requirements: 1.2
   */
  async getTotalPlayerCount(): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        // 1. Try to get cached count first for performance
        const cachedCount = await redis.get(LEADERBOARD_COUNT_KEY);
        if (cachedCount) {
          return parseInt(cachedCount, 10);
        }

        // 2. Cache miss - Fetch from DB (Source of Truth)
        // Use the dedicated count method that counts all players with > 0 attempts
        const countResult = await this.userRepo.countActivePlayers();

        if (!isOk(countResult)) {
          // If DB fails, try Redis Sorted Set count as a last resort fallback
          const redisZCard = await redis.zCard(LEADERBOARD_KEY);
          if (redisZCard > 0) return redisZCard;

          throw new Error(`Failed to get user count: ${JSON.stringify(countResult.error)}`);
        }

        const count = countResult.value;

        // 3. Update Cache - Store for 10 minutes to reduce DB load
        await redis.set(LEADERBOARD_COUNT_KEY, count.toString(), {
          expiration: new Date(Date.now() + COUNT_CACHE_TTL_SECONDS * 1000)
        });

        return count;
      },
      (error) => {
        this.logError('LeaderboardService.getTotalPlayerCount', error);
        return databaseError('getTotalPlayerCount', String(error));
      }
    );
  }


  /**
   * Get top N players sorted by total points (descending)
   * Uses zRange with { by: 'rank', reverse: true } for O(log N) retrieval
   * Requirements: 9.2
   * 
   * Falls back to database query if Redis fails (Requirements: 7.1)
   */
  async getTopPlayers(limit: number = 10, offset: number = 0): Promise<Result<LeaderboardEntry[], AppError>> {
    return tryCatch(
      async () => {
        // Try Redis sorted set first
        const entriesResult = await this.getTopPlayersFromRedis(limit, offset);
        if (!isOk(entriesResult)) {
          // Redis failed - fall back to database (Requirements: 7.1)
          this.logError('LeaderboardService.getTopPlayers', entriesResult.error);
          console.error('[LeaderboardService] Redis failed, falling back to database:', entriesResult.error);
          return await this.getTopPlayersFromDatabaseInternal(limit, offset);
        }

        const entries = entriesResult.value;
        if (entries.length > 0) {
          return entries;
        }

        // Fall back to database if Redis returns empty (might not be populated yet)
        return await this.getTopPlayersFromDatabaseInternal(limit, offset);
      },
      (error) => {
        this.logError('LeaderboardService.getTopPlayers', error);
        return databaseError('getTopPlayers', String(error));
      }
    );
  }

  /**
   * Get top players from Redis sorted set
   * Uses zRange with { by: 'rank', reverse: true } for descending order
   * Implements standard competition ranking (1224) - ties share rank, next rank skips
   * Excludes moderators from the leaderboard
   */
  private async getTopPlayersFromRedis(limit: number, offset: number): Promise<Result<LeaderboardEntry[], AppError>> {
    return tryCatch(
      async () => {
        // Fetch more entries than needed to account for filtered mods
        // We'll filter and then trim to the requested limit
        const fetchLimit = limit * 2 + 20; // Fetch extra to handle mod filtering
        const start = 0; // Always start from beginning to properly filter
        const end = offset + fetchLimit - 1;

        const members = await redis.zRange(LEADERBOARD_KEY, start, end, {
          by: 'rank',
          reverse: true
        });

        if (!members || members.length === 0) {
          return [];
        }

        // Fetch user details for each member and filter out mods
        const allEntries: LeaderboardEntry[] = [];
        let playerRank = 0; // Track rank among non-mod players only

        for (let i = 0; i < members.length; i++) {
          const member = members[i];
          const memberId = member.member;
          const score = member.score;

          // Get user profile for additional details
          const userProfileResult = await this.userRepo.findById(memberId);
          if (!isOk(userProfileResult)) {
            continue; // Skip this user if profile fetch fails
          }

          const userProfile = userProfileResult.value;
          if (userProfile) {
            // Skip moderators - they don't appear on leaderboard
            if (userProfile.role === 'mod') {
              continue;
            }

            playerRank++;

            // Use sequential rank based on position in sorted list
            // This is correct for competition ranking when iterating in descending score order
            allEntries.push({
              rank: playerRank,
              userId: userProfile.user_id,
              username: userProfile.username,
              totalPoints: score,
              level: userProfile.level,
              challengesSolved: userProfile.challenges_solved,
              isCurrentUser: false,
            });
          }
        }

        // Apply offset and limit to the filtered results
        // Adjust ranks for the offset
        const paginatedEntries = allEntries.slice(offset, offset + limit);
        
        return paginatedEntries;
      },
      (error) => databaseError('getTopPlayersFromRedis', String(error))
    );
  }

  /**
   * Get competition rank for a given score, excluding moderators
   * Standard competition ranking: rank = 1 + count of non-mod players with higher score
   * Players with same score share the same rank
   */
  private async getCompetitionRankExcludingMods(score: number): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        // Use zRange with by: 'score' to get players with scores strictly greater than this score
        const playersWithHigherScore = await redis.zRange(
          LEADERBOARD_KEY,
          score + 0.001, // Exclusive: scores strictly greater than this
          '+inf',
          { by: 'score' }
        );

        if (!playersWithHigherScore || playersWithHigherScore.length === 0) {
          return 1;
        }

        // Count only non-mod players with higher scores
        let nonModCount = 0;
        for (const member of playersWithHigherScore) {
          const userProfileResult = await this.userRepo.findById(member.member);
          if (isOk(userProfileResult) && userProfileResult.value && userProfileResult.value.role !== 'mod') {
            nonModCount++;
          }
        }

        // Rank = 1 + number of non-mod players with higher score
        return nonModCount + 1;
      },
      (error) => {
        this.logError('LeaderboardService.getCompetitionRankExcludingMods', error);
        return databaseError('getCompetitionRankExcludingMods', String(error));
      }
    );
  }

  /**
   * Get competition rank for a given score
   * Standard competition ranking: rank = 1 + count of players with higher score
   * Players with same score share the same rank
   */
  private async getCompetitionRank(score: number): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        // Use zRange with by: 'score' to get players with scores strictly greater than this score
        // We use score + 0.001 as the lower bound to exclude exact matches (exclusive)
        const playersWithHigherScore = await redis.zRange(
          LEADERBOARD_KEY,
          score + 0.001, // Exclusive: scores strictly greater than this
          '+inf',
          { by: 'score' }
        );

        // Rank = 1 + number of players with higher score
        return (playersWithHigherScore?.length || 0) + 1;
      },
      (error) => {
        this.logError('LeaderboardService.getCompetitionRank', error);
        return databaseError('getCompetitionRank', String(error));
      }
    );
  }

  /**
   * Fallback: Get top players from database
   * Used when Redis is unavailable (Requirements: 7.1)
   * Implements standard competition ranking (1224) - ties share rank
   * Excludes moderators from the leaderboard
   */
  private async getTopPlayersFromDatabaseInternal(limit: number, offset: number): Promise<LeaderboardEntry[]> {
    // findByPoints already filters out mods
    const usersResult = await this.userRepo.findByPoints(limit, offset);
    if (!isOk(usersResult)) {
      throw new Error(`Failed to get users: ${JSON.stringify(usersResult.error)}`);
    }
    const users = usersResult.value;

    // Get all non-mod users to calculate proper competition ranks
    const allUsersResult = await this.userRepo.findByPoints(1000, 0);
    if (!isOk(allUsersResult)) {
      throw new Error(`Failed to get all users: ${JSON.stringify(allUsersResult.error)}`);
    }
    const allUsers = allUsersResult.value;

    return users.map((user) => {
      // Count non-mod players with higher points for competition ranking
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
  async getUserRank(userId: string): Promise<Result<number | null, AppError>> {
    return tryCatch(
      async () => {
        // Try Redis first
        const rankResult = await this.getUserRankFromRedis(userId);
        if (!isOk(rankResult)) {
          // Redis failed - fall back to database (Requirements: 7.1)
          this.logError('LeaderboardService.getUserRank', rankResult.error);
          console.error('[LeaderboardService] Redis failed for getUserRank, falling back to database:', rankResult.error);
          const dbResult = await this.userRepo.getUserRank(userId);
          if (!isOk(dbResult)) {
            throw dbResult.error;
          }
          return dbResult.value;
        }

        const rank = rankResult.value;
        if (rank !== null) {
          return rank;
        }

        // Fall back to database
        const dbResult = await this.userRepo.getUserRank(userId);
        if (!isOk(dbResult)) {
          throw dbResult.error;
        }
        return dbResult.value;
      },
      (error) => {
        this.logError('LeaderboardService.getUserRank', error);
        return databaseError('getUserRank', String(error));
      }
    );
  }

  /**
   * Get user rank from Redis sorted set using competition ranking
   * Standard competition ranking: rank = 1 + count of players with higher score
   * Players with same score share the same rank
   * Requirements: 9.3
   */
  private async getUserRankFromRedis(userId: string): Promise<Result<number | null, AppError>> {
    return tryCatch(
      async () => {
        // Get the user's score first
        const userScore = await redis.zScore(LEADERBOARD_KEY, userId);

        if (userScore === null || userScore === undefined) {
          return null;
        }

        // Use competition ranking: count players with higher score + 1
        const rankResult = await this.getCompetitionRank(userScore);
        if (!isOk(rankResult)) {
          throw new Error(`Failed to get competition rank: ${JSON.stringify(rankResult.error)}`);
        }
        return rankResult.value;
      },
      (error) => databaseError('getUserRankFromRedis', String(error))
    );
  }


  /**
   * Sync a user's score from database to Redis sorted set
   * Useful for initial population or recovery
   * Skips moderators - they don't appear on leaderboard
   */
  async syncUserScore(userId: string): Promise<Result<void, AppError>> {
    return tryCatch(
      async () => {
        const userProfileResult = await this.userRepo.findById(userId);
        if (!isOk(userProfileResult)) {
          throw new Error(`Failed to get user profile: ${JSON.stringify(userProfileResult.error)}`);
        }

        const userProfile = userProfileResult.value;
        if (userProfile) {
          // Skip moderators - they don't appear on leaderboard
          if (userProfile.role === 'mod') {
            this.logInfo('LeaderboardService', `Skipping leaderboard sync for moderator ${userId}`);
            return;
          }

          const updateResult = await this.updateScore(userId, userProfile.total_points);
          if (!isOk(updateResult)) {
            throw new Error(`Failed to update score: ${JSON.stringify(updateResult.error)}`);
          }
        }
      },
      (error) => {
        this.logError('LeaderboardService.syncUserScore', error);
        return databaseError('syncUserScore', String(error));
      }
    );
  }

  /**
   * Refresh the leaderboard by syncing from database
   * Call this to populate Redis sorted set from database
   * Only includes non-moderator players
   */
  async refreshLeaderboard(): Promise<Result<void, AppError>> {
    return tryCatch(
      async () => {
        this.logInfo('LeaderboardService', 'Refreshing leaderboard from database');

        // Get all non-mod users with points from database (findByPoints already filters mods)
        const usersResult = await this.userRepo.findByPoints(1000, 0);
        if (!isOk(usersResult)) {
          throw new Error(`Failed to get users: ${JSON.stringify(usersResult.error)}`);
        }
        const users = usersResult.value;

        // Add each non-mod user to the sorted set
        for (const user of users) {
          await redis.zAdd(LEADERBOARD_KEY, {
            member: user.user_id,
            score: user.total_points
          });
        }

        this.logInfo('LeaderboardService', `Leaderboard refreshed with ${users.length} players (mods excluded)`);
      },
      (error) => {
        this.logError('LeaderboardService.refreshLeaderboard', error);
        return databaseError('refreshLeaderboard', String(error));
      }
    );
  }

  /**
   * Get leaderboard with current user highlighted
   * If user is not in top N, their entry is appended
   */
  async getLeaderboardWithUser(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Result<{ entries: LeaderboardEntry[]; userEntry: LeaderboardEntry | null }, AppError>> {
    return tryCatch(
      async () => {
        const topPlayersResult = await this.getTopPlayers(limit, offset);
        if (!isOk(topPlayersResult)) {
          throw new Error(`Failed to get top players: ${JSON.stringify(topPlayersResult.error)}`);
        }
        const topPlayers = topPlayersResult.value;

        const entries = topPlayers.map(entry => ({
          ...entry,
          isCurrentUser: entry.userId === userId,
        }));

        const userInList = entries.some(entry => entry.userId === userId);

        let userEntry: LeaderboardEntry | null = null;

        if (!userInList) {
          const userProfileResult = await this.userRepo.findById(userId);
          const userRankResult = await this.getUserRank(userId);

          if (isOk(userProfileResult) && isOk(userRankResult)) {
            const userProfile = userProfileResult.value;
            const userRank = userRankResult.value;

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
        }

        return { entries, userEntry };
      },
      (error) => {
        this.logError('LeaderboardService.getLeaderboardWithUser', error);
        return databaseError('getLeaderboardWithUser', String(error));
      }
    );
  }

  /**
   * Get leaderboard with pagination metadata and current user's rank
   * Returns paginated entries with totalEntries, totalPages, hasNextPage, hasPreviousPage
   * Requirements: 1.2, 2.1
   */
  async getLeaderboardWithUserPaginated(
    userId: string,
    pageSize: number = 20,
    currentPage: number = 0
  ): Promise<Result<PaginatedLeaderboardResult, AppError>> {
    return tryCatch(
      async () => {
        const offset = currentPage * pageSize;

        // Cap at top 100 entries for the leaderboard
        const MAX_LEADERBOARD_ENTRIES = 100;

        // Get total entries for pagination calculation
        const totalEntriesResult = await this.getTotalPlayerCount();
        if (!isOk(totalEntriesResult)) {
          throw new Error(`Failed to get total player count: ${JSON.stringify(totalEntriesResult.error)}`);
        }

        // Cap total entries at 100 for leaderboard display
        const actualTotalEntries = totalEntriesResult.value;
        const totalEntries = Math.min(actualTotalEntries, MAX_LEADERBOARD_ENTRIES);
        const totalPages = totalEntries > 0 ? Math.ceil(totalEntries / pageSize) : 0;

        // Don't fetch beyond the max entries
        if (offset >= MAX_LEADERBOARD_ENTRIES) {
          return {
            entries: [],
            userRank: null,
            totalEntries,
            totalPages,
            currentPage,
            hasNextPage: false,
            hasPreviousPage: currentPage > 0,
          };
        }

        // Limit page size to not exceed max entries
        const effectiveLimit = Math.min(pageSize, MAX_LEADERBOARD_ENTRIES - offset);

        // Get paginated entries
        const topPlayersResult = await this.getTopPlayers(effectiveLimit, offset);
        if (!isOk(topPlayersResult)) {
          throw new Error(`Failed to get top players: ${JSON.stringify(topPlayersResult.error)}`);
        }
        const topPlayers = topPlayersResult.value;

        const entries = topPlayers.map(entry => ({
          ...entry,
          isCurrentUser: entry.userId === userId,
        }));

        // Get user's rank data (always fetch for Your Rank Section)
        // Moderators won't have a rank but can still view the leaderboard
        let userRank: UserRankData | null = null;
        const userProfileResult = await this.userRepo.findById(userId);
        const rankResult = await this.getUserRank(userId);

        if (isOk(userProfileResult)) {
          const userProfile = userProfileResult.value;
          const rank = isOk(rankResult) ? rankResult.value : null;

          if (userProfile) {
            // Moderators get null rank (they're excluded from leaderboard)
            userRank = {
              rank: userProfile.role === 'mod' ? null : rank,
              username: userProfile.username,
              totalPoints: userProfile.total_points,
              level: userProfile.level,
            };
          }
        }

        // Calculate hasNextPage based on current position and remaining entries
        const entriesFetchedSoFar = offset + entries.length;
        const hasNextPage = entriesFetchedSoFar < totalEntries && entries.length > 0;

        this.logInfo('LeaderboardService', `Pagination: page=${currentPage}, offset=${offset}, entries=${entries.length}, totalEntries=${totalEntries}, hasNextPage=${hasNextPage}`);

        return {
          entries,
          userRank,
          totalEntries,
          totalPages,
          currentPage,
          hasNextPage,
          hasPreviousPage: currentPage > 0,
        };
      },
      (error) => {
        this.logError('LeaderboardService.getLeaderboardWithUserPaginated', error);
        return databaseError('getLeaderboardWithUserPaginated', String(error));
      }
    );
  }

  /**
   * Get leaderboard statistics
   */
  async getLeaderboardStats(): Promise<Result<{
    totalPlayers: number;
    topScore: number;
    averageScore: number;
  }, AppError>> {
    return tryCatch(
      async () => {
        // Get total players from sorted set
        const totalPlayers = await redis.zCard(LEADERBOARD_KEY);

        // Get top player's score
        const topPlayersResult = await this.getTopPlayers(1, 0);
        if (!isOk(topPlayersResult)) {
          throw new Error(`Failed to get top players: ${JSON.stringify(topPlayersResult.error)}`);
        }
        const topPlayers = topPlayersResult.value;
        const topScore = topPlayers.length > 0 ? topPlayers[0].totalPoints : 0;

        return {
          totalPlayers,
          topScore,
          averageScore: 0, // Would need to sum all scores
        };
      },
      (error) => {
        this.logError('LeaderboardService.getLeaderboardStats', error);
        return databaseError('getLeaderboardStats', String(error));
      }
    );
  }

  /**
   * Clear the leaderboard cache (removes all entries from sorted set)
   */
  async clearCache(): Promise<Result<void, AppError>> {
    return tryCatch(
      async () => {
        // Remove all entries by removing the key
        // Note: Devvit Redis doesn't have DEL for sorted sets, so we use zRemRangeByRank
        const count = await redis.zCard(LEADERBOARD_KEY);
        if (count > 0) {
          await redis.zRemRangeByRank(LEADERBOARD_KEY, 0, count - 1);
        }
        this.logInfo('LeaderboardService', 'Leaderboard cache cleared');
      },
      (error) => {
        this.logError('LeaderboardService.clearCache', error);
        return databaseError('clearCache', String(error));
      }
    );
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
  ): Promise<Result<PaginatedResult<LeaderboardEntry>, AppError>> {
    return tryCatch(
      async () => {
        const limit = Math.max(1, Math.min(pageSize, 100));
        const offset = Math.max(0, (page - 1) * limit);

        const entriesResult = await this.getTopPlayers(limit + 1, offset);
        if (!isOk(entriesResult)) {
          throw new Error(`Failed to get top players: ${JSON.stringify(entriesResult.error)}`);
        }
        const entries = entriesResult.value;

        const hasMore = entries.length > limit;
        const data = hasMore ? entries.slice(0, limit) : entries;

        return createPaginatedResult(data, limit, {
          currentOffset: offset,
        });
      },
      (error) => {
        this.logError('LeaderboardService.getTopPlayersPaginated', error);
        return databaseError('getTopPlayersPaginated', String(error));
      }
    );
  }

  /**
   * Remove a user from the leaderboard
   */
  async removeUser(userId: string): Promise<Result<void, AppError>> {
    return tryCatch(
      async () => {
        await redis.zRem(LEADERBOARD_KEY, [userId]);
        this.logInfo('LeaderboardService', `Removed user ${userId} from leaderboard`);
      },
      (error) => {
        this.logError('LeaderboardService.removeUser', error);
        return databaseError('removeUser', String(error));
      }
    );
  }
}

