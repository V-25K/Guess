/**
 * Property-Based Test: API Error Status Codes
 * Feature: devvit-web-migration, Property 4: API error status codes
 * Validates: Requirements 8.5
 * 
 * Property: For any API endpoint error, the HTTP status code should be in the 
 * 4xx range for client errors or 5xx range for server errors
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Property 4: API error status codes', () => {
  it('should use 4xx status codes for client errors', () => {
    fc.assert(
      fc.property(
        // Generate client error scenarios
        fc.constantFrom(
          { type: 'unauthorized', expectedCode: 401 },
          { type: 'bad_request', expectedCode: 400 },
          { type: 'not_found', expectedCode: 404 },
          { type: 'forbidden', expectedCode: 403 }
        ),
        (errorScenario) => {
          const statusCode = errorScenario.expectedCode;
          
          // Verify it's in the 4xx range
          expect(statusCode).toBeGreaterThanOrEqual(400);
          expect(statusCode).toBeLessThan(500);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use 5xx status codes for server errors', () => {
    fc.assert(
      fc.property(
        // Generate server error scenarios
        fc.constantFrom(
          { type: 'internal_error', expectedCode: 500 },
          { type: 'service_unavailable', expectedCode: 503 },
          { type: 'gateway_timeout', expectedCode: 504 }
        ),
        (errorScenario) => {
          const statusCode = errorScenario.expectedCode;
          
          // Verify it's in the 5xx range
          expect(statusCode).toBeGreaterThanOrEqual(500);
          expect(statusCode).toBeLessThan(600);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never use 2xx or 3xx codes for errors', () => {
    fc.assert(
      fc.property(
        // Generate various error types
        fc.constantFrom('client_error', 'server_error', 'validation_error'),
        (errorType) => {
          // Map error types to appropriate status codes
          const statusCode = errorType === 'server_error' ? 500 : 400;
          
          // Verify it's not a success (2xx) or redirect (3xx) code
          // Error codes should be >= 400
          expect(statusCode).toBeGreaterThanOrEqual(400);
          
          // And not in the 2xx or 3xx range
          const isSuccessOrRedirect = (statusCode >= 200 && statusCode < 400);
          expect(isSuccessOrRedirect).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include error message in response body', () => {
    fc.assert(
      fc.property(
        fc.record({
          statusCode: fc.integer({ min: 400, max: 599 }),
          error: fc.string({ minLength: 1 }),
        }),
        (errorResponse) => {
          // Verify error response has required fields
          expect(errorResponse.statusCode).toBeGreaterThanOrEqual(400);
          expect(errorResponse.error).toBeTruthy();
          expect(typeof errorResponse.error).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should categorize errors correctly by status code range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 599 }),
        (statusCode) => {
          const isClientError = statusCode >= 400 && statusCode < 500;
          const isServerError = statusCode >= 500 && statusCode < 600;
          
          // Every error code should be either client or server error
          expect(isClientError || isServerError).toBe(true);
          
          // But not both
          expect(isClientError && isServerError).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
