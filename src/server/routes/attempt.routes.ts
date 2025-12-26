/**
 * Attempt API Routes
 * Handles all challenge attempt-related HTTP endpoints
 * 
 * Requirements: 8.2, 8.3
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
  type SubmitGuessInput,
  type RevealHintInput 
} from '../validation/schemas.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { RATE_LIMITS } from '../config/rate-limits.js';
import { handleResult } from '../utils/result-http.js';
import { validationError } from '../../shared/models/errors.js';
import { err, isOk } from '../../shared/utils/result.js';

const router = Router();

/**
 * POST /api/attempts/submit
 * Submit a guess for a challenge
 * Requirements: 8.2, 8.3
 */
router.post('/submit', rateLimit(RATE_LIMITS['POST /api/attempts/submit']), validateRequest(submitGuessSchema), async (req: Request, res: Response) => {
  const { userId } = context;
  
  // Validate authentication
  if (!userId) {
    return handleResult(
      err(validationError([{ field: 'auth', message: 'User not authenticated' }])),
      res
    );
  }
  
  // Get validated data
  const { challengeId, guess } = (req as ValidatedRequest<SubmitGuessInput>).validated.body;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // Submit guess and handle result
  const result = await attemptService.submitGuess(userId, challengeId, guess);
  return handleResult(result, res);
});

/**
 * GET /api/attempts/user
 * Get all attempts by the current user
 * Requirements: 8.2, 8.3
 */
router.get('/user', rateLimit(RATE_LIMITS['GET /api/attempts/user']), async (_req: Request, res: Response) => {
  const { userId } = context;
  
  // Validate authentication
  if (!userId) {
    return handleResult(
      err(validationError([{ field: 'auth', message: 'User not authenticated' }])),
      res
    );
  }
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // Get user attempts and handle result
  const result = await attemptService.getUserAttempts(userId);
  return handleResult(result, res);
});

/**
 * GET /api/attempts/challenge/:challengeId
 * Get the current user's attempt for a specific challenge
 * Requirements: 8.2, 8.3
 */
router.get('/challenge/:challengeId', rateLimit(RATE_LIMITS['GET /api/attempts/user']), async (req: Request, res: Response) => {
  const { userId } = context;
  const { challengeId } = req.params;
  
  // Validate authentication
  if (!userId) {
    return handleResult(
      err(validationError([{ field: 'auth', message: 'User not authenticated' }])),
      res
    );
  }
  
  // Validate challengeId
  if (!challengeId) {
    return handleResult(
      err(validationError([{ field: 'challengeId', message: 'Challenge ID is required' }])),
      res
    );
  }
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // Get attempt for this challenge
  const result = await attemptService.getAttempt(userId, challengeId);
  return handleResult(result, res);
});

/**
 * POST /api/attempts/hint
 * Reveal a hint for a challenge
 * Requirements: 8.2, 8.3
 */
router.post('/hint', rateLimit(RATE_LIMITS['POST /api/attempts/hint']), validateRequest(revealHintSchema), async (req: Request, res: Response) => {
  const { userId } = context;
  
  // Validate authentication
  if (!userId) {
    return handleResult(
      err(validationError([{ field: 'auth', message: 'User not authenticated' }])),
      res
    );
  }
  
  // Get validated request data
  const { challengeId, imageIndex, hintCost } = (req as ValidatedRequest<RevealHintInput>).validated.body;
  
  // Initialize services
  const userRepo = new UserRepository(context);
  const attemptRepo = new AttemptRepository(context);
  const challengeRepo = new ChallengeRepository(context);
  const userService = new UserService(context, userRepo);
  const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
  
  // Reveal hint and handle result
  const result = await attemptService.revealHint(userId, challengeId, imageIndex, hintCost);
  
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

export { router as attemptRoutes };
