/**
 * Post Delete Trigger Handler
 * Handles post deletion events and removes associated challenge data
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 6.1
 */

import { Router, type Request, type Response } from 'express';
import { context } from '@devvit/web/server';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { unwrapOr } from '../../shared/utils/result.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const logger = createLogger({ service: 'PostDeleteTrigger' });

/**
 * POST /internal/triggers/post-delete
 * Handle post deletion trigger from Devvit
 * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 6.1
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Extract post data from request body (Requirements: 1.1)
    const { post } = req.body;
    const postId = post?.id;
    
    if (!postId) {
      logger.warn('Missing post ID in post delete trigger', { body: req.body });
      // Return success to prevent trigger retry (Requirements: 1.7)
      return res.status(200).json({ success: false, message: 'Missing post ID' });
    }
    
    // Initialize repository
    const challengeRepo = new ChallengeRepository(context);
    
    // Look up challenge by Reddit post ID (Requirements: 1.2)
    const challengeResult = await challengeRepo.findByPostId(postId);
    const challenge = unwrapOr(challengeResult, null);
    
    if (!challenge) {
      // No challenge found for this post - return success (Requirements: 1.6)
      logger.info('No challenge found for deleted post', { postId });
      return res.status(200).json({ success: true, message: 'No challenge found' });
    }
    
    // Delete challenge - CASCADE handles related records (Requirements: 1.3, 1.4)
    const deleteResult = await challengeRepo.deleteChallenge(challenge.id);
    const deleted = unwrapOr(deleteResult, false);
    
    if (deleted) {
      // Log successful deletion (Requirements: 6.1)
      logger.info('Challenge deleted for post', { 
        postId, 
        challengeId: challenge.id,
        creatorId: challenge.creator_id 
      });
      return res.status(200).json({ success: true, challengeId: challenge.id });
    } else {
      // Deletion failed but return success to prevent retry (Requirements: 1.7)
      logger.error('Failed to delete challenge', undefined, { 
        postId, 
        challengeId: challenge.id 
      });
      return res.status(200).json({ success: false, message: 'Deletion failed' });
    }
  } catch (error) {
    // Log error but return success to prevent trigger retry (Requirements: 1.7)
    logger.error('Error in post delete trigger', error, { 
      body: req.body 
    });
    
    // Always return HTTP 200 to prevent retry loops
    return res.status(200).json({ success: false, error: 'Internal error' });
  }
});

export { router as postDeleteRoutes };
