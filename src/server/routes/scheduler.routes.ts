/**
 * Scheduler Routes
 * Handles scheduled task endpoints for Devvit scheduler
 * 
 * Tasks:
 * - Cache warming (periodic)
 * - Leaderboard refresh (periodic)
 * - User data cleanup (daily at 3 AM UTC)
 * 
 * Requirements: Phase 4.5 - Cache Warming, 5.1-5.5 - Data Retention Compliance
 */

import { Router, type Request, type Response } from 'express';
import { settings } from '@devvit/web/server';
import { CacheWarmingService } from '../services/cache-warming.service.js';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { DataCleanupService } from '../services/data-cleanup.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { isOk } from '../../shared/utils/result.js';
import { createLogger } from '../utils/logger.js';

// Create structured logger for scheduler routes
const logger = createLogger({ service: 'SchedulerRoutes' });

const router = Router();

// Create a mock context for services
const mockContext = {} as any;

/**
 * POST /internal/scheduler/cache-warming
 * Scheduled task to warm caches periodically
 */
router.post('/cache-warming', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const cacheWarmingService = new CacheWarmingService(mockContext);
    
    // Get Supabase config
    const supabaseUrl = await settings.get('supabaseUrl');
    const supabaseKey = await settings.get('supabaseAnonKey');
    
    if (supabaseUrl && supabaseKey) {
      cacheWarmingService.setSupabaseConfig(
        supabaseUrl as string,
        supabaseKey as string
      );
    }

    const result = await cacheWarmingService.warmAll();
    const duration = Date.now() - startTime;

    if (isOk(result)) {
      res.json({
        status: 'ok',
        duration,
        result: result.value,
      });
    } else {
      res.json({
        status: 'partial',
        duration,
        error: result.error,
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    res.status(500).json({
      status: 'error',
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /internal/scheduler/leaderboard-refresh
 * Scheduled task to refresh leaderboard from database
 */
router.post('/leaderboard-refresh', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const userRepo = new UserRepository(mockContext);
    const leaderboardService = new LeaderboardService(mockContext, userRepo);

    const result = await leaderboardService.refreshLeaderboard();
    const duration = Date.now() - startTime;

    if (isOk(result)) {
      res.json({
        status: 'ok',
        duration,
      });
    } else {
      res.status(500).json({
        status: 'error',
        duration,
        error: result.error,
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    res.status(500).json({
      status: 'error',
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /internal/scheduler/status
 * Get status of scheduled tasks (for debugging)
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const cacheWarmingService = new CacheWarmingService(mockContext);
    const warmingStatus = await cacheWarmingService.getWarmingStatus();

    res.json({
      cacheWarming: warmingStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get scheduler status',
    });
  }
});

/**
 * POST /internal/scheduler/user-data-cleanup
 * Scheduled task to anonymize inactive user data for compliance
 * Runs daily at 3:00 AM UTC (configured in devvit.json)
 * 
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */
router.post('/user-data-cleanup', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Get Supabase config from settings (Requirement 5.2)
    const supabaseUrl = await settings.get('supabaseUrl');
    const supabaseKey = await settings.get('supabaseAnonKey');

    // Check if Supabase is configured (Requirement 5.4)
    if (!supabaseUrl || !supabaseKey) {
      const duration = Date.now() - startTime;
      logger.error('User data cleanup failed: Supabase not configured', undefined, {
        operation: 'user-data-cleanup',
        duration,
      });
      return res.status(500).json({
        status: 'error',
        duration,
        error: 'Supabase not configured',
      });
    }

    // Create and configure the cleanup service
    const dataCleanupService = new DataCleanupService(mockContext);
    dataCleanupService.setSupabaseConfig(
      supabaseUrl as string,
      supabaseKey as string
    );

    // Invoke cleanup with 30-day retention (Requirement 5.2)
    const result = await dataCleanupService.anonymizeInactiveUsers(30);
    const duration = Date.now() - startTime;

    if (isOk(result)) {
      // Log cleanup statistics on success (Requirement 5.3)
      logger.info('User data cleanup completed successfully', {
        operation: 'user-data-cleanup',
        duration,
        profilesAnonymized: result.value.profilesAnonymized,
        challengesUpdated: result.value.challengesUpdated,
        attemptsUpdated: result.value.attemptsUpdated,
        executionTimeMs: result.value.executionTimeMs,
      });

      // Return JSON with status, duration, and result (Requirement 5.5)
      return res.json({
        status: 'ok',
        duration,
        result: result.value,
      });
    } else {
      // Log error details on failure (Requirement 5.4)
      logger.error('User data cleanup failed', undefined, {
        operation: 'user-data-cleanup',
        duration,
        error: result.error,
      });

      // Extract error message based on error type
      const errorMessage = 'message' in result.error 
        ? result.error.message 
        : 'Cleanup failed';

      // Return JSON with status, duration, and error (Requirement 5.5)
      return res.status(500).json({
        status: 'error',
        duration,
        error: errorMessage,
      });
    }
  } catch (error) {
    // Handle unexpected exceptions (Requirement 5.4)
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('User data cleanup failed with exception', error, {
      operation: 'user-data-cleanup',
      duration,
    });

    return res.status(500).json({
      status: 'error',
      duration,
      error: errorMessage,
    });
  }
});

export { router as schedulerRoutes };
