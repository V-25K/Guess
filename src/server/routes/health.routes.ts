/**
 * Health Check Routes
 * Provides endpoints for monitoring application health
 * 
 * Endpoints:
 * - GET /api/health - Basic health check
 * - GET /api/health/live - Liveness probe (is the service running?)
 * - GET /api/health/ready - Readiness probe (can the service handle requests?)
 * - GET /api/health/detailed - Detailed health with component status
 * 
 * Requirements: Phase 4.4 - Health Checks
 */

import { Router, type Request, type Response } from 'express';
import { settings } from '@devvit/web/server';
import { HealthService } from '../services/health.service.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const logger = createLogger({ service: 'HealthRoutes' });

// Create a mock context for the health service
// In a real Devvit app, this would come from the request context
const mockContext = {} as any;

/**
 * GET /api/health
 * Basic health check - returns 200 if service is running
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'guess-the-link',
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/live
 * Liveness probe - confirms the service is running
 * Used by orchestrators to determine if the service should be restarted
 */
router.get('/live', async (_req: Request, res: Response) => {
  try {
    const healthService = new HealthService(mockContext);
    const liveness = await healthService.checkLiveness();
    
    res.json(liveness);
  } catch (error) {
    logger.error('Liveness check failed', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/ready
 * Readiness probe - confirms the service can handle requests
 * Used by load balancers to determine if traffic should be sent
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const healthService = new HealthService(mockContext);
    const readiness = await healthService.checkReadiness();
    
    if (readiness.ready) {
      res.json(readiness);
    } else {
      res.status(503).json(readiness);
    }
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      ready: false,
      reason: 'Health check failed',
    });
  }
});

/**
 * GET /api/health/detailed
 * Detailed health check with component status and metrics
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  try {
    const healthService = new HealthService(mockContext);
    
    // Try to get Supabase config for database health check
    try {
      const supabaseUrl = await settings.get('supabaseUrl');
      const supabaseKey = await settings.get('supabaseAnonKey');
      
      if (supabaseUrl && supabaseKey) {
        healthService.setSupabaseConfig(
          supabaseUrl as string,
          supabaseKey as string
        );
      }
    } catch (configError) {
      logger.warn('Could not load Supabase config for health check');
    }
    
    const health = await healthService.checkHealth();
    
    // Set appropriate status code based on health
    const statusCode = health.status === 'healthy' ? 200 :
                       health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Detailed health check failed', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

export { router as healthRoutes };
