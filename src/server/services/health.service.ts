/**
 * Health Check Service
 * Provides comprehensive health checks for all system components
 * 
 * Checks:
 * - Redis connectivity
 * - Database (Supabase) connectivity
 * - Cache status
 * - Overall system health
 * 
 * Requirements: Phase 4.4 - Health Checks
 */

import type { Context } from '@devvit/server/server-context';
import { redis } from '@devvit/web/server';
import { BaseService } from './base.service.js';
import { createLogger, type Logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

/**
 * Health status for a component
 */
export type ComponentHealth = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
  lastChecked: string;
};

/**
 * Overall system health response
 */
export type SystemHealth = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  components: {
    redis: ComponentHealth;
    database: ComponentHealth;
    cache: ComponentHealth;
  };
  metrics?: Record<string, unknown>;
};

/**
 * Health check configuration
 */
export type HealthCheckConfig = {
  /** Timeout for individual health checks in ms */
  timeout: number;
  /** Whether to include detailed metrics */
  includeMetrics: boolean;
};

const DEFAULT_CONFIG: HealthCheckConfig = {
  timeout: 5000,
  includeMetrics: true,
};

// Track server start time for uptime calculation
const SERVER_START_TIME = Date.now();

/**
 * Health Check Service
 * Provides comprehensive health monitoring for the application
 */
export class HealthService extends BaseService {
  private logger: Logger;
  private config: HealthCheckConfig;
  private supabaseUrl: string | null = null;
  private supabaseKey: string | null = null;

  constructor(context: Context, config?: Partial<HealthCheckConfig>) {
    super(context);
    this.logger = createLogger({ service: 'HealthService' });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set Supabase configuration for database health checks
   */
  setSupabaseConfig(url: string, key: string): void {
    this.supabaseUrl = url;
    this.supabaseKey = key;
  }

  /**
   * Perform a full system health check
   */
  async checkHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    
    this.logger.info('Starting health check');

    // Run all health checks in parallel
    const [redisHealth, databaseHealth, cacheHealth] = await Promise.all([
      this.checkRedis(),
      this.checkDatabase(),
      this.checkCache(),
    ]);

    // Determine overall status
    const componentStatuses = [redisHealth.status, databaseHealth.status, cacheHealth.status];
    let overallStatus: SystemHealth['status'] = 'healthy';
    
    if (componentStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    const health: SystemHealth = {
      status: overallStatus,
      version: '1.0.0', // Could be read from package.json
      uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
      timestamp: new Date().toISOString(),
      components: {
        redis: redisHealth,
        database: databaseHealth,
        cache: cacheHealth,
      },
    };

    // Include metrics if configured
    if (this.config.includeMetrics) {
      health.metrics = await metrics.getMetricsSummary();
    }

    const duration = Date.now() - startTime;
    this.logger.info('Health check completed', {
      status: overallStatus,
      duration,
    });

    // Record health check metrics
    await metrics.recordHistogram('health_check_duration_ms', duration);
    await metrics.setGauge('health_status', overallStatus === 'healthy' ? 1 : 0);

    return health;
  }

  /**
   * Quick liveness check (just confirms the service is running)
   */
  async checkLiveness(): Promise<{ status: 'ok'; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check (confirms the service can handle requests)
   */
  async checkReadiness(): Promise<{ ready: boolean; reason?: string }> {
    try {
      // Check Redis is available (required for the app to function)
      const redisHealth = await this.checkRedis();
      
      if (redisHealth.status === 'unhealthy') {
        return {
          ready: false,
          reason: 'Redis is unavailable',
        };
      }

      return { ready: true };
    } catch (error) {
      return {
        ready: false,
        reason: 'Health check failed',
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Perform a simple Redis operation to verify connectivity
      const testKey = 'health:ping';
      const testValue = Date.now().toString();
      
      await redis.set(testKey, testValue, {
        expiration: new Date(Date.now() + 10000), // 10 second TTL
      });
      
      const retrieved = await redis.get(testKey);
      
      const latencyMs = Date.now() - startTime;

      if (retrieved === testValue) {
        return {
          status: 'healthy',
          latencyMs,
          message: 'Redis is responding normally',
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: 'degraded',
        latencyMs,
        message: 'Redis read/write mismatch',
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.error('Redis health check failed', error);
      
      return {
        status: 'unhealthy',
        latencyMs,
        message: error instanceof Error ? error.message : 'Redis connection failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check Database (Supabase) connectivity
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();

    // If Supabase config is not set, try to get it from context
    if (!this.supabaseUrl || !this.supabaseKey) {
      return {
        status: 'degraded',
        message: 'Database configuration not available',
        lastChecked: new Date().toISOString(),
      };
    }

    try {
      // Perform a simple query to verify database connectivity
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/user_profiles?select=count&limit=1`,
        {
          method: 'GET',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact',
          },
        }
      );

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return {
          status: 'healthy',
          latencyMs,
          message: 'Database is responding normally',
          lastChecked: new Date().toISOString(),
        };
      }

      // Non-2xx response
      return {
        status: 'degraded',
        latencyMs,
        message: `Database returned status ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.error('Database health check failed', error);

      return {
        status: 'unhealthy',
        latencyMs,
        message: error instanceof Error ? error.message : 'Database connection failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check Cache status
   */
  private async checkCache(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Check if we can read/write to cache
      const testKey = 'health:cache:test';
      const testData = { timestamp: Date.now(), test: true };
      
      await redis.set(testKey, JSON.stringify(testData), {
        expiration: new Date(Date.now() + 10000),
      });
      
      const cached = await redis.get(testKey);
      const latencyMs = Date.now() - startTime;

      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.test === true) {
          return {
            status: 'healthy',
            latencyMs,
            message: 'Cache is functioning normally',
            lastChecked: new Date().toISOString(),
          };
        }
      }

      return {
        status: 'degraded',
        latencyMs,
        message: 'Cache data integrity issue',
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.error('Cache health check failed', error);

      return {
        status: 'unhealthy',
        latencyMs,
        message: error instanceof Error ? error.message : 'Cache check failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

/**
 * Create a health service instance
 */
export function createHealthService(context: Context): HealthService {
  return new HealthService(context);
}
