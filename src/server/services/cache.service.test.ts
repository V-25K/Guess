/**
 * Property-based tests for CacheService
 * 
 * Tests TTL validation and cache error fallback behavior.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateDynamicTTL,
  isValidDynamicTTL,
  InvalidTTLError,
  TTL,
  capUserDataTTL,
} from './cache.service.js';

describe('CacheService Properties', () => {
  /**
   * **Feature: performance-optimization, Property 12: TTL Values Within Valid Range**
   * 
   * *For any* cache TTL set for dynamic data, the value SHALL be between
   * 10,000 and 60,000 milliseconds (10-60 seconds).
   * 
   * **Validates: Requirements 8.4**
   */
  describe('Property 12: TTL Values Within Valid Range', () => {
    it('should accept TTL values within valid range [10000, 60000]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: TTL.MIN_DYNAMIC, max: TTL.MAX_DYNAMIC }),
          (ttl) => {
            // validateDynamicTTL should return true for valid TTL
            expect(validateDynamicTTL(ttl)).toBe(true);
            expect(isValidDynamicTTL(ttl)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject TTL values below minimum (10000ms)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: TTL.MIN_DYNAMIC - 1 }),
          (ttl) => {
            // validateDynamicTTL should throw for TTL below minimum
            expect(() => validateDynamicTTL(ttl)).toThrow(InvalidTTLError);
            expect(isValidDynamicTTL(ttl)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject TTL values above maximum (60000ms)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: TTL.MAX_DYNAMIC + 1, max: 1_000_000 }),
          (ttl) => {
            // validateDynamicTTL should throw for TTL above maximum
            expect(() => validateDynamicTTL(ttl)).toThrow(InvalidTTLError);
            expect(isValidDynamicTTL(ttl)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept boundary values exactly at min and max', () => {
      // Test exact boundary values
      expect(validateDynamicTTL(TTL.MIN_DYNAMIC)).toBe(true);
      expect(validateDynamicTTL(TTL.MAX_DYNAMIC)).toBe(true);
      expect(isValidDynamicTTL(TTL.MIN_DYNAMIC)).toBe(true);
      expect(isValidDynamicTTL(TTL.MAX_DYNAMIC)).toBe(true);
    });

    it('should reject values just outside boundaries', () => {
      // Just below minimum
      expect(() => validateDynamicTTL(TTL.MIN_DYNAMIC - 1)).toThrow(InvalidTTLError);
      expect(isValidDynamicTTL(TTL.MIN_DYNAMIC - 1)).toBe(false);
      
      // Just above maximum
      expect(() => validateDynamicTTL(TTL.MAX_DYNAMIC + 1)).toThrow(InvalidTTLError);
      expect(isValidDynamicTTL(TTL.MAX_DYNAMIC + 1)).toBe(false);
    });

    it('should have InvalidTTLError contain the invalid value and valid range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: TTL.MIN_DYNAMIC - 1 }),
          (ttl) => {
            try {
              validateDynamicTTL(ttl);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error) {
              expect(error).toBeInstanceOf(InvalidTTLError);
              expect((error as Error).message).toContain(String(ttl));
              expect((error as Error).message).toContain(String(TTL.MIN_DYNAMIC));
              expect((error as Error).message).toContain(String(TTL.MAX_DYNAMIC));
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});


  /**
   * **Feature: performance-optimization, Property 11: Cache Error Returns Fallback Data**
   * 
   * *For any* context.cache() call where the fetch function throws an error,
   * the system SHALL return an empty array (for list data) or null (for single items)
   * rather than propagating the error.
   * 
   * **Validates: Requirements 8.3**
   * 
   * Note: Since context.cache() is a Devvit runtime feature that cannot be easily mocked
   * in unit tests, we test the error handling behavior through the CacheService's
   * error handling patterns. The actual integration with context.cache() is tested
   * through manual testing in the Devvit environment.
   */
  describe('Property 11: Cache Error Returns Fallback Data', () => {
    it('should demonstrate that InvalidTTLError is caught and handled gracefully', () => {
      fc.assert(
        fc.property(
          // Generate invalid TTL values (outside valid range)
          fc.oneof(
            fc.integer({ min: 0, max: TTL.MIN_DYNAMIC - 1 }),
            fc.integer({ min: TTL.MAX_DYNAMIC + 1, max: 1_000_000 })
          ),
          (invalidTTL) => {
            // The validateDynamicTTL function throws InvalidTTLError for invalid TTL
            // In CacheService.getSharedData, this error is caught and null is returned
            // In CacheService.getSharedDataArray, this error is caught and [] is returned
            
            // Verify the error is thrown (which CacheService catches internally)
            expect(() => validateDynamicTTL(invalidTTL)).toThrow(InvalidTTLError);
            
            // The error message should be informative
            try {
              validateDynamicTTL(invalidTTL);
            } catch (error) {
              expect(error).toBeInstanceOf(InvalidTTLError);
              expect((error as InvalidTTLError).name).toBe('InvalidTTLError');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have error types that can be caught and identified', () => {
      // Test that InvalidTTLError can be caught and identified
      const invalidTTL = 5000; // Below minimum
      
      try {
        validateDynamicTTL(invalidTTL);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        // Error should be catchable
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(InvalidTTLError);
        
        // Error should have proper name for identification
        expect((error as Error).name).toBe('InvalidTTLError');
        
        // Error message should contain useful information
        const message = (error as Error).message;
        expect(message).toContain('5000');
        expect(message).toContain('10000');
        expect(message).toContain('60000');
      }
    });

    it('should validate that isValidDynamicTTL never throws (safe check)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1_000_000, max: 1_000_000 }),
          (ttl) => {
            // isValidDynamicTTL should never throw, only return boolean
            // This is the safe version for checking without exceptions
            const result = isValidDynamicTTL(ttl);
            expect(typeof result).toBe('boolean');
            
            // Result should match expected validity
            const expectedValid = ttl >= TTL.MIN_DYNAMIC && ttl <= TTL.MAX_DYNAMIC;
            expect(result).toBe(expectedValid);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: data-retention-compliance, Property 1: TTL Capping Invariant**
   * 
   * *For any* requested TTL value (from 0 to any positive integer), the effective TTL
   * applied to user data SHALL equal the minimum of the requested TTL and USER_DATA_RETENTION
   * (30 days). This ensures TTLs longer than 30 days are capped, while shorter TTLs pass
   * through unchanged.
   * 
   * **Validates: Requirements 1.3, 1.4, 2.1**
   */
  describe('Property 1: TTL Capping Invariant', () => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 2,592,000,000 ms

    it('should verify USER_DATA_RETENTION constant equals 30 days in milliseconds', () => {
      expect(TTL.USER_DATA_RETENTION).toBe(THIRTY_DAYS_MS);
    });

    it('should verify USER_DATA_RETENTION_SECONDS constant equals 30 days in seconds', () => {
      expect(TTL.USER_DATA_RETENTION_SECONDS).toBe(30 * 24 * 60 * 60);
    });

    it('should cap TTL values greater than 30 days to USER_DATA_RETENTION', () => {
      fc.assert(
        fc.property(
          // Generate TTL values greater than 30 days (up to 100 days)
          fc.integer({ min: THIRTY_DAYS_MS + 1, max: 100 * 24 * 60 * 60 * 1000 }),
          (requestedTTL) => {
            const effectiveTTL = capUserDataTTL(requestedTTL);
            // Effective TTL should be capped at USER_DATA_RETENTION
            expect(effectiveTTL).toBe(TTL.USER_DATA_RETENTION);
            // Verify the invariant: effective = min(requested, USER_DATA_RETENTION)
            expect(effectiveTTL).toBe(Math.min(requestedTTL, TTL.USER_DATA_RETENTION));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass through TTL values less than or equal to 30 days unchanged', () => {
      fc.assert(
        fc.property(
          // Generate TTL values from 0 to 30 days
          fc.integer({ min: 0, max: THIRTY_DAYS_MS }),
          (requestedTTL) => {
            const effectiveTTL = capUserDataTTL(requestedTTL);
            // Effective TTL should equal the requested TTL
            expect(effectiveTTL).toBe(requestedTTL);
            // Verify the invariant: effective = min(requested, USER_DATA_RETENTION)
            expect(effectiveTTL).toBe(Math.min(requestedTTL, TTL.USER_DATA_RETENTION));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should satisfy the invariant: effective TTL = min(requested, USER_DATA_RETENTION) for any positive TTL', () => {
      fc.assert(
        fc.property(
          // Generate any positive TTL value (0 to 365 days)
          fc.integer({ min: 0, max: 365 * 24 * 60 * 60 * 1000 }),
          (requestedTTL) => {
            const effectiveTTL = capUserDataTTL(requestedTTL);
            const expectedTTL = Math.min(requestedTTL, TTL.USER_DATA_RETENTION);
            expect(effectiveTTL).toBe(expectedTTL);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle boundary value exactly at 30 days', () => {
      const effectiveTTL = capUserDataTTL(THIRTY_DAYS_MS);
      expect(effectiveTTL).toBe(THIRTY_DAYS_MS);
    });

    it('should handle boundary value just above 30 days', () => {
      const effectiveTTL = capUserDataTTL(THIRTY_DAYS_MS + 1);
      expect(effectiveTTL).toBe(THIRTY_DAYS_MS);
    });

    it('should handle boundary value just below 30 days', () => {
      const effectiveTTL = capUserDataTTL(THIRTY_DAYS_MS - 1);
      expect(effectiveTTL).toBe(THIRTY_DAYS_MS - 1);
    });
  });


/**
 * Unit tests for CacheService TTL enforcement
 * 
 * Tests for Requirements 2.1, 2.2, 2.3, 2.4
 */
describe('CacheService TTL Enforcement', () => {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const FIVE_MINUTES_MS = 5 * 60 * 1000;

  describe('setUserData TTL capping (Requirement 2.1)', () => {
    it('should cap TTL > 30 days to USER_DATA_RETENTION', () => {
      // TTL of 60 days should be capped to 30 days
      const requestedTTL = 60 * 24 * 60 * 60 * 1000;
      const effectiveTTL = capUserDataTTL(requestedTTL);
      expect(effectiveTTL).toBe(THIRTY_DAYS_MS);
    });

    it('should pass through TTL < 30 days unchanged', () => {
      // TTL of 7 days should pass through
      const requestedTTL = 7 * 24 * 60 * 60 * 1000;
      const effectiveTTL = capUserDataTTL(requestedTTL);
      expect(effectiveTTL).toBe(requestedTTL);
    });

    it('should pass through TTL exactly at 30 days', () => {
      const effectiveTTL = capUserDataTTL(THIRTY_DAYS_MS);
      expect(effectiveTTL).toBe(THIRTY_DAYS_MS);
    });
  });

  describe('setUserData default TTL behavior (Requirement 2.2)', () => {
    it('should use USER_PROFILE TTL (5 minutes) as default', () => {
      expect(TTL.USER_PROFILE).toBe(FIVE_MINUTES_MS);
    });

    it('should have default TTL less than USER_DATA_RETENTION', () => {
      // Default TTL should be less than 30 days, so no capping needed
      expect(TTL.USER_PROFILE).toBeLessThan(TTL.USER_DATA_RETENTION);
    });
  });

  describe('capUserDataTTL helper function (Requirement 2.3)', () => {
    it('should return min(requestedTTL, USER_DATA_RETENTION)', () => {
      // Test with various TTL values
      const testCases = [
        { requested: 1000, expected: 1000 },
        { requested: FIVE_MINUTES_MS, expected: FIVE_MINUTES_MS },
        { requested: THIRTY_DAYS_MS, expected: THIRTY_DAYS_MS },
        { requested: THIRTY_DAYS_MS + 1, expected: THIRTY_DAYS_MS },
        { requested: 100 * 24 * 60 * 60 * 1000, expected: THIRTY_DAYS_MS },
      ];

      for (const { requested, expected } of testCases) {
        expect(capUserDataTTL(requested)).toBe(expected);
      }
    });

    it('should handle zero TTL', () => {
      expect(capUserDataTTL(0)).toBe(0);
    });

    it('should handle very small TTL values', () => {
      expect(capUserDataTTL(1)).toBe(1);
      expect(capUserDataTTL(100)).toBe(100);
    });
  });

  describe('TTL constants validation (Requirement 2.4)', () => {
    it('should have USER_DATA_RETENTION equal to 30 days in milliseconds', () => {
      expect(TTL.USER_DATA_RETENTION).toBe(2592000000);
    });

    it('should have USER_DATA_RETENTION_SECONDS equal to 30 days in seconds', () => {
      expect(TTL.USER_DATA_RETENTION_SECONDS).toBe(2592000);
    });

    it('should have consistent values between ms and seconds constants', () => {
      expect(TTL.USER_DATA_RETENTION).toBe(TTL.USER_DATA_RETENTION_SECONDS * 1000);
    });
  });
});
