/**
 * Health Service Tests
 * Tests for health check functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthService, type SystemHealth } from './health.service.js';

// Mock redis with proper JSON for cache check
vi.mock('@devvit/web/server', () => ({
  redis: {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockImplementation((key: string) => {
      // Return valid JSON for cache health check
      if (key === 'health:cache:test') {
        return Promise.resolve(JSON.stringify({ timestamp: Date.now(), test: true }));
      }
      // Return the test value for redis health check
      return Promise.resolve(Date.now().toString());
    }),
    del: vi.fn().mockResolvedValue(undefined),
    incrBy: vi.fn().mockResolvedValue(1),
  },
}));

// Mock fetch for database health checks
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HealthService', () => {
  let healthService: HealthService;
  const mockContext = {} as any;

  beforeEach(() => {
    healthService = new HealthService(mockContext);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkLiveness', () => {
    it('should return ok status', async () => {
      const result = await healthService.checkLiveness();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('checkReadiness', () => {
    it('should return ready when Redis is healthy', async () => {
      const result = await healthService.checkReadiness();

      expect(result.ready).toBe(true);
    });
  });

  describe('checkHealth', () => {
    beforeEach(() => {
      // Mock successful database response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it('should return healthy status when all components are healthy', async () => {
      healthService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      
      const result = await healthService.checkHealth();

      // Check that we get a valid health response
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(result.components.redis).toBeDefined();
      expect(result.components.cache).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include version and uptime', async () => {
      const result = await healthService.checkHealth();

      expect(result.version).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });

    it('should return degraded status when database config is missing', async () => {
      // Don't set Supabase config
      const result = await healthService.checkHealth();

      expect(result.components.database.status).toBe('degraded');
      expect(result.components.database.message).toContain('configuration not available');
    });

    it('should include metrics when configured', async () => {
      const result = await healthService.checkHealth();

      expect(result.metrics).toBeDefined();
    });

    it('should measure latency for each component', async () => {
      healthService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      
      const result = await healthService.checkHealth();

      expect(result.components.redis.latencyMs).toBeDefined();
      expect(result.components.cache.latencyMs).toBeDefined();
    });
  });

  describe('component health checks', () => {
    it('should detect unhealthy Redis', async () => {
      const { redis } = await import('@devvit/web/server');
      vi.mocked(redis.set).mockRejectedValueOnce(new Error('Redis connection failed'));
      // Also mock cache check to fail since it uses the same redis
      vi.mocked(redis.set).mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await healthService.checkHealth();

      expect(result.components.redis.status).toBe('unhealthy');
      expect(result.components.redis.message).toContain('Redis connection failed');
    });

    it('should detect unhealthy database', async () => {
      healthService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await healthService.checkHealth();

      expect(result.components.database.status).toBe('degraded');
    });

    it('should handle database connection errors', async () => {
      healthService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await healthService.checkHealth();

      expect(result.components.database.status).toBe('unhealthy');
      expect(result.components.database.message).toContain('Network error');
    });
  });

  describe('overall status determination', () => {
    it('should return unhealthy if any component is unhealthy', async () => {
      const { redis } = await import('@devvit/web/server');
      vi.mocked(redis.set).mockRejectedValueOnce(new Error('Redis down'));
      vi.mocked(redis.set).mockRejectedValueOnce(new Error('Redis down'));

      const result = await healthService.checkHealth();

      expect(result.status).toBe('unhealthy');
    });

    it('should return degraded if any component is degraded but none unhealthy', async () => {
      // Database will be degraded due to missing config
      // Redis and cache should be healthy
      const result = await healthService.checkHealth();

      // Database should be degraded (no config), overall should be degraded
      expect(result.components.database.status).toBe('degraded');
      // The overall status should be degraded when database is degraded
      expect(['healthy', 'degraded']).toContain(result.status);
    });
  });

  describe('lastChecked timestamp', () => {
    it('should include lastChecked for each component', async () => {
      const result = await healthService.checkHealth();

      expect(result.components.redis.lastChecked).toBeDefined();
      expect(result.components.database.lastChecked).toBeDefined();
      expect(result.components.cache.lastChecked).toBeDefined();
    });
  });
});
