/**
 * Property-Based Tests for Rate Limit Configuration
 * 
 * Tests universal properties that should hold for all rate limit configurations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { 
  RATE_LIMITS, 
  DEFAULT_RATE_LIMIT, 
  ANONYMOUS_RATE_LIMIT,
  updateRateLimit,
  getRateLimit 
} from './rate-limits.js';
import { RateLimitConfig } from '../middleware/rate-limit.js';

describe('Rate Limit Configuration Properties', () => {
  /**
   * Feature: rate-limiting, Property 10: Configuration changes apply immediately
   * Validates: Requirements 4.5
   * 
   * For any endpoint and configuration, when we update the rate limit,
   * subsequent calls to getRateLimit should return the new configuration
   * without requiring a restart.
   */
  it('should apply configuration updates immediately', () => {
    fc.assert(
      fc.property(
        // Generate random endpoint pattern
        fc.string({ minLength: 5, maxLength: 50 }),
        // Generate random rate limit configuration
        fc.record({
          limit: fc.integer({ min: 1, max: 1000 }),
          windowSeconds: fc.integer({ min: 1, max: 3600 }),
        }),
        // Generate a second different configuration
        fc.record({
          limit: fc.integer({ min: 1, max: 1000 }),
          windowSeconds: fc.integer({ min: 1, max: 3600 }),
        }),
        (endpoint, config1, config2) => {
          // Exclude problematic JavaScript property names
          const problematicNames = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable'];
          fc.pre(!problematicNames.includes(endpoint));
          
          // Ensure configs are different (either limit or window must differ)
          fc.pre(config1.limit !== config2.limit || config1.windowSeconds !== config2.windowSeconds);
          
          // Update to first config
          updateRateLimit(endpoint, config1);
          const retrieved1 = getRateLimit(endpoint);
          
          // Should get the first config back
          expect(retrieved1.limit).toBe(config1.limit);
          expect(retrieved1.windowSeconds).toBe(config1.windowSeconds);
          
          // Update to second config
          updateRateLimit(endpoint, config2);
          const retrieved2 = getRateLimit(endpoint);
          
          // Should get the second config back immediately
          expect(retrieved2.limit).toBe(config2.limit);
          expect(retrieved2.windowSeconds).toBe(config2.windowSeconds);
          
          // Verify the change was immediate - at least one value should have changed
          const limitChanged = retrieved2.limit !== config1.limit;
          const windowChanged = retrieved2.windowSeconds !== config1.windowSeconds;
          expect(limitChanged || windowChanged).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: rate-limiting, Property 10: Configuration changes apply immediately
   * Validates: Requirements 4.5
   * 
   * For any sequence of configuration updates, the most recent update
   * should always be the active configuration.
   */
  it('should maintain most recent configuration across multiple updates', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.array(
          fc.record({
            limit: fc.integer({ min: 1, max: 1000 }),
            windowSeconds: fc.integer({ min: 1, max: 3600 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (endpoint, configs) => {
          // Apply all configurations in sequence
          configs.forEach(config => {
            updateRateLimit(endpoint, config);
          });
          
          // The last configuration should be active
          const lastConfig = configs[configs.length - 1];
          const retrieved = getRateLimit(endpoint);
          
          expect(retrieved.limit).toBe(lastConfig.limit);
          expect(retrieved.windowSeconds).toBe(lastConfig.windowSeconds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: rate-limiting, Property 10: Configuration changes apply immediately
   * Validates: Requirements 4.5
   * 
   * For any configuration update, it should not affect other endpoints.
   */
  it('should isolate configuration updates per endpoint', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.record({
          limit: fc.integer({ min: 1, max: 1000 }),
          windowSeconds: fc.integer({ min: 1, max: 3600 }),
        }),
        fc.record({
          limit: fc.integer({ min: 1, max: 1000 }),
          windowSeconds: fc.integer({ min: 1, max: 3600 }),
        }),
        (endpoint1, endpoint2, config1, config2) => {
          // Ensure endpoints are different and not problematic property names
          const problematicNames = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];
          fc.pre(
            endpoint1 !== endpoint2 &&
            !problematicNames.includes(endpoint1) &&
            !problematicNames.includes(endpoint2)
          );
          
          // Update both endpoints
          updateRateLimit(endpoint1, config1);
          updateRateLimit(endpoint2, config2);
          
          // Each endpoint should have its own config
          const retrieved1 = getRateLimit(endpoint1);
          const retrieved2 = getRateLimit(endpoint2);
          
          expect(retrieved1.limit).toBe(config1.limit);
          expect(retrieved1.windowSeconds).toBe(config1.windowSeconds);
          
          expect(retrieved2.limit).toBe(config2.limit);
          expect(retrieved2.windowSeconds).toBe(config2.windowSeconds);
          
          // Update endpoint1 again
          const newConfig1: RateLimitConfig = {
            limit: config1.limit + 100,
            windowSeconds: config1.windowSeconds + 10,
          };
          updateRateLimit(endpoint1, newConfig1);
          
          // endpoint1 should change, endpoint2 should not
          const retrievedAfter1 = getRateLimit(endpoint1);
          const retrievedAfter2 = getRateLimit(endpoint2);
          
          expect(retrievedAfter1.limit).toBe(newConfig1.limit);
          expect(retrievedAfter2.limit).toBe(config2.limit);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Rate Limit Time Window Properties', () => {
  /**
   * Feature: rate-limiting, Property: Rate limiting works with various window sizes
   * Validates: Requirements 4.4
   * 
   * For any valid time window configuration, the rate limiting system should
   * correctly enforce limits regardless of the window duration.
   */
  it('should work correctly with various time window sizes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 3600 }), // 1 second to 1 hour
        (endpoint, limit, windowSeconds) => {
          // Create configuration with the time window
          const config: RateLimitConfig = {
            limit,
            windowSeconds,
          };
          
          // Update the configuration
          updateRateLimit(endpoint, config);
          
          // Retrieve and verify
          const retrieved = getRateLimit(endpoint);
          
          expect(retrieved.limit).toBe(limit);
          expect(retrieved.windowSeconds).toBe(windowSeconds);
          
          // Verify window is within valid range
          expect(retrieved.windowSeconds).toBeGreaterThan(0);
          expect(retrieved.windowSeconds).toBeLessThanOrEqual(3600);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: rate-limiting, Property: Time windows are independent per endpoint
   * Validates: Requirements 4.4
   * 
   * For any two endpoints with different time windows, each should maintain
   * its own window configuration independently.
   */
  it('should maintain independent time windows for different endpoints', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 3600 }),
        fc.integer({ min: 1, max: 3600 }),
        (endpoint1, endpoint2, limit, window1, window2) => {
          // Ensure endpoints are different
          fc.pre(endpoint1 !== endpoint2);
          // Ensure windows are different
          fc.pre(window1 !== window2);
          
          // Configure both endpoints with different windows
          updateRateLimit(endpoint1, { limit, windowSeconds: window1 });
          updateRateLimit(endpoint2, { limit, windowSeconds: window2 });
          
          // Retrieve both configurations
          const config1 = getRateLimit(endpoint1);
          const config2 = getRateLimit(endpoint2);
          
          // Each should have its own window
          expect(config1.windowSeconds).toBe(window1);
          expect(config2.windowSeconds).toBe(window2);
          expect(config1.windowSeconds).not.toBe(config2.windowSeconds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: rate-limiting, Property: Short and long windows are both supported
   * Validates: Requirements 4.4
   * 
   * The system should support both very short windows (seconds) and very long
   * windows (hours/days) without issues.
   */
  it('should support both short and long time windows', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.integer({ min: 1, max: 100 }),
        fc.constantFrom(
          1,      // 1 second (very short)
          5,      // 5 seconds
          60,     // 1 minute
          300,    // 5 minutes
          3600,   // 1 hour
          86400   // 24 hours (very long)
        ),
        (endpoint, limit, windowSeconds) => {
          const config: RateLimitConfig = {
            limit,
            windowSeconds,
          };
          
          updateRateLimit(endpoint, config);
          const retrieved = getRateLimit(endpoint);
          
          expect(retrieved.windowSeconds).toBe(windowSeconds);
          
          // Verify the window is one of our supported values
          expect([1, 5, 60, 300, 3600, 86400]).toContain(retrieved.windowSeconds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: rate-limiting, Property: Window updates don't affect limit
   * Validates: Requirements 4.4, 4.5
   * 
   * For any endpoint, changing the time window should not affect the limit value.
   */
  it('should preserve limit when updating time window', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 3600 }),
        fc.integer({ min: 1, max: 3600 }),
        (endpoint, limit, window1, window2) => {
          // Ensure windows are different
          fc.pre(window1 !== window2);
          
          // Set initial configuration
          updateRateLimit(endpoint, { limit, windowSeconds: window1 });
          
          // Update only the window
          updateRateLimit(endpoint, { limit, windowSeconds: window2 });
          
          const retrieved = getRateLimit(endpoint);
          
          // Limit should remain the same
          expect(retrieved.limit).toBe(limit);
          // Window should be updated
          expect(retrieved.windowSeconds).toBe(window2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
