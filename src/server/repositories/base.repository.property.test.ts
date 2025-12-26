/**
 * Property-based tests for BaseRepository
 * **Feature: repository-tests, Property 10: BaseRepository Methods Return Correct Result Types**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8**
 * 
 * Tests that all BaseRepository methods return correct Result types
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { BaseRepository } from './base.repository.js';
import type { Context } from '@devvit/server/server-context';
import { isOk, isErr } from '../../shared/utils/result.js';

// Mock @devvit/web/server settings
vi.mock('@devvit/web/server', () => ({
  settings: {
    get: vi.fn(),
  },
}));

import { settings } from '@devvit/web/server';
import { afterEach } from 'node:test';

// Concrete implementation for testing
class TestRepository extends BaseRepository {
  constructor(context: Context) {
    super(context);
  }

  public testQuery<T>(table: string, options = {}) {
    return this.query<T>(table, options);
  }

  public testQueryOne<T>(table: string, options = {}) {
    return this.queryOne<T>(table, options);
  }

  public testInsert<T>(table: string, data: Partial<T>) {
    return this.insert<T>(table, data);
  }

  public testUpdate<T>(table: string, filter: Record<string, string>, data: Partial<T>) {
    return this.update<T>(table, filter, data);
  }

  public testDelete(table: string, filter: Record<string, string>) {
    return this.delete(table, filter);
  }

  public testCount(table: string, filter?: Record<string, string>) {
    return this.count(table, filter);
  }

  public testBatchInsert<T>(table: string, data: Partial<T>[]) {
    return this.batchInsert<T>(table, data);
  }

  public testExecuteFunction<T>(functionName: string, params: Record<string, unknown>) {
    return this.executeFunction<T>(functionName, params);
  }
}

// Mock context
const createMockContext = (): Context => {
  return {
    redis: {} as any,
    subredditId: 'test-subreddit',
    subredditName: 'test',
    userId: 'test-user',
    appName: 'test-app',
    appAccountId: 'test-account',
    debug: {
      effects: {
        enabled: false,
      },
      emitSnapshots: false,
      emitState: false,
      metadata: {},
    },
    toJSON: () => ({}),
  } as unknown as Context;
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BaseRepository Property Tests', () => {
  let repository: TestRepository;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = createMockContext();
    repository = new TestRepository(mockContext);
    mockFetch.mockClear();
    
    // Mock settings.get for Supabase config (use camelCase keys as in config-cache.ts)
    vi.mocked(settings.get).mockImplementation((key: string) => {
      if (key === 'supabaseUrl') return Promise.resolve('https://test.supabase.co');
      if (key === 'supabaseAnonKey') return Promise.resolve('test-anon-key');
      return Promise.resolve(null);
    });
    
    // Also set environment variables as fallback
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  describe('Property 10: BaseRepository Methods Return Correct Result Types', () => {
    it('query returns Ok with array on success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({ id: fc.string(), name: fc.string() })),
          async (mockData) => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => mockData,
              headers: new Map(),
            });

            const result = await repository.testQuery('test_table');
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(Array.isArray(result.value)).toBe(true);
              expect(result.value).toEqual(mockData);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('queryOne returns Ok with single record or null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.record({ id: fc.string() }), fc.constant(null)),
          async (mockRecord) => {
            const mockData = mockRecord ? [mockRecord] : [];
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => mockData,
              headers: new Map(),
            });

            const result = await repository.testQueryOne('test_table');
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              if (mockRecord) {
                expect(result.value).toEqual(mockRecord);
              } else {
                expect(result.value).toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('insert returns Ok with inserted record on success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({ id: fc.string(), name: fc.string() }),
          async (mockRecord) => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => [mockRecord],
              headers: new Map(),
            });

            const result = await repository.testInsert('test_table', { name: mockRecord.name });
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(typeof result.value).toBe('object');
              expect(result.value).toEqual(mockRecord);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('update returns Ok with boolean true on success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.record({ name: fc.string() }),
          async (id, updateData) => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              headers: new Map(),
            });

            const result = await repository.testUpdate('test_table', { id }, updateData);
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(typeof result.value).toBe('boolean');
              expect(result.value).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('delete returns Ok with boolean true on success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          async (id) => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              headers: new Map(),
            });

            const result = await repository.testDelete('test_table', { id });
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(typeof result.value).toBe('boolean');
              expect(result.value).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('count returns Ok with number on success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 1000 }),
          async (count) => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              headers: new Map([['content-range', `0-${count - 1}/${count}`]]),
            });

            const result = await repository.testCount('test_table');
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(typeof result.value).toBe('number');
              expect(result.value).toBe(count);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('batchInsert returns Ok with array on success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({ name: fc.string() }), { minLength: 1, maxLength: 10 }),
          async (mockData) => {
            const mockResult = mockData.map((item, idx) => ({ id: `${idx}`, ...item }));
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => mockResult,
              headers: new Map(),
            });

            const result = await repository.testBatchInsert('test_table', mockData);
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(Array.isArray(result.value)).toBe(true);
              expect(result.value.length).toBe(mockData.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('executeFunction returns Ok with function result on success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({ param: fc.string() }),
          fc.record({ result: fc.string() }),
          async (params, mockResult) => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => mockResult,
              headers: new Map(),
            });

            const result = await repository.testExecuteFunction('test_function', params);
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
              expect(result.value).toEqual(mockResult);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all methods return Err on database error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 599 }),
          fc.string(),
          async (statusCode, errorMessage) => {
            mockFetch.mockResolvedValue({
              ok: false,
              status: statusCode,
              statusText: errorMessage,
            });

            const queryResult = await repository.testQuery('test_table');
            expect(isErr(queryResult)).toBe(true);
            if (isErr(queryResult)) {
              expect(queryResult.error.type).toBe('database');
            }

            const queryOneResult = await repository.testQueryOne('test_table');
            expect(isErr(queryOneResult)).toBe(true);
            if (isErr(queryOneResult)) {
              expect(queryOneResult.error.type).toBe('database');
            }

            const insertResult = await repository.testInsert('test_table', { name: 'test' });
            expect(isErr(insertResult)).toBe(true);
            if (isErr(insertResult)) {
              expect(insertResult.error.type).toBe('database');
            }

            const updateResult = await repository.testUpdate('test_table', { id: '1' }, { name: 'test' });
            expect(isErr(updateResult)).toBe(true);
            if (isErr(updateResult)) {
              expect(updateResult.error.type).toBe('database');
            }

            const deleteResult = await repository.testDelete('test_table', { id: '1' });
            expect(isErr(deleteResult)).toBe(true);
            if (isErr(deleteResult)) {
              expect(deleteResult.error.type).toBe('database');
            }

            const countResult = await repository.testCount('test_table');
            expect(isErr(countResult)).toBe(true);
            if (isErr(countResult)) {
              expect(countResult.error.type).toBe('database');
            }

            const batchInsertResult = await repository.testBatchInsert('test_table', [{ name: 'test' }]);
            expect(isErr(batchInsertResult)).toBe(true);
            if (isErr(batchInsertResult)) {
              expect(batchInsertResult.error.type).toBe('database');
            }

            const executeFunctionResult = await repository.testExecuteFunction('test_function', {});
            expect(isErr(executeFunctionResult)).toBe(true);
            if (isErr(executeFunctionResult)) {
              expect(executeFunctionResult.error.type).toBe('database');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
