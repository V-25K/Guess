/**
 * Scheduler Routes
 * Handles scheduled task endpoints for Devvit scheduler
 * 
 * Tasks:
 * - Cache warming (periodic)
 * - Leaderboard refresh (periodic)
 * 
 * Requirements: Phase 4.5 - Cache Warming
 */

import { Router, type Request, type Response } from 'express';
import { settings } from '@devvit/web/server';
import { CacheWarmingService } from '../services/cache-warming.service.js';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { createLogger } from '../utils/logger.js';
import { isOk } from '../../shared/utils/result.js';

const router = Router();
const logger = createLogger({ service: 'SchedulerRoutes' });

// Create a mock context for services
const mockContext = {} as any;

/**
 * POST /internal/scheduler/cache-warming
 * Scheduled task to warm caches periodically
 */
router.post('/cache-warming', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  logger.info('Cache warming task started');

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
      logger.info('Cache warming task completed', {
        duration,
        itemsWarmed: result.value.totalItemsWarmed,
      });

      res.json({
        status: 'ok',
        duration,
        result: result.value,
      });
    } else {
      logger.warn('Cache warming task completed with errors', {
        duration,
        error: result.error,
      });

      res.json({
        status: 'partial',
        duration,
        error: result.error,
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Cache warming task failed', error, { duration });

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
  logger.info('Leaderboard refresh task started');

  try {
    const userRepo = new UserRepository(mockContext);
    const leaderboardService = new LeaderboardService(mockContext, userRepo);

    const result = await leaderboardService.refreshLeaderboard();
    const duration = Date.now() - startTime;

    if (isOk(result)) {
      logger.info('Leaderboard refresh task completed', { duration });

      res.json({
        status: 'ok',
        duration,
      });
    } else {
      logger.warn('Leaderboard refresh task failed', {
        duration,
        error: result.error,
      });

      res.status(500).json({
        status: 'error',
        duration,
        error: result.error,
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Leaderboard refresh task failed', error, { duration });

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
    logger.error('Failed to get scheduler status', error);
    res.status(500).json({
      error: 'Failed to get scheduler status',
    });
  }
});

export { router as schedulerRoutes };
