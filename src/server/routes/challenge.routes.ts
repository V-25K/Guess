/**
 * Challenge API Routes
 * Handles all challenge-related HTTP endpoints
 * 
 * Requirements: 8.2, 8.3
 */

import { Router, type Request, type Response } from 'express';
import { context } from '@devvit/web/server';
import { ChallengeService } from '../services/challenge.service.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { UserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { ChallengeCreate, ChallengeFilters } from '../../shared/models/challenge.types.js';
import { validateRequest, type ValidatedRequest } from '../middleware/validation.js';
import { 
  getChallengeSchema, 
  paginationSchema, 
  fullChallengeCreationSchema,
  challengePreviewSchema,
  type GetChallengeInput,
  type FullChallengeCreationInput,
  type ChallengePreviewInput
} from '../validation/schemas.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { RATE_LIMITS } from '../config/rate-limits.js';
import { handleResult } from '../utils/result-http.js';
import { err, ok } from '../../shared/utils/result.js';
import { validationError, notFoundError } from '../../shared/models/errors.js';
import { isOk } from '../../shared/utils/result.js';
import { convertToGameChallenges } from '../../shared/utils/challenge-utils.js';
import { fetchAvatarUrlCached } from '../utils/challenge-utils.js';
import type { GameChallenge } from '../../shared/models/challenge.types.js';

const router = Router();

/**
 * GET /api/challenges
 * List all challenges with optional filters
 * Requirements: 8.2, 8.3
 */
router.get('/', rateLimit(RATE_LIMITS['GET /api/challenges']), validateRequest({ query: paginationSchema }), async (req: Request, res: Response) => {
  // Get validated pagination params
  const { page, limit } = (req as ValidatedRequest<{ query: { page: number; limit: number; sortBy?: string; order: string } }>).validated.query;
  
  // Parse query parameters for filters
  const filters: ChallengeFilters = {};
  
  if (req.query.tags) {
    filters.tags = Array.isArray(req.query.tags) 
      ? req.query.tags as string[]
      : [req.query.tags as string];
  }
  
  if (req.query.creatorId) {
    filters.creatorId = req.query.creatorId as string;
  }
  
  // Use validated pagination params
  filters.limit = limit;
  filters.offset = (page - 1) * limit;
  
  // Initialize services
  const challengeRepo = new ChallengeRepository(context);
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const challengeService = new ChallengeService(context, challengeRepo, userService);
  
  // Get challenges and handle Result
  const result = await challengeService.getChallenges(filters);
  
  // Transform Challenge[] to GameChallenge[] before sending to client
  if (isOk(result)) {
    const gameChallenges = convertToGameChallenges(result.value);
    
    // Enrich challenges with creator avatar URLs
    const enrichedChallenges = await enrichChallengesWithAvatars(gameChallenges);
    handleResult(ok(enrichedChallenges), res);
  } else {
    handleResult(result, res);
  }
});

/**
 * GET /api/challenges/:challengeId
 * Get a single challenge by ID
 * Requirements: 8.2, 8.3
 */
router.get('/:challengeId', rateLimit(RATE_LIMITS['GET /api/challenges/:id']), validateRequest(getChallengeSchema), async (req: Request, res: Response) => {
  const { challengeId } = (req as ValidatedRequest<GetChallengeInput>).validated.params;
  
  // Initialize services
  const challengeRepo = new ChallengeRepository(context);
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const challengeService = new ChallengeService(context, challengeRepo, userService);
  
  // Get challenge and handle Result
  const result = await challengeService.getChallengeById(challengeId);
  
  // Convert null to not found error
  if (isOk(result) && result.value === null) {
    return handleResult(err(notFoundError('Challenge', challengeId)), res);
  }
  
  // Transform Challenge to GameChallenge before sending to client
  if (isOk(result) && result.value) {
    const gameChallenge = convertToGameChallenges([result.value])[0];
    
    // Enrich with creator avatar URL
    const enrichedChallenges = await enrichChallengesWithAvatars([gameChallenge]);
    handleResult(ok(enrichedChallenges[0]), res);
  } else {
    handleResult(result, res);
  }
});

/**
 * POST /api/challenges
 * Create a new challenge
 * Requirements: 8.2, 8.3
 */
router.post('/', rateLimit(RATE_LIMITS['POST /api/challenges']), validateRequest(fullChallengeCreationSchema), async (req: Request, res: Response) => {
  const { userId, username } = context;
  
  // Validate authentication
  if (!userId || !username) {
    return handleResult(err(validationError([
      { field: 'auth', message: 'User not authenticated' }
    ])), res);
  }
  
  // Get validated challenge data from request body
  const validatedData = (req as ValidatedRequest<FullChallengeCreationInput>).validated.body;
  const challengeData: ChallengeCreate = validatedData;
  
  // Set creator info from context (override any provided values for security)
  challengeData.creator_id = userId;
  challengeData.creator_username = username;
  
  // Initialize services
  const challengeRepo = new ChallengeRepository(context);
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const challengeService = new ChallengeService(context, challengeRepo, userService);
  
  // Create challenge and handle Result
  const result = await challengeService.createChallenge(challengeData);
  
  // Set 201 status for successful creation
  if (isOk(result)) {
    return res.status(201).json(result.value);
  }
  
  handleResult(result, res);
});

/**
 * POST /api/challenges/preview
 * Generate answer set preview for a challenge
 * Requirements: 8.2, 8.3
 */
router.post('/preview', rateLimit(RATE_LIMITS['POST /api/challenges/preview']), validateRequest(challengePreviewSchema), async (req: Request, res: Response) => {
  const { userId, username } = context;
  
  // Validate authentication
  if (!userId || !username) {
    return handleResult(err(validationError([
      { field: 'auth', message: 'User not authenticated' }
    ])), res);
  }
  
  // Get validated challenge data from request body
  const validatedData = (req as ValidatedRequest<ChallengePreviewInput>).validated.body;
  const challengeData: ChallengeCreate = validatedData;
  
  // Initialize services
  const challengeRepo = new ChallengeRepository(context);
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const challengeService = new ChallengeService(context, challengeRepo, userService);
  
  // Generate answer set preview and handle Result
  const result = await challengeService.generateAnswerSetPreview(challengeData);
  handleResult(result, res);
});

/**
 * POST /api/challenges/:challengeId/create-post
 * Create a Reddit post for an existing challenge
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */
router.post('/:challengeId/create-post', rateLimit(RATE_LIMITS['POST /api/challenges/:id/create-post']), validateRequest(getChallengeSchema), async (req: Request, res: Response) => {
  const { userId } = context;
  const { challengeId } = (req as ValidatedRequest<GetChallengeInput>).validated.params;
  
  // Validate authentication
  if (!userId) {
    return handleResult(err(validationError([
      { field: 'auth', message: 'User not authenticated' }
    ])), res);
  }
  
  // Initialize services
  const challengeRepo = new ChallengeRepository(context);
  const userRepo = new UserRepository(context);
  const userService = new UserService(context, userRepo);
  const challengeService = new ChallengeService(context, challengeRepo, userService);
  
  // Get challenge to verify ownership
  const challengeResult = await challengeService.getChallengeById(challengeId);
  
  if (!isOk(challengeResult)) {
    return handleResult(challengeResult, res);
  }
  
  const challenge = challengeResult.value;
  
  if (!challenge) {
    return handleResult(err(notFoundError('Challenge', challengeId)), res);
  }
  
  // Verify user is the creator
  if (challenge.creator_id !== userId) {
    return handleResult(err(validationError([
      { field: 'authorization', message: 'Only the challenge creator can create a post' }
    ])), res);
  }
  
  // Create Reddit post and handle Result
  const postResult = await challengeService.createRedditPostForChallenge(challengeId);
  
  if (!isOk(postResult)) {
    return handleResult(postResult, res);
  }
  
  const postId = postResult.value;
  
  // Post creation may return null if not yet implemented or if it fails gracefully
  // Still return success since the challenge itself was created
  res.json({ postId, success: true, posted: !!postId });
});

/**
 * Helper function to enrich challenges with creator avatar URLs
 * Fetches snoovatar/profile image for each unique creator
 */
async function enrichChallengesWithAvatars(challenges: GameChallenge[]): Promise<GameChallenge[]> {
  // Get unique creator usernames
  const uniqueCreators = [...new Set(challenges.map(c => c.creator_username))];
  
  // Fetch avatars for all unique creators in parallel
  const avatarMap = new Map<string, string | undefined>();
  await Promise.all(
    uniqueCreators.map(async (username) => {
      try {
        const avatarUrl = await fetchAvatarUrlCached(context, username);
        avatarMap.set(username, avatarUrl);
      } catch {
        // Silent failure - avatar is optional
        avatarMap.set(username, undefined);
      }
    })
  );
  
  // Enrich challenges with avatar URLs
  return challenges.map(challenge => ({
    ...challenge,
    creator_avatar_url: avatarMap.get(challenge.creator_username),
  }));
}

export { router as challengeRoutes };
