/**
 * Property-based tests for Deletion Handler Idempotency
 * **Feature: data-deletion-handlers, Property 5: Deletion Handler Idempotency**
 * **Validates: Requirements 1.6, 1.7, 2.3, 2.4**
 * 
 * Tests that calling any deletion handler multiple times with the same identifier
 * always returns success (HTTP 200) regardless of whether the data existed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import express, { type Express } from 'express';
import request from 'supertest';

// Mock @devvit/web/server before importing routes
vi.mock('@devvit/web/server', () => ({
  settings: {
    get: vi.fn(),
  },
  context: {
    redis: {},
    subredditId: 'test-subreddit',
    subredditName: 'test',
    userId: 'test-user',
    appName: 'test-app',
    appAccountId: 'test-account',
  },
}));

// Mock logger to prevent console output during tests
vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { settings } from '@devvit/web/server';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Generators for Reddit ID formats
const redditPostIdArb = fc.string({ minLength: 5, maxLength: 10 })
  .map(s => `t3_${s.replace(/[^a-z0-9]/gi, 'x')}`);

const redditUserIdArb = fc.string({ minLength: 5, maxLength: 10 })
  .map(s => `t2_${s.replace(/[^a-z0-9]/gi, 'x')}`);

// Generator for number of repeated calls (2-5 times)
const repeatCountArb = fc.integer({ min: 2, max: 5 });

describe('Deletion Handler Idempotency Property Tests', () => {
  let app: Express;

  beforeEach(async () => {
    mockFetch.mockClear();
    
    // Mock settings.get for Supabase config
    vi.mocked(settings.get).mockImplementation((key: string) => {
      if (key === 'supabaseUrl') return Promise.resolve('https://test.supabase.co');
      if (key === 'supabaseAnonKey') return Promise.resolve('test-anon-key');
      return Promise.resolve(null);
    });
    
    // Set environment variables as fallback
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Import routes fresh for each test
    const { postDeleteRoutes } = await import('./post-delete.js');
    const { accountDeleteRoutes } = await import('./account-delete.js');
    
    app.use('/internal/triggers/post-delete', postDeleteRoutes);
    app.use('/internal/triggers/account-delete', accountDeleteRoutes);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    vi.resetModules();
  });

  describe('Property 5: Deletion Handler Idempotency', () => {
    it('for any post ID, calling post-delete handler multiple times always returns HTTP 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          redditPostIdArb,
          repeatCountArb,
          async (postId, repeatCount) => {
            // Mock findByPostId to return null (no challenge found) for all calls
            // This simulates the case where data doesn't exist or was already deleted
            for (let i = 0; i < repeatCount; i++) {
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
                headers: new Map(),
              });
            }
            
            // Call the handler multiple times
            for (let i = 0; i < repeatCount; i++) {
              const response = await request(app)
                .post('/internal/triggers/post-delete')
                .send({ post: { id: postId } });
              
              // Should always return HTTP 200 (Requirements: 1.6, 1.7)
              expect(response.status).toBe(200);
              expect(response.body).toHaveProperty('success');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any post with existing challenge, repeated deletions always return HTTP 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          redditPostIdArb,
          fc.uuid(),
          repeatCountArb,
          async (postId, challengeId, repeatCount) => {
            // First call: challenge exists and gets deleted
            mockFetch
              .mockResolvedValueOnce({
                ok: true,
                json: async () => [{ id: challengeId, reddit_post_id: postId }],
                headers: new Map(),
              })
              .mockResolvedValueOnce({
                ok: true,
                headers: new Map(),
              });
            
            // Subsequent calls: challenge no longer exists
            for (let i = 1; i < repeatCount; i++) {
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
                headers: new Map(),
              });
            }
            
            // Call the handler multiple times
            for (let i = 0; i < repeatCount; i++) {
              const response = await request(app)
                .post('/internal/triggers/post-delete')
                .send({ post: { id: postId } });
              
              // Should always return HTTP 200 (Requirements: 1.6, 1.7)
              expect(response.status).toBe(200);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any user ID, calling account-delete handler multiple times always returns HTTP 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          redditUserIdArb,
          repeatCountArb,
          async (userId, repeatCount) => {
            // For each call, mock all deletion operations
            for (let i = 0; i < repeatCount; i++) {
              // deleteByCreatorId (challenges)
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
                headers: new Map(),
              });
              // deleteByUserId (attempts)
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
                headers: new Map(),
              });
              // deleteProfile
              mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Map(),
              });
            }
            
            // Call the handler multiple times
            for (let i = 0; i < repeatCount; i++) {
              const response = await request(app)
                .post('/internal/triggers/account-delete')
                .send({ userId });
              
              // Should always return HTTP 200
              expect(response.status).toBe(200);
              expect(response.body).toHaveProperty('success');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any deletion request with database errors, handler still returns HTTP 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({ type: fc.constant('post'), id: redditPostIdArb }),
          repeatCountArb,
          async (request_data, repeatCount) => {
            // Mock database errors for all calls
            for (let i = 0; i < repeatCount; i++) {
              mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
              });
            }
            
            // Call the appropriate handler multiple times
            for (let i = 0; i < repeatCount; i++) {
              const response = await request(app)
                .post('/internal/triggers/post-delete')
                .send({ post: { id: request_data.id } });
              
              // Should always return HTTP 200 even on errors (Requirements: 1.7)
              expect(response.status).toBe(200);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any missing ID in request, handlers return HTTP 200 with success false', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('post'),
            fc.constant('account'),
          ),
          repeatCountArb,
          async (handlerType, repeatCount) => {
            // Call the handler multiple times with missing ID
            for (let i = 0; i < repeatCount; i++) {
              let response;
              if (handlerType === 'post') {
                response = await request(app)
                  .post('/internal/triggers/post-delete')
                  .send({ post: {} }); // Missing id
              } else {
                response = await request(app)
                  .post('/internal/triggers/account-delete')
                  .send({}); // Missing userId
              }
              
              // Should always return HTTP 200 (idempotent)
              expect(response.status).toBe(200);
              expect(response.body).toHaveProperty('success', false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
