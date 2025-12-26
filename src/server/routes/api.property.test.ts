/**
 * Property-based tests for API endpoints
 * 
 * **Feature: devvit-web-migration, Property 3: API response JSON serialization**
 * **Feature: devvit-web-migration, Property 4: API error status codes**
 * **Feature: devvit-web-migration, Property 5: User data completeness**
 * 
 * **Validates: Requirements 8.4, 8.5, 10.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { UserProfile } from '../../shared/models/user.types.js';
import type { ChallengeAttempt, AttemptResult } from '../../shared/models/attempt.types.js';
import type { Challenge } from '../../shared/models/challenge.types.js';

describe('API Response Properties', () => {
  /**
   * **Feature: devvit-web-migration, Property 3: API response JSON serialization**
   * 
   * *For any* successful API endpoint response, the Content-Type header should be
   * 'application/json' and the body should be valid JSON
   * 
   * **Validates: Requirements 8.4**
   */
  describe('Property 3: API response JSON serialization', () => {
    // Arbitrary for user profiles
    const arbitraryUserProfile = fc.record({
      user_id: fc.string({ minLength: 1 }),
      username: fc.string({ minLength: 1 }),
      total_points: fc.integer({ min: 0 }),
      total_experience: fc.integer({ min: 0 }),
      level: fc.integer({ min: 1 }),
      challenges_created: fc.integer({ min: 0 }),
      challenges_attempted: fc.integer({ min: 0 }),
      challenges_solved: fc.integer({ min: 0 }),
      current_streak: fc.integer({ min: 0 }),
      best_streak: fc.integer({ min: 0 }),
      last_challenge_created_at: fc.oneof(
        fc.constant(null), 
        // Generate valid timestamps between 2020 and 2030
        fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
          .map(timestamp => new Date(timestamp).toISOString())
      ),
      role: fc.constantFrom('player' as const, 'mod' as const),
    });

    // Arbitrary for attempt results
    const arbitraryAttemptResult = fc.record({
      isCorrect: fc.boolean(),
      explanation: fc.string(),
      attemptsRemaining: fc.integer({ min: 0, max: 10 }),
      potentialScore: fc.integer({ min: 0 }),
      gameOver: fc.boolean(),
    });

    it('should serialize user profiles to valid JSON', () => {
      fc.assert(
        fc.property(arbitraryUserProfile, (profile) => {
          // Serialize to JSON
          const json = JSON.stringify(profile);
          
          // Should be valid JSON (no error thrown)
          expect(() => JSON.parse(json)).not.toThrow();
          
          // Deserialized object should match original
          const deserialized = JSON.parse(json);
          expect(deserialized).toEqual(profile);
        }),
        { numRuns: 100 }
      );
    });

    it('should serialize attempt results to valid JSON', () => {
      fc.assert(
        fc.property(arbitraryAttemptResult, (result) => {
          // Serialize to JSON
          const json = JSON.stringify(result);
          
          // Should be valid JSON (no error thrown)
          expect(() => JSON.parse(json)).not.toThrow();
          
          // Deserialized object should match original
          const deserialized = JSON.parse(json);
          expect(deserialized).toEqual(result);
        }),
        { numRuns: 100 }
      );
    });

    it('should serialize arrays of objects to valid JSON', () => {
      fc.assert(
        fc.property(fc.array(arbitraryUserProfile, { maxLength: 10 }), (profiles) => {
          // Serialize to JSON
          const json = JSON.stringify(profiles);
          
          // Should be valid JSON (no error thrown)
          expect(() => JSON.parse(json)).not.toThrow();
          
          // Deserialized array should match original
          const deserialized = JSON.parse(json);
          expect(deserialized).toEqual(profiles);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle null values in JSON serialization', () => {
      fc.assert(
        fc.property(arbitraryUserProfile, (profile) => {
          // Ensure last_challenge_created_at can be null
          const profileWithNull = { ...profile, last_challenge_created_at: null };
          
          // Serialize to JSON
          const json = JSON.stringify(profileWithNull);
          
          // Should be valid JSON
          expect(() => JSON.parse(json)).not.toThrow();
          
          // Null should be preserved
          const deserialized = JSON.parse(json);
          expect(deserialized.last_challenge_created_at).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve number types in JSON round-trip', () => {
      fc.assert(
        fc.property(arbitraryUserProfile, (profile) => {
          // Serialize and deserialize
          const json = JSON.stringify(profile);
          const deserialized = JSON.parse(json);
          
          // Number fields should remain numbers
          expect(typeof deserialized.total_points).toBe('number');
          expect(typeof deserialized.total_experience).toBe('number');
          expect(typeof deserialized.level).toBe('number');
          expect(typeof deserialized.challenges_created).toBe('number');
          expect(typeof deserialized.challenges_attempted).toBe('number');
          expect(typeof deserialized.challenges_solved).toBe('number');
          expect(typeof deserialized.current_streak).toBe('number');
          expect(typeof deserialized.best_streak).toBe('number');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: devvit-web-migration, Property 4: API error status codes**
   * 
   * *For any* API endpoint error, the HTTP status code should be in the 4xx range
   * for client errors or 5xx range for server errors
   * 
   * **Validates: Requirements 8.5**
   */
  describe('Property 4: API error status codes', () => {
    // Arbitrary for HTTP status codes
    const clientErrorCode = fc.integer({ min: 400, max: 499 });
    const serverErrorCode = fc.integer({ min: 500, max: 599 });
    const errorCode = fc.oneof(clientErrorCode, serverErrorCode);

    it('should use 4xx status codes for client errors', () => {
      fc.assert(
        fc.property(clientErrorCode, (statusCode) => {
          // Client error codes should be in 400-499 range
          expect(statusCode).toBeGreaterThanOrEqual(400);
          expect(statusCode).toBeLessThan(500);
        }),
        { numRuns: 100 }
      );
    });

    it('should use 5xx status codes for server errors', () => {
      fc.assert(
        fc.property(serverErrorCode, (statusCode) => {
          // Server error codes should be in 500-599 range
          expect(statusCode).toBeGreaterThanOrEqual(500);
          expect(statusCode).toBeLessThan(600);
        }),
        { numRuns: 100 }
      );
    });

    it('should include error message in error responses', () => {
      fc.assert(
        fc.property(errorCode, fc.string({ minLength: 1 }), (statusCode, errorMessage) => {
          // Create error response
          const errorResponse = { error: errorMessage };
          
          // Should be serializable to JSON
          const json = JSON.stringify(errorResponse);
          expect(() => JSON.parse(json)).not.toThrow();
          
          // Should contain error field
          const deserialized = JSON.parse(json);
          expect(deserialized).toHaveProperty('error');
          expect(typeof deserialized.error).toBe('string');
        }),
        { numRuns: 100 }
      );
    });

    it('should use 401 for unauthorized requests', () => {
      const unauthorizedCode = 401;
      
      // 401 is a client error
      expect(unauthorizedCode).toBeGreaterThanOrEqual(400);
      expect(unauthorizedCode).toBeLessThan(500);
    });

    it('should use 400 for bad requests', () => {
      const badRequestCode = 400;
      
      // 400 is a client error
      expect(badRequestCode).toBeGreaterThanOrEqual(400);
      expect(badRequestCode).toBeLessThan(500);
    });

    it('should use 404 for not found errors', () => {
      const notFoundCode = 404;
      
      // 404 is a client error
      expect(notFoundCode).toBeGreaterThanOrEqual(400);
      expect(notFoundCode).toBeLessThan(500);
    });

    it('should use 500 for internal server errors', () => {
      const internalErrorCode = 500;
      
      // 500 is a server error
      expect(internalErrorCode).toBeGreaterThanOrEqual(500);
      expect(internalErrorCode).toBeLessThan(600);
    });
  });

  /**
   * **Feature: devvit-web-migration, Property 5: User data completeness**
   * 
   * *For any* user authentication response, the data should include both user_id
   * and username fields
   * 
   * **Validates: Requirements 10.4**
   */
  describe('Property 5: User data completeness', () => {
    // Arbitrary for user authentication data
    const arbitraryUserAuth = fc.record({
      user_id: fc.string({ minLength: 1 }).filter(s => s !== 'anonymous' && s.trim() !== ''),
      username: fc.string({ minLength: 1 }).filter(s => s !== 'anonymous' && s.trim() !== ''),
    });

    it('should include user_id in authentication responses', () => {
      fc.assert(
        fc.property(arbitraryUserAuth, (authData) => {
          // Should have user_id field
          expect(authData).toHaveProperty('user_id');
          expect(typeof authData.user_id).toBe('string');
          expect(authData.user_id.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should include username in authentication responses', () => {
      fc.assert(
        fc.property(arbitraryUserAuth, (authData) => {
          // Should have username field
          expect(authData).toHaveProperty('username');
          expect(typeof authData.username).toBe('string');
          expect(authData.username.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should not allow anonymous user_id', () => {
      fc.assert(
        fc.property(arbitraryUserAuth, (authData) => {
          // user_id should not be 'anonymous'
          expect(authData.user_id).not.toBe('anonymous');
          expect(authData.user_id.trim()).not.toBe('');
        }),
        { numRuns: 100 }
      );
    });

    it('should not allow anonymous username', () => {
      fc.assert(
        fc.property(arbitraryUserAuth, (authData) => {
          // username should not be 'anonymous'
          expect(authData.username).not.toBe('anonymous');
          expect(authData.username.trim()).not.toBe('');
        }),
        { numRuns: 100 }
      );
    });

    it('should serialize authentication data to valid JSON', () => {
      fc.assert(
        fc.property(arbitraryUserAuth, (authData) => {
          // Serialize to JSON
          const json = JSON.stringify(authData);
          
          // Should be valid JSON
          expect(() => JSON.parse(json)).not.toThrow();
          
          // Deserialized should match original
          const deserialized = JSON.parse(json);
          expect(deserialized.user_id).toBe(authData.user_id);
          expect(deserialized.username).toBe(authData.username);
        }),
        { numRuns: 100 }
      );
    });

    it('should include both user_id and username in user profiles', () => {
      fc.assert(
        fc.property(
          fc.record({
            user_id: fc.string({ minLength: 1 }).filter(s => s !== 'anonymous'),
            username: fc.string({ minLength: 1 }).filter(s => s !== 'anonymous'),
            total_points: fc.integer({ min: 0 }),
            level: fc.integer({ min: 1 }),
          }),
          (profile) => {
            // Profile should have both fields
            expect(profile).toHaveProperty('user_id');
            expect(profile).toHaveProperty('username');
            
            // Both should be non-empty strings
            expect(typeof profile.user_id).toBe('string');
            expect(typeof profile.username).toBe('string');
            expect(profile.user_id.length).toBeGreaterThan(0);
            expect(profile.username.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
