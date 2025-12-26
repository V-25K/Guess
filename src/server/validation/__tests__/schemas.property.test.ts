/**
 * Property-based tests for base validation schemas
 * 
 * These tests verify universal properties that should hold across all inputs.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { 
  userIdSchema, 
  uuidSchema, 
  paginationSchema,
  createChallengeSchema,
  getChallengeSchema,
  submitGuessSchema
} from '../schemas';

describe('Base Schema Properties', () => {
  /**
   * Feature: request-validation, Property 1: Valid inputs always pass validation
   * Validates: Requirements 1.1, 5.1-5.4
   */
  describe('Property 1: Valid inputs always pass validation', () => {
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

    it('should accept pagination with string numbers (coercion)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 100 }),
          (page, limit) => {
            const input = {
              page: String(page),
              limit: String(limit),
            };
            
            const result = paginationSchema.safeParse(input);
            expect(result.success).toBe(true);
            
            if (result.success) {
              expect(result.data.page).toBe(page);
              expect(result.data.limit).toBe(limit);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default values when pagination fields are omitted', () => {
      fc.assert(
        fc.property(
          fc.record({
            page: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
            limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
            sortBy: fc.option(fc.constantFrom('created_at', 'points', 'level'), { nil: undefined }),
            order: fc.option(fc.constantFrom('asc', 'desc'), { nil: undefined }),
          }),
          (input) => {
            // Remove undefined values to test defaults
            const cleanInput = Object.fromEntries(
              Object.entries(input).filter(([_, v]) => v !== undefined)
            );
            
            const result = paginationSchema.safeParse(cleanInput);
            expect(result.success).toBe(true);
            
            if (result.success) {
              // Check defaults are applied
              expect(result.data.page).toBeDefined();
              expect(result.data.limit).toBeDefined();
              expect(result.data.order).toBeDefined();
              
              // If input had values, they should be preserved
              if (input.page !== undefined) {
                expect(result.data.page).toBe(input.page);
              } else {
                expect(result.data.page).toBe(1); // default
              }
              
              if (input.limit !== undefined) {
                expect(result.data.limit).toBe(input.limit);
              } else {
                expect(result.data.limit).toBe(20); // default
              }
              
              if (input.order !== undefined) {
                expect(result.data.order).toBe(input.order);
              } else {
                expect(result.data.order).toBe('desc'); // default
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Invalid inputs always fail validation
   * This helps ensure our schemas properly reject bad data
   */
  describe('Property: Invalid inputs always fail validation', () => {
    it('should reject user IDs that are too long', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 101, maxLength: 200 }),
          (tooLongId) => {
            const result = userIdSchema.safeParse(tooLongId);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject empty user IDs', () => {
      const result = userIdSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject non-UUID strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
          (nonUuid) => {
            const result = uuidSchema.safeParse(nonUuid);
            expect(result.success).toBe(false);
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
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


describe('Challenge Schema Properties', () => {
  /**
   * Feature: request-validation, Property 2: Invalid inputs always fail validation
   * Validates: Requirements 2.1-2.5
   */
  describe('Property 2: Invalid inputs always fail validation', () => {
    it('should reject empty answer strings', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 1, maxLength: 100 }),
          (hints, difficulty, creatorId) => {
            const input = {
              body: {
                answer: '', // Invalid: empty
                hints,
                difficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
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
                hints: [], // Invalid: empty array
                difficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
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
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject hints with empty strings', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 0, maxLength: 3 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 1, maxLength: 100 }),
          (answer, validHints, difficulty, creatorId) => {
            // Add an empty string to the hints array
            const hintsWithEmpty = [...validHints, ''];
            
            const input = {
              body: {
                answer,
                hints: hintsWithEmpty,
                difficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject hints over 500 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.string({ minLength: 501, maxLength: 1000 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 1, maxLength: 100 }),
          (answer, tooLongHint, difficulty, creatorId) => {
            const input = {
              body: {
                answer,
                hints: [tooLongHint],
                difficulty,
                creatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
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
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid creatorId (empty)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          (answer, hints, difficulty) => {
            const input = {
              body: {
                answer,
                hints,
                difficulty,
                creatorId: '', // Invalid: empty
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid creatorId (too long)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 4 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 101, maxLength: 200 }),
          (answer, hints, difficulty, tooLongCreatorId) => {
            const input = {
              body: {
                answer,
                hints,
                difficulty,
                creatorId: tooLongCreatorId,
              },
            };
            
            const result = createChallengeSchema.safeParse(input);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-UUID challengeId in getChallengeSchema', () => {
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
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Valid inputs always pass validation
   * Ensures that all valid challenge data is accepted
   */
  describe('Property: Valid challenge inputs always pass validation', () => {
    it('should accept all valid challenge creation inputs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          fc.array(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 4 }),
          fc.constantFrom('easy', 'medium', 'hard'),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
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
              // Verify trimming is applied
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

    it('should accept all valid UUID challengeIds', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (uuid) => {
            const input = {
              params: {
                challengeId: uuid,
              },
            };
            
            const result = getChallengeSchema.safeParse(input);
            expect(result.success).toBe(true);
            
            if (result.success) {
              expect(result.data.params.challengeId).toBe(uuid);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


describe('Guess Submission Schema Properties', () => {
  /**
   * Feature: request-validation, Property 6: Schema transformations are applied
   * Validates: Requirements 3.4
   * Note: userId is obtained from server context, not request body
   */
  describe('Property 6: Schema transformations are applied', () => {
    it('should trim leading and trailing whitespace from guess', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.nat({ max: 10 }),
          fc.nat({ max: 10 }),
          (challengeId, guess, leadingSpaces, trailingSpaces) => {
            // Add whitespace to the guess
            const whitespaceGuess = ' '.repeat(leadingSpaces) + guess + ' '.repeat(trailingSpaces);
            
            const input = {
              body: {
                challengeId,
                guess: whitespaceGuess,
              },
            };
            
            const result = submitGuessSchema.safeParse(input);
            
            // Should succeed if the trimmed guess is valid
            const trimmedGuess = guess.trim();
            if (trimmedGuess.length >= 1 && trimmedGuess.length <= 200) {
              expect(result.success).toBe(true);
              
              if (result.success) {
                // Verify trimming was applied
                expect(result.data.body.guess).toBe(trimmedGuess);
                // Ensure no leading/trailing whitespace
                expect(result.data.body.guess).toBe(result.data.body.guess.trim());
                expect(result.data.body.guess.startsWith(' ')).toBe(false);
                expect(result.data.body.guess.endsWith(' ')).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trim whitespace while preserving internal spaces', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          (challengeId, word1, word2) => {
            // Create a guess with internal spaces
            const guessWithInternalSpaces = `${word1} ${word2}`;
            const guessWithWhitespace = `  ${guessWithInternalSpaces}  `;
            
            const input = {
              body: {
                challengeId,
                guess: guessWithWhitespace,
              },
            };
            
            const result = submitGuessSchema.safeParse(input);
            
            // Check if the trimmed version is valid
            const trimmedGuess = guessWithInternalSpaces.trim();
            if (trimmedGuess.length >= 1 && trimmedGuess.length <= 200) {
              expect(result.success).toBe(true);
              
              if (result.success) {
                // Should preserve internal space (both words have content after trim)
                expect(result.data.body.guess).toBe(trimmedGuess);
                expect(result.data.body.guess).toContain(' ');
                // But no leading/trailing whitespace
                expect(result.data.body.guess.startsWith(' ')).toBe(false);
                expect(result.data.body.guess.endsWith(' ')).toBe(false);
              }
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
          fc.stringMatching(/^\s+$/), // Only whitespace characters
          (challengeId, whitespaceOnly) => {
            const input = {
              body: {
                challengeId,
                guess: whitespaceOnly,
              },
            };
            
            const result = submitGuessSchema.safeParse(input);
            
            // Should fail because trimmed guess is empty
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept all valid guess submissions with trimming', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
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
              // Verify all fields are present and trimmed
              expect(result.data.body.challengeId).toBe(challengeId);
              expect(result.data.body.guess).toBe(guess.trim());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid guess submissions', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Invalid challengeId (not UUID)
            fc.record({
              challengeId: fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
              guess: fc.string({ minLength: 1, maxLength: 200 }),
            }),
            // Invalid guess (too long)
            fc.record({
              challengeId: fc.uuid(),
              guess: fc.string({ minLength: 201, maxLength: 500 }),
            }),
            // Invalid guess (empty)
            fc.record({
              challengeId: fc.uuid(),
              guess: fc.constant(''),
            })
          ),
          (invalidData) => {
            const input = {
              body: invalidData,
            };
            
            const result = submitGuessSchema.safeParse(input);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
