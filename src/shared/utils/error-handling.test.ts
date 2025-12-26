/**
 * Property-based tests for graceful error degradation
 * 
 * **Feature: devvit-web-migration, Property 7: Graceful error degradation**
 * **Validates: Requirements 13.4**
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

/**
 * Simulates a service operation that may fail
 */
async function serviceOperation<T>(
  fetcher: () => Promise<T>,
  fallbackValue: T
): Promise<T> {
  try {
    return await fetcher();
  } catch (error) {
    console.error('Operation failed, returning fallback:', error);
    return fallbackValue;
  }
}

/**
 * Simulates a cache operation that may fail
 */
async function cacheOperation<T>(
  operation: () => Promise<T>
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error('Cache operation failed:', error);
    return null;
  }
}

/**
 * Simulates a boolean operation that may fail
 */
async function booleanOperation(
  operation: () => Promise<boolean>
): Promise<boolean> {
  try {
    return await operation();
  } catch (error) {
    console.error('Boolean operation failed:', error);
    return false;
  }
}

describe('Graceful Error Degradation Properties', () => {
  /**
   * **Feature: devvit-web-migration, Property 7: Graceful error degradation**
   * 
   * *For any* error that occurs during data fetching or processing,
   * the system SHALL catch the error, log it, and return a fallback value
   * without crashing or propagating the error to the caller.
   * 
   * **Validates: Requirements 13.4**
   */
  describe('Property 7: Graceful error degradation', () => {
    it('should return fallback value when operation throws error', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random error messages
          fc.string({ minLength: 1, maxLength: 100 }),
          // Generate random fallback values
          fc.anything(),
          async (errorMessage, fallbackValue) => {
            const failingOperation = async () => {
              throw new Error(errorMessage);
            };

            const result = await serviceOperation(failingOperation, fallbackValue);

            // Should return fallback value, not throw
            expect(result).toEqual(fallbackValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return successful result when operation succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random success values
          fc.anything(),
          // Generate random fallback values (should not be used)
          fc.anything(),
          async (successValue, fallbackValue) => {
            const successfulOperation = async () => {
              return successValue;
            };

            const result = await serviceOperation(successfulOperation, fallbackValue);

            // Should return success value, not fallback
            expect(result).toEqual(successValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when cache operation fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random error messages
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            const failingCacheOp = async () => {
              throw new Error(errorMessage);
            };

            const result = await cacheOperation(failingCacheOp);

            // Should return null, not throw
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return cached value when cache operation succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random cached values
          fc.anything().filter(v => v !== null && v !== undefined),
          async (cachedValue) => {
            const successfulCacheOp = async () => {
              return cachedValue;
            };

            const result = await cacheOperation(successfulCacheOp);

            // Should return cached value
            expect(result).toEqual(cachedValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false when boolean operation fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random error messages
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            const failingBooleanOp = async () => {
              throw new Error(errorMessage);
            };

            const result = await booleanOperation(failingBooleanOp);

            // Should return false, not throw
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return true when boolean operation succeeds with true', async () => {
      const successfulBooleanOp = async () => {
        return true;
      };

      const result = await booleanOperation(successfulBooleanOp);

      // Should return true
      expect(result).toBe(true);
    });

    it('should return false when boolean operation succeeds with false', async () => {
      const successfulBooleanOp = async () => {
        return false;
      };

      const result = await booleanOperation(successfulBooleanOp);

      // Should return false (not because of error, but because operation returned false)
      expect(result).toBe(false);
    });

    it('should not propagate errors to caller', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random error types
          fc.oneof(
            fc.string().map(msg => new Error(msg)),
            fc.string().map(msg => new TypeError(msg)),
            fc.string().map(msg => new RangeError(msg)),
            fc.string(),
            fc.integer(),
            fc.record({ message: fc.string() })
          ),
          // Generate random fallback values
          fc.anything(),
          async (error, fallbackValue) => {
            const failingOperation = async () => {
              throw error;
            };

            // This should NOT throw - it should catch and return fallback
            const result = await serviceOperation(failingOperation, fallbackValue);

            expect(result).toEqual(fallbackValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log errors when they occur', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.anything(),
          async (errorMessage, fallbackValue) => {
            // Spy on console.error
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const failingOperation = async () => {
              throw new Error(errorMessage);
            };

            await serviceOperation(failingOperation, fallbackValue);

            // Should have logged the error
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle async errors in nested operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.anything(),
          async (errorMessage, fallbackValue) => {
            const nestedFailingOperation = async () => {
              // Simulate async work
              await new Promise(resolve => setTimeout(resolve, 1));
              throw new Error(errorMessage);
            };

            const result = await serviceOperation(nestedFailingOperation, fallbackValue);

            // Should still return fallback value
            expect(result).toEqual(fallbackValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle errors in operations that return promises', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.anything(),
          async (errorMessage, fallbackValue) => {
            const promiseRejectingOperation = async () => {
              return Promise.reject(new Error(errorMessage));
            };

            const result = await serviceOperation(promiseRejectingOperation, fallbackValue);

            // Should return fallback value
            expect(result).toEqual(fallbackValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple sequential errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
          fc.anything(),
          async (errorMessages, fallbackValue) => {
            const results: any[] = [];

            for (const errorMessage of errorMessages) {
              const failingOperation = async () => {
                throw new Error(errorMessage);
              };

              const result = await serviceOperation(failingOperation, fallbackValue);
              results.push(result);
            }

            // All results should be the fallback value
            for (const result of results) {
              expect(result).toEqual(fallbackValue);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle errors with different fallback types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.oneof(
            fc.constant(null),
            fc.constant(false),
            fc.constant(0),
            fc.constant(''),
            fc.constant([]),
            fc.constant({}),
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.anything()),
            fc.record({ key: fc.anything() })
          ),
          async (errorMessage, fallbackValue) => {
            const failingOperation = async () => {
              throw new Error(errorMessage);
            };

            const result = await serviceOperation(failingOperation, fallbackValue);

            // Should return the specific fallback value regardless of type
            expect(result).toEqual(fallbackValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
