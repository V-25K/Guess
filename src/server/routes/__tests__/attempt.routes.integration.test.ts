/**
 * Integration tests for attempt routes with validation
 * 
 * Tests the full request/response cycle including validation middleware
 * Requirements: 6.1, 6.2, 6.3, 3.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { validateRequest, type ValidatedRequest } from '../../middleware/validation.js';
import { submitGuessSchema, type SubmitGuessInput } from '../../validation/schemas.js';

describe('Attempt Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('POST /api/attempts/submit', () => {
    it('should accept valid guess submission and pass to handler', async () => {
      // Setup route with validation
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (req: Request, res: Response) => {
          const { challengeId, guess } = (req as ValidatedRequest<SubmitGuessInput>).validated.body;
          res.json({ success: true, challengeId, guess });
        }
      );

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: validUuid,
          guess: 'Paris',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.challengeId).toBe(validUuid);
      expect(response.body.guess).toBe('Paris');
    });

    it('should reject invalid challengeId with 400 error', async () => {
      // Setup route with validation
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (_req: Request, res: Response) => {
          // Handler should not be called
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: 'not-a-uuid',
          guess: 'Paris',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
      expect(response.body.details[0].field).toContain('challengeId');
    });

    it('should reject empty guess with 400 error', async () => {
      // Setup route with validation
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: validUuid,
          guess: '',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
      expect(response.body.details[0].field).toContain('guess');
    });

    it('should reject guess over 200 characters with 400 error', async () => {
      // Setup route with validation
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const tooLongGuess = 'a'.repeat(201);
      
      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: validUuid,
          guess: tooLongGuess,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should trim whitespace from guess (XSS prevention)', async () => {
      // Setup route with validation
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (req: Request, res: Response) => {
          const { guess } = (req as ValidatedRequest<SubmitGuessInput>).validated.body;
          res.json({ success: true, guess, trimmed: guess === 'Paris' });
        }
      );

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: validUuid,
          guess: '  Paris  ',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.guess).toBe('Paris');
      expect(response.body.trimmed).toBe(true);
      expect(response.body.guess.startsWith(' ')).toBe(false);
      expect(response.body.guess.endsWith(' ')).toBe(false);
    });

    it('should reject whitespace-only guess (XSS prevention)', async () => {
      // Setup route with validation
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: validUuid,
          guess: '     ',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details[0].field).toContain('guess');
    });

    it('should not call handler when validation fails', async () => {
      const handlerMock = vi.fn((_req: Request, res: Response) => {
        res.json({ success: true });
      });

      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        handlerMock
      );

      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: 'invalid-uuid',
          guess: 'Paris',
        })
        .expect(400);

      // Handler should never be called
      expect(handlerMock).not.toHaveBeenCalled();
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return error with field path and message', async () => {
      // Setup route with validation
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: 'bad-uuid',
          guess: '',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
      
      // Verify each detail has required fields
      response.body.details.forEach((detail: any) => {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
        expect(detail).toHaveProperty('code');
        expect(typeof detail.field).toBe('string');
        expect(typeof detail.message).toBe('string');
        expect(typeof detail.code).toBe('string');
      });
    });

    it('should handle missing required fields', async () => {
      // Setup route with validation
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          // Missing all required fields
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should preserve internal spaces while trimming edges', async () => {
      // Setup route with validation
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (req: Request, res: Response) => {
          const { guess } = (req as ValidatedRequest<SubmitGuessInput>).validated.body;
          res.json({ success: true, guess });
        }
      );

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: validUuid,
          guess: '  New York City  ',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.guess).toBe('New York City');
      expect(response.body.guess).toContain(' ');
      expect(response.body.guess.startsWith(' ')).toBe(false);
      expect(response.body.guess.endsWith(' ')).toBe(false);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format across all validation failures', async () => {
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: 'bad-id',
          guess: '',
        })
        .expect(400);

      // Verify error format matches specification
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
      expect(response.body.error).toBe('Validation failed');
      expect(Array.isArray(response.body.details)).toBe(true);
      
      // Verify each detail has required fields
      response.body.details.forEach((detail: any) => {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
        expect(detail).toHaveProperty('code');
      });
    });

    it('should return HTTP 400 status for validation errors', async () => {
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: 'invalid',
          guess: 'test',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should provide typed validated data to handlers', async () => {
      app.post(
        '/api/attempts/submit',
        validateRequest(submitGuessSchema),
        (req: Request, res: Response) => {
          // TypeScript should know the exact type
          const validatedReq = req as ValidatedRequest<SubmitGuessInput>;
          const { challengeId, guess } = validatedReq.validated.body;
          
          // This should compile without errors
          const guessLength: number = guess.length;
          const idLength: number = challengeId.length;
          
          res.json({ success: true, guessLength, idLength });
        }
      );

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .post('/api/attempts/submit')
        .send({
          challengeId: validUuid,
          guess: 'Paris',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.guessLength).toBe(5);
      expect(response.body.idLength).toBe(36); // UUID length
    });
  });
});
