/**
 * User API Routes
 * Handles all user-related HTTP endpoints
 * 
 * Requirements: 8.2, 8.3, 10.1, 10.5
 */

import { Router } from 'express';
import { context, reddit } from '@devvit/web/server';
import { UserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { RATE_LIMITS } from '../config/rate-limits.js';
import { withResult } from '../utils/result-http.js';
import { validationError, notFoundError } from '../../shared/models/errors.js';
import { ok, err, isOk } from '../../shared/utils/result.js';

const router = Router();

/**
 * GET /api/user/profile
 * Get the current user's profile
 * Requirements: 8.2, 8.3, 10.1, 10.5
 */
router.get('/profile', rateLimit(RATE_LIMITS['GET /api/user/profile']), withResult(async () => {
  const { userId, username } = context;
  
  // Validate authentication (Requirements: 10.5)
  if (!userId || !username) {
    return err(validationError([{ field: 'auth', message: 'Unauthorized' }]));
  }
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  
  // Get user profile
  const profileResult = await userService.getUserProfile(userId, username);
  
  // Check if result is an error
  if (!isOk(profileResult)) {
    return profileResult;
  }
  
  // Check if profile exists
  if (!profileResult.value) {
    return err(notFoundError('Profile', userId));
  }
  
  // Return profile (Requirements: 8.2, 8.3)
  return ok(profileResult.value);
}));

/**
 * PATCH /api/users/:userId
 * Update user profile (endpoint not yet implemented)
 * 
 * When implementing this endpoint, use:
 * router.patch('/:userId', validateRequest(updateProfileSchema), async (req: Request, res: Response) => {
 *   const { userId } = (req as ValidatedRequest<UpdateProfileInput>).validated.params;
 *   const { username, bio } = (req as ValidatedRequest<UpdateProfileInput>).validated.body;
 *   // Implementation here
 * });
 */

/**
 * GET /api/user/stats
 * Get the current user's statistics including rank
 * Requirements: 8.2, 8.3
 */
router.get('/stats', rateLimit(RATE_LIMITS['GET /api/user/stats']), withResult(async () => {
  const { userId, username } = context;
  
  // Validate authentication
  if (!userId || !username) {
    return err(validationError([{ field: 'auth', message: 'Unauthorized' }]));
  }
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const leaderboardService = new LeaderboardService(context, userRepo);
  
  // Get user profile
  const profileResult = await userService.getUserProfile(userId, username);
  
  if (!isOk(profileResult)) {
    return profileResult;
  }
  
  if (!profileResult.value) {
    return err(notFoundError('Profile', userId));
  }
  
  const profile = profileResult.value;
  
  // Get rank
  const rankResult = await leaderboardService.getUserRank(userId);
  
  if (!isOk(rankResult)) {
    return rankResult;
  }
  
  // Get exp to next level
  const expResult = await userService.getExpToNextLevel(userId);
  
  if (!isOk(expResult)) {
    return expResult;
  }
  
  // Return stats
  return ok({
    ...profile,
    rank: rankResult.value,
    expToNextLevel: expResult.value,
  });
}));

/**
 * POST /api/user/subscribe
 * Subscribe the current user to the subreddit where the app is installed
 */
router.post('/subscribe', rateLimit(RATE_LIMITS['GET /api/user/profile']), withResult(async () => {
  const { userId } = context;
  
  // Validate authentication
  if (!userId) {
    return err(validationError([{ field: 'auth', message: 'Unauthorized' }]));
  }
  
  try {
    // Subscribe user to the current subreddit
    await reddit.subscribeToCurrentSubreddit();
    return ok({ success: true, message: 'Successfully joined the community!' });
  } catch (error) {
    // User might already be subscribed or there's an error
    const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe';
    return err(validationError([{ field: 'subscribe', message: errorMessage }]));
  }
}));

export { router as userRoutes };
