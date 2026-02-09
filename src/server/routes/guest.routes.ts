/**
 * Guest User API Routes
 * Handles all guest user-related HTTP endpoints
 * 
 * Requirements: REQ-3.1, REQ-3.2, REQ-3.4
 */

import { Router, type Request, type Response } from 'express';
import { UserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { AttemptService } from '../services/attempt.service.js';
import { AttemptRepository } from '../repositories/attempt.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { validateRequest, type ValidatedRequest } from '../middleware/validation.js';
import { 
  createGuestProfileSchema,
  getGuestProfileSchema,
  updateGuestProfileSchema,
  submitGuestGuessSchema,
  getGuestAttemptSchema,
  revealGuestHintSchema,
  giveUpGuestChallengeSchema,
  type CreateGuestProfileInput,
  type GetGuestProfileInput,
  type UpdateGuestProfileInput,
  type SubmitGuestGuessInput,
  type GetGuestAttemptInput,
  type RevealGuestHintInput,
  type GiveUpGuestChallengeInput
} from '../validation/schemas.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { RATE_LIMITS } from '../config/rate-limits.js';
import { withResult, handleResult } from '../utils/result-http.js';
import { validationError, notFoundError } from '../../shared/models/errors.js';
import { ok, err, isOk } from '../../shared/utils/result.js';
import { context } from '@devvit/web/server';
import type { GuestProfile } from '../../shared/models/user.types.js';

const router = Router();

// ============================================
// Guest User Profile Operations
// ============================================

/**
 * POST /api/guest/profile
 * Create a new guest user profile
 * Requirements: REQ-3.1, REQ-3.2
 */
router.post('/profile', rateLimit(RATE_LIMITS['GET /api/user/profile']), validateRequest(createGuestProfileSchema), withResult(async (req: Request) => {
  // Get validated data
  const { body } = (req as ValidatedRequest<CreateGuestProfileInput>).validated;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  
  // Convert request body to GuestProfile format
  const guestProfile: GuestProfile = {
    ...body,
    last_challenge_created_at: body.last_challenge_created_at || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    isGuest: true,
    is_subscribed: false,
    subscribed_at: null,
  };
  
  // Validate guest user data
  const validation = userRepo.validateGuestUser(guestProfile);
  if (!validation.isValid) {
    return err(validationError(validation.errors.map(error => ({ field: 'profile', message: error }))));
  }
  
  // Create guest profile
  const result = await userService.createGuestProfile(guestProfile);
  
  if (!isOk(result)) {
    return result;
  }
  
  return ok(result.value);
}));

/**
 * GET /api/guest/profile/:guestId
 * Get a guest user profile by ID
 * Requirements: REQ-3.1, REQ-3.4
 */
router.get('/profile/:guestId', rateLimit(RATE_LIMITS['GET /api/user/profile']), validateRequest(getGuestProfileSchema), withResult(async (req: Request) => {
  // Get validated data
  const { guestId } = (req as ValidatedRequest<GetGuestProfileInput>).validated.params;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  
  // Get guest profile
  const profileResult = await userService.getGuestProfile(guestId);
  
  if (!isOk(profileResult)) {
    return profileResult;
  }
  
  if (!profileResult.value) {
    return err(notFoundError('Guest Profile', guestId));
  }
  
  return ok(profileResult.value);
}));

/**
 * PATCH /api/guest/profile/:guestId
 * Update a guest user profile
 * Requirements: REQ-3.1, REQ-3.2
 */
router.patch('/profile/:guestId', rateLimit(RATE_LIMITS['GET /api/user/profile']), validateRequest(updateGuestProfileSchema), withResult(async (req: Request) => {
  // Get validated data
  const { guestId } = (req as ValidatedRequest<UpdateGuestProfileInput>).validated.params;
  const updates = (req as ValidatedRequest<UpdateGuestProfileInput>).validated.body;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  
  // Validate guest user data if provided
  if (Object.keys(updates).length > 0) {
    const validation = userRepo.validateGuestUser({ id: guestId, ...updates });
    if (!validation.isValid) {
      return err(validationError(validation.errors.map(error => ({ field: 'profile', message: error }))));
    }
  }
  
  // Update guest profile
  const result = await userService.updateGuestProfile(guestId, updates);
  
  if (!isOk(result)) {
    return result;
  }
  
  return ok({ success: result.value });
}));

/**
 * GET /api/guest/stats/:guestId
 * Get guest user statistics including rank
 * Requirements: REQ-3.1, REQ-3.4
 */
router.get('/stats/:guestId', rateLimit(RATE_LIMITS['GET /api/user/stats']), validateRequest(getGuestProfileSchema), withResult(async (req: Request) => {
  // Get validated data
  const { guestId } = (req as ValidatedRequest<GetGuestProfileInput>).validated.params;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const leaderboardService = new LeaderboardService(context, userRepo);
  
  // Get guest profile
  const profileResult = await userService.getGuestProfile(guestId);
  
  if (!isOk(profileResult)) {
    return profileResult;
  }
  
  if (!profileResult.value) {
    return err(notFoundError('Guest Profile', guestId));
  }
  
  const profile = profileResult.value;
  
  // Get rank
  const rankResult = await userService.getGuestUserRank(guestId);
  
  if (!isOk(rankResult)) {
    return rankResult;
  }
  
  // Get exp to next level
  const expResult = await userService.getGuestExpToNextLevel(guestId);
  
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
 * DELETE /api/guest/profile/:guestId
 * Delete a guest user profile
 * Requirements: REQ-3.1
 */
router.delete('/profile/:guestId', rateLimit(RATE_LIMITS['GET /api/user/profile']), validateRequest(getGuestProfileSchema), withResult(async (req: Request) => {
  // Get validated data
  const { guestId } = (req as ValidatedRequest<GetGuestProfileInput>).validated.params;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  
  // Delete guest profile
  const result = await userService.deleteGuestProfile(guestId);
  
  if (!isOk(result)) {
    return result;
  }
  
  return ok({ success: result.value });
}));

// ============================================
// Guest User Attempt Operations
// ============================================

/**
 * POST /api/guest/attempts/submit
 * Submit a guess for a challenge as a guest user
 * Requirements: REQ-3.1, REQ-3.2
 */
router.post('/attempts/submit', rateLimit(RATE_LIMITS['POST /api/attempts/submit']), validateRequest(submitGuestGuessSchema), async (req: Request, res: Response) => {
  // Get validated data
  const { challengeId, guess, guestId } = (req as ValidatedRequest<SubmitGuestGuessInput>).validated.body;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // Check if guest user exists
  const guestResult = await userService.getGuestProfile(guestId);
  if (!isOk(guestResult) || !guestResult.value) {
    return handleResult(
      err(validationError([{ field: 'guestId', message: 'Guest user not found' }])),
      res
    );
  }
  
  // Submit guess using guest ID as user ID
  const result = await attemptService.submitGuess(guestId, challengeId, guess);
  return handleResult(result, res);
});

/**
 * GET /api/guest/attempts/:guestId
 * Get all attempts by a guest user
 * Requirements: REQ-3.1, REQ-3.4
 */
router.get('/attempts/:guestId', rateLimit(RATE_LIMITS['GET /api/attempts/user']), validateRequest(getGuestProfileSchema), async (req: Request, res: Response) => {
  // Get validated data
  const { guestId } = (req as ValidatedRequest<GetGuestProfileInput>).validated.params;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // Check if guest user exists
  const guestResult = await userService.getGuestProfile(guestId);
  if (!isOk(guestResult) || !guestResult.value) {
    return handleResult(
      err(validationError([{ field: 'guestId', message: 'Guest user not found' }])),
      res
    );
  }
  
  // Get guest attempts using guest ID as user ID
  const result = await attemptService.getUserAttempts(guestId);
  return handleResult(result, res);
});

/**
 * GET /api/guest/attempts/challenge/:challengeId/:guestId
 * Get a guest user's attempt for a specific challenge
 * Requirements: REQ-3.1, REQ-3.4
 */
router.get('/attempts/challenge/:challengeId/:guestId', rateLimit(RATE_LIMITS['GET /api/attempts/user']), validateRequest(getGuestAttemptSchema), async (req: Request, res: Response) => {
  // Get validated data
  const { challengeId, guestId } = (req as ValidatedRequest<GetGuestAttemptInput>).validated.params;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // Check if guest user exists
  const guestResult = await userService.getGuestProfile(guestId);
  if (!isOk(guestResult) || !guestResult.value) {
    return handleResult(
      err(validationError([{ field: 'guestId', message: 'Guest user not found' }])),
      res
    );
  }
  
  // Get attempt for this challenge using guest ID as user ID
  const result = await attemptService.getAttempt(guestId, challengeId);
  return handleResult(result, res);
});

/**
 * POST /api/guest/attempts/hint
 * Reveal a hint for a challenge as a guest user
 * Requirements: REQ-3.1, REQ-3.2
 */
router.post('/attempts/hint', rateLimit(RATE_LIMITS['POST /api/attempts/hint']), validateRequest(revealGuestHintSchema), async (req: Request, res: Response) => {
  // Get validated data
  const { challengeId, imageIndex, hintCost, guestId } = (req as ValidatedRequest<RevealGuestHintInput>).validated.body;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // Check if guest user exists
  const guestResult = await userService.getGuestProfile(guestId);
  if (!isOk(guestResult) || !guestResult.value) {
    return handleResult(
      err(validationError([{ field: 'guestId', message: 'Guest user not found' }])),
      res
    );
  }
  
  // Reveal hint using guest ID as user ID
  const result = await attemptService.revealHint(guestId, challengeId, imageIndex, hintCost);
  
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
 * POST /api/guest/attempts/giveup
 * Give up on a challenge as a guest user
 * Requirements: REQ-3.1, REQ-3.2
 */
router.post('/attempts/giveup', rateLimit(RATE_LIMITS['POST /api/attempts/submit']), validateRequest(giveUpGuestChallengeSchema), async (req: Request, res: Response) => {
  // Get validated data
  const { challengeId, guestId } = (req as ValidatedRequest<GiveUpGuestChallengeInput>).validated.body;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // Check if guest user exists
  const guestResult = await userService.getGuestProfile(guestId);
  if (!isOk(guestResult) || !guestResult.value) {
    return handleResult(
      err(validationError([{ field: 'guestId', message: 'Guest user not found' }])),
      res
    );
  }
  
  // Give up on challenge using guest ID as user ID
  const result = await attemptService.giveUpChallenge(guestId, challengeId);
  return handleResult(result, res);
});

export { router as guestRoutes };