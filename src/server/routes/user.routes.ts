/**
 * User API Routes
 * Handles all user-related HTTP endpoints for both authenticated and guest users
 * 
 * Requirements: 8.2, 8.3, 10.1, 10.5, REQ-3.1, REQ-3.2, REQ-4.1, REQ-4.2
 */

import { Router, type Request } from 'express';
import { context, reddit } from '@devvit/web/server';
import { UserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { RATE_LIMITS } from '../config/rate-limits.js';
import { withResult } from '../utils/result-http.js';
import { validationError, notFoundError } from '../../shared/models/errors.js';
import { ok, err, isOk } from '../../shared/utils/result.js';
import { validateRequest, type ValidatedRequest } from '../middleware/validation.js';
import { guestIdSchema, type GetGuestProfileInput } from '../validation/schemas.js';
import type { GuestProfile, UserProfile } from '../../shared/models/user.types.js';

const router = Router();

/**
 * GET /api/user/profile
 * Get the current user's profile (authenticated, anonymous, or guest)
 * Requirements: 8.2, 8.3, 10.1, 10.5, REQ-3.1, REQ-4.1
 * 
 * Query Parameters:
 * - guestId (optional): Guest user ID for guest user profile retrieval (legacy)
 */
router.get('/profile', rateLimit(RATE_LIMITS['GET /api/user/profile']), withResult(async (req: Request) => {
  const { userId, username } = context;
  const guestId = req.query.guestId as string;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  
  // Handle legacy guest user request
  if (guestId) {
    // Validate guest ID format
    const guestIdValidation = guestIdSchema.safeParse(guestId);
    if (!guestIdValidation.success) {
      return err(validationError([{ field: 'guestId', message: 'Invalid guest ID format' }]));
    }
    
    // Get guest profile
    const profileResult = await userService.getGuestProfile(guestId);
    
    if (!isOk(profileResult)) {
      return profileResult;
    }
    
    if (!profileResult.value) {
      return err(notFoundError('Guest Profile', guestId));
    }
    
    return ok(profileResult.value);
  }
  
  // Handle authenticated user request
  if (userId && username) {
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
  }
  
  // Handle anonymous user with session
  const effectiveUserId = (req as any).effectiveUserId;
  if (effectiveUserId && (req as any).isAnonymous) {
    // First, check if profile already exists
    const existsResult = await userService.guestProfileExists(effectiveUserId);
    
    if (isOk(existsResult) && existsResult.value) {
      // Profile exists, get it
      const profileResult = await userService.getGuestProfile(effectiveUserId);
      if (isOk(profileResult) && profileResult.value) {
        console.log('Using existing anonymous profile for:', effectiveUserId);
        return ok(profileResult.value);
      }
    }
    
    // Profile doesn't exist, create new one
    const shortId = effectiveUserId.slice(-8); // Last 8 characters for shorter username
    const anonymousProfile: GuestProfile = {
      id: effectiveUserId,
      username: `guest_${shortId}`, // Shorter username
      total_points: 30, // Give anonymous users starting points for hints
      total_experience: 0,
      level: 1,
      challenges_created: 0,
      challenges_attempted: 0,
      challenges_solved: 0,
      current_streak: 0,
      best_streak: 0,
      last_challenge_created_at: null,
      role: 'player' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isGuest: true as const,
      is_subscribed: false,
      subscribed_at: null,
    };
    
    // Create the profile with better error handling
    const createResult = await userService.createGuestProfile(anonymousProfile);
    
    if (isOk(createResult)) {
      console.log('Successfully created anonymous profile for:', effectiveUserId);
      return ok(createResult.value);
    } else {
      console.error('Failed to create anonymous profile:', createResult.error);
      // If creation fails, convert guest profile to UserProfile format for client-side use
      const fallbackProfile: UserProfile = {
        id: anonymousProfile.id,
        user_id: anonymousProfile.id,
        username: anonymousProfile.username,
        total_points: anonymousProfile.total_points,
        total_experience: anonymousProfile.total_experience,
        level: anonymousProfile.level,
        challenges_created: anonymousProfile.challenges_created,
        challenges_attempted: anonymousProfile.challenges_attempted,
        challenges_solved: anonymousProfile.challenges_solved,
        current_streak: anonymousProfile.current_streak,
        best_streak: anonymousProfile.best_streak,
        last_challenge_created_at: anonymousProfile.last_challenge_created_at,
        role: anonymousProfile.role,
        is_subscribed: anonymousProfile.is_subscribed,
        subscribed_at: anonymousProfile.subscribed_at,
        created_at: anonymousProfile.created_at,
        updated_at: anonymousProfile.updated_at,
      };
      return ok(fallbackProfile);
    }
  }
  
  // No user available - return error that client can handle gracefully
  return err(validationError([{ field: 'auth', message: 'No authenticated user or session' }]));
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
 * Get the current user's statistics including rank (authenticated or guest)
 * Requirements: 8.2, 8.3, REQ-3.1, REQ-4.1
 * 
 * Query Parameters:
 * - guestId (optional): Guest user ID for guest user stats retrieval
 */
router.get('/stats', rateLimit(RATE_LIMITS['GET /api/user/stats']), withResult(async (req: Request) => {
  const { userId, username } = context;
  const guestId = req.query.guestId as string;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const leaderboardService = new LeaderboardService(context, userRepo);
  
  // Handle guest user request
  if (guestId) {
    // Validate guest ID format
    const guestIdValidation = guestIdSchema.safeParse(guestId);
    if (!guestIdValidation.success) {
      return err(validationError([{ field: 'guestId', message: 'Invalid guest ID format' }]));
    }
    
    // Get guest profile
    const profileResult = await userService.getGuestProfile(guestId);
    
    if (!isOk(profileResult)) {
      return profileResult;
    }
    
    if (!profileResult.value) {
      return err(notFoundError('Guest Profile', guestId));
    }
    
    const profile = profileResult.value;
    
    // Get rank for guest user
    const rankResult = await userService.getGuestUserRank(guestId);
    
    if (!isOk(rankResult)) {
      return rankResult;
    }
    
    // Get exp to next level for guest user
    const expResult = await userService.getGuestExpToNextLevel(guestId);
    
    if (!isOk(expResult)) {
      return expResult;
    }
    
    // Return guest stats
    return ok({
      ...profile,
      rank: rankResult.value,
      expToNextLevel: expResult.value,
    });
  }
  
  // Handle authenticated user request
  if (!userId || !username) {
    return err(validationError([{ field: 'auth', message: 'User ID or guest ID required' }]));
  }
  
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
