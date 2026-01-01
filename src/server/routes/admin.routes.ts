/**
 * Admin Routes
 * Handles admin-only endpoints for moderators
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { Router, type Request, type Response } from 'express';
import { settings } from '@devvit/web/server';
import { DataCleanupService } from '../services/data-cleanup.service.js';
import { isOk } from '../../shared/utils/result.js';
import { createLogger } from '../utils/logger.js';

// Create structured logger for admin routes
const logger = createLogger({ service: 'AdminRoutes' });

const router = Router();

// Create a mock context for services
const mockContext = {} as any;

/**
 * POST /internal/admin/cleanup-user
 * Admin endpoint to manually trigger user data cleanup
 * Accessible only to moderators via menu item
 * 
 * Requirements: 7.2, 7.3, 7.4
 */
router.post('/cleanup-user', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Get Supabase config from settings
    const supabaseUrl = await settings.get('supabaseUrl');
    const supabaseKey = await settings.get('supabaseAnonKey');

    // Check if Supabase is configured
    if (!supabaseUrl || !supabaseKey) {
      const duration = Date.now() - startTime;
      logger.error('Admin cleanup failed: Supabase not configured', undefined, {
        operation: 'admin-cleanup-user',
        duration,
      });
      return res.status(500).json({
        status: 'error',
        error: 'Supabase not configured',
      });
    }

    // Create and configure the cleanup service (Requirement 7.2)
    const dataCleanupService = new DataCleanupService(mockContext);
    dataCleanupService.setSupabaseConfig(
      supabaseUrl as string,
      supabaseKey as string
    );

    // Invoke cleanup with 30-day retention (Requirement 7.2)
    const result = await dataCleanupService.anonymizeInactiveUsers(30);
    const duration = Date.now() - startTime;

    if (isOk(result)) {
      // Log cleanup statistics on success
      logger.info('Admin cleanup completed successfully', {
        operation: 'admin-cleanup-user',
        duration,
        profilesAnonymized: result.value.profilesAnonymized,
        challengesUpdated: result.value.challengesUpdated,
        attemptsUpdated: result.value.attemptsUpdated,
        executionTimeMs: result.value.executionTimeMs,
      });

      // Return cleanup statistics to moderator (Requirement 7.4)
      return res.json({
        status: 'ok',
        result: result.value,
      });
    } else {
      // Log error details on failure
      logger.error('Admin cleanup failed', undefined, {
        operation: 'admin-cleanup-user',
        duration,
        error: result.error,
      });

      // Extract error message based on error type
      const errorMessage = 'message' in result.error 
        ? result.error.message 
        : 'Cleanup failed';

      return res.status(500).json({
        status: 'error',
        error: errorMessage,
      });
    }
  } catch (error) {
    // Handle unexpected exceptions
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Admin cleanup failed with exception', error, {
      operation: 'admin-cleanup-user',
      duration,
    });

    return res.status(500).json({
      status: 'error',
      error: errorMessage,
    });
  }
});

export { router as adminRoutes };
