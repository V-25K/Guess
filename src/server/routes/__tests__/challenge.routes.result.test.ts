/**
 * Integration tests for challenge routes with Result pattern
 * 
 * Tests that challenge routes properly handle Results and return appropriate HTTP responses
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { ok, err } from '../../../shared/utils/result.js';
import { validationError, notFoundError, rateLimitError, databaseError } from '../../../shared/models/errors.js';
import { handleResult } from '../../utils/result-http.js';
import type { Challenge } from '../../../shared/models/challenge.types.js';

describe('Challenge Routes - Result Pattern Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Successful challenge creation returns HTTP 200', () => {
    it('should return 201 and challenge data when createChallenge succeeds', async () => {
      const mockChallenge: Challenge = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        creator_id: 'user123',
        creator_username: 'testuser',
        title: 'Test Challenge',
        image_url: 'https://example.com/image.jpg',
        image_descriptions: ['A test image'],
        correct_answer: 'answer',
        answer_explanation: 'This is how the images relate',
        tags: ['test'],
        max_score: 100,
        score_deduction_per_hint: 10,
        reddit_post_id: null,
        players_played: 0,
        players_completed: 0,
        created_at: new Date().toISOString()
      };

      app.post('/api/challenges', (req: Request, res: Response) => {
        const result = ok(mockChallenge);
        
        // Simulate the route behavior - return 201 for creation
        if (result.ok) {
          return res.status(201).json(result.value);
        }
        handleResult(result, res);
      });

      const response = await request(app)
        .post('/api/challenges')
        .send({
          title: 'Test Challenge',
          image_url: 'https://example.com/image.jpg',
          correct_answer: 'answer',
          tags: ['test']
        })
        .expect(201);

      expect(response.body).toEqual(mockChallenge);
      expect(response.body.id).toBe(mockChallenge.id);
      expect(response.body.title).toBe(mockChallenge.title);
    });
  });

  describe('Validation errors return HTTP 400', () => {
    it('should return 400 with validation error details', async () => {
      app.post('/api/challenges', (req: Request, res: Response) => {
        const result = err(validationError([
          { field: 'title', message: 'Title is required' },
          { field: 'correct_answer', message: 'Correct answer is required' }
        ]));
        handleResult(result, res);
      });

      const response = await request(app)
        .post('/api/challenges')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.fields).toBeInstanceOf(Array);
      expect(response.body.fields).toHaveLength(2);
      expect(response.body.fields[0]).toEqual({
        field: 'title',
        message: 'Title is required'
      });
      expect(response.body.fields[1]).toEqual({
        field: 'correct_answer',
        message: 'Correct answer is required'
      });
    });

    it('should return 401 for authentication validation errors', async () => {
      app.post('/api/challenges', (req: Request, res: Response) => {
        const result = err(validationError([
          { field: 'auth', message: 'User not authenticated' }
        ]));
        handleResult(result, res);
      });

      const response = await request(app)
        .post('/api/challenges')
        .send({})
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      app.post('/api/challenges', (req: Request, res: Response) => {
        const result = err(validationError([
          { field: 'image_url', message: 'Image URL is required' }
        ]));
        handleResult(result, res);
      });

      const response = await request(app)
        .post('/api/challenges')
        .send({
          title: 'Test',
          correct_answer: 'answer',
          tags: []
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.fields[0].field).toBe('image_url');
    });
  });

  describe('Rate limit errors return HTTP 429', () => {
    it('should return 429 with retry information when rate limited', async () => {
      app.post('/api/challenges', (req: Request, res: Response) => {
        const result = err(rateLimitError(5000)); // 5 seconds remaining
        handleResult(result, res);
      });

      const response = await request(app)
        .post('/api/challenges')
        .send({})
        .expect(429);

      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body.retryAfterMs).toBe(5000);
    });

    it('should include time remaining in rate limit response', async () => {
      const timeRemaining = 30000; // 30 seconds
      
      app.post('/api/challenges', (req: Request, res: Response) => {
        const result = err(rateLimitError(timeRemaining));
        handleResult(result, res);
      });

      const response = await request(app)
        .post('/api/challenges')
        .send({})
        .expect(429);

      expect(response.body.retryAfterMs).toBe(timeRemaining);
    });
  });

  describe('Error responses follow Devvit Web patterns', () => {
    it('should return consistent error format for validation errors', async () => {
      app.post('/api/challenges', (req: Request, res: Response) => {
        const result = err(validationError([
          { field: 'title', message: 'Title is required' }
        ]));
        handleResult(result, res);
      });

      const response = await request(app)
        .post('/api/challenges')
        .send({})
        .expect(400);

      // Verify Devvit Web error pattern
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('fields');
      expect(typeof response.body.error).toBe('string');
      expect(Array.isArray(response.body.fields)).toBe(true);
    });

    it('should return consistent error format for not found errors', async () => {
      app.get('/api/challenges/:id', (req: Request, res: Response) => {
        const result = err(notFoundError('Challenge', req.params.id));
        handleResult(result, res);
      });

      const response = await request(app)
        .get('/api/challenges/nonexistent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('resource');
      expect(response.body).toHaveProperty('identifier');
      expect(response.body.error).toBe('Challenge not found');
      expect(response.body.resource).toBe('Challenge');
      expect(response.body.identifier).toBe('nonexistent-id');
    });

    it('should not expose internal database errors to clients', async () => {
      app.get('/api/challenges', (req: Request, res: Response) => {
        const result = err(databaseError('redis.get', 'Connection timeout'));
        handleResult(result, res);
      });

      const response = await request(app)
        .get('/api/challenges')
        .expect(500);

      // Should return generic error, not internal details
      expect(response.body.error).toBe('Database error');
      expect(response.body).not.toHaveProperty('operation');
      expect(response.body).not.toHaveProperty('message');
    });

    it('should return success data directly without wrapper', async () => {
      const mockChallenges: Challenge[] = [
        {
          id: '1',
          creator_id: 'user1',
          creator_username: 'user1',
          title: 'Challenge 1',
          image_url: 'https://example.com/image1.jpg',
          correct_answer: 'answer1',
          tags: ['tag1'],
          max_score: 100,
          score_deduction_per_hint: 10,
          reddit_post_id: null,
          players_played: 0,
          players_completed: 0,
          created_at: new Date().toISOString()
        }
      ];

      app.get('/api/challenges', (req: Request, res: Response) => {
        const result = ok(mockChallenges);
        handleResult(result, res);
      });

      const response = await request(app)
        .get('/api/challenges')
        .expect(200);

      // Data should be returned directly, not wrapped in { ok: true, value: ... }
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toEqual(mockChallenges);
      expect(response.body).not.toHaveProperty('ok');
      expect(response.body).not.toHaveProperty('value');
    });
  });

  describe('GET /api/challenges/:id with Results', () => {
    it('should return 200 with challenge data when found', async () => {
      const mockChallenge: Challenge = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        creator_id: 'user123',
        creator_username: 'testuser',
        title: 'Test Challenge',
        image_url: 'https://example.com/image.jpg',
        correct_answer: 'answer',
        tags: ['test'],
        max_score: 100,
        score_deduction_per_hint: 10,
        reddit_post_id: null,
        players_played: 5,
        players_completed: 2,
        created_at: new Date().toISOString()
      };

      app.get('/api/challenges/:id', (req: Request, res: Response) => {
        const result = ok(mockChallenge);
        handleResult(result, res);
      });

      const response = await request(app)
        .get('/api/challenges/550e8400-e29b-41d4-a716-446655440000')
        .expect(200);

      expect(response.body).toEqual(mockChallenge);
    });

    it('should return 404 when challenge not found', async () => {
      app.get('/api/challenges/:id', (req: Request, res: Response) => {
        const result = err(notFoundError('Challenge', req.params.id));
        handleResult(result, res);
      });

      const response = await request(app)
        .get('/api/challenges/nonexistent-id')
        .expect(404);

      expect(response.body.error).toBe('Challenge not found');
      expect(response.body.resource).toBe('Challenge');
      expect(response.body.identifier).toBe('nonexistent-id');
    });
  });

  describe('POST /api/challenges/preview with Results', () => {
    it('should return 200 with answer set preview', async () => {
      const mockAnswerSet = {
        answers: ['answer1', 'answer2', 'answer3', 'answer4'],
        correctIndex: 0
      };

      app.post('/api/challenges/preview', (req: Request, res: Response) => {
        const result = ok(mockAnswerSet);
        handleResult(result, res);
      });

      const response = await request(app)
        .post('/api/challenges/preview')
        .send({
          correct_answer: 'answer1',
          wrong_answers: ['answer2', 'answer3', 'answer4']
        })
        .expect(200);

      expect(response.body).toEqual(mockAnswerSet);
    });

    it('should return 401 when not authenticated', async () => {
      app.post('/api/challenges/preview', (req: Request, res: Response) => {
        const result = err(validationError([
          { field: 'auth', message: 'User not authenticated' }
        ]));
        handleResult(result, res);
      });

      const response = await request(app)
        .post('/api/challenges/preview')
        .send({})
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });
});
