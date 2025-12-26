/**
 * Integration Test Setup
 * Provides mock factories, fixtures, and test context for integration tests
 * 
 * Requirements: 1.1, 2.1, 3.1
 */

import { vi } from 'vitest';
import { faker } from '@faker-js/faker';
import type { Context } from '@devvit/server/server-context';
import type { UserProfile } from '../../../shared/models/user.types.js';
import type { Challenge } from '../../../shared/models/challenge.types.js';
import type { ChallengeAttempt } from '../../../shared/models/attempt.types.js';

// ============================================
// Mock Redis Implementation
// ============================================

export interface MockRedisData {
  strings: Map<string, { value: string; expireAt?: number }>;
  sortedSets: Map<string, Map<string, number>>;
  hashes: Map<string, Map<string, string>>;
}

export interface MockRedis {
  data: MockRedisData;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { ex?: number }) => Promise<void>;
  del: (key: string) => Promise<void>;
  zAdd: (key: string, entry: { member: string; score: number }) => Promise<void>;
  zScore: (key: string, member: string) => Promise<number | null>;
  zRank: (key: string, member: string) => Promise<number | null>;
  zCard: (key: string) => Promise<number>;
  zRange: (key: string, start: number | string, end: number | string, options?: { by?: string; reverse?: boolean }) => Promise<Array<{ member: string; score: number }>>;
  zRem: (key: string, members: string[]) => Promise<void>;
  zIncrBy: (key: string, member: string, delta: number) => Promise<number>;
  zRemRangeByRank: (key: string, start: number, end: number) => Promise<void>;
  hGet: (key: string, field: string) => Promise<string | null>;
  hSet: (key: string, field: string, value: string) => Promise<void>;
  hGetAll: (key: string) => Promise<Record<string, string>>;
  expire: (key: string, seconds: number) => Promise<void>;
  reset: () => void;
}

/**
 * Creates a mock Redis instance with in-memory storage
 * Simulates TTL expiration for cache behavior tests
 */
export function createMockRedis(): MockRedis {
  const data: MockRedisData = {
    strings: new Map(),
    sortedSets: new Map(),
    hashes: new Map(),
  };

  const isExpired = (key: string): boolean => {
    const entry = data.strings.get(key);
    if (entry?.expireAt && Date.now() > entry.expireAt) {
      data.strings.delete(key);
      return true;
    }
    return false;
  };

  return {
    data,

    async get(key: string): Promise<string | null> {
      if (isExpired(key)) return null;
      return data.strings.get(key)?.value ?? null;
    },

    async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
      const expireAt = options?.ex ? Date.now() + options.ex * 1000 : undefined;
      data.strings.set(key, { value, expireAt });
    },

    async del(key: string): Promise<void> {
      data.strings.delete(key);
      data.sortedSets.delete(key);
      data.hashes.delete(key);
    },

    async zAdd(key: string, entry: { member: string; score: number }): Promise<void> {
      if (!data.sortedSets.has(key)) {
        data.sortedSets.set(key, new Map());
      }
      data.sortedSets.get(key)!.set(entry.member, entry.score);
    },

    async zScore(key: string, member: string): Promise<number | null> {
      return data.sortedSets.get(key)?.get(member) ?? null;
    },

    async zRank(key: string, member: string): Promise<number | null> {
      const set = data.sortedSets.get(key);
      if (!set) return null;
      
      const score = set.get(member);
      if (score === undefined) return null;
      
      // Sort by score ascending and find position
      const sorted = Array.from(set.entries()).sort((a, b) => a[1] - b[1]);
      return sorted.findIndex(([m]) => m === member);
    },

    async zCard(key: string): Promise<number> {
      return data.sortedSets.get(key)?.size ?? 0;
    },

    async zRange(
      key: string,
      start: number | string,
      end: number | string,
      options?: { by?: string; reverse?: boolean }
    ): Promise<Array<{ member: string; score: number }>> {
      const set = data.sortedSets.get(key);
      if (!set) return [];

      let entries = Array.from(set.entries()).map(([member, score]) => ({ member, score }));

      if (options?.by === 'score') {
        // Filter by score range
        const minScore = typeof start === 'string' ? (start === '-inf' ? -Infinity : parseFloat(start)) : start;
        const maxScore = typeof end === 'string' ? (end === '+inf' ? Infinity : parseFloat(end)) : end;
        entries = entries.filter(e => e.score >= minScore && e.score <= maxScore);
      }

      // Sort by score
      entries.sort((a, b) => options?.reverse ? b.score - a.score : a.score - b.score);

      if (options?.by === 'rank' && typeof start === 'number' && typeof end === 'number') {
        entries = entries.slice(start, end + 1);
      }

      return entries;
    },

    async zRem(key: string, members: string[]): Promise<void> {
      const set = data.sortedSets.get(key);
      if (set) {
        members.forEach(m => set.delete(m));
      }
    },

    async zIncrBy(key: string, member: string, delta: number): Promise<number> {
      if (!data.sortedSets.has(key)) {
        data.sortedSets.set(key, new Map());
      }
      const set = data.sortedSets.get(key)!;
      const currentScore = set.get(member) ?? 0;
      const newScore = currentScore + delta;
      set.set(member, newScore);
      return newScore;
    },

    async zRemRangeByRank(key: string, start: number, end: number): Promise<void> {
      const set = data.sortedSets.get(key);
      if (!set) return;
      
      const sorted = Array.from(set.entries()).sort((a, b) => a[1] - b[1]);
      const toRemove = sorted.slice(start, end + 1);
      toRemove.forEach(([member]) => set.delete(member));
    },

    async hGet(key: string, field: string): Promise<string | null> {
      return data.hashes.get(key)?.get(field) ?? null;
    },

    async hSet(key: string, field: string, value: string): Promise<void> {
      if (!data.hashes.has(key)) {
        data.hashes.set(key, new Map());
      }
      data.hashes.get(key)!.set(field, value);
    },

    async hGetAll(key: string): Promise<Record<string, string>> {
      const hash = data.hashes.get(key);
      if (!hash) return {};
      return Object.fromEntries(hash.entries());
    },

    async expire(key: string, seconds: number): Promise<void> {
      const entry = data.strings.get(key);
      if (entry) {
        entry.expireAt = Date.now() + seconds * 1000;
      }
    },

    reset(): void {
      data.strings.clear();
      data.sortedSets.clear();
      data.hashes.clear();
    },
  };
}

// ============================================
// Mock Supabase Implementation
// ============================================

export interface MockSupabaseData {
  users: UserProfile[];
  challenges: Challenge[];
  attempts: ChallengeAttempt[];
}

export interface MockSupabase {
  data: MockSupabaseData;
  from: (table: string) => MockSupabaseQueryBuilder;
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: null } | { data: null; error: { message: string } }>;
  reset: () => void;
}

interface MockSupabaseQueryBuilder {
  select: (columns?: string) => MockSupabaseQueryBuilder;
  insert: (data: unknown) => MockSupabaseQueryBuilder;
  update: (data: unknown) => MockSupabaseQueryBuilder;
  delete: () => MockSupabaseQueryBuilder;
  eq: (column: string, value: unknown) => MockSupabaseQueryBuilder;
  neq: (column: string, value: unknown) => MockSupabaseQueryBuilder;
  gt: (column: string, value: unknown) => MockSupabaseQueryBuilder;
  gte: (column: string, value: unknown) => MockSupabaseQueryBuilder;
  lt: (column: string, value: unknown) => MockSupabaseQueryBuilder;
  lte: (column: string, value: unknown) => MockSupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => MockSupabaseQueryBuilder;
  limit: (count: number) => MockSupabaseQueryBuilder;
  range: (from: number, to: number) => MockSupabaseQueryBuilder;
  single: () => Promise<{ data: unknown; error: null } | { data: null; error: { message: string } }>;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  then: <T>(resolve: (result: { data: unknown[]; error: null }) => T) => Promise<T>;
}

/**
 * Creates a mock Supabase client with in-memory storage
 * Simulates database queries for integration tests
 */
export function createMockSupabase(): MockSupabase {
  const data: MockSupabaseData = {
    users: [],
    challenges: [],
    attempts: [],
  };

  const getTable = (table: string): unknown[] => {
    switch (table) {
      case 'user_profiles': return data.users;
      case 'challenges': return data.challenges;
      case 'challenge_attempts': return data.attempts;
      default: return [];
    }
  };

  const createQueryBuilder = (table: string): MockSupabaseQueryBuilder => {
    let results: unknown[] = [...getTable(table)];
    let insertData: unknown = null;
    let updateData: unknown = null;
    let isDelete = false;
    const filters: Array<(item: unknown) => boolean> = [];
    let orderColumn: string | null = null;
    let orderAscending = true;
    let limitCount: number | null = null;
    let rangeFrom: number | null = null;
    let rangeTo: number | null = null;

    const builder: MockSupabaseQueryBuilder = {
      select(_columns?: string) {
        return builder;
      },

      insert(d: unknown) {
        insertData = d;
        return builder;
      },

      update(d: unknown) {
        updateData = d;
        return builder;
      },

      delete() {
        isDelete = true;
        return builder;
      },

      eq(column: string, value: unknown) {
        filters.push((item: unknown) => (item as Record<string, unknown>)[column] === value);
        return builder;
      },

      neq(column: string, value: unknown) {
        filters.push((item: unknown) => (item as Record<string, unknown>)[column] !== value);
        return builder;
      },

      gt(column: string, value: unknown) {
        filters.push((item: unknown) => {
          const itemVal = (item as Record<string, unknown>)[column] as number;
          return itemVal > (value as number);
        });
        return builder;
      },

      gte(column: string, value: unknown) {
        filters.push((item: unknown) => {
          const itemVal = (item as Record<string, unknown>)[column] as number;
          return itemVal >= (value as number);
        });
        return builder;
      },

      lt(column: string, value: unknown) {
        filters.push((item: unknown) => {
          const itemVal = (item as Record<string, unknown>)[column] as number;
          return itemVal < (value as number);
        });
        return builder;
      },

      lte(column: string, value: unknown) {
        filters.push((item: unknown) => {
          const itemVal = (item as Record<string, unknown>)[column] as number;
          return itemVal <= (value as number);
        });
        return builder;
      },

      order(column: string, options?: { ascending?: boolean }) {
        orderColumn = column;
        orderAscending = options?.ascending ?? true;
        return builder;
      },

      limit(count: number) {
        limitCount = count;
        return builder;
      },

      range(from: number, to: number) {
        rangeFrom = from;
        rangeTo = to;
        return builder;
      },

      async single() {
        const filtered = results.filter(item => filters.every(f => f(item)));
        if (filtered.length === 0) {
          return { data: null, error: { message: 'No rows found' } };
        }
        return { data: filtered[0], error: null };
      },

      async maybeSingle() {
        const filtered = results.filter(item => filters.every(f => f(item)));
        return { data: filtered[0] ?? null, error: null };
      },

      then<T>(resolve: (result: { data: unknown[]; error: null }) => T): Promise<T> {
        return Promise.resolve().then(() => {
          // Handle insert
          if (insertData) {
            const newItem = Array.isArray(insertData) ? insertData[0] : insertData;
            const itemWithId = { ...newItem as object, id: faker.string.uuid() };
            const tableData = getTable(table) as unknown[];
            tableData.push(itemWithId);
            return resolve({ data: [itemWithId], error: null });
          }

          // Handle update
          if (updateData) {
            const tableData = getTable(table) as unknown[];
            const filtered = tableData.filter(item => filters.every(f => f(item)));
            filtered.forEach(item => {
              Object.assign(item as object, updateData);
            });
            return resolve({ data: filtered, error: null });
          }

          // Handle delete
          if (isDelete) {
            const tableData = getTable(table) as unknown[];
            const toRemove = tableData.filter(item => filters.every(f => f(item)));
            toRemove.forEach(item => {
              const index = tableData.indexOf(item);
              if (index > -1) tableData.splice(index, 1);
            });
            return resolve({ data: toRemove, error: null });
          }

          // Handle select
          let filtered = results.filter(item => filters.every(f => f(item)));

          // Apply ordering
          if (orderColumn) {
            filtered.sort((a, b) => {
              const aVal = (a as Record<string, unknown>)[orderColumn!] as number | string;
              const bVal = (b as Record<string, unknown>)[orderColumn!] as number | string;
              if (aVal < bVal) return orderAscending ? -1 : 1;
              if (aVal > bVal) return orderAscending ? 1 : -1;
              return 0;
            });
          }

          // Apply range
          if (rangeFrom !== null && rangeTo !== null) {
            filtered = filtered.slice(rangeFrom, rangeTo + 1);
          }

          // Apply limit
          if (limitCount !== null) {
            filtered = filtered.slice(0, limitCount);
          }

          return resolve({ data: filtered, error: null });
        });
      },
    };

    return builder;
  };

  return {
    data,

    from(table: string) {
      return createQueryBuilder(table);
    },

    async rpc(fn: string, params: Record<string, unknown>) {
      // Handle common RPC functions
      if (fn === 'record_completion_atomic') {
        const { p_attempt_id, p_user_id, p_attempts_made, p_points, p_experience } = params;
        
        // Update attempt
        const attempt = data.attempts.find(a => a.id === p_attempt_id);
        if (attempt) {
          attempt.is_solved = true;
          attempt.game_over = true;
          attempt.attempts_made = p_attempts_made as number;
          attempt.points_earned = p_points as number;
          attempt.experience_earned = p_experience as number;
          attempt.completed_at = new Date().toISOString();
        }

        // Update user
        const user = data.users.find(u => u.user_id === p_user_id);
        if (user) {
          user.total_points += p_points as number;
          user.total_experience += p_experience as number;
          user.challenges_solved += 1;
        }

        return { data: true, error: null };
      }

      return { data: null, error: { message: `Unknown RPC function: ${fn}` } };
    },

    reset() {
      data.users = [];
      data.challenges = [];
      data.attempts = [];
    },
  };
}

// ============================================
// Test Context Factory
// ============================================

export interface TestContext {
  mockContext: Context;
  mockRedis: MockRedis;
  mockSupabase: MockSupabase;
  mockFetch: ReturnType<typeof vi.fn>;
}

/**
 * Creates a complete test context with all mocked dependencies
 */
export function createTestContext(): TestContext {
  const mockRedis = createMockRedis();
  const mockSupabase = createMockSupabase();
  const mockFetch = vi.fn();

  // Create mock context using the same pattern as existing test utilities
  // The Context type from Devvit may not expose redis directly, so we cast
  const mockContext = {
    redis: mockRedis,
    subredditId: faker.string.uuid(),
    subredditName: faker.internet.domainWord(),
    userId: `t2_${faker.string.alphanumeric(10)}` as `t2_${string}`,
    appName: 'guess-the-link-test',
    appAccountId: faker.string.uuid(),
  } as unknown as Context;

  // Set up global fetch mock
  global.fetch = mockFetch as unknown as typeof fetch;

  return {
    mockContext,
    mockRedis,
    mockSupabase,
    mockFetch,
  };
}

// ============================================
// Fixture Factories
// ============================================

/** Default values for test user */
const DEFAULT_TEST_USER: Partial<UserProfile> = {
  total_points: 0,
  total_experience: 0,
  level: 1,
  challenges_created: 0,
  challenges_attempted: 0,
  challenges_solved: 0,
  current_streak: 0,
  best_streak: 0,
  role: 'player',
};

/** Default values for test challenge */
const DEFAULT_TEST_CHALLENGE: Partial<Challenge> = {
  max_score: 100,
  score_deduction_per_hint: 10,
  players_played: 0,
  players_completed: 0,
};

/**
 * Creates a test user profile with optional overrides
 */
export function createTestUser(overrides?: Partial<UserProfile>): UserProfile {
  const id = faker.string.uuid();
  const userId = overrides?.user_id ?? `t2_${faker.string.alphanumeric(10)}`;
  
  return {
    id,
    user_id: userId,
    username: overrides?.username ?? faker.internet.username(),
    total_points: DEFAULT_TEST_USER.total_points!,
    total_experience: DEFAULT_TEST_USER.total_experience!,
    level: DEFAULT_TEST_USER.level!,
    challenges_created: DEFAULT_TEST_USER.challenges_created!,
    challenges_attempted: DEFAULT_TEST_USER.challenges_attempted!,
    challenges_solved: DEFAULT_TEST_USER.challenges_solved!,
    current_streak: DEFAULT_TEST_USER.current_streak!,
    best_streak: DEFAULT_TEST_USER.best_streak!,
    last_challenge_created_at: null,
    role: DEFAULT_TEST_USER.role!,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a test challenge with optional overrides
 */
export function createTestChallenge(overrides?: Partial<Challenge>): Challenge {
  const id = overrides?.id ?? faker.string.uuid();
  const creatorId = overrides?.creator_id ?? `t2_${faker.string.alphanumeric(10)}`;
  
  return {
    id,
    creator_id: creatorId,
    creator_username: overrides?.creator_username ?? faker.internet.username(),
    title: overrides?.title ?? faker.lorem.sentence(),
    image_url: overrides?.image_url ?? `${faker.image.url()},${faker.image.url()}`,
    image_descriptions: overrides?.image_descriptions ?? [faker.lorem.sentence(), faker.lorem.sentence()],
    tags: overrides?.tags ?? ['test'],
    correct_answer: overrides?.correct_answer ?? faker.lorem.word(),
    answer_explanation: overrides?.answer_explanation ?? faker.lorem.paragraph(),
    answer_set: overrides?.answer_set ?? {
      correct: [faker.lorem.word()],
      close: [faker.lorem.word()],
    },
    max_score: DEFAULT_TEST_CHALLENGE.max_score!,
    score_deduction_per_hint: DEFAULT_TEST_CHALLENGE.score_deduction_per_hint!,
    reddit_post_id: overrides?.reddit_post_id ?? null,
    players_played: DEFAULT_TEST_CHALLENGE.players_played!,
    players_completed: DEFAULT_TEST_CHALLENGE.players_completed!,
    created_at: overrides?.created_at ?? new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a test attempt with optional overrides
 */
export function createTestAttempt(overrides?: Partial<ChallengeAttempt>): ChallengeAttempt {
  const id = overrides?.id ?? faker.string.uuid();
  
  return {
    id,
    user_id: overrides?.user_id ?? `t2_${faker.string.alphanumeric(10)}`,
    challenge_id: overrides?.challenge_id ?? faker.string.uuid(),
    attempts_made: overrides?.attempts_made ?? 0,
    images_revealed: overrides?.images_revealed ?? 1,
    is_solved: overrides?.is_solved ?? false,
    game_over: overrides?.game_over ?? false,
    points_earned: overrides?.points_earned ?? 0,
    experience_earned: overrides?.experience_earned ?? 0,
    attempted_at: overrides?.attempted_at ?? new Date().toISOString(),
    completed_at: overrides?.completed_at ?? null,
    hints_used: overrides?.hints_used ?? [],
    ...overrides,
  };
}

// ============================================
// Cleanup Utilities
// ============================================

/**
 * Resets all mocks to their initial state
 */
export function resetMocks(): void {
  vi.clearAllMocks();
  vi.restoreAllMocks();
}

/**
 * Clears all test data from mock stores
 */
export function clearTestData(testContext: TestContext): void {
  testContext.mockRedis.reset();
  testContext.mockSupabase.reset();
}
