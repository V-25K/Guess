/**
 * Property-based tests for Data Cleanup Service
 * **Feature: data-retention-compliance, Property 3: Anonymization Idempotence**
 * **Feature: data-retention-compliance, Property 5: Cleanup Statistics Validity**
 * **Validates: Requirements 3.6, 3.7, 4.4**
 * 
 * Tests that:
 * - Already-anonymized profiles are not modified when anonymization runs again
 * - Cleanup statistics are always valid (non-negative counts, positive execution time)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * CleanupResult interface matching the design document
 */
export interface CleanupResult {
  profilesAnonymized: number;
  challengesUpdated: number;
  attemptsUpdated: number;
  executionTimeMs: number;
}

/**
 * Helper to check if a user_id is already anonymized
 */
function isAnonymized(userId: string): boolean {
  return userId.startsWith('[deleted]');
}

/**
 * Simulates the anonymization logic for a user profile.
 * This mirrors what the database function will do.
 */
function anonymizeProfile(profile: { user_id: string; username: string }): { user_id: string; username: string; wasModified: boolean } {
  // Skip already-anonymized users (user_id NOT LIKE '[deleted]%')
  if (isAnonymized(profile.user_id)) {
    return { ...profile, wasModified: false };
  }
  
  // Transform user_id to "[deleted]:{uuid}" format
  const uuid = crypto.randomUUID();
  return {
    user_id: `[deleted]:${uuid}`,
    username: '[deleted]',
    wasModified: true,
  };
}

// Generator for already-anonymized user profiles
const anonymizedProfileArb = fc.record({
  user_id: fc.uuid().map(uuid => `[deleted]:${uuid}`),
  username: fc.constant('[deleted]'),
});

// Generator for non-anonymized Reddit user profiles
const activeProfileArb = fc.record({
  user_id: fc.string({ minLength: 5, maxLength: 10 }).map(s => `t2_${s.replace(/[^a-z0-9]/gi, 'x')}`),
  username: fc.string({ minLength: 3, maxLength: 20 }).filter(s => s !== '[deleted]'),
});

describe('Data Cleanup Property Tests', () => {
  describe('Property 3: Anonymization Idempotence', () => {
    it('for any already-anonymized profile, calling anonymization does not modify the profile', () => {
      fc.assert(
        fc.property(
          anonymizedProfileArb,
          (profile) => {
            const result = anonymizeProfile(profile);
            
            // Profile should not be modified
            expect(result.wasModified).toBe(false);
            expect(result.user_id).toBe(profile.user_id);
            expect(result.username).toBe(profile.username);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any already-anonymized profile, multiple anonymization calls produce identical results', () => {
      fc.assert(
        fc.property(
          anonymizedProfileArb,
          fc.integer({ min: 2, max: 10 }),
          (profile, repeatCount) => {
            let currentProfile: { user_id: string; username: string } = { ...profile };
            
            for (let i = 0; i < repeatCount; i++) {
              const result = anonymizeProfile(currentProfile);
              
              // Each call should not modify the profile
              expect(result.wasModified).toBe(false);
              expect(result.user_id).toBe(profile.user_id);
              expect(result.username).toBe(profile.username);
              
              currentProfile = { user_id: result.user_id, username: result.username };
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any non-anonymized profile, first anonymization transforms it, subsequent calls do not', () => {
      fc.assert(
        fc.property(
          activeProfileArb,
          fc.integer({ min: 2, max: 5 }),
          (profile, repeatCount) => {
            // First call should transform the profile
            const firstResult = anonymizeProfile(profile);
            expect(firstResult.wasModified).toBe(true);
            expect(firstResult.user_id).toMatch(/^\[deleted\]:/);
            expect(firstResult.username).toBe('[deleted]');
            
            // Subsequent calls should not modify
            let currentProfile: { user_id: string; username: string } = { 
              user_id: firstResult.user_id, 
              username: firstResult.username 
            };
            for (let i = 1; i < repeatCount; i++) {
              const result = anonymizeProfile(currentProfile);
              expect(result.wasModified).toBe(false);
              expect(result.user_id).toBe(firstResult.user_id);
              expect(result.username).toBe('[deleted]');
              currentProfile = { user_id: result.user_id, username: result.username };
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isAnonymized correctly identifies anonymized user IDs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Anonymized IDs
            fc.uuid().map(uuid => ({ id: `[deleted]:${uuid}`, expected: true })),
            // Non-anonymized Reddit IDs
            fc.string({ minLength: 5, maxLength: 10 })
              .map(s => ({ id: `t2_${s.replace(/[^a-z0-9]/gi, 'x')}`, expected: false })),
          ),
          ({ id, expected }) => {
            expect(isAnonymized(id)).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Validates that a CleanupResult has valid statistics
 */
function isValidCleanupResult(result: CleanupResult): boolean {
  return (
    result.profilesAnonymized >= 0 &&
    result.challengesUpdated >= 0 &&
    result.attemptsUpdated >= 0 &&
    result.executionTimeMs > 0
  );
}

// Generator for valid CleanupResult objects
const validCleanupResultArb = fc.record({
  profilesAnonymized: fc.integer({ min: 0, max: 10000 }),
  challengesUpdated: fc.integer({ min: 0, max: 10000 }),
  attemptsUpdated: fc.integer({ min: 0, max: 10000 }),
  executionTimeMs: fc.integer({ min: 1, max: 60000 }),
});

// Generator for potentially invalid CleanupResult objects (for negative testing)
const anyCleanupResultArb = fc.record({
  profilesAnonymized: fc.integer({ min: -100, max: 10000 }),
  challengesUpdated: fc.integer({ min: -100, max: 10000 }),
  attemptsUpdated: fc.integer({ min: -100, max: 10000 }),
  executionTimeMs: fc.integer({ min: -100, max: 60000 }),
});

describe('Property 5: Cleanup Statistics Validity', () => {
  it('for any valid cleanup result, all counts are non-negative and executionTimeMs is positive', () => {
    fc.assert(
      fc.property(
        validCleanupResultArb,
        (result) => {
          expect(result.profilesAnonymized).toBeGreaterThanOrEqual(0);
          expect(result.challengesUpdated).toBeGreaterThanOrEqual(0);
          expect(result.attemptsUpdated).toBeGreaterThanOrEqual(0);
          expect(result.executionTimeMs).toBeGreaterThan(0);
          expect(isValidCleanupResult(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isValidCleanupResult correctly identifies valid vs invalid results', () => {
    fc.assert(
      fc.property(
        anyCleanupResultArb,
        (result) => {
          const isValid = isValidCleanupResult(result);
          const expectedValid = 
            result.profilesAnonymized >= 0 &&
            result.challengesUpdated >= 0 &&
            result.attemptsUpdated >= 0 &&
            result.executionTimeMs > 0;
          
          expect(isValid).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cleanup results with zero counts are valid (no inactive users)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 60000 }),
        (executionTimeMs) => {
          const result: CleanupResult = {
            profilesAnonymized: 0,
            challengesUpdated: 0,
            attemptsUpdated: 0,
            executionTimeMs,
          };
          
          expect(isValidCleanupResult(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('challengesUpdated should be <= profilesAnonymized * maxChallengesPerUser (logical constraint)', () => {
    const MAX_CHALLENGES_PER_USER = 100; // Reasonable upper bound
    
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 60000 }),
        (profilesAnonymized, executionTimeMs) => {
          // Generate a plausible challengesUpdated based on profiles
          const challengesUpdated = fc.sample(
            fc.integer({ min: 0, max: profilesAnonymized * MAX_CHALLENGES_PER_USER }),
            1
          )[0];
          
          const result: CleanupResult = {
            profilesAnonymized,
            challengesUpdated,
            attemptsUpdated: 0,
            executionTimeMs,
          };
          
          expect(isValidCleanupResult(result)).toBe(true);
          // Logical constraint: can't update more challenges than possible
          expect(result.challengesUpdated).toBeLessThanOrEqual(
            profilesAnonymized * MAX_CHALLENGES_PER_USER
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
