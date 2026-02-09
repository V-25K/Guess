/**
 * Subscription API Routes
 * Handles subreddit subscription operations for both authenticated and guest users
 * 
 * Requirements: User engagement, community growth
 */

import { Router, type Request, type Response } from 'express';
import { context } from '@devvit/web/server';
import { SubscriptionService } from '../services/subscription.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { UserService } from '../services/user.service.js';
import { validateRequest, type ValidatedRequest } from '../middleware/validation.js';
import { guestIdSchema } from '../validation/schemas.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { RATE_LIMITS } from '../config/rate-limits.js';
import { handleResult, withResult } from '../utils/result-http.js';
import { validationError, internalError } from '../../shared/models/errors.js';
import { err, isOk } from '../../shared/utils/result.js';

const router = Router();

/**
 * GET /api/subscription/status
 * Get current user's subscription status
 * Supports both authenticated and guest users via query parameter
 * 
 * Query Parameters:
 * - guestId (optional): Guest user ID for guest user status
 */
router.get('/status', rateLimit(RATE_LIMITS['GET /api/user/profile']), async (req: Request, res: Response) => {
  const { userId } = context;
  const guestId = req.query.guestId as string;
  
  // Determine effective user ID
  let effectiveUserId: string | null = null;
  
  if (guestId) {
    // Validate guest ID format
    const guestIdValidation = guestIdSchema.safeParse(guestId);
    if (!guestIdValidation.success) {
      return handleResult(
        err(validationError([{ field: 'guestId', message: 'Invalid guest ID format' }])),
        res
      );
    }
    effectiveUserId = guestId;
  } else if (userId) {
    effectiveUserId = userId;
  }
  
  // If no user ID available, return not subscribed
  if (!effectiveUserId) {
    return res.json({
      isSubscribed: false,
      subscribedAt: null,
      source: 'unknown',
    });
  }
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const subscriptionService = new SubscriptionService(context, userRepo, userService);
  
  // Get subscription status
  const result = await subscriptionService.getSubscriptionStatus(effectiveUserId);
  return handleResult(result, res);
});

/**
 * POST /api/subscription/subscribe
 * Subscribe user to the current subreddit
 * Supports both authenticated and guest users
 * 
 * Body Parameters:
 * - guestId (optional): Guest user ID for guest subscriptions
 */
router.post('/subscribe', rateLimit(RATE_LIMITS['POST /api/attempts/submit']), async (req: Request, res: Response) => {
  const { userId } = context;
  const guestId = req.body.guestId as string;
  
  // Determine effective user ID
  let effectiveUserId: string;
  
  if (guestId) {
    // Validate guest ID format
    const guestIdValidation = guestIdSchema.safeParse(guestId);
    if (!guestIdValidation.success) {
      return handleResult(
        err(validationError([{ field: 'guestId', message: 'Invalid guest ID format' }])),
        res
      );
    }
    effectiveUserId = guestId;
  } else if (userId) {
    effectiveUserId = userId;
  } else {
    return handleResult(
      err(validationError([{ field: 'auth', message: 'Please sign in or create a guest profile to subscribe' }])),
      res
    );
  }
  
  try {
    // Initialize services
    const userRepo = new UserRepository(context);
    const userService = new UserService(context, userRepo);
    const subscriptionService = new SubscriptionService(context, userRepo, userService);
    
    // If guest user, verify guest exists
    if (guestId) {
      const guestResult = await userService.getGuestProfile(guestId);
      if (!isOk(guestResult) || !guestResult.value) {
        return handleResult(
          err(validationError([{ field: 'guestId', message: 'Guest user not found' }])),
          res
        );
      }
    }
    
    // Subscribe to subreddit
    const result = await subscriptionService.subscribeToSubreddit(effectiveUserId);
    return handleResult(result, res);
  } catch (error) {
    console.error('Subscription error:', error);
    return handleResult(
      err(internalError('Failed to process subscription request', error)),
      res
    );
  }
});

/**
 * POST /api/subscription/invalidate-cache
 * Invalidate subscription cache for current user
 * Useful when subscription status might have changed outside the app
 * 
 * Body Parameters:
 * - guestId (optional): Guest user ID for guest cache invalidation
 */
router.post('/invalidate-cache', rateLimit(RATE_LIMITS['POST /api/attempts/submit']), async (req: Request, res: Response) => {
  const { userId } = context;
  const guestId = req.body.guestId as string;
  
  // Determine effective user ID
  let effectiveUserId: string;
  
  if (guestId) {
    // Validate guest ID format
    const guestIdValidation = guestIdSchema.safeParse(guestId);
    if (!guestIdValidation.success) {
      return handleResult(
        err(validationError([{ field: 'guestId', message: 'Invalid guest ID format' }])),
        res
      );
    }
    effectiveUserId = guestId;
  } else if (userId) {
    effectiveUserId = userId;
  } else {
    return handleResult(
      err(validationError([{ field: 'auth', message: 'Please sign in or create a guest profile to invalidate cache' }])),
      res
    );
  }
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const subscriptionService = new SubscriptionService(context, userRepo, userService);
  
  // Invalidate cache
  const result = await subscriptionService.invalidateSubscriptionCache(effectiveUserId);
  return handleResult(result, res);
});

/**
 * GET /api/subscription/analytics
 * Get subscription analytics (admin/mod only)
 * Returns subscription statistics for the subreddit
 */
router.get('/analytics', rateLimit(RATE_LIMITS['GET /api/user/profile']), withResult(async (req: Request) => {
  const { userId } = context;
  
  if (!userId) {
    return err(validationError([{ field: 'auth', message: 'Authentication required' }]));
  }
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const subscriptionService = new SubscriptionService(context, userRepo, userService);
  
  // Check if user is a moderator
  const userResult = await userService.getUserProfile(userId);
  if (!isOk(userResult) || !userResult.value || userResult.value.role !== 'mod') {
    return err(validationError([{ field: 'auth', message: 'Moderator access required' }]));
  }
  
  // Get analytics
  return await subscriptionService.getSubscriptionAnalytics();
}));

export { router as subscriptionRoutes };