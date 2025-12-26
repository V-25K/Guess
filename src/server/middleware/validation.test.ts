/**
 * Unit tests for validation middleware
 */

import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import {
  validateRequest,
  formatValidationError,
  ValidatedRequest,
  ValidationSchema,
} from './validation.js';

describe('formatValidationError', () => {
  it('should format Zod errors into API-friendly format', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });

    const result = schema.safeParse({ name: '', age: -5 });
    
    if (!result.success) {
      const formatted = formatValidationError(result.error);
      
      expect(formatted.error).toBe('Validation failed');
      expect(formatted.details).toHaveLength(2);
      expect(formatted.details[0]).toHaveProperty('field');
      expect(formatted.details[0]).toHaveProperty('message');
      expect(formatted.details[0]).toHaveProperty('code');
    }
  });

  it('should include field paths in error details', () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email(),
      }),
    });

    const result = schema.safeParse({ user: { email: 'invalid' } });
    
    if (!result.success) {
      const formatted = formatValidationError(result.error);
      
      expect(formatted.details[0].field).toBe('user.email');
    }
  });
});

describe('validateRequest', () => {
  const createMockRequest = (body = {}, params = {}, query = {}): Partial<Request> => ({
    body,
    params,
    query,
  });

  interface MockResponse extends Partial<Response> {
    statusCode: number;
    jsonData: any;
  }

  const createMockResponse = (): MockResponse => {
    const res: any = {
      statusCode: 200,
      jsonData: null,
    };
    res.status = vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    });
    res.json = vi.fn((data: any) => {
      res.jsonData = data;
      return res;
    });
    return res as MockResponse;
  };

  const createMockNext = (): NextFunction => vi.fn();

  describe('successful validation', () => {
    it('should validate request body and call next()', async () => {
      const schema = z.object({
        body: z.object({
          name: z.string(),
          age: z.number(),
        }),
      });

      const req = createMockRequest({ name: 'John', age: 30 });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect((req as ValidatedRequest<any>).validated.body).toEqual({
        name: 'John',
        age: 30,
      });
    });

    it('should validate multi-part schema (body, params, query)', async () => {
      const schema: ValidationSchema = {
        body: z.object({ name: z.string() }),
        params: z.object({ id: z.string() }),
        query: z.object({ page: z.coerce.number() }),
      };

      const req = createMockRequest(
        { name: 'John' },
        { id: '123' },
        { page: '1' }
      );
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect((req as ValidatedRequest<any>).validated).toEqual({
        body: { name: 'John' },
        params: { id: '123' },
        query: { page: 1 },
      });
    });

    it('should handle partial multi-part validation (only body)', async () => {
      const schema: ValidationSchema = {
        body: z.object({ name: z.string() }),
      };

      const req = createMockRequest({ name: 'John' });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect((req as ValidatedRequest<any>).validated.body).toEqual({
        name: 'John',
      });
    });
  });

  describe('validation failure', () => {
    it('should return 400 with error details on validation failure', async () => {
      const schema = z.object({
        body: z.object({
          name: z.string().min(1),
          age: z.number().positive(),
        }),
      });

      const req = createMockRequest({ name: '', age: -5 });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.jsonData).toHaveProperty('error', 'Validation failed');
      expect(res.jsonData.details).toBeInstanceOf(Array);
      expect(res.jsonData.details.length).toBeGreaterThan(0);
    });

    it('should not call next() when validation fails', async () => {
      const schema = z.object({
        body: z.object({
          email: z.string().email(),
        }),
      });

      const req = createMockRequest({ email: 'invalid-email' });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('should include field paths in error response', async () => {
      const schema = z.object({
        body: z.object({
          user: z.object({
            email: z.string().email(),
          }),
        }),
      });

      const req = createMockRequest({ user: { email: 'invalid' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(res.jsonData.details[0]).toHaveProperty('field');
      expect(res.jsonData.details[0].field).toContain('email');
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors with 500 status', async () => {
      const schema = z.object({
        body: z.string(),
      });

      // Create a schema that will throw a non-Zod error
      const mockSchema = {
        parseAsync: vi.fn().mockRejectedValue(new Error('Unexpected error')),
      };

      const req = createMockRequest({ name: 'test' });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequest(mockSchema as any);
      await middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.jsonData).toEqual({ error: 'Internal server error' });
    });
  });

  describe('TypeScript type inference', () => {
    it('should provide typed validated data', async () => {
      interface TestInput {
        body: {
          name: string;
          age: number;
        };
      }

      const schema = z.object({
        body: z.object({
          name: z.string(),
          age: z.number(),
        }),
      });

      const req = createMockRequest({ name: 'John', age: 30 });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateRequest<TestInput>(schema);
      await middleware(req as Request, res as Response, next);

      // TypeScript should infer the correct type
      const validatedReq = req as ValidatedRequest<TestInput>;
      expect(validatedReq.validated.body.name).toBe('John');
      expect(validatedReq.validated.body.age).toBe(30);
    });
  });
});
