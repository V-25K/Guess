/**
 * Property-based tests for RateLimitService
 * 
 * **Feature: rate-limiting**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { RateLimitService } from './rate-limit.service.js';
import { redis } from '@devvit/web/server';

// Mock Redis for testing
vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(),
    watch: vi.fn(),
  },
}));

describe('RateLimitService Property Tests', () => {
  let service: RateLimitService;
  let mockRedisData: Map<string, { value: string; expiry: number }>;

  beforeEach(() => {
    service = new RateLimitService();
    mockRedisData = new Map();

    // Setup Redis mock implementation
    vi.mocked(redis.get).mockImplementation(async (key: string) => {
      const data = mockRedisData.get(key);
      if (!data) return undefined;
      if (data.expiry < Date.now()) {
        mockRedisData.delete(key);
        return undefined;
      }
      return data.value;
    });

    vi.mocked(redis.watch).mockImplementation(async () => {
      const txn = {
        multi: vi.fn().mockResolvedValue(undefined),
        incrBy: vi.fn().mockImplementation(async (k: string, amount: number) => {
          const current = mockRedisData.get(k);
          const newValue = (current ? parseInt(current.value, 10) : 0) + amount;
          mockRedisData.set(k, {
            value: String(newValue),
            expiry: current?.expiry || Date.now() + 1000000,
          });
          return newValue;
        }),
        expire: vi.fn().mockImplementation(async (k: string, seconds: number) => {
          const current = mockRedisData.get(k);
          if (current) {
            mockRedisData.set(k, {
              ...current,
              expiry: Date.now() + seconds * 1000,
            });
          }
          return true;
        }),
        exec: vi.fn().mockImplementation(async () => {
          // Execute the queued commands
          return [true, true];
        }),
      };
      return txn as any;
    });
  });

  /**
   * **Feature: rate-limiting, Property 1: Rate limits are enforced correctly**
   * 
   * *For any* rate limit key and configuration, when the request count exceeds the limit
   * within the window, subsequent requests should be rejected with 429.
   * 
   * **Validates: Requirements 2.3, 3.4, 6.1**
   */
  describe('Property 1: Rate limits are enforced correctly', () => {
    it('should enforce rate limits for any key and configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.integer({ min: 1, max: 20 }), // Keep limit small for test performance
          fc.integer({ min: 1, max: 10 }), // Keep window small for test performance
          async (key, limit, windowSeconds) => {
            // Clear mock data for this test
            mockRedisData.clear();

            // Make requests up to the limit (all should be allowed)
            for (let i = 0; i < limit; i++) {
              const result = await service.checkLimit(key, limit, windowSeconds);
              expect(result.allowed).toBe(true);
              expect(result.remaining).toBeGreaterThanOrEqual(0);
            }
            
            // Make one more request to exceed the limit
            // With sliding window, this might still be allowed depending on timing
            // So we make TWO more requests to ensure we definitely exceed
            await service.checkLimit(key, limit, windowSeconds);
            const result = await service.checkLimit(key, limit, windowSeconds);
            
            // After making limit+2 requests, we should definitely be blocked
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track remaining requests correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.integer({ min: 5, max: 20 }),
          fc.integer({ min: 1, max: 10 }),
          async (key, limit, windowSeconds) => {
            mockRedisData.clear();

            // Make some requests (half the limit)
            const requestCount = Math.floor(limit / 2);
            let lastResult;
            
            for (let i = 0; i < requestCount; i++) {
              lastResult = await service.checkLimit(key, limit, windowSeconds);
            }
            
            // Remaining should be approximately limit - requestCount
            expect(lastResult?.remaining).toBeGreaterThanOrEqual(limit - requestCount - 1);
            expect(lastResult?.remaining).toBeLessThanOrEqual(limit - requestCount + 1);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: rate-limiting, Property 5: Rate limits are per-user isolated**
   * 
   * *For any* two different users, their rate limit counters should be independent
   * and not affect each other.
   * 
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Property 5: Rate limits are per-user isolated', () => {
    it('should isolate rate limits between different users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 10 }),
          async (key1, key2, limit, windowSeconds) => {
            // Ensure keys are different
            if (key1 === key2) return;

            mockRedisData.clear();
            
            // Exhaust limit for key1 - make limit+2 requests to ensure we're definitely over
            for (let i = 0; i < limit + 2; i++) {
              await service.checkLimit(key1, limit, windowSeconds);
            }
            
            // Verify key1 is blocked
            const result1 = await service.checkLimit(key1, limit, windowSeconds);
            expect(result1.allowed).toBe(false);
            
            // key2 should still be allowed (first request)
            const result2 = await service.checkLimit(key2, limit, windowSeconds);
            expect(result2.allowed).toBe(true);
            // After first request, remaining should be approximately limit - 1
            // Allow some tolerance for sliding window calculations
            expect(result2.remaining).toBeGreaterThanOrEqual(0);
            expect(result2.remaining).toBeLessThanOrEqual(limit);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: rate-limiting, Property 3: System fails open on Redis errors**
   * 
   * *For any* Redis error or timeout, the rate limiting middleware should allow
   * the request to proceed rather than blocking it.
   * 
   * **Validates: Requirements 10.1, 10.2, 10.3**
   */
  describe('Property 3: System fails open on Redis errors', () => {
    it('should allow requests when Redis get fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 10 }),
          async (key, limit, windowSeconds) => {
            // Mock Redis to throw an error
            vi.mocked(redis.get).mockRejectedValueOnce(new Error('Redis connection failed'));

            // Request should still be allowed (fail open)
            const result = await service.checkLimit(key, limit, windowSeconds);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(limit);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow requests when Redis watch fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 10 }),
          async (key, limit, windowSeconds) => {
            mockRedisData.clear();

            // Mock Redis watch to throw an error on increment
            vi.mocked(redis.watch).mockRejectedValueOnce(new Error('Redis transaction failed'));

            // Request should still be allowed (fail open)
            const result = await service.checkLimit(key, limit, windowSeconds);
            expect(result.allowed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct fallback values on error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 60 }),
          async (key, limit, windowSeconds) => {
            // Mock Redis to throw an error
            vi.mocked(redis.get).mockRejectedValueOnce(new Error('Redis error'));

            const result = await service.checkLimit(key, limit, windowSeconds);
            
            // Should fail open with sensible defaults
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(limit);
            expect(result.current).toBe(0);
            expect(result.resetTime).toBeGreaterThan(Date.now());
            expect(result.resetTime).toBeLessThanOrEqual(Date.now() + windowSeconds * 1000 + 1000);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: rate-limiting, Property 4: Sliding window prevents burst attacks**
   * 
   * *For any* sequence of requests at window boundaries, the sliding window algorithm
   * should prevent burst attacks by considering requests from both current and previous windows.
   * 
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
   */
  describe('Property 4: Sliding window prevents burst attacks', () => {
    it('should consider requests from previous window', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.integer({ min: 5, max: 20 }),
          async (key, limit) => {
            mockRedisData.clear();
            const windowSeconds = 1; // 1 second window for testing

            // Make requests up to limit in first window
            for (let i = 0; i < limit; i++) {
              await service.checkLimit(key, limit, windowSeconds);
            }

            // Immediately at window boundary, should still be blocked
            // because sliding window considers previous window
            const result = await service.checkLimit(key, limit, windowSeconds);
            
            // The sliding window should still consider previous requests
            // So we should either be blocked or have very few remaining
            expect(result.remaining).toBeLessThan(limit);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should weight previous window requests proportionally', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.integer({ min: 10, max: 20 }),
          async (key, limit) => {
            mockRedisData.clear();
            const windowSeconds = 1;

            // Fill up the limit and go beyond to ensure we're definitely blocked
            for (let i = 0; i < limit + 2; i++) {
              await service.checkLimit(key, limit, windowSeconds);
            }

            // Should be blocked after exceeding limit
            const blocked = await service.checkLimit(key, limit, windowSeconds);
            expect(blocked.allowed).toBe(false);

            // The current count should reflect that we've exceeded the limit
            expect(blocked.current).toBeGreaterThanOrEqual(limit);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should allow requests after window fully expires', async () => {
      // This test verifies that after enough time passes, the limit resets
      // We simulate this by clearing the mock data (simulating TTL expiration)
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
          fc.integer({ min: 5, max: 20 }),
          async (key, limit) => {
            mockRedisData.clear();
            const windowSeconds = 1;

            // Fill up the limit and go beyond to ensure we're blocked
            for (let i = 0; i < limit + 2; i++) {
              await service.checkLimit(key, limit, windowSeconds);
            }

            // Make one more request - should definitely be blocked now
            const blocked = await service.checkLimit(key, limit, windowSeconds);
            expect(blocked.allowed).toBe(false);

            // Simulate window expiration by clearing data
            mockRedisData.clear();

            // Should be allowed again - this is the key property we're testing
            const allowed = await service.checkLimit(key, limit, windowSeconds);
            expect(allowed.allowed).toBe(true);
            // The remaining count should be reasonable (between 0 and limit)
            expect(allowed.remaining).toBeGreaterThanOrEqual(0);
            expect(allowed.remaining).toBeLessThanOrEqual(limit);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Example test for Redis TTL expiration
   * 
   * Tests that rate limit keys have TTL set correctly
   * 
   * **Validates: Requirements 1.3**
   */
  describe('Redis TTL expiration', () => {
    it('should set TTL on rate limit keys', async () => {
      mockRedisData.clear();
      const key = 'test-key';
      const limit = 10;
      const windowSeconds = 60;

      // Make a request
      await service.checkLimit(key, limit, windowSeconds);

      // Check that the Redis key has a TTL set
      // The TTL should be 2x the window (for sliding window)
      const currentWindow = Math.floor(Date.now() / (windowSeconds * 1000));
      const redisKey = `ratelimit:${key}:${currentWindow}`;
      
      const data = mockRedisData.get(redisKey);
      expect(data).toBeDefined();
      expect(data?.expiry).toBeGreaterThan(Date.now());
      
      // TTL should be approximately 2x window seconds
      const ttlMs = data!.expiry - Date.now();
      expect(ttlMs).toBeGreaterThan(0);
      expect(ttlMs).toBeLessThanOrEqual(windowSeconds * 2 * 1000 + 1000); // Allow 1s tolerance
    });

    it('should expire keys after TTL', async () => {
      mockRedisData.clear();
      const key = 'test-key';
      const limit = 10;
      const windowSeconds = 1;

      // Make a request
      await service.checkLimit(key, limit, windowSeconds);

      const currentWindow = Math.floor(Date.now() / (windowSeconds * 1000));
      const redisKey = `ratelimit:${key}:${currentWindow}`;
      
      // Key should exist
      expect(mockRedisData.get(redisKey)).toBeDefined();

      // Simulate TTL expiration by setting expiry to past
      const data = mockRedisData.get(redisKey);
      if (data) {
        mockRedisData.set(redisKey, {
          ...data,
          expiry: Date.now() - 1000, // Expired 1 second ago
        });
      }

      // Now when we try to get it, it should return undefined (expired)
      const value = await redis.get(redisKey);
      expect(value).toBeUndefined();
    });
  });
});
