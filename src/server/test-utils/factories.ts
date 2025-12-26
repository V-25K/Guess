/**
 * Test Data Factories
 * Provides factory functions for creating mock test data
 */

import { faker } from '@faker-js/faker';
import type { Context } from '@devvit/server/server-context';
import type { UserProfile } from '../../shared/models/user.types.js';
import type { Challenge } from '../../shared/models/challenge.types.js';
import type { ChallengeAttempt } from '../../shared/models/attempt.types.js';

/**
 * Creates a mock User object for testing
 * @param overrides - Optional partial user object to override default values
 * @returns A complete UserProfile object with realistic test data
 */
export function createMockUser(overrides?: Partial<UserProfile>): UserProfile {
  return {
    id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    username: faker.internet.username(),
    total_points: faker.number.int({ min: 0, max: 10000 }),
    total_experience: faker.number.int({ min: 0, max: 50000 }),
    level: faker.number.int({ min: 1, max: 10 }),
    challenges_created: faker.number.int({ min: 0, max: 50 }),
    challenges_attempted: faker.number.int({ min: 0, max: 200 }),
    challenges_solved: faker.number.int({ min: 0, max: 100 }),
    current_streak: faker.number.int({ min: 0, max: 30 }),
    best_streak: faker.number.int({ min: 0, max: 50 }),
    last_challenge_created_at: faker.date.recent().toISOString(),
    role: faker.helpers.arrayElement(['player', 'mod'] as const),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides
  };
}

/**
 * Creates a mock Challenge object for testing
 * @param overrides - Optional partial challenge object to override default values
 * @returns A complete Challenge object with realistic test data
 */
export function createMockChallenge(overrides?: Partial<Challenge>): Challenge {
  return {
    id: faker.string.uuid(),
    creator_id: faker.string.uuid(),
    creator_username: faker.internet.username(),
    title: faker.lorem.sentence(),
    image_url: faker.image.url(),
    image_descriptions: Array.from({ length: 4 }, () => faker.lorem.sentence()),
    tags: faker.helpers.arrayElements(['nature', 'technology', 'sports', 'music', 'art'], { min: 1, max: 3 }),
    correct_answer: faker.lorem.word(),
    answer_explanation: faker.lorem.paragraph(),
    answer_set: {
      correct: [faker.lorem.word(), faker.lorem.word()],
      close: [faker.lorem.word(), faker.lorem.word()]
    },
    max_score: faker.number.int({ min: 50, max: 200 }),
    score_deduction_per_hint: faker.number.int({ min: 5, max: 20 }),
    reddit_post_id: faker.string.alphanumeric(10),
    players_played: faker.number.int({ min: 0, max: 1000 }),
    players_completed: faker.number.int({ min: 0, max: 500 }),
    created_at: faker.date.past().toISOString(),
    ...overrides
  };
}

/**
 * Creates a mock Attempt object for testing
 * @param overrides - Optional partial attempt object to override default values
 * @returns A complete ChallengeAttempt object with realistic test data
 */
export function createMockAttempt(overrides?: Partial<ChallengeAttempt>): ChallengeAttempt {
  return {
    id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    challenge_id: faker.string.uuid(),
    attempts_made: faker.number.int({ min: 1, max: 10 }),
    images_revealed: faker.number.int({ min: 1, max: 4 }),
    is_solved: faker.datatype.boolean(),
    game_over: faker.datatype.boolean(),
    points_earned: faker.number.int({ min: 0, max: 100 }),
    experience_earned: faker.number.int({ min: 0, max: 200 }),
    attempted_at: faker.date.past().toISOString(),
    completed_at: faker.datatype.boolean() ? faker.date.recent().toISOString() : null,
    hints_used: Array.from({ length: faker.number.int({ min: 0, max: 3 }) }, (_, i) => i),
    ...overrides
  };
}

/**
 * Creates a mock Devvit Context for testing
 * @param overrides - Optional partial context object to override default values
 * @returns A mock Context object with all required properties
 */
export function createMockContext(overrides?: Partial<Context>): Context {
  return {
    redis: {} as any,
    subredditId: faker.string.uuid(),
    subredditName: faker.internet.domainWord(),
    userId: `t2_${faker.string.alphanumeric(10)}` as `t2_${string}`,
    appName: 'guess-the-link-test',
    appAccountId: faker.string.uuid(),
    ...overrides
  } as unknown as Context;
}
