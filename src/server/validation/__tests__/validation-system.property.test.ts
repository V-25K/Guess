/**
 * Property-based tests for the complete validation system
 * 
 * These tests verify universal properties that should hold across all inputs
 * for the entire validation system, including middleware integration.
 * 
 * Feature: request-validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { validateRequest, type ValidatedRequest, formatValidationError } from '../../middleware/validation.js';
import { 
  userIdSchema,
  uuidSchema,
  paginationSchema,
  createChallengeSchema,
  getChallengeSchema,
  submitGuessSchema,
  updateProfileSchema,
  type CreateChallengeInput,
  type GetChallengeInput,
  type SubmitGuessInput,
  type UpdateProfileInput
} from '../schemas.js';
import { ZodError } from 'zod';

/**
 * Property 1: Valid inputs always pass validation
 * Validates: Requirements 1.1, 2.1-2.5, 3.1-3.4, 4.1-4.4, 5.1-5.4
 */
describe('Property 1: Valid inputs always pass validation', () => {
  describe('Base schemas', () => {
    it('should accept all valid user IDs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (userId) => {
            const result = userIdSchema.safeParse(userId);
            expect(result.success).toBe(true);
            if (result.success) {
              expect(result.data).toBe(userId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept all valid UUIDs', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (uuid) => {
            const result = uuidSchema.safeParse(uuid);
            expect(result.success).toBe(true);
            if (result.success) {
              expect(result.data).toBe(uuid);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept all valid pagination parameters', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.option(fc.constantFrom('created_at', 'points', 'level'), { nil: undefined }),
          fc.constantFrom('asc', 'desc'),
          (page, limit, sortBy, order) => {
            const input = {
              page,
              limit,
              ...(sortBy !== undefined && { sortBy }),
              order,
            };
            
            const result = paginationSchema.safeParse(input);
            expect(result.success).toBe(true);
            
            if (result.success) {
              expect(result.data.page).toBe(page);
              expect(result.data.limit).toBe(limit);
              expect(result.data.order).toBe(order);
              if (sortBy !== undefined) {
                expect(result.data.sortBy).toBe(sortBy);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Challenge schemas', () => {
    it('should accept all valid challenge creation inputs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length >= 1),
          fc.array(
            fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length >= 1),
            { minLength: 1, maxLength: 4 }
          ),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 1, maxLength: 100 }),
          (answer, hints, difficulty, creatorId) => {
            const input = {
              body: {
                answer,
                hints,
                difficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(true);
            
            if (result.success) {
              expect(result.data.body.answer).toBe(answer.trim());
              expect(result.data.body.hints).toEqual(hints.map(h => h.trim()));
              expect(result.data.body.difficulty).toBe(difficulty);
              expect(result.data.body.creatorId).toBe(creatorId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept all valid challenge retrieval inputs', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (challengeId) => {
            const input = {
              params: {
                challengeId,
              },
            };
            
            const result = getChallengeSchema.safeParse(input);
            expect(result.success).toBe(true);
            
            if (result.success) {
              expect(result.data.params.challengeId).toBe(challengeId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Guess submission schemas', () => {
    it('should accept all valid guess submissions', () => {
      // Note: userId is obtained from server context, not request body
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length >= 1),
          (challengeId, guess) => {
            const input = {
              body: {
                challengeId,
                guess,
              },
            };
            
            const result = submitGuessSchema.safeParse(input);
            expect(result.success).toBe(true);
            
            if (result.success) {
              expect(result.data.body.challengeId).toBe(challengeId);
              expect(result.data.body.guess).toBe(guess.trim());
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('User profile schemas', () => {
    it('should accept all valid profile updates with username', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 3, maxLength: 30 })
            .filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
          (userId, username) => {
            const input = {
              params: {
                userId,
              },
              body: {
                username,
              },
            };
            
            const result = updateProfileSchema.safeParse(input);
            expect(result.success).toBe(true);
            
            if (result.success) {
              expect(result.data.params.userId).toBe(userId);
              expect(result.data.body.username).toBe(username);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept all valid profile updates with bio', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 500 }),
          (userId, bio) => {
            const input = {
              params: {
                userId,
              },
              body: {
                bio,
              },
            };
            
            const result = updateProfileSchema.safeParse(input);
            expect(result.success).toBe(true);
            
            if (result.success) {
              expect(result.data.params.userId).toBe(userId);
              expect(result.data.body.bio).toBe(bio);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept all valid profile updates with both fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 3, maxLength: 30 })
            .filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
          fc.string({ minLength: 0, maxLength: 500 }),
          (userId, username, bio) => {
            const input = {
              params: {
                userId,
              },
              body: {
                username,
                bio,
              },
            };
            
            const result = updateProfileSchema.safeParse(input);
            expect(result.success).toBe(true);
            
            if (result.success) {
              expect(result.data.params.userId).toBe(userId);
              expect(result.data.body.username).toBe(username);
              expect(result.data.body.bio).toBe(bio);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Property 2: Invalid inputs always fail validation
 * Validates: Requirements 6.3, 7.1-7.5
 */
describe('Property 2: Invalid inputs always fail validation', () => {
  describe('Base schemas', () => {
    it('should reject user IDs that are too long', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 101, maxLength: 200 }),
          (tooLongId) => {
            const result = userIdSchema.safeParse(tooLongId);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject empty user IDs', () => {
      const result = userIdSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should reject non-UUID strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
          (nonUuid) => {
            const result = uuidSchema.safeParse(nonUuid);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pagination with invalid page numbers', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          (invalidPage) => {
            const result = paginationSchema.safeParse({ page: invalidPage });
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pagination with invalid limit values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ max: 0 }),
            fc.integer({ min: 101, max: 1000 })
          ),
          (invalidLimit) => {
            const result = paginationSchema.safeParse({ limit: invalidLimit });
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pagination with invalid sortBy values', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !['created_at', 'points', 'level'].includes(s)),
          (invalidSortBy) => {
            const result = paginationSchema.safeParse({ sortBy: invalidSortBy });
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pagination with invalid order values', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !['asc', 'desc'].includes(s)),
          (invalidOrder) => {
            const result = paginationSchema.safeParse({ order: invalidOrder });
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Challenge schemas', () => {
    it('should reject empty answer strings', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 1, maxLength: 100 }),
          (hints, difficulty, creatorId) => {
            const input = {
              body: {
                answer: '',
                hints,
                difficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject answer strings over 200 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 201, maxLength: 500 }),
          fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 1, maxLength: 100 }),
          (tooLongAnswer, hints, difficulty, creatorId) => {
            const input = {
              body: {
                answer: tooLongAnswer,
                hints,
                difficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject empty hints arrays', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 1, maxLength: 100 }),
          (answer, difficulty, creatorId) => {
            const input = {
              body: {
                answer,
                hints: [],
                difficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject hints arrays with more than 4 elements', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 5, maxLength: 10 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 1, maxLength: 100 }),
          (answer, tooManyHints, difficulty, creatorId) => {
            const input = {
              body: {
                answer,
                hints: tooManyHints,
                difficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid difficulty values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
          fc.string().filter(s => !['easy', 'medium', 'hard'].includes(s)),
          fc.string({ minLength: 1, maxLength: 100 }),
          (answer, hints, invalidDifficulty, creatorId) => {
            const input = {
              body: {
                answer,
                hints,
                difficulty: invalidDifficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-UUID challengeId', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
          (nonUuid) => {
            const input = {
              params: {
                challengeId: nonUuid,
              },
            };
            
            const result = getChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Guess submission schemas', () => {
    it('should reject invalid guess submissions', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Invalid challengeId (not UUID)
            fc.record({
              challengeId: fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
              guess: fc.string({ minLength: 1, maxLength: 200 }),
              userId: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            // Invalid guess (too long)
            fc.record({
              challengeId: fc.uuid(),
              guess: fc.string({ minLength: 201, maxLength: 500 }),
              userId: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            // Invalid userId (empty)
            fc.record({
              challengeId: fc.uuid(),
              guess: fc.string({ minLength: 1, maxLength: 200 }),
              userId: fc.constant(''),
            }),
            // Invalid userId (too long)
            fc.record({
              challengeId: fc.uuid(),
              guess: fc.string({ minLength: 1, maxLength: 200 }),
              userId: fc.string({ minLength: 101, maxLength: 200 }),
            })
          ),
          (invalidData) => {
            const input = {
              body: invalidData,
            };
            
            const result = submitGuessSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject guess that becomes empty after trimming', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.stringMatching(/^\s+$/),
          (challengeId, whitespaceOnly) => {
            const input = {
              body: {
                challengeId,
                guess: whitespaceOnly,
              },
            };
            
            const result = submitGuessSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('User profile schemas', () => {
    it('should reject profile updates with no fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (userId) => {
            const input = {
              params: {
                userId,
              },
              body: {},
            };
            
            const result = updateProfileSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid username (too short)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 2 }),
          (userId, tooShortUsername) => {
            const input = {
              params: {
                userId,
              },
              body: {
                username: tooShortUsername,
              },
            };
            
            const result = updateProfileSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid username (too long)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 31, maxLength: 100 }),
          (userId, tooLongUsername) => {
            const input = {
              params: {
                userId,
              },
              body: {
                username: tooLongUsername,
              },
            };
            
            const result = updateProfileSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid username (invalid characters)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 3, maxLength: 30 })
            .filter(s => !/^[a-zA-Z0-9_]+$/.test(s)),
          (userId, invalidUsername) => {
            const input = {
              params: {
                userId,
              },
              body: {
                username: invalidUsername,
              },
            };
            
            const result = updateProfileSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid bio (too long)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 501, maxLength: 1000 }),
          (userId, tooLongBio) => {
            const input = {
              params: {
                userId,
              },
              body: {
                bio: tooLongBio,
              },
            };
            
            const result = updateProfileSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBeInstanceOf(ZodError);
              expect(result.error.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error messages are present', () => {
    it('should include error messages for all validation failures', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.string({ minLength: 101, maxLength: 200 })
          ),
          (invalidUserId) => {
            const result = userIdSchema.safeParse(invalidUserId);
            expect(result.success).toBe(false);
            
            if (!result.success) {
              expect(result.error.issues.length).toBeGreaterThan(0);
              result.error.issues.forEach(issue => {
                expect(issue.message).toBeDefined();
                expect(typeof issue.message).toBe('string');
                expect(issue.message.length).toBeGreaterThan(0);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Property 5: Validation happens before handlers
 * Validates: Requirements 6.1, 6.4
 */
describe('Property 5: Validation happens before handlers', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('should never execute handler when validation fails for challenge creation', () => {
    fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Invalid answer (empty)
          fc.record({
            answer: fc.constant(''),
            hints: fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
            difficulty: fc.constantFrom('easy', 'medium', 'hard'),
            creatorId: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          // Invalid hints (empty array)
          fc.record({
            answer: fc.string({ minLength: 1, maxLength: 200 }),
            hints: fc.constant([]),
            difficulty: fc.constantFrom('easy', 'medium', 'hard'),
            creatorId: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          // Invalid difficulty
          fc.record({
            answer: fc.string({ minLength: 1, maxLength: 200 }),
            hints: fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
            difficulty: fc.string().filter(s => !['easy', 'medium', 'hard'].includes(s)),
            creatorId: fc.string({ minLength: 1, maxLength: 100 }),
          })
        ),
        async (invalidData) => {
          const handlerMock = vi.fn((req: Request, res: Response) => {
            res.json({ success: true });
          });

          app.post(
            '/api/challenges',
            validateRequest(createChallengeSchema),
            handlerMock
          );

          await request(app)
            .post('/api/challenges')
            .send(invalidData)
            .expect(400);

          // Handler should never be called
          expect(handlerMock).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 } // Reduced runs for async tests
    );
  });

  it('should never execute handler when validation fails for challenge retrieval', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 })
          .filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
          .filter(s => s.trim().length > 0), // Filter out whitespace-only strings
        async (invalidChallengeId) => {
          const handlerMock = vi.fn((req: Request, res: Response) => {
            res.json({ success: true });
          });

          app.get(
            '/api/challenges/:challengeId',
            validateRequest(getChallengeSchema),
            handlerMock
          );

          await request(app)
            .get(`/api/challenges/${invalidChallengeId}`)
            .expect(400);

          // Handler should never be called
          expect(handlerMock).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should never execute handler when validation fails for guess submission', () => {
    fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Invalid challengeId
          fc.record({
            challengeId: fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
            guess: fc.string({ minLength: 1, maxLength: 200 }),
            userId: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          // Invalid guess (empty after trim)
          fc.record({
            challengeId: fc.uuid(),
            guess: fc.stringMatching(/^\s+$/),
            userId: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          // Invalid userId (empty)
          fc.record({
            challengeId: fc.uuid(),
            guess: fc.string({ minLength: 1, maxLength: 200 }),
            userId: fc.constant(''),
          })
        ),
        async (invalidData) => {
          const handlerMock = vi.fn((req: Request, res: Response) => {
            res.json({ success: true });
          });

          app.post(
            '/api/attempts/submit',
            validateRequest(submitGuessSchema),
            handlerMock
          );

          await request(app)
            .post('/api/attempts/submit')
            .send(invalidData)
            .expect(400);

          // Handler should never be called
          expect(handlerMock).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should never execute handler when validation fails for profile update', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.oneof(
          // No fields provided
          fc.constant({}),
          // Invalid username (too short)
          fc.record({
            username: fc.string({ minLength: 1, maxLength: 2 }),
          }),
          // Invalid username (invalid chars)
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 30 })
              .filter(s => !/^[a-zA-Z0-9_]+$/.test(s)),
          }),
          // Invalid bio (too long)
          fc.record({
            bio: fc.string({ minLength: 501, maxLength: 1000 }),
          })
        ),
        async (userId, invalidData) => {
          const handlerMock = vi.fn((req: Request, res: Response) => {
            res.json({ success: true });
          });

          app.patch(
            '/api/users/:userId',
            validateRequest(updateProfileSchema),
            handlerMock
          );

          await request(app)
            .patch(`/api/users/${userId}`)
            .send(invalidData)
            .expect(400);

          // Handler should never be called
          expect(handlerMock).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should execute handler when validation succeeds', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (validChallengeId) => {
          // Create a fresh Express app for each iteration to avoid route conflicts
          const testApp = express();
          testApp.use(express.json());
          
          const handlerMock = vi.fn((req: Request, res: Response) => {
            res.json({ success: true });
          });

          testApp.get(
            '/api/challenges/:challengeId',
            validateRequest(getChallengeSchema),
            handlerMock
          );

          await request(testApp)
            .get(`/api/challenges/${validChallengeId}`)
            .expect(200);

          // Handler should be called exactly once
          expect(handlerMock).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 4: Validation errors are actionable
 * Validates: Requirements 7.2-7.4
 */
describe('Property 4: Validation errors are actionable', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('should include field path and message for all validation errors', () => {
    fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Invalid answer (empty)
          fc.record({
            answer: fc.constant(''),
            hints: fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
            difficulty: fc.constantFrom('easy', 'medium', 'hard'),
            creatorId: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          // Invalid hints (empty array)
          fc.record({
            answer: fc.string({ minLength: 1, maxLength: 200 }),
            hints: fc.constant([]),
            difficulty: fc.constantFrom('easy', 'medium', 'hard'),
            creatorId: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          // Invalid difficulty
          fc.record({
            answer: fc.string({ minLength: 1, maxLength: 200 }),
            hints: fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
            difficulty: fc.string().filter(s => !['easy', 'medium', 'hard'].includes(s)),
            creatorId: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          // Invalid creatorId (empty)
          fc.record({
            answer: fc.string({ minLength: 1, maxLength: 200 }),
            hints: fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
            difficulty: fc.constantFrom('easy', 'medium', 'hard'),
            creatorId: fc.constant(''),
          })
        ),
        async (invalidData) => {
          app.post(
            '/api/challenges',
            validateRequest(createChallengeSchema),
            (req: Request, res: Response) => {
              res.json({ success: true });
            }
          );

          const response = await request(app)
            .post('/api/challenges')
            .send(invalidData)
            .expect(400);

          // Verify error format
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toBe('Validation failed');
          expect(response.body).toHaveProperty('details');
          expect(Array.isArray(response.body.details)).toBe(true);
          expect(response.body.details.length).toBeGreaterThan(0);

          // Verify each detail has required fields
          response.body.details.forEach((detail: any) => {
            expect(detail).toHaveProperty('field');
            expect(detail).toHaveProperty('message');
            expect(detail).toHaveProperty('code');
            expect(typeof detail.field).toBe('string');
            expect(typeof detail.message).toBe('string');
            expect(typeof detail.code).toBe('string');
            expect(detail.field.length).toBeGreaterThan(0);
            expect(detail.message.length).toBeGreaterThan(0);
            expect(detail.code.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should include field path for nested validation errors', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
        fc.string().filter(s => !['easy', 'medium', 'hard'].includes(s)),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (answer, hints, invalidDifficulty, creatorId) => {
          app.post(
            '/api/challenges',
            validateRequest(createChallengeSchema),
            (req: Request, res: Response) => {
              res.json({ success: true });
            }
          );

          const response = await request(app)
            .post('/api/challenges')
            .send({
              answer,
              hints,
              difficulty: invalidDifficulty,
              creatorId,
            })
            .expect(400);

          // Find the difficulty error
          const difficultyError = response.body.details.find(
            (detail: any) => detail.field.includes('difficulty')
          );

          expect(difficultyError).toBeDefined();
          expect(difficultyError.field).toContain('body');
          expect(difficultyError.field).toContain('difficulty');
          expect(difficultyError.message).toBeDefined();
          expect(difficultyError.message.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should provide consistent error format across different schemas', () => {
    fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Challenge creation error
          fc.record({
            type: fc.constant('challenge'),
            data: fc.record({
              answer: fc.constant(''),
              hints: fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
              difficulty: fc.constantFrom('easy', 'medium', 'hard'),
              creatorId: fc.string({ minLength: 1, maxLength: 100 }),
            }),
          }),
          // Guess submission error
          fc.record({
            type: fc.constant('guess'),
            data: fc.record({
              challengeId: fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
              guess: fc.string({ minLength: 1, maxLength: 200 }),
              userId: fc.string({ minLength: 1, maxLength: 100 }),
            }),
          }),
          // Profile update error
          fc.record({
            type: fc.constant('profile'),
            userId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), // Filter out whitespace-only strings
            data: fc.constant({}),
          })
        ),
        async (testCase) => {
          if (testCase.type === 'challenge') {
            app.post(
              '/api/challenges',
              validateRequest(createChallengeSchema),
              (req: Request, res: Response) => {
                res.json({ success: true });
              }
            );

            const response = await request(app)
              .post('/api/challenges')
              .send(testCase.data)
              .expect(400);

            // Verify consistent format
            expect(response.body.error).toBe('Validation failed');
            expect(Array.isArray(response.body.details)).toBe(true);
            response.body.details.forEach((detail: any) => {
              expect(detail).toHaveProperty('field');
              expect(detail).toHaveProperty('message');
              expect(detail).toHaveProperty('code');
            });
          } else if (testCase.type === 'guess') {
            app.post(
              '/api/attempts/submit',
              validateRequest(submitGuessSchema),
              (req: Request, res: Response) => {
                res.json({ success: true });
              }
            );

            const response = await request(app)
              .post('/api/attempts/submit')
              .send(testCase.data)
              .expect(400);

            // Verify consistent format
            expect(response.body.error).toBe('Validation failed');
            expect(Array.isArray(response.body.details)).toBe(true);
            response.body.details.forEach((detail: any) => {
              expect(detail).toHaveProperty('field');
              expect(detail).toHaveProperty('message');
              expect(detail).toHaveProperty('code');
            });
          } else if (testCase.type === 'profile') {
            app.patch(
              '/api/users/:userId',
              validateRequest(updateProfileSchema),
              (req: Request, res: Response) => {
                res.json({ success: true });
              }
            );

            const response = await request(app)
              .patch(`/api/users/${testCase.userId}`)
              .send(testCase.data)
              .expect(400);

            // Verify consistent format
            expect(response.body.error).toBe('Validation failed');
            expect(Array.isArray(response.body.details)).toBe(true);
            response.body.details.forEach((detail: any) => {
              expect(detail).toHaveProperty('field');
              expect(detail).toHaveProperty('message');
              expect(detail).toHaveProperty('code');
            });
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should format errors using formatValidationError function', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.string({ minLength: 101, maxLength: 200 })
        ),
        (invalidUserId) => {
          const result = userIdSchema.safeParse(invalidUserId);
          expect(result.success).toBe(false);

          if (!result.success) {
            const formattedError = formatValidationError(result.error);

            // Verify format
            expect(formattedError).toHaveProperty('error');
            expect(formattedError.error).toBe('Validation failed');
            expect(formattedError).toHaveProperty('details');
            expect(Array.isArray(formattedError.details)).toBe(true);
            expect(formattedError.details.length).toBeGreaterThan(0);

            // Verify each detail
            formattedError.details.forEach(detail => {
              expect(detail).toHaveProperty('field');
              expect(detail).toHaveProperty('message');
              expect(detail).toHaveProperty('code');
              expect(typeof detail.field).toBe('string');
              expect(typeof detail.message).toBe('string');
              expect(typeof detail.code).toBe('string');
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include multiple errors when multiple fields are invalid', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constant(''),
        fc.constant([]),
        fc.string().filter(s => !['easy', 'medium', 'hard'].includes(s)),
        fc.constant(''),
        async (emptyAnswer, emptyHints, invalidDifficulty, emptyCreatorId) => {
          app.post(
            '/api/challenges',
            validateRequest(createChallengeSchema),
            (req: Request, res: Response) => {
              res.json({ success: true });
            }
          );

          const response = await request(app)
            .post('/api/challenges')
            .send({
              answer: emptyAnswer,
              hints: emptyHints,
              difficulty: invalidDifficulty,
              creatorId: emptyCreatorId,
            })
            .expect(400);

          // Should have multiple errors (at least 3: answer, hints, difficulty, creatorId)
          expect(response.body.details.length).toBeGreaterThanOrEqual(3);

          // Each error should be actionable
          response.body.details.forEach((detail: any) => {
            expect(detail.field).toBeDefined();
            expect(detail.message).toBeDefined();
            expect(detail.code).toBeDefined();
            expect(detail.field.length).toBeGreaterThan(0);
            expect(detail.message.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});
