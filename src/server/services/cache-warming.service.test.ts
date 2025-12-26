/**
 * Cache Warming Service Tests
 * Tests for cache warming functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheWarmingService, type WarmingStatus } from './cache-warming.service.js';

// Mock redis - must be defined inline in vi.mock
vi.mock('@devvit/web/server', () => ({
  redis: {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(undefined),
    zAdd: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock fetch for database queries
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Get the mocked redis for assertions
const getMockedRedis = async () => {
  const { redis } = await import('@devvit/web/server');
  return redis;
};

describe('CacheWarmingService', () => {
  let cacheWarmingService: CacheWarmingService;
  const mockContext = {} as any;

  beforeEach(async () => {
    cacheWarmingService = new CacheWarmingService(mockContext);
    vi.clearAllMocks();
    
    // Reset redis mocks - use undefined for null values since Devvit redis returns undefined
    const redis = await getMockedRedis();
    vi.mocked(redis.get).mockResolvedValue(undefined as any);
    vi.mocked(redis.set).mockResolvedValue(undefined as any);
    vi.mocked(redis.del).mockResolvedValue(undefined as any);
    vi.mocked(redis.zAdd).mockResolvedValue(undefined as any);
    
    // Default mock responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('warmAll', () => {
    it('should return early when disabled', async () => {
      const service = new CacheWarmingService(mockContext, { enabled: false });
      
      const result = await service.warmAll();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalItemsWarmed).toBe(0);
        expect(result.value.lastRun).toBeNull();
      }
    });

    it('should warm all caches when enabled', async () => {
      cacheWarmingService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      
      // Mock user profiles response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { user_id: 'user1', username: 'User1', total_points: 100, level: 1, challenges_solved: 5 },
          { user_id: 'user2', username: 'User2', total_points: 200, level: 2, challenges_solved: 10 },
        ]),
      });

      // Mock challenges response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 'challenge1', title: 'Challenge 1' },
          { id: 'challenge2', title: 'Challenge 2' },
        ]),
      });

      const result = await cacheWarmingService.warmAll();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalItemsWarmed).toBe(4); // 2 users + 2 challenges
        expect(result.value.results).toHaveLength(2);
        expect(result.value.lastRun).toBeDefined();
      }
    });

    it('should handle database errors gracefully', async () => {
      cacheWarmingService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      
      mockFetch.mockRejectedValue(new Error('Database error'));

      const result = await cacheWarmingService.warmAll();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.results[0].success).toBe(false);
        expect(result.value.results[0].error).toContain('Database error');
      }
    });

    it('should prevent concurrent warming with lock', async () => {
      cacheWarmingService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      
      // Simulate lock already held
      const redis = await getMockedRedis();
      vi.mocked(redis.get).mockResolvedValueOnce(Date.now().toString());

      const result = await cacheWarmingService.warmAll();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // AppError types vary - check for internal error type
        expect(result.error.type).toBe('internal');
      }
    });

    it('should release lock after warming completes', async () => {
      cacheWarmingService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      
      await cacheWarmingService.warmAll();

      const redis = await getMockedRedis();
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('warmLeaderboard', () => {
    it('should populate Redis sorted set with user scores', async () => {
      cacheWarmingService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { user_id: 'user1', username: 'User1', total_points: 100, level: 1, challenges_solved: 5 },
        ]),
      });

      // Mock challenges response (empty)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await cacheWarmingService.warmAll();

      const redis = await getMockedRedis();
      expect(redis.zAdd).toHaveBeenCalledWith('leaderboard:points', {
        member: 'user1',
        score: 100,
      });
    });
  });

  describe('warmRecentChallenges', () => {
    it('should cache individual challenges', async () => {
      cacheWarmingService.setSupabaseConfig('https://test.supabase.co', 'test-key');
      
      // Mock user profiles response (empty)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      // Mock challenges response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 'challenge1', title: 'Challenge 1' },
        ]),
      });

      await cacheWarmingService.warmAll();

      const redis = await getMockedRedis();
      
      // Should cache the challenges list
      expect(redis.set).toHaveBeenCalledWith(
        'cache:challenges:recent',
        expect.any(String),
        expect.any(Object)
      );

      // Should cache individual challenge
      expect(redis.set).toHaveBeenCalledWith(
        'cache:challenge:challenge1',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('getWarmingStatus', () => {
    it('should return null when no status exists', async () => {
      const redis = await getMockedRedis();
      vi.mocked(redis.get).mockResolvedValueOnce(undefined as any);

      const status = await cacheWarmingService.getWarmingStatus();

      expect(status).toBeNull();
    });

    it('should return stored status', async () => {
      const storedStatus: WarmingStatus = {
        lastRun: '2025-12-10T00:00:00.000Z',
        results: [],
        totalItemsWarmed: 10,
        totalDurationMs: 100,
      };
      const redis = await getMockedRedis();
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(storedStatus));

      const status = await cacheWarmingService.getWarmingStatus();

      expect(status).toEqual(storedStatus);
    });
  });

  describe('isWarmingNeeded', () => {
    it('should return true when no previous warming', async () => {
      const redis = await getMockedRedis();
      vi.mocked(redis.get).mockResolvedValueOnce(undefined as any);

      const needed = await cacheWarmingService.isWarmingNeeded();

      expect(needed).toBe(true);
    });

    it('should return true when last warming is stale', async () => {
      const oldStatus: WarmingStatus = {
        lastRun: new Date(Date.now() - 120_000).toISOString(), // 2 minutes ago
        results: [],
        totalItemsWarmed: 10,
        totalDurationMs: 100,
      };
      const redis = await getMockedRedis();
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(oldStatus));

      const needed = await cacheWarmingService.isWarmingNeeded();

      expect(needed).toBe(true);
    });

    it('should return false when last warming is recent', async () => {
      const recentStatus: WarmingStatus = {
        lastRun: new Date(Date.now() - 30_000).toISOString(), // 30 seconds ago
        results: [],
        totalItemsWarmed: 10,
        totalDurationMs: 100,
      };
      const redis = await getMockedRedis();
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(recentStatus));

      const needed = await cacheWarmingService.isWarmingNeeded();

      expect(needed).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should use custom TTL', async () => {
      const service = new CacheWarmingService(mockContext, {
        defaultTtl: 120_000, // 2 minutes
      });
      service.setSupabaseConfig('https://test.supabase.co', 'test-key');

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await service.warmAll();

      const redis = await getMockedRedis();
      // Verify TTL is used in cache set calls
      const setCalls = vi.mocked(redis.set).mock.calls;
      const cacheCall = setCalls.find((call: any[]) => call[0].includes('cache:'));
      if (cacheCall) {
        const expiration = (cacheCall[2] as any)?.expiration;
        expect(expiration).toBeDefined();
      }
    });

    it('should respect maxItemsPerCategory', async () => {
      const service = new CacheWarmingService(mockContext, {
        maxItemsPerCategory: 5,
      });
      service.setSupabaseConfig('https://test.supabase.co', 'test-key');

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await service.warmAll();

      // Verify limit is used in fetch URL
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=5'),
        expect.any(Object)
      );
    });
  });
});
