/**
 * Property-based tests for RequestDeduplicator
 * 
 * **Feature: performance-optimization, Property 4: Request Deduplication Returns Same Promise**
 * **Validates: Requirements 4.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { RequestDeduplicator } from './request-deduplication.js';

describe('RequestDeduplicator Properties', () => {
  let deduplicator: RequestDeduplicator;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator();
  });

  /**
   * **Feature: performance-optimization, Property 4: Request Deduplication Returns Same Promise**
   * 
   * *For any* N simultaneous requests for the same user profile (where N > 1),
   * the deduplicator SHALL return the same promise to all callers,
   * resulting in exactly 1 actual fetch operation.
   * 
   * **Validates: Requirements 4.3**
   */
  describe('Property 4: Request Deduplication Returns Same Promise', () => {
    it('should return the same promise for N simultaneous requests (N > 1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate N between 2 and 10 simultaneous requests
          fc.integer({ min: 2, max: 10 }),
          // Generate a unique key for the request
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          // Generate a result value
          fc.anything(),
          async (n, key, resultValue) => {
            let fetchCount = 0;
            const fetcher = async () => {
              fetchCount++;
              // Simulate async operation
              await new Promise(resolve => setTimeout(resolve, 10));
              return resultValue;
            };

            // Make N simultaneous requests
            const promises: Promise<unknown>[] = [];
            for (let i = 0; i < n; i++) {
              promises.push(deduplicator.dedupe(key, fetcher));
            }

            // All promises should be the same reference
            for (let i = 1; i < promises.length; i++) {
              expect(promises[i]).toBe(promises[0]);
            }

            // Wait for all to complete
            const results = await Promise.all(promises);

            // All results should be equal
            for (const result of results) {
              expect(result).toEqual(resultValue);
            }

            // Only 1 actual fetch should have occurred
            expect(fetchCount).toBe(1);

            // Clean up for next iteration
            deduplicator.clearAll();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track in-flight status correctly during request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (key) => {
            let resolvePromise: () => void;
            const blockingPromise = new Promise<void>(resolve => {
              resolvePromise = resolve;
            });

            const fetcher = async () => {
              await blockingPromise;
              return 'result';
            };

            // Start the request
            const promise = deduplicator.dedupe(key, fetcher);

            // Should be in flight
            expect(deduplicator.isInFlight(key)).toBe(true);

            // Resolve the blocking promise
            resolvePromise!();
            await promise;

            // Should no longer be in flight after completion
            expect(deduplicator.isInFlight(key)).toBe(false);

            deduplicator.clearAll();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clean up completed requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.anything(),
          async (key, resultValue) => {
            const fetcher = async () => resultValue;

            // Make request and wait for completion
            await deduplicator.dedupe(key, fetcher);

            // Request should be cleaned up
            expect(deduplicator.isInFlight(key)).toBe(false);
            expect(deduplicator.getPendingCount()).toBe(0);

            deduplicator.clearAll();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clean up failed requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string(),
          async (key, errorMessage) => {
            const fetcher = async () => {
              throw new Error(errorMessage);
            };

            // Make request and expect it to fail
            try {
              await deduplicator.dedupe(key, fetcher);
            } catch {
              // Expected to throw
            }

            // Request should be cleaned up even on failure
            expect(deduplicator.isInFlight(key)).toBe(false);
            expect(deduplicator.getPendingCount()).toBe(0);

            deduplicator.clearAll();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow new requests after previous completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 5 }),
          async (key, sequentialCount) => {
            let fetchCount = 0;

            for (let i = 0; i < sequentialCount; i++) {
              const fetcher = async () => {
                fetchCount++;
                return i;
              };

              const result = await deduplicator.dedupe(key, fetcher);
              expect(result).toBe(i);
            }

            // Each sequential request should trigger a new fetch
            expect(fetchCount).toBe(sequentialCount);

            deduplicator.clearAll();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
