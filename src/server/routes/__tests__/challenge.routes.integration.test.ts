/**
 * Integration tests for challenge routes with validation
 * 
 * Tests the full request/response cycle including validation middleware
 * Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateRequest, type ValidatedRequest } from '../../middleware/validation.js';
import { getChallengeSchema, paginationSchema, type GetChallengeInput } from '../../validation/schemas.js';

describe('Challenge Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('GET /api/challenges/:challengeId', () => {
    it('should accept valid UUID and pass to handler', async () => {
      // Setup route with validation
      app.get(
        '/api/challenges/:challengeId',
        validateRequest(getChallengeSchema),
        (req: Request, res: Response) => {
          const { challengeId } = (req as ValidatedRequest<GetChallengeInput>).validated.params;
          res.json({ success: true, challengeId });
        }
      );

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/api/challenges/${validUuid}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.challengeId).toBe(validUuid);
    });

    it('should reject invalid UUID with 400 error', async () => {
      // Setup route with validation
      app.get(
        '/api/challenges/:challengeId',
        validateRequest(getChallengeSchema),
        (_req: Request, res: Response) => {
          // Handler should not be called
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .get('/api/challenges/not-a-uuid')
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should return error with field path and message', async () => {
      // Setup route with validation
      app.get(
        '/api/challenges/:challengeId',
        validateRequest(getChallengeSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .get('/api/challenges/invalid-id')
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details[0]).toHaveProperty('field');
      expect(response.body.details[0]).toHaveProperty('message');
      expect(response.body.details[0]).toHaveProperty('code');
      expect(response.body.details[0].field).toContain('challengeId');
    });

    it('should not call handler when validation fails', async () => {
      const handlerMock = vi.fn((_req: Request, res: Response) => {
        res.json({ success: true });
      });

      app.get(
        '/api/challenges/:challengeId',
        validateRequest(getChallengeSchema),
        handlerMock
      );

      await request(app)
        .get('/api/challenges/invalid-id')
        .expect(400);

      // Handler should never be called
      expect(handlerMock).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/challenges (pagination)', () => {
    it('should accept valid pagination params', async () => {
      app.get(
        '/api/challenges',
        validateRequest({ query: paginationSchema }),
        (req: Request, res: Response) => {
          const { page, limit, order } = (req as ValidatedRequest<{ query: z.infer<typeof paginationSchema> }>).validated.query;
          res.json({ success: true, page, limit, order });
        }
      );

      const response = await request(app)
        .get('/api/challenges?page=2&limit=50')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(50);
      expect(response.body.order).toBe('desc'); // default value
    });

    it('should apply default values for missing pagination params', async () => {
      app.get(
        '/api/challenges',
        validateRequest({ query: paginationSchema }),
        (req: Request, res: Response) => {
          const { page, limit, order } = (req as ValidatedRequest<{ query: z.infer<typeof paginationSchema> }>).validated.query;
          res.json({ success: true, page, limit, order });
        }
      );

      const response = await request(app)
        .get('/api/challenges')
        .expect(200);

      expect(response.body.page).toBe(1); // default
      expect(response.body.limit).toBe(20); // default
      expect(response.body.order).toBe('desc'); // default
    });

    it('should reject invalid pagination params', async () => {
      app.get(
        '/api/challenges',
        validateRequest({ query: paginationSchema }),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .get('/api/challenges?page=0&limit=200')
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should coerce string numbers to integers', async () => {
      app.get(
        '/api/challenges',
        validateRequest({ query: paginationSchema }),
        (req: Request, res: Response) => {
          const { page, limit } = (req as ValidatedRequest<{ query: z.infer<typeof paginationSchema> }>).validated.query;
          res.json({ 
            success: true, 
            page, 
            limit,
            pageType: typeof page,
            limitType: typeof limit
          });
        }
      );

      const response = await request(app)
        .get('/api/challenges?page=3&limit=25')
        .expect(200);

      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(25);
      expect(response.body.pageType).toBe('number');
      expect(response.body.limitType).toBe('number');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format across all validation failures', async () => {
      app.get(
        '/api/challenges/:challengeId',
        validateRequest(getChallengeSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .get('/api/challenges/bad-id')
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
        expect(typeof detail.field).toBe('string');
        expect(typeof detail.message).toBe('string');
        expect(typeof detail.code).toBe('string');
      });
    });

    it('should return HTTP 400 status for validation errors', async () => {
      app.get(
        '/api/challenges/:challengeId',
        validateRequest(getChallengeSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .get('/api/challenges/invalid');

      expect(response.status).toBe(400);
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should provide typed validated data to handlers', async () => {
      app.get(
        '/api/challenges/:challengeId',
        validateRequest(getChallengeSchema),
        (req: Request, res: Response) => {
          // TypeScript should know the exact type
          const validatedReq = req as ValidatedRequest<GetChallengeInput>;
          const { challengeId } = validatedReq.validated.params;
          
          // This should compile without errors
          const idLength: number = challengeId.length;
          
          res.json({ success: true, idLength });
        }
      );

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/api/challenges/${validUuid}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.idLength).toBe(36); // UUID length
    });
  });
});
