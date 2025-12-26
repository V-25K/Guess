/**
 * Comment Submit Trigger Handler
 * Handles comment submission events and awards creator bonuses
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { Router, type Request, type Response } from 'express';
import { context } from '@devvit/web/server';
import { CommentService } from '../services/comment.service.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { UserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ChallengeRepository } from '../repositories/challenge.repository.js';
import { unwrapOr } from '../../shared/utils/result.js';

const router = Router();

/**
 * POST /internal/triggers/comment-submit
 * Handle comment submission trigger
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Extract comment data from request body
    const { postId, commentId, commenterId } = req.body;
    
    if (!postId || !commentId || !commenterId) {
      console.error('Missing required fields in comment trigger:', { postId, commentId, commenterId });
      // Return success to prevent trigger retry (Requirements: 11.5)
      return res.status(200).json({ success: false, message: 'Missing required fields' });
    }
    
    // Initialize repositories
    const challengeRepo = new ChallengeRepository(context);
    const userRepo = new UserRepository(context);
    const commentRepo = new CommentRepository(context);
    
    // Get challenge by post ID (Requirements: 11.2)
    const challengeResult = await challengeRepo.findByPostId(postId);
    const challenge = unwrapOr(challengeResult, null);
    
    if (!challenge) {
      console.log('Challenge not found for post:', postId);
      // Return success to prevent trigger retry
      return res.status(200).json({ success: false, message: 'Challenge not found' });
    }
    
    // Initialize services
    const userService = new UserService(context, userRepo);
    const commentService = new CommentService(context, commentRepo, userService);
    
    // Track comment and award creator (Requirements: 11.3)
    // This handles duplicate prevention and self-comment prevention internally
    const result = await commentService.trackComment(
      challenge.id,
      commentId,
      commenterId,
      challenge.creator_id
    );
    
    const success = unwrapOr(result, false);
    
    if (success) {
      console.log(`Awarded creator bonus for comment ${commentId} on challenge ${challenge.id}`);
    } else {
      console.log(`Comment ${commentId} was not rewarded (duplicate or self-comment)`);
    }
    
    // Always return success to prevent trigger retry (Requirements: 11.5)
    res.status(200).json({ success: true });
  } catch (error) {
    // Log error but don't crash (Requirements: 11.5)
    console.error('Error in comment trigger:', error);
    
    // Return success to prevent trigger retry
    res.status(200).json({ success: false, error: 'Internal error' });
  }
});

export { router as commentTriggerRoutes };
