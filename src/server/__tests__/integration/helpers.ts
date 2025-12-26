/**
 * Integration Test Helpers
 * Provides helper functions for service instantiation and common test operations
 * 
 * Requirements: 1.1, 2.1, 3.1
 */

import { vi } from 'vitest';
import { expect } from 'vitest';
import type { Context } from '@devvit/server/server-context';
import type { Result } from '../../../shared/utils/result.js';
import { isOk, isErr } from '../../../shared/utils/result.js';
import type { AppError } from '../../../shared/models/errors.js';
import type { UserProfile } from '../../../shared/models/user.types.js';
import type { Challenge } from '../../../shared/models/challenge.types.js';
import type { ChallengeAttempt } from '../../../shared/models/attempt.types.js';
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestAttempt,
  type TestContext,
  type MockSupabase,
  type MockRedis,
} from './setup.js';

// ============================================
// Result Assertion Helpers
// ============================================

/**
 * Asserts that a Result is Ok and returns the value
 * @throws {Error} If the Result is Err
 */
export function assertResultOk<T>(result: Result<T, AppError>): T {
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Expected Ok but got Err: ${JSON.stringify((result as { error: AppError }).error)}`);
}

/**
 * Asserts that a Result is Err and returns the error
 * @throws {Error} If the Result is Ok
 */
export function assertResultErr(result: Result<unknown, AppError>): AppError {
  expect(isErr(result)).toBe(true);
  if (isErr(result)) {
    return result.error;
  }
  throw new Error('Expected Err but got Ok');
}

/**
 * Asserts that a Result is Ok with a specific value
 */
export function assertResultOkValue<T>(result: Result<T, AppError>, expected: T): void {
  const value = assertResultOk(result);
  expect(value).toEqual(expected);
}

/**
 * Asserts that a Result is Err with a specific error type
 */
export function assertResultErrType(result: Result<unknown, AppError>, expectedType: AppError['type']): AppError {
  const error = assertResultErr(result);
  expect(error.type).toBe(expectedType);
  return error;
}

// ============================================
// Mock Fetch Helpers
// ============================================

/**
 * Creates a mock fetch response for successful database queries
 */
export function createMockFetchSuccess<T>(data: T, headers?: Record<string, string>): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    headers: new Headers(headers || {}),
  } as Response);
}

/**
 * Creates a mock fetch response for database errors
 */
export function createMockFetchError(status: number, statusText: string): Promise<Response> {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: async () => ({ error: statusText }),
    headers: new Headers(),
  } as Response);
}

/**
 * Sets up mock fetch to return specific data for Supabase queries
 */
export function setupMockFetch(
  mockFetch: ReturnType<typeof vi.fn>,
  responses: Array<{ match?: RegExp | string; data?: unknown; error?: { status: number; message: string } }>
): void {
  mockFetch.mockImplementation((url: string) => {
    for (const response of responses) {
      if (response.match) {
        const matches = typeof response.match === 'string'
          ? url.includes(response.match)
          : response.match.test(url);
        
        if (matches) {
          if (response.error) {
            return createMockFetchError(response.error.status, response.error.message);
          }
          return createMockFetchSuccess(response.data);
        }
      }
    }
    // Default: return empty array
    return createMockFetchSuccess([]);
  });
}

// ============================================
// Test Data Seeding Helpers
// ============================================

/**
 * Seeds a user into the mock Supabase and optionally Redis leaderboard
 */
export function seedUser(
  mockSupabase: MockSupabase,
  mockRedis: MockRedis,
  user: UserProfile,
  addToLeaderboard: boolean = true
): UserProfile {
  mockSupabase.data.users.push(user);
  
  if (addToLeaderboard && user.total_points > 0) {
    mockRedis.zAdd('leaderboard:points', { member: user.user_id, score: user.total_points });
  }
  
  return user;
}

/**
 * Seeds a challenge into the mock Supabase
 */
export function seedChallenge(mockSupabase: MockSupabase, challenge: Challenge): Challenge {
  mockSupabase.data.challenges.push(challenge);
  return challenge;
}

/**
 * Seeds an attempt into the mock Supabase
 */
export function seedAttempt(mockSupabase: MockSupabase, attempt: ChallengeAttempt): ChallengeAttempt {
  mockSupabase.data.attempts.push(attempt);
  return attempt;
}

/**
 * Creates and seeds a user with profile
 */
export function createUserWithProfile(
  testContext: TestContext,
  userId: string,
  username: string,
  overrides?: Partial<UserProfile>
): UserProfile {
  const user = createTestUser({
    user_id: userId,
    username,
    ...overrides,
  });
  
  return seedUser(testContext.mockSupabase, testContext.mockRedis, user);
}

/**
 * Creates and seeds a challenge with creator
 */
export function createChallengeWithCreator(
  testContext: TestContext,
  creatorId: string,
  overrides?: Partial<Challenge>
): Challenge {
  const challenge = createTestChallenge({
    creator_id: creatorId,
    ...overrides,
  });
  
  return seedChallenge(testContext.mockSupabase, challenge);
}

/**
 * Creates and seeds an attempt for a user and challenge
 */
export function createAttemptForUser(
  testContext: TestContext,
  userId: string,
  challengeId: string,
  overrides?: Partial<ChallengeAttempt>
): ChallengeAttempt {
  const attempt = createTestAttempt({
    user_id: userId,
    challenge_id: challengeId,
    ...overrides,
  });
  
  return seedAttempt(testContext.mockSupabase, attempt);
}

// ============================================
// Flow Simulation Helpers
// ============================================

/**
 * Simulates a complete successful attempt flow
 * Creates user, challenge, and completed attempt
 */
export function simulateSuccessfulAttempt(
  testContext: TestContext,
  options?: {
    userId?: string;
    username?: string;
    challengeId?: string;
    attemptsMade?: number;
    pointsEarned?: number;
    experienceEarned?: number;
  }
): {
  user: UserProfile;
  challenge: Challenge;
  attempt: ChallengeAttempt;
} {
  const userId = options?.userId ?? `t2_test_${Date.now()}`;
  const username = options?.username ?? 'testuser';
  const attemptsMade = options?.attemptsMade ?? 3;
  const pointsEarned = options?.pointsEarned ?? 50;
  const experienceEarned = options?.experienceEarned ?? 100;

  // Create user with earned points
  const user = createUserWithProfile(testContext, userId, username, {
    total_points: pointsEarned,
    total_experience: experienceEarned,
    challenges_solved: 1,
    challenges_attempted: 1,
  });

  // Create challenge
  const challenge = createChallengeWithCreator(testContext, 't2_creator', {
    id: options?.challengeId,
    players_played: 1,
    players_completed: 1,
  });

  // Create completed attempt
  const attempt = createAttemptForUser(testContext, userId, challenge.id, {
    attempts_made: attemptsMade,
    is_solved: true,
    game_over: true,
    points_earned: pointsEarned,
    experience_earned: experienceEarned,
    completed_at: new Date().toISOString(),
  });

  return { user, challenge, attempt };
}

/**
 * Simulates a failed attempt flow (game over without solving)
 */
export function simulateFailedAttempt(
  testContext: TestContext,
  options?: {
    userId?: string;
    username?: string;
    challengeId?: string;
  }
): {
  user: UserProfile;
  challenge: Challenge;
  attempt: ChallengeAttempt;
} {
  const userId = options?.userId ?? `t2_test_${Date.now()}`;
  const username = options?.username ?? 'testuser';

  // Create user with reset streak
  const user = createUserWithProfile(testContext, userId, username, {
    current_streak: 0,
    challenges_attempted: 1,
  });

  // Create challenge
  const challenge = createChallengeWithCreator(testContext, 't2_creator', {
    id: options?.challengeId,
    players_played: 1,
  });

  // Create failed attempt (10 attempts, game over)
  const attempt = createAttemptForUser(testContext, userId, challenge.id, {
    attempts_made: 10,
    is_solved: false,
    game_over: true,
    points_earned: 0,
    experience_earned: 0,
  });

  return { user, challenge, attempt };
}

// ============================================
// Leaderboard Helpers
// ============================================

/**
 * Seeds multiple users for leaderboard testing
 * Returns users sorted by points descending
 */
export function seedLeaderboardUsers(
  testContext: TestContext,
  count: number,
  basePoints: number = 100
): UserProfile[] {
  const users: UserProfile[] = [];
  
  for (let i = 0; i < count; i++) {
    const points = basePoints * (count - i); // Descending points
    const user = createUserWithProfile(
      testContext,
      `t2_leaderboard_${i}`,
      `player${i + 1}`,
      {
        total_points: points,
        level: Math.floor(points / 100) + 1,
        challenges_solved: Math.floor(points / 50),
      }
    );
    users.push(user);
  }
  
  return users;
}

/**
 * Verifies leaderboard is sorted correctly by points descending
 */
export function verifyLeaderboardOrder(entries: Array<{ totalPoints: number; rank: number }>): void {
  for (let i = 1; i < entries.length; i++) {
    expect(entries[i - 1].totalPoints).toBeGreaterThanOrEqual(entries[i].totalPoints);
    expect(entries[i - 1].rank).toBeLessThanOrEqual(entries[i].rank);
  }
}

// ============================================
// Cache Behavior Helpers
// ============================================

/**
 * Simulates cache TTL expiration by advancing time
 * Note: This requires using vi.useFakeTimers()
 */
export function advanceTime(ms: number): void {
  vi.advanceTimersByTime(ms);
}

/**
 * Sets up fake timers for cache TTL testing
 */
export function setupFakeTimers(): void {
  vi.useFakeTimers();
}

/**
 * Restores real timers after cache TTL testing
 */
export function restoreFakeTimers(): void {
  vi.useRealTimers();
}

// ============================================
// Error Scenario Helpers
// ============================================

/**
 * Creates a validation error response structure
 */
export function createValidationErrorResponse(fields: Array<{ field: string; message: string }>): {
  type: 'ValidationError';
  details: Array<{ field: string; message: string }>;
} {
  return {
    type: 'ValidationError',
    details: fields,
  };
}

/**
 * Verifies that an error response has the correct validation error format
 */
export function verifyValidationErrorFormat(error: AppError): void {
  expect(error.type).toBe('validation');
  expect((error as { fields: unknown[] }).fields).toBeDefined();
  expect(Array.isArray((error as { fields: unknown[] }).fields)).toBe(true);
}

/**
 * Verifies that an error response has the correct not found error format
 */
export function verifyNotFoundErrorFormat(error: AppError, resource?: string): void {
  expect(error.type).toBe('not_found');
  if (resource) {
    expect((error as { resource: string }).resource).toBe(resource);
  }
}

/**
 * Verifies that an error response has the correct rate limit error format
 */
export function verifyRateLimitErrorFormat(error: AppError): void {
  expect(error.type).toBe('rate_limit');
  expect((error as { timeRemainingMs: number }).timeRemainingMs).toBeDefined();
  expect(typeof (error as { timeRemainingMs: number }).timeRemainingMs).toBe('number');
}

// ============================================
// Utility Exports
// ============================================

export { createTestContext, createTestUser, createTestChallenge, createTestAttempt };
export type { TestContext };
