/**
 * Batch Loader Tests
 * Tests for batch loading and N+1 query prevention
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchLoader, createUserProfileLoader, createChallengeLoader } from './batch-loader.js';

describe('BatchLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic loading', () => {
    it('should load a single item', async () => {
      const batchFn = vi.fn().mockResolvedValue(new Map([['key1', 'value1']]));
      const loader = new BatchLoader(batchFn);

      const promise = loader.load('key1');
      vi.advanceTimersByTime(20);
      const result = await promise;

      expect(result).toBe('value1');
      expect(batchFn).toHaveBeenCalledWith(['key1']);
    });

    it('should return null for missing items', async () => {
      const batchFn = vi.fn().mockResolvedValue(new Map());
      const loader = new BatchLoader(batchFn);

      const promise = loader.load('missing');
      vi.advanceTimersByTime(20);
      const result = await promise;

      expect(result).toBeNull();
    });

    it('should batch multiple requests', async () => {
      const batchFn = vi.fn().mockResolvedValue(
        new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
          ['key3', 'value3'],
        ])
      );
      const loader = new BatchLoader(batchFn);

      const promises = [
        loader.load('key1'),
        loader.load('key2'),
        loader.load('key3'),
      ];

      vi.advanceTimersByTime(20);
      const results = await Promise.all(promises);

      expect(results).toEqual(['value1', 'value2', 'value3']);
      expect(batchFn).toHaveBeenCalledTimes(1);
      expect(batchFn).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });

    it('should deduplicate keys in batch', async () => {
      const batchFn = vi.fn().mockResolvedValue(new Map([['key1', 'value1']]));
      const loader = new BatchLoader(batchFn);

      const promises = [
        loader.load('key1'),
        loader.load('key1'),
        loader.load('key1'),
      ];

      vi.advanceTimersByTime(20);
      const results = await Promise.all(promises);

      expect(results).toEqual(['value1', 'value1', 'value1']);
      expect(batchFn).toHaveBeenCalledTimes(1);
      expect(batchFn).toHaveBeenCalledWith(['key1']);
    });
  });

  describe('loadMany', () => {
    it('should load multiple items at once', async () => {
      const batchFn = vi.fn().mockResolvedValue(
        new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ])
      );
      const loader = new BatchLoader(batchFn);

      const promise = loader.loadMany(['key1', 'key2']);
      vi.advanceTimersByTime(20);
      const results = await promise;

      expect(results.get('key1')).toBe('value1');
      expect(results.get('key2')).toBe('value2');
    });
  });

  describe('caching', () => {
    it('should cache results by default', async () => {
      const batchFn = vi.fn().mockResolvedValue(new Map([['key1', 'value1']]));
      const loader = new BatchLoader(batchFn);

      // First load
      const promise1 = loader.load('key1');
      vi.advanceTimersByTime(20);
      await promise1;

      // Second load should use cache
      const result2 = await loader.load('key1');

      expect(result2).toBe('value1');
      expect(batchFn).toHaveBeenCalledTimes(1);
    });

    it('should not cache when disabled', async () => {
      const batchFn = vi.fn().mockResolvedValue(new Map([['key1', 'value1']]));
      const loader = new BatchLoader(batchFn, { cache: false });

      // First load
      const promise1 = loader.load('key1');
      vi.advanceTimersByTime(20);
      await promise1;

      // Second load should not use cache
      const promise2 = loader.load('key1');
      vi.advanceTimersByTime(20);
      await promise2;

      expect(batchFn).toHaveBeenCalledTimes(2);
    });

    it('should allow priming the cache', async () => {
      const batchFn = vi.fn().mockResolvedValue(new Map());
      const loader = new BatchLoader(batchFn);

      loader.prime('key1', 'primed-value');
      const result = await loader.load('key1');

      expect(result).toBe('primed-value');
      expect(batchFn).not.toHaveBeenCalled();
    });

    it('should allow clearing specific cache entries', async () => {
      const batchFn = vi.fn()
        .mockResolvedValueOnce(new Map([['key1', 'value1']]))
        .mockResolvedValueOnce(new Map([['key1', 'value2']]));
      const loader = new BatchLoader(batchFn);

      // First load
      const promise1 = loader.load('key1');
      vi.advanceTimersByTime(20);
      await promise1;

      // Clear cache
      loader.clear('key1');

      // Second load should fetch again
      const promise2 = loader.load('key1');
      vi.advanceTimersByTime(20);
      const result2 = await promise2;

      expect(result2).toBe('value2');
      expect(batchFn).toHaveBeenCalledTimes(2);
    });

    it('should allow clearing all cache entries', async () => {
      const batchFn = vi.fn().mockResolvedValue(
        new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ])
      );
      const loader = new BatchLoader(batchFn);

      // First load
      const promise1 = loader.loadMany(['key1', 'key2']);
      vi.advanceTimersByTime(20);
      await promise1;

      // Clear all cache
      loader.clearAll();

      // Second load should fetch again
      const promise2 = loader.loadMany(['key1', 'key2']);
      vi.advanceTimersByTime(20);
      await promise2;

      expect(batchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('batch size limits', () => {
    it('should execute immediately when max batch size is reached', async () => {
      const batchFn = vi.fn().mockResolvedValue(
        new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ])
      );
      const loader = new BatchLoader(batchFn, { maxBatchSize: 2 });

      const promises = [
        loader.load('key1'),
        loader.load('key2'),
      ];

      // Should execute immediately without waiting for timer
      const results = await Promise.all(promises);

      expect(results).toEqual(['value1', 'value2']);
      expect(batchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should reject all pending requests on batch error', async () => {
      const batchFn = vi.fn().mockRejectedValue(new Error('Batch failed'));
      const loader = new BatchLoader(batchFn);

      const promises = [
        loader.load('key1'),
        loader.load('key2'),
      ];

      vi.advanceTimersByTime(20);

      await expect(promises[0]).rejects.toThrow('Batch failed');
      await expect(promises[1]).rejects.toThrow('Batch failed');
    });
  });

  describe('factory functions', () => {
    it('should create user profile loader', async () => {
      const fetchFn = vi.fn().mockResolvedValue([
        { user_id: 'user1', username: 'User 1' },
        { user_id: 'user2', username: 'User 2' },
      ]);
      const loader = createUserProfileLoader(fetchFn);

      const promise = loader.loadMany(['user1', 'user2']);
      vi.advanceTimersByTime(20);
      const results = await promise;

      expect(results.get('user1')?.username).toBe('User 1');
      expect(results.get('user2')?.username).toBe('User 2');
    });

    it('should create challenge loader', async () => {
      const fetchFn = vi.fn().mockResolvedValue([
        { id: 'challenge1', title: 'Challenge 1' },
        { id: 'challenge2', title: 'Challenge 2' },
      ]);
      const loader = createChallengeLoader(fetchFn);

      const promise = loader.loadMany(['challenge1', 'challenge2']);
      vi.advanceTimersByTime(20);
      const results = await promise;

      expect(results.get('challenge1')?.title).toBe('Challenge 1');
      expect(results.get('challenge2')?.title).toBe('Challenge 2');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const batchFn = vi.fn().mockResolvedValue(
        new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ])
      );
      const loader = new BatchLoader(batchFn);

      const promise = loader.loadMany(['key1', 'key2']);
      vi.advanceTimersByTime(20);
      await promise;

      const stats = loader.getCacheStats();
      expect(stats.size).toBe(2);
    });
  });
});
