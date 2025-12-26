/**
 * Property-Based Tests for ChallengeRepository
 * **Feature: repository-tests, Property 5: Read Non-Existent Returns Ok Null**
 * **Validates: Requirements 2.3**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ChallengeRepository } from './challenge.repository.js';
import type { Context } from '@devvit/server/server-context';
import { isOk } from '../../shared/utils/result.js';
import { 
  createMockFetchSuccess,
  setupRepositoryTest,
  teardownRepositoryTest
} from '../test-utils/index.js';

// Mock @devvit/web/server settings
vi.mock('@devvit/web/server', () => ({
  settings: {
    get: vi.fn(),
  },
}));

import { settings } from '@devvit/web/server';

describe('ChallengeRepository Property-Based Tests', () => {
  let repository: ChallengeRepository;
  let mockContext: Context;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const testContext = setupRepositoryTest();
    mockContext = testContext.mockContext;
    mockFetch = testContext.mockFetch;
    
    vi.mocked(settings.get).mockImplementation((key: string) => {
      if (key === 'SUPABASE_URL') return Promise.resolve('https://test.supabase.co');
      if (key === 'SUPABASE_ANON_KEY') return Promise.resolve('test-anon-key');
      return Promise.resolve(null);
    });
    
    repository = new ChallengeRepository(mockContext);
  });

  afterEach(() => {
    teardownRepositoryTest();
  });

  describe('Property 5: Read Non-Existent Returns Ok Null', () => {
    it('should return Ok with null for any non-existent challenge ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (challengeId) => {
            // Mock empty response (challenge not found)
            mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

            const result = await repository.findById(challengeId);
            
            // Should return Ok (not Err)
            expect(isOk(result)).toBe(true);
            
            // Value should be null
            if (isOk(result)) {
              expect(result.value).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return Ok with null for findByPostId with non-existent post ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (postId) => {
            // Mock empty response (post not found)
            mockFetch.mockResolvedValueOnce(createMockFetchSuccess([]));

            const result = await repository.findByPostId(postId);
            
            // Should return Ok (not Err)
            expect(isOk(result)).toBe(true);
            
            // Value should be null
            if (isOk(result)) {
              expect(result.value).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
