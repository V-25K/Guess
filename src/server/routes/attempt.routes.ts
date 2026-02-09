/**
 * Attempt API Routes
 * Handles all challenge attempt-related HTTP endpoints for both authenticated and guest users
 * 
 * Requirements: 8.2, 8.3, REQ-3.1, REQ-3.2, REQ-4.1, REQ-4.2
 */

import { Router, type Request, type Response } from 'express';
import { context } from '@devvit/web/server';
import { AttemptService } from '../services/attempt.service.js';
import { AttemptRepository } from '../repositories/attempt.repository.js';
import { UserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { validateRequest, type ValidatedRequest } from '../middleware/validation.js';
import { 
  submitGuessSchema, 
  revealHintSchema,
  giveUpChallengeSchema,
  guestIdSchema,
  type SubmitGuessInput,
  type RevealHintInput,
  type GiveUpChallengeInput
} from '../validation/schemas.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { RATE_LIMITS } from '../config/rate-limits.js';
import { handleResult } from '../utils/result-http.js';
import { validationError } from '../../shared/models/errors.js';
import { err, isOk } from '../../shared/utils/result.js';
import type { GuestProfile } from '../../shared/models/user.types.js';

const router = Router();

/**
 * Helper function to determine effective user ID from request
 * Handles authenticated users, session-based anonymous users, and legacy guest users
 */
function getEffectiveUserId(req: Request, guestId?: string): { effectiveUserId: string; isAnonymous: boolean } | { error: any } {
  const { userId } = context;
  
  if (userId) {
    // Authenticated user
    return { effectiveUserId: userId, isAnonymous: false };
  } else if ((req as any).effectiveUserId) {
    // Anonymous user with session ID
    return { effectiveUserId: (req as any).effectiveUserId, isAnonymous: true };
  } else if (guestId) {
    // Legacy guest user (for backward compatibility)
    const guestIdValidation = guestIdSchema.safeParse(guestId);
    if (!guestIdValidation.success) {
      return { error: validationError([{ field: 'guestId', message: 'Invalid guest ID format' }]) };
    }
    return { effectiveUserId: guestId, isAnonymous: true };
  } else {
    return { error: validationError([{ field: 'auth', message: 'User ID, session, or guest ID required' }]) };
  }
}

/**
 * POST /api/attempts/submit
 * Submit a guess for a challenge (authenticated or anonymous user)
 * Requirements: 8.2, 8.3, REQ-3.1, REQ-3.2
 * 
 * Body Parameters:
 * - challengeId: UUID of the challenge
 * - guess: The user's guess
 * - guestId (optional): Guest user ID for guest submissions (deprecated - use session)
 */
router.post('/submit', rateLimit(RATE_LIMITS['POST /api/attempts/submit']), validateRequest(submitGuessSchema), async (req: Request, res: Response) => {
  const { userId } = context;
  
  // Get validated data
  const { challengeId, guess } = (req as ValidatedRequest<SubmitGuessInput>).validated.body;
  const guestId = req.body.guestId as string;
  
  // Determine user ID using helper function
  const userIdResult = getEffectiveUserId(req, guestId);
  if ('error' in userIdResult) {
    return handleResult(err(userIdResult.error), res);
  }
  
  const { effectiveUserId, isAnonymous } = userIdResult;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // For anonymous users, ensure profile exists (create only if needed)
  if (isAnonymous && !guestId) {
    // First, check if profile already exists
    const existsResult = await userService.guestProfileExists(effectiveUserId);
    
    if (isOk(existsResult) && !existsResult.value) {
      // Profile doesn't exist, create it
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
      
      // Try to create the anonymous user profile
      try {
        const createResult = await userService.createGuestProfile(anonymousProfile);
        if (!isOk(createResult)) {
          console.error('Failed to create anonymous profile:', createResult.error);
        } else {
          console.log('Successfully created anonymous profile for:', effectiveUserId);
        }
      } catch (error) {
        console.error('Anonymous profile creation error:', error);
      }
    } else {
      console.log('Anonymous profile already exists for:', effectiveUserId);
    }
  }
  
  // If legacy guest user, verify guest exists
  if (guestId && !userId && !(req as any).effectiveUserId) {
    const guestResult = await userService.getGuestProfile(guestId);
    if (!isOk(guestResult) || !guestResult.value) {
      return handleResult(
        err(validationError([{ field: 'guestId', message: 'Guest user not found' }])),
        res
      );
    }
  }
  
  // Submit guess and handle result
  const result = await attemptService.submitGuess(effectiveUserId, challengeId, guess);
  return handleResult(result, res);
});

/**
 * GET /api/attempts/user
 * Get all attempts by the current user (authenticated or guest)
 * Requirements: 8.2, 8.3, REQ-3.1, REQ-4.1
 * 
 * Query Parameters:
 * - guestId (optional): Guest user ID for guest user attempts
 */
router.get('/user', rateLimit(RATE_LIMITS['GET /api/attempts/user']), async (req: Request, res: Response) => {
  const guestId = req.query.guestId as string;
  
  // Determine user ID using helper function
  const userIdResult = getEffectiveUserId(req, guestId);
  if ('error' in userIdResult) {
    return handleResult(err(userIdResult.error), res);
  }
  
  const { effectiveUserId } = userIdResult;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
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
  
  // Get user attempts and handle result
  const result = await attemptService.getUserAttempts(effectiveUserId);
  return handleResult(result, res);
});

/**
 * GET /api/attempts/challenge/:challengeId
 * Get the current user's attempt for a specific challenge (authenticated or guest)
 * Requirements: 8.2, 8.3, REQ-3.1, REQ-4.1
 * 
 * Query Parameters:
 * - guestId (optional): Guest user ID for guest user attempts
 */
router.get('/challenge/:challengeId', rateLimit(RATE_LIMITS['GET /api/attempts/user']), async (req: Request, res: Response) => {
  const challengeId = Array.isArray(req.params.challengeId) ? req.params.challengeId[0] : req.params.challengeId;
  const guestId = req.query.guestId as string;
  
  // Validate challengeId
  if (!challengeId) {
    return handleResult(
      err(validationError([{ field: 'challengeId', message: 'Challenge ID is required' }])),
      res
    );
  }
  
  // Determine user ID using helper function
  const userIdResult = getEffectiveUserId(req, guestId);
  if ('error' in userIdResult) {
    return handleResult(err(userIdResult.error), res);
  }
  
  const { effectiveUserId } = userIdResult;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
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
  
  // Get attempt for this challenge
  const result = await attemptService.getAttempt(effectiveUserId, challengeId);
  return handleResult(result, res);
});

/**
 * POST /api/attempts/hint
 * Reveal a hint for a challenge (authenticated or guest user)
 * Requirements: 8.2, 8.3, REQ-3.1, REQ-3.2
 * 
 * Body Parameters:
 * - challengeId: UUID of the challenge
 * - imageIndex: Index of the image to reveal
 * - hintCost: Cost in points to reveal the hint
 * - guestId (optional): Guest user ID for guest submissions
 */
router.post('/hint', rateLimit(RATE_LIMITS['POST /api/attempts/hint']), validateRequest(revealHintSchema), async (req: Request, res: Response) => {
  // Get validated request data
  const { challengeId, imageIndex, hintCost } = (req as ValidatedRequest<RevealHintInput>).validated.body;
  const guestId = req.body.guestId as string;
  
  // Determine user ID using helper function
  const userIdResult = getEffectiveUserId(req, guestId);
  if ('error' in userIdResult) {
    return handleResult(err(userIdResult.error), res);
  }
  
  const { effectiveUserId } = userIdResult;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
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
  
  // Reveal hint and handle result
  const result = await attemptService.revealHint(effectiveUserId, challengeId, imageIndex, hintCost);
  
  // If successful, also fetch the challenge to get the hint description
  if (isOk(result) && result.value.success) {
    const challengeResult = await challengeRepo.findById(challengeId);
    let hint = 'No description available';
    let potentialScore = 0;
    
    if (isOk(challengeResult) && challengeResult.value) {
      const challenge = challengeResult.value;
      // Parse image_descriptions if it's a string
      let descriptions: string[] = [];
      if (challenge.image_descriptions) {
        if (typeof challenge.image_descriptions === 'string') {
          try {
            descriptions = JSON.parse(challenge.image_descriptions);
          } catch {
            descriptions = [];
          }
        } else if (Array.isArray(challenge.image_descriptions)) {
          descriptions = challenge.image_descriptions;
        }
      }
      
      if (descriptions[imageIndex]) {
        hint = descriptions[imageIndex];
      }
      
      // Calculate potential score based on hints used
      const hintsUsed = result.value.attempt?.hints_used?.length || 0;
      const attemptsMade = result.value.attempt?.attempts_made || 0;
      const imageCount = challenge.image_url.split(',').length;
      const { calculatePotentialScore } = await import('../../shared/utils/reward-calculator.js');
      potentialScore = calculatePotentialScore(attemptsMade, hintsUsed, imageCount);
    }
    
    // Return the expected HintRevealResponse format
    return res.json({
      hint,
      potentialScore,
    });
  }
  
  return handleResult(result, res);
});

/**
 * POST /api/attempts/giveup
 * Give up on a challenge (mark as game over without solving) - authenticated or guest user
 * Requirements: 8.2, 8.3, REQ-3.1, REQ-3.2
 * 
 * Body Parameters:
 * - challengeId: UUID of the challenge to give up on
 * - guestId (optional): Guest user ID for guest submissions
 */
router.post('/giveup', rateLimit(RATE_LIMITS['POST /api/attempts/submit']), validateRequest(giveUpChallengeSchema), async (req: Request, res: Response) => {
  // Get validated data
  const { challengeId } = (req as ValidatedRequest<GiveUpChallengeInput>).validated.body;
  const guestId = req.body.guestId as string;
  
  // Determine user ID using helper function
  const userIdResult = getEffectiveUserId(req, guestId);
  if ('error' in userIdResult) {
    return handleResult(err(userIdResult.error), res);
  }
  
  const { effectiveUserId } = userIdResult;
  
  // Initialize services
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
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
  
  // Give up on challenge and handle result
  const result = await attemptService.giveUpChallenge(effectiveUserId, challengeId);
  return handleResult(result, res);
});

export { router as attemptRoutes };
