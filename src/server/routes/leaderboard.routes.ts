/**
 * Leaderboard API Routes
 * Handles all leaderboard-related HTTP endpoints
 * 
 * Requirements: 8.2, 8.3
 */

import { Router, type Request, type Response } from 'express';
import { context } from '@devvit/web/server';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { validateRequest, type ValidatedRequest } from '../middleware/validation.js';
import { paginationSchema } from '../validation/schemas.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { RATE_LIMITS } from '../config/rate-limits.js';
import { handleResult } from '../utils/result-http.js';
import { ok, err, isOk } from '../../shared/utils/result.js';
import { validationError, notFoundError } from '../../shared/models/errors.js';

const router = Router();

/**
 * GET /api/leaderboard
 * Get top players on the leaderboard with user rank and total players
 * Requirements: 8.2, 8.3, 5.1, 5.2
 */
router.get('/', rateLimit(RATE_LIMITS['GET /api/leaderboard']), validateRequest({ query: paginationSchema }), async (req: Request, res: Response) => {
  try {
    const { userId } = context;

    // Get validated pagination params
    const { page, limit } = (req as ValidatedRequest<{ query: { page: number; limit: number; sortBy?: string; order: string } }>).validated.query;

    // Initialize services
    const userRepo = new UserRepository(context);
    const leaderboardService = new LeaderboardService(context, userRepo);

    // Use the paginated service which returns full userRank data
    const leaderboardResult = await leaderboardService.getLeaderboardWithUserPaginated(
      userId || '',
      limit,
      page - 1 // Service uses 0-indexed pages
    );

    if (!isOk(leaderboardResult)) {
      return handleResult(leaderboardResult, res);
    }

    const leaderboardData = leaderboardResult.value;

    // Get actual total player count (uncapped) for display
    const totalPlayersResult = await leaderboardService.getTotalPlayerCount();
    const actualTotalPlayers = isOk(totalPlayersResult) ? totalPlayersResult.value : leaderboardData.totalEntries;

    // Return response matching client expectations (LeaderboardResponse type)
    const result = ok({
      entries: leaderboardData.entries,
      userRank: leaderboardData.userRank, // Full UserRankData object with rank, username, totalPoints, level
      totalEntries: leaderboardData.totalEntries,
      totalPages: leaderboardData.totalPages,
      currentPage: page,
      hasNextPage: leaderboardData.hasNextPage,
      hasPreviousPage: leaderboardData.hasPreviousPage,
      totalPlayers: actualTotalPlayers, // Uncapped actual total
    });

    handleResult(result, res);
  } catch (error) {
    console.error('[LeaderboardRoutes] Unexpected error in GET /api/leaderboard:', error);
    if (error instanceof Error) {
      console.error('[LeaderboardRoutes] Error stack:', error.stack);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/leaderboard/user
 * Get the current user's rank on the leaderboard
 * Requirements: 8.2, 8.3, 5.1, 5.2
 */
router.get('/user', rateLimit(RATE_LIMITS['GET /api/leaderboard/user']), async (_req: Request, res: Response) => {
  try {
    const { userId } = context;

    // Validate authentication
    if (!userId) {
      const result = err(validationError([
        { field: 'auth', message: 'User ID required' }
      ]));
      return handleResult(result, res);
    }

    // Initialize services
    const userRepo = new UserRepository(context);
    const leaderboardService = new LeaderboardService(context, userRepo);

    // Get user rank
    const rankResult = await leaderboardService.getUserRank(userId);
    if (!isOk(rankResult)) {
      return handleResult(rankResult, res);
    }
    const rank = rankResult.value;

    if (rank === null) {
      const result = err(notFoundError('User rank', userId));
      return handleResult(result, res);
    }

    // Get user profile for additional info
    const profileResult = await userRepo.findById(userId);
    if (!isOk(profileResult)) {
      return handleResult(profileResult, res);
    }
    const profile = profileResult.value;

    if (!profile) {
      const result = err(notFoundError('User profile', userId));
      return handleResult(result, res);
    }

    const result = ok({
      rank,
      userId: profile.user_id,
      username: profile.username,
      totalPoints: profile.total_points,
      level: profile.level,
      challengesSolved: profile.challenges_solved,
    });

    handleResult(result, res);
  } catch (error) {
    console.error('[LeaderboardRoutes] Unexpected error in GET /api/leaderboard/user:', error);
    if (error instanceof Error) {
      console.error('[LeaderboardRoutes] Error stack:', error.stack);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as leaderboardRoutes };
