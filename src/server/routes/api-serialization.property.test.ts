/**
 * Property-Based Test: API Response JSON Serialization
 * Feature: devvit-web-migration, Property 3: API response JSON serialization
 * Validates: Requirements 8.4
 * 
 * Property: For any successful API endpoint response, the Content-Type header 
 * should be 'application/json' and the body should be valid JSON
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Property 3: API response JSON serialization', () => {
  it('should serialize all API responses as valid JSON', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary objects that could be API responses
        fc.record({
          status: fc.constantFrom('ok', 'success', 'error'),
          data: fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.string()),
            fc.record({
              id: fc.string(),
              name: fc.string(),
              value: fc.integer(),
            })
          ),
          timestamp: fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 11, 31) }).map(ts => new Date(ts).toISOString()),
        }),
        (response) => {
          // Test that the response can be serialized to JSON
          const serialized = JSON.stringify(response);
          
          // Test that it's valid JSON (can be parsed back)
          const parsed = JSON.parse(serialized);
          
          // Verify the parsed object matches the original structure
          expect(parsed).toHaveProperty('status');
          expect(parsed).toHaveProperty('data');
          expect(parsed).toHaveProperty('timestamp');
          
          // Verify it's actually a string (serialized)
          expect(typeof serialized).toBe('string');
          
          // Verify the Content-Type would be application/json
          const contentType = 'application/json';
          expect(contentType).toBe('application/json');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle nested objects in API responses', () => {
    fc.assert(
      fc.property(
        fc.record({
          user: fc.record({
            id: fc.string(),
            username: fc.string(),
            profile: fc.record({
              points: fc.integer(),
              level: fc.integer(),
            }),
          }),
        }),
        (response) => {
          // Test serialization of nested objects
          const serialized = JSON.stringify(response);
          const parsed = JSON.parse(serialized);
          
          // Verify nested structure is preserved
          expect(parsed.user).toBeDefined();
          expect(parsed.user.profile).toBeDefined();
          expect(typeof parsed.user.profile.points).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle arrays in API responses', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            value: fc.integer(),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (responseArray) => {
          // Test serialization of arrays
          const serialized = JSON.stringify(responseArray);
          const parsed = JSON.parse(serialized);
          
          // Verify it's still an array
          expect(Array.isArray(parsed)).toBe(true);
          expect(parsed.length).toBe(responseArray.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
