/**
 * Account Delete Handler
 * Handles account deletion by removing all user-related data
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 6.3, 6.4
 */

import { Router, type Request, type Response } from 'express';
import { context } from '@devvit/web/server';
import { UserRepository } from '../repositories/user.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { AttemptRepository } from '../repositories/attempt.repository.js';
import { isOk } from '../../shared/utils/result.js';
import { createLogger } from '../utils/logger.js';
import type { AppError } from '../../shared/models/errors.js';

/**
 * Get a human-readable message from an AppError
 */
function getErrorMessage(error: AppError): string {
  switch (error.type) {
    case 'validation':
      return `Validation error: ${error.fields.map(f => f.message).join(', ')}`;
    case 'not_found':
      return `Not found: ${error.resource} (${error.identifier})`;
    case 'rate_limit':
      return `Rate limited: ${error.timeRemainingMs}ms remaining`;
    case 'database':
      return `Database error in ${error.operation}: ${error.message}`;
    case 'external_api':
      return `External API error (${error.service}): ${error.message}`;
    case 'internal':
      return `Internal error: ${error.message}`;
    default:
      return 'Unknown error';
  }
}

const router = Router();
const logger = createLogger({ service: 'AccountDeleteHandler' });

/**
 * Deletion result statistics
 */
interface DeletionResult {
  success: boolean;
  deletedChallenges: number;
  deletedAttempts: number;
  profileDeleted: boolean;
  errors: string[];
}

/**
 * POST /internal/triggers/account-delete
 * Handle account deletion - removes all user data
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 6.3, 6.4
 */
router.post('/', async (req: Request, res: Response) => {
  const result: DeletionResult = {
    success: true,
    deletedChallenges: 0,
    deletedAttempts: 0,
    profileDeleted: false,
    errors: [],
  };

  try {
    // Extract user ID from request body (Requirements: 3.1)
    const { userId } = req.body;
    
    if (!userId) {
      logger.warn('Missing user ID in account delete request', { body: req.body });
      // Return success to prevent retry (Requirements: 3.7)
      return res.status(200).json({ 
        ...result, 
        success: false, 
        errors: ['Missing user ID'] 
      });
    }
    
    // Initialize repositories
    const userRepo = new UserRepository(context);
    const challengeRepo = new ChallengeRepository(context);
    const attemptRepo = new AttemptRepository(context);
    
    // Delete all challenges created by user (Requirements: 3.3)
    // Note: CASCADE will handle related attempts, guesses, and rewards for these challenges
    try {
      const challengeResult = await challengeRepo.deleteByCreatorId(userId);
      if (isOk(challengeResult)) {
        result.deletedChallenges = challengeResult.value;
      } else {
        result.errors.push(`Failed to delete challenges: ${getErrorMessage(challengeResult.error)}`);
        logger.error('Failed to delete challenges', challengeResult.error, { userId });
      }
    } catch (error) {
      result.errors.push(`Exception deleting challenges: ${String(error)}`);
      logger.error('Exception deleting challenges', error, { userId });
    }
    
    // Delete all attempts made by user (Requirements: 3.4)
    try {
      const attemptResult = await attemptRepo.deleteByUserId(userId);
      if (isOk(attemptResult)) {
        result.deletedAttempts = attemptResult.value;
      } else {
        result.errors.push(`Failed to delete attempts: ${getErrorMessage(attemptResult.error)}`);
        logger.error('Failed to delete attempts', attemptResult.error, { userId });
      }
    } catch (error) {
      result.errors.push(`Exception deleting attempts: ${String(error)}`);
      logger.error('Exception deleting attempts', error, { userId });
    }
    
    // Delete user profile (Requirements: 3.2)
    try {
      const profileResult = await userRepo.deleteProfile(userId);
      if (isOk(profileResult)) {
        result.profileDeleted = profileResult.value;
      } else {
        result.errors.push(`Failed to delete profile: ${getErrorMessage(profileResult.error)}`);
        logger.error('Failed to delete profile', profileResult.error, { userId });
      }
    } catch (error) {
      result.errors.push(`Exception deleting profile: ${String(error)}`);
      logger.error('Exception deleting profile', error, { userId });
    }
    
    // Determine overall success
    result.success = result.errors.length === 0;
    
    // Log deletion statistics (Requirements: 6.3)
    logger.info('Account deletion completed', {
      userId,
      deletedChallenges: result.deletedChallenges,
      deletedAttempts: result.deletedAttempts,
      profileDeleted: result.profileDeleted,
      errorCount: result.errors.length,
    });
    
    // Always return HTTP 200 with deletion statistics (Requirements: 3.7, 3.8)
    return res.status(200).json(result);
  } catch (error) {
    // Log error (Requirements: 6.4)
    logger.error('Error in account delete handler', error, { 
      body: req.body 
    });
    
    // Always return HTTP 200 to prevent retry loops
    return res.status(200).json({ 
      ...result, 
      success: false, 
      errors: [...result.errors, 'Internal error'] 
    });
  }
});

export { router as accountDeleteRoutes };
