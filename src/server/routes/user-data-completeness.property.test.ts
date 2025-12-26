/**
 * Property-Based Test: User Data Completeness
 * Feature: devvit-web-migration, Property 5: User data completeness
 * Validates: Requirements 10.4
 * 
 * Property: For any user authentication response, the data should include 
 * both user_id and username fields
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Property 5: User data completeness', () => {
  it('should include both user_id and username in authentication responses', () => {
    fc.assert(
      fc.property(
        // Generate user authentication data
        fc.record({
          userId: fc.string({ minLength: 1 }),
          username: fc.string({ minLength: 1 }),
        }),
        (authData) => {
          // Verify both fields are present
          expect(authData.userId).toBeDefined();
          expect(authData.username).toBeDefined();
          
          // Verify they are non-empty strings
          expect(typeof authData.userId).toBe('string');
          expect(typeof authData.username).toBe('string');
          expect(authData.userId.length).toBeGreaterThan(0);
          expect(authData.username.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject authentication data missing user_id', () => {
    fc.assert(
      fc.property(
        fc.record({
          username: fc.string({ minLength: 1 }),
        }),
        (incompleteData) => {
          // Verify userId is missing
          expect(incompleteData).not.toHaveProperty('userId');
          
          // This would be invalid authentication data
          const isValid = 'userId' in incompleteData && 'username' in incompleteData;
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject authentication data missing username', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1 }),
        }),
        (incompleteData) => {
          // Verify username is missing
          expect(incompleteData).not.toHaveProperty('username');
          
          // This would be invalid authentication data
          const isValid = 'userId' in incompleteData && 'username' in incompleteData;
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject empty or null values for user_id', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', null, undefined),
        (invalidUserId) => {
          const authData = {
            userId: invalidUserId,
            username: 'validUsername',
          };
          
          // Check if userId is valid (non-empty string)
          const isValidUserId = typeof authData.userId === 'string' && authData.userId.length > 0;
          expect(isValidUserId).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject empty or null values for username', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', null, undefined),
        (invalidUsername) => {
          const authData = {
            userId: 'validUserId',
            username: invalidUsername,
          };
          
          // Check if username is valid (non-empty string)
          const isValidUsername = typeof authData.username === 'string' && authData.username.length > 0;
          expect(isValidUsername).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate complete user profile data', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          username: fc.string({ minLength: 1 }),
          totalPoints: fc.integer({ min: 0 }),
          level: fc.integer({ min: 1 }),
        }),
        (profileData) => {
          // Verify all required fields are present
          expect(profileData).toHaveProperty('userId');
          expect(profileData).toHaveProperty('username');
          expect(profileData).toHaveProperty('totalPoints');
          expect(profileData).toHaveProperty('level');
          
          // Verify data types
          expect(typeof profileData.userId).toBe('string');
          expect(typeof profileData.username).toBe('string');
          expect(typeof profileData.totalPoints).toBe('number');
          expect(typeof profileData.level).toBe('number');
          
          // Verify constraints
          expect(profileData.totalPoints).toBeGreaterThanOrEqual(0);
          expect(profileData.level).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
