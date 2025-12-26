/**
 * Unit tests for BaseRepository Result integration
 * Tests that BaseRepository methods properly return Results and handle errors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

// Concrete implementation for testing
class TestRepository extends BaseRepository {
  constructor(context: Context) {
    super(context);
  }

  // Expose protected methods for testing
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

describe('BaseRepository Result Integration', () => {
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

  describe('query', () => {
    it('should return Ok with data on successful query', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Map(),
      });

      const result = await repository.testQuery('test_table');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockData);
      }
    });

    it('should return Err with DatabaseError on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await repository.testQuery('test_table');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
        if (result.error.type === 'database') {
          expect(result.error.operation).toBe('query');
        }
      }
    });

    it('should return Err with DatabaseError on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await repository.testQuery('test_table');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
        if (result.error.type === 'database') {
          expect(result.error.message).toContain('Network error');
        }
      }
    });

    it('should return Err with timeout information on timeout', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const result = await repository.testQuery('test_table');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
        if (result.error.type === 'database') {
          expect(result.error.message).toContain('timeout');
        }
      }
    });

    it('should pass correct filter parameters to Supabase', async () => {
      const mockData = [{ id: '1', name: 'Test', status: 'active' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Map(),
      });

      await repository.testQuery('test_table', {
        filter: { status: 'eq.active', user_id: 'eq.123' }
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=eq.active'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('user_id=eq.123'),
        expect.any(Object)
      );
    });

    it('should pass correct sorting parameters to Supabase', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Map(),
      });

      await repository.testQuery('test_table', {
        order: 'created_at.desc'
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('order=created_at.desc'),
        expect.any(Object)
      );
    });

    it('should pass correct pagination parameters to Supabase', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Map(),
      });

      await repository.testQuery('test_table', {
        limit: 10,
        offset: 20
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20'),
        expect.any(Object)
      );
    });

    it('should pass correct select fields to Supabase', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Map(),
      });

      await repository.testQuery('test_table', {
        select: 'id,name,created_at'
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('select=id%2Cname%2Ccreated_at'),
        expect.any(Object)
      );
    });

    it('should correctly combine multiple query parameters', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Map(),
      });

      await repository.testQuery('test_table', {
        select: 'id,name',
        filter: { status: 'eq.active' },
        order: 'created_at.desc',
        limit: 5,
        offset: 10
      });
      
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('select=id%2Cname');
      expect(callUrl).toContain('status=eq.active');
      expect(callUrl).toContain('order=created_at.desc');
      expect(callUrl).toContain('limit=5');
      expect(callUrl).toContain('offset=10');
    });
  });

  describe('queryOne', () => {
    it('should return Ok with single record on success', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Map(),
      });

      const result = await repository.testQueryOne('test_table');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockData[0]);
      }
    });

    it('should return Ok with null when no records found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        headers: new Map(),
      });

      const result = await repository.testQueryOne('test_table');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('insert', () => {
    it('should return Ok with inserted record on success', async () => {
      const mockData = { id: '1', name: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockData],
        headers: new Map(),
      });

      const result = await repository.testInsert('test_table', { name: 'Test' });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockData);
      }
    });

    it('should return Err with DatabaseError on insert failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const result = await repository.testInsert('test_table', { name: 'Test' });
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
        if (result.error.type === 'database') {
          expect(result.error.operation).toBe('insert');
        }
      }
    });

    it('should return Err when insert succeeds but no record returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [], // Empty array - no record returned
        headers: new Map(),
      });

      const result = await repository.testInsert('test_table', { name: 'Test' });
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
        if (result.error.type === 'database') {
          expect(result.error.operation).toBe('insert');
          expect(result.error.message).toContain('Insert succeeded but no record returned');
        }
      }
    });
  });

  describe('update', () => {
    it('should return Ok with true on successful update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      const result = await repository.testUpdate('test_table', { id: '1' }, { name: 'Updated' });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    it('should return Err with DatabaseError on update failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await repository.testUpdate('test_table', { id: '1' }, { name: 'Updated' });
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
        if (result.error.type === 'database') {
          expect(result.error.operation).toBe('update');
        }
      }
    });
  });

  describe('delete', () => {
    it('should return Ok with true on successful delete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      const result = await repository.testDelete('test_table', { id: '1' });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    it('should return Err with DatabaseError on delete failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await repository.testDelete('test_table', { id: '1' });
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
        if (result.error.type === 'database') {
          expect(result.error.operation).toBe('delete');
        }
      }
    });
  });

  describe('count', () => {
    it('should return Ok with count on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-range', '0-9/42']]),
      });

      const result = await repository.testCount('test_table');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('should return Err with DatabaseError on count failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await repository.testCount('test_table');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
        if (result.error.type === 'database') {
          expect(result.error.operation).toBe('count');
        }
      }
    });

    it('should return Ok with 0 when no results found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-range', '*/0']]),
      });

      const result = await repository.testCount('test_table');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(0);
      }
    });

    it('should return Ok with 0 when content-range header is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      const result = await repository.testCount('test_table');
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(0);
      }
    });

    it('should pass filter parameters correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-range', '0-9/10']]),
      });

      await repository.testCount('test_table', { status: 'active' });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=eq.active'),
        expect.any(Object)
      );
    });
  });

  describe('batchInsert', () => {
    it('should return Ok with inserted records on success', async () => {
      const mockData = [
        { id: '1', name: 'Test1' },
        { id: '2', name: 'Test2' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Map(),
      });

      const result = await repository.testBatchInsert('test_table', [
        { name: 'Test1' },
        { name: 'Test2' },
      ]);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockData);
      }
    });

    it('should return Ok with empty array when input is empty', async () => {
      const result = await repository.testBatchInsert('test_table', []);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('executeFunction', () => {
    it('should return Ok with function result on success', async () => {
      const mockResult = { success: true, data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
        headers: new Map(),
      });

      const result = await repository.testExecuteFunction('test_function', { param: 'value' });
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockResult);
      }
    });

    it('should return Err with DatabaseError on function execution failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await repository.testExecuteFunction('test_function', { param: 'value' });
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('database');
        if (result.error.type === 'database') {
          expect(result.error.operation).toBe('executeFunction');
        }
      }
    });

    it('should handle empty parameters object', async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
        headers: new Map(),
      });

      const result = await repository.testExecuteFunction('test_function', {});
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockResult);
      }
    });

    it('should handle complex parameter types', async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
        headers: new Map(),
      });

      const complexParams = {
        stringParam: 'test',
        numberParam: 42,
        booleanParam: true,
        arrayParam: [1, 2, 3],
        objectParam: { nested: 'value' }
      };

      const result = await repository.testExecuteFunction('test_function', complexParams);
      
      expect(isOk(result)).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('rpc/test_function'),
        expect.objectContaining({
          body: JSON.stringify(complexParams)
        })
      );
    });

    it('should handle null and undefined in parameters', async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
        headers: new Map(),
      });

      const result = await repository.testExecuteFunction('test_function', {
        nullParam: null,
        undefinedParam: undefined
      });
      
      expect(isOk(result)).toBe(true);
    });
  });
});
