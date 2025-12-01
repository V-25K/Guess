/**
 * Property-based tests for parallel-fetch utilities
 * 
 * Tests retry logic with exponential backoff behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  fetchWithRetry,
  calculateRetryDelay,
  type RetryOptions,
} from './parallel-fetch.js';

describe('Parallel Fetch Properties', () => {
  /**
   * **Feature: performance-optimization, Property 10: Retry Uses Exponential Backoff**
   * 
   * *For any* failed request with retry enabled, the delay between attempt N and N+1
   * SHALL be approximately 2^N seconds (with jitter), up to a maximum of 3 retries.
   * 
   * **Validates: Requirements 7.3**
   */
  describe('Property 10: Retry Uses Exponential Backoff', () => {
    it('should calculate base delay as min(initialDelay * 2^attempt, maxDelay)', () => {
      fc.assert(
        fc.property(
          // attempt number (0-indexed, up to 10 for testing)
          fc.integer({ min: 0, max: 10 }),
          // initial delay in ms (100ms to 5000ms)
          fc.integer({ min: 100, max: 5000 }),
          // max delay in ms
          fc.integer({ min: 1000, max: 1000000 }),
          (attempt, initialDelayMs, maxDelayMs) => {
            const { baseDelay } = calculateRetryDelay(attempt, initialDelayMs, maxDelayMs);
            
            // Base delay should be min(initialDelay * 2^attempt, maxDelay)
            const uncappedDelay = initialDelayMs * Math.pow(2, attempt);
            const expectedBaseDelay = Math.min(uncappedDelay, maxDelayMs);
            expect(baseDelay).toBe(expectedBaseDelay);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cap base delay at maxDelayMs', () => {
      fc.assert(
        fc.property(
          // attempt number high enough to exceed max
          fc.integer({ min: 5, max: 15 }),
          // initial delay
          fc.integer({ min: 1000, max: 2000 }),
          // max delay (smaller than what exponential would produce)
          fc.integer({ min: 5000, max: 10000 }),
          (attempt, initialDelayMs, maxDelayMs) => {
            const { baseDelay } = calculateRetryDelay(attempt, initialDelayMs, maxDelayMs);
            
            // Base delay should never exceed maxDelayMs
            expect(baseDelay).toBeLessThanOrEqual(maxDelayMs);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add jitter between 0 and 30% of base delay', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 1000, max: 5000 }),
          fc.integer({ min: 50000, max: 100000 }),
          (attempt, initialDelayMs, maxDelayMs) => {
            const { baseDelay, jitter } = calculateRetryDelay(attempt, initialDelayMs, maxDelayMs);
            
            // Jitter should be between 0 and 30% of base delay
            expect(jitter).toBeGreaterThanOrEqual(0);
            expect(jitter).toBeLessThanOrEqual(baseDelay * 0.3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have totalDelay equal to baseDelay + jitter', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 1000, max: 5000 }),
          fc.integer({ min: 50000, max: 100000 }),
          (attempt, initialDelayMs, maxDelayMs) => {
            const { baseDelay, jitter, totalDelay } = calculateRetryDelay(attempt, initialDelayMs, maxDelayMs);
            
            // Total delay should be base + jitter
            expect(totalDelay).toBe(baseDelay + jitter);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default 1-second initial delay', () => {
      const { baseDelay } = calculateRetryDelay(0);
      expect(baseDelay).toBe(1000); // 1000ms = 1 second
    });

    it('should double delay on each subsequent attempt', () => {
      // Test the exponential progression: 1s, 2s, 4s, 8s...
      const delays = [0, 1, 2, 3].map(attempt => {
        const { baseDelay } = calculateRetryDelay(attempt, 1000, 100000);
        return baseDelay;
      });
      
      expect(delays[0]).toBe(1000);  // 2^0 * 1000 = 1000
      expect(delays[1]).toBe(2000);  // 2^1 * 1000 = 2000
      expect(delays[2]).toBe(4000);  // 2^2 * 1000 = 4000
      expect(delays[3]).toBe(8000);  // 2^3 * 1000 = 8000
    });

    it('should retry maximum 3 times by default', async () => {
      let attemptCount = 0;
      const delays: number[] = [];
      
      const failingFetcher = async () => {
        attemptCount++;
        throw new Error('Always fails');
      };

      const options: RetryOptions = {
        delayFn: async (ms) => {
          delays.push(ms);
          return ms;
        },
      };

      await expect(fetchWithRetry(failingFetcher, options)).rejects.toThrow('Always fails');
      
      // Should have attempted 3 times (default maxRetries)
      expect(attemptCount).toBe(3);
      // Should have 2 delays (between attempts 1-2 and 2-3)
      expect(delays.length).toBe(2);
    });

    it('should call onRetry callback with correct attempt number', async () => {
      const retryAttempts: number[] = [];
      
      let attemptCount = 0;
      const failingFetcher = async () => {
        attemptCount++;
        throw new Error('Fail');
      };

      const options: RetryOptions = {
        maxRetries: 4,
        onRetry: (attempt) => {
          retryAttempts.push(attempt);
        },
        delayFn: async () => 0, // Skip actual delays
      };

      await expect(fetchWithRetry(failingFetcher, options)).rejects.toThrow();
      
      // onRetry should be called with 1, 2, 3 (not called after last attempt)
      expect(retryAttempts).toEqual([1, 2, 3]);
    });

    it('should succeed on first attempt without retrying', async () => {
      let attemptCount = 0;
      const delays: number[] = [];
      
      const successFetcher = async () => {
        attemptCount++;
        return 'success';
      };

      const options: RetryOptions = {
        delayFn: async (ms) => {
          delays.push(ms);
          return ms;
        },
      };

      const result = await fetchWithRetry(successFetcher, options);
      
      expect(result).toBe('success');
      expect(attemptCount).toBe(1);
      expect(delays.length).toBe(0); // No delays needed
    });

    it('should succeed on retry after initial failures', async () => {
      let attemptCount = 0;
      
      const eventuallySucceedsFetcher = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Not yet');
        }
        return 'success';
      };

      const options: RetryOptions = {
        delayFn: async () => 0, // Skip actual delays
      };

      const result = await fetchWithRetry(eventuallySucceedsFetcher, options);
      
      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should use exponential delays between retries', async () => {
      const delays: number[] = [];
      
      const failingFetcher = async () => {
        throw new Error('Fail');
      };

      const options: RetryOptions = {
        maxRetries: 4,
        initialDelayMs: 1000,
        maxDelayMs: 100000,
        delayFn: async (ms) => {
          delays.push(ms);
          return ms;
        },
      };

      await expect(fetchWithRetry(failingFetcher, options)).rejects.toThrow();
      
      // Should have 3 delays (between 4 attempts)
      expect(delays.length).toBe(3);
      
      // Each delay should be approximately 2x the previous (accounting for jitter)
      // Delay 0: ~1000ms (1000 * 2^0 + jitter)
      // Delay 1: ~2000ms (1000 * 2^1 + jitter)
      // Delay 2: ~4000ms (1000 * 2^2 + jitter)
      
      // Base delays without jitter
      expect(delays[0]).toBeGreaterThanOrEqual(1000);
      expect(delays[0]).toBeLessThanOrEqual(1300); // 1000 + 30% jitter
      
      expect(delays[1]).toBeGreaterThanOrEqual(2000);
      expect(delays[1]).toBeLessThanOrEqual(2600); // 2000 + 30% jitter
      
      expect(delays[2]).toBeGreaterThanOrEqual(4000);
      expect(delays[2]).toBeLessThanOrEqual(5200); // 4000 + 30% jitter
    });
  });
});
