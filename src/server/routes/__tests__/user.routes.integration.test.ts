/**
 * Integration tests for user routes with validation
 * 
 * Tests the full request/response cycle including validation middleware
 * Requirements: 6.1, 6.2, 6.3, 4.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { validateRequest, type ValidatedRequest } from '../../middleware/validation.js';
import { updateProfileSchema, type UpdateProfileInput } from '../../validation/schemas.js';

describe('User Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('PATCH /api/users/:userId', () => {
    it('should accept valid profile update with username', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (req: Request, res: Response) => {
          const { userId } = (req as ValidatedRequest<UpdateProfileInput>).validated.params;
          const { username } = (req as ValidatedRequest<UpdateProfileInput>).validated.body;
          res.json({ success: true, userId, username });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'john_doe',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe('user123');
      expect(response.body.username).toBe('john_doe');
    });

    it('should accept valid profile update with bio', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (req: Request, res: Response) => {
          const { userId } = (req as ValidatedRequest<UpdateProfileInput>).validated.params;
          const { bio } = (req as ValidatedRequest<UpdateProfileInput>).validated.body;
          res.json({ success: true, userId, bio });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          bio: 'Software engineer and puzzle enthusiast',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe('user123');
      expect(response.body.bio).toBe('Software engineer and puzzle enthusiast');
    });

    it('should accept valid profile update with both username and bio', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (req: Request, res: Response) => {
          const { userId } = (req as ValidatedRequest<UpdateProfileInput>).validated.params;
          const { username, bio } = (req as ValidatedRequest<UpdateProfileInput>).validated.body;
          res.json({ success: true, userId, username, bio });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'jane_smith',
          bio: 'Developer and gamer',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe('user123');
      expect(response.body.username).toBe('jane_smith');
      expect(response.body.bio).toBe('Developer and gamer');
    });

    it('should reject username that is too short (less than 3 chars)', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'ab',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
      expect(response.body.details[0].field).toContain('username');
    });

    it('should reject username that is too long (more than 30 chars)', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const tooLongUsername = 'a'.repeat(31);
      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: tooLongUsername,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details[0].field).toContain('username');
    });

    it('should reject username with invalid characters (hyphens)', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'john-doe',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details[0].field).toContain('username');
      expect(response.body.details[0].message).toMatch(/invalid/i);
    });

    it('should reject username with invalid characters (spaces)', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'john doe',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details[0].field).toContain('username');
    });

    it('should reject username with special characters', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const invalidUsernames = ['john@doe', 'user!123', 'test#user', 'user$name'];

      for (const username of invalidUsernames) {
        const response = await request(app)
          .patch('/api/users/user123')
          .send({ username })
          .expect(400);

        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details[0].field).toContain('username');
      }
    });

    it('should accept username with alphanumeric and underscores', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (req: Request, res: Response) => {
          const { username } = (req as ValidatedRequest<UpdateProfileInput>).validated.body;
          res.json({ success: true, username });
        }
      );

      const validUsernames = ['user123', 'JohnDoe', 'test_user', 'ABC123', 'user_name_123'];

      for (const username of validUsernames) {
        const response = await request(app)
          .patch('/api/users/user123')
          .send({ username })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.username).toBe(username);
      }
    });

    it('should reject bio that is too long (more than 500 chars)', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const tooLongBio = 'a'.repeat(501);
      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          bio: tooLongBio,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details[0].field).toContain('bio');
    });

    it('should accept bio at max length (500 chars)', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (req: Request, res: Response) => {
          const { bio } = (req as ValidatedRequest<UpdateProfileInput>).validated.body;
          res.json({ success: true, bioLength: bio?.length });
        }
      );

      const maxLengthBio = 'a'.repeat(500);
      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          bio: maxLengthBio,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.bioLength).toBe(500);
    });

    it('should accept empty bio', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (req: Request, res: Response) => {
          const { bio } = (req as ValidatedRequest<UpdateProfileInput>).validated.body;
          res.json({ success: true, bio });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          bio: '',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.bio).toBe('');
    });

    it('should reject empty update (no fields provided)', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should reject invalid userId in params (empty)', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      // Note: Express won't match empty param, but we can test with a route that captures it
      app.patch(
        '/api/users/',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .patch('/api/users/')
        .send({
          username: 'test_user',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject invalid userId in params (too long)', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const tooLongUserId = 'a'.repeat(101);
      const response = await request(app)
        .patch(`/api/users/${tooLongUserId}`)
        .send({
          username: 'test_user',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details[0].field).toContain('userId');
    });

    it('should not call handler when validation fails', async () => {
      const handlerMock = vi.fn((_req: Request, res: Response) => {
        res.json({ success: true });
      });

      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        handlerMock
      );

      await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'ab', // Too short
        })
        .expect(400);

      // Handler should never be called
      expect(handlerMock).not.toHaveBeenCalled();
    });

    it('should return error with field path and message', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'a', // Too short
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
  });

  describe('Error Response Format', () => {
    it('should return consistent error format across all validation failures', async () => {
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'a', // Too short
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
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (_req: Request, res: Response) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'invalid-username',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should provide typed validated data to handlers', async () => {
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (req: Request, res: Response) => {
          // TypeScript should know the exact type
          const validatedReq = req as ValidatedRequest<UpdateProfileInput>;
          const { userId } = validatedReq.validated.params;
          const { username, bio } = validatedReq.validated.body;
          
          // This should compile without errors
          const userIdLength: number = userId.length;
          const usernameLength: number | undefined = username?.length;
          const bioLength: number | undefined = bio?.length;
          
          res.json({ success: true, userIdLength, usernameLength, bioLength });
        }
      );

      const response = await request(app)
        .patch('/api/users/user123')
        .send({
          username: 'john_doe',
          bio: 'Developer',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.userIdLength).toBe(7);
      expect(response.body.usernameLength).toBe(8);
      expect(response.body.bioLength).toBe(9);
    });
  });

  describe('Username Regex Validation', () => {
    it('should validate username regex pattern correctly', async () => {
      // Setup route with validation
      app.patch(
        '/api/users/:userId',
        validateRequest(updateProfileSchema),
        (req: Request, res: Response) => {
          const { username } = (req as ValidatedRequest<UpdateProfileInput>).validated.body;
          res.json({ success: true, username });
        }
      );

      // Test valid patterns
      const validPatterns = [
        'abc',
        'ABC',
        '123',
        'user123',
        'User_Name',
        'test_user_123',
        'a'.repeat(30), // Max length
      ];

      for (const username of validPatterns) {
        const response = await request(app)
          .patch('/api/users/user123')
          .send({ username })
          .expect(200);

        expect(response.body.success).toBe(true);
      }

      // Test invalid patterns
      const invalidPatterns = [
        'user-name',
        'user name',
        'user.name',
        'user@name',
        'user!name',
        'user#name',
        'user$name',
        'user%name',
        'user&name',
        'user*name',
      ];

      for (const username of invalidPatterns) {
        const response = await request(app)
          .patch('/api/users/user123')
          .send({ username })
          .expect(400);

        expect(response.body.error).toBe('Validation failed');
      }
    });
  });
});
