/**
 * Validation schemas for API request validation
 * 
 * This file contains Zod schemas for validating incoming requests
 * to ensure data integrity and security.
 */

import { z } from 'zod';

/**
 * User ID schema
 * 
 * Validates user identifiers from Reddit/Devvit platform.
 * User IDs must be non-empty strings with a maximum length of 100 characters.
 * 
 * @example
 * userIdSchema.parse('user123') // ✓ Valid
 * userIdSchema.parse('') // ✗ Invalid: too short
 * userIdSchema.parse('a'.repeat(101)) // ✗ Invalid: too long
 */
export const userIdSchema = z.string().min(1).max(100);

/**
 * UUID schema
 * 
 * Validates UUID v4 format strings used for challenge IDs and other entities.
 * Must conform to standard UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * 
 * @example
 * uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000') // ✓ Valid
 * uuidSchema.parse('not-a-uuid') // ✗ Invalid: wrong format
 */
export const uuidSchema = z.string().uuid();

/**
 * Pagination schema
 * 
 * Validates pagination parameters for list endpoints.
 * Provides sensible defaults and constraints to prevent abuse.
 * 
 * Fields:
 * - page: Current page number (positive integer, default: 1)
 * - limit: Items per page (1-100, default: 20)
 * - sortBy: Field to sort by (optional)
 * - order: Sort direction (asc/desc, default: desc)
 * 
 * @example
 * paginationSchema.parse({ page: '1', limit: '20' }) // ✓ Valid
 * paginationSchema.parse({}) // ✓ Valid: uses defaults
 * paginationSchema.parse({ page: '0' }) // ✗ Invalid: page must be positive
 * paginationSchema.parse({ limit: '200' }) // ✗ Invalid: limit too high
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['created_at', 'points', 'level']).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Challenge creation schema
 * 
 * Validates data for creating a new challenge.
 * Ensures all required fields are present and meet constraints.
 * 
 * Fields:
 * - answer: The correct answer (1-200 chars, trimmed)
 * - hints: Array of 1-4 hint strings (each 1-500 chars, trimmed)
 * - difficulty: Challenge difficulty level (easy/medium/hard)
 * - creatorId: ID of the user creating the challenge
 * 
 * @example
 * createChallengeSchema.parse({
 *   body: {
 *     answer: 'Paris',
 *     hints: ['Capital city', 'In France'],
 *     difficulty: 'easy',
 *     creatorId: 'user123'
 *   }
 * }) // ✓ Valid
 * 
 * createChallengeSchema.parse({
 *   body: {
 *     answer: '',
 *     hints: [],
 *     difficulty: 'invalid',
 *     creatorId: 'user123'
 *   }
 * }) // ✗ Invalid: empty answer, empty hints, invalid difficulty
 */
export const createChallengeSchema = z.object({
  body: z.object({
    answer: z.string().min(1).max(200).refine(
      (val) => val.trim().length > 0,
      { message: 'Answer cannot be empty or only whitespace' }
    ).transform((val) => val.trim()),
    hints: z.array(
      z.string().min(1).max(500).refine(
        (val) => val.trim().length > 0,
        { message: 'Hint cannot be empty or only whitespace' }
      ).transform((val) => val.trim())
    ).min(1).max(4),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    creatorId: userIdSchema,
  }),
});

/**
 * Challenge retrieval schema
 * 
 * Validates parameters for retrieving a specific challenge.
 * 
 * Fields:
 * - challengeId: UUID of the challenge to retrieve
 * 
 * @example
 * getChallengeSchema.parse({
 *   params: {
 *     challengeId: '550e8400-e29b-41d4-a716-446655440000'
 *   }
 * }) // ✓ Valid
 * 
 * getChallengeSchema.parse({
 *   params: {
 *     challengeId: 'not-a-uuid'
 *   }
 * }) // ✗ Invalid: not a valid UUID
 */
export const getChallengeSchema = z.object({
  params: z.object({
    challengeId: uuidSchema,
  }),
});

/**
 * Guess submission schema
 * 
 * Validates data for submitting a guess to a challenge.
 * Includes XSS prevention through string trimming.
 * 
 * Fields:
 * - challengeId: UUID of the challenge being attempted
 * - guess: The user's guess (1-200 chars, trimmed for XSS prevention)
 * 
 * Note: userId is obtained from server context, not from request body
 * 
 * @example
 * submitGuessSchema.parse({
 *   body: {
 *     challengeId: '550e8400-e29b-41d4-a716-446655440000',
 *     guess: 'Paris'
 *   }
 * }) // ✓ Valid
 * 
 * submitGuessSchema.parse({
 *   body: {
 *     challengeId: 'not-a-uuid',
 *     guess: ''
 *   }
 * }) // ✗ Invalid: not a UUID, empty guess
 */
export const submitGuessSchema = z.object({
  body: z.object({
    challengeId: uuidSchema,
    guess: z.string().min(1).max(200).refine(
      (val) => val.trim().length > 0,
      { message: 'Guess cannot be empty or only whitespace' }
    ).transform((val) => val.trim()),
  }),
});

/**
 * User profile update schema
 * 
 * Validates data for updating a user's profile.
 * At least one field must be provided for the update.
 * 
 * Fields:
 * - username: Alphanumeric username with underscores (3-30 chars, optional)
 * - bio: User biography text (max 500 chars, optional)
 * 
 * Constraints:
 * - Username must match pattern: ^[a-zA-Z0-9_]+$
 * - At least one field must be provided
 * 
 * @example
 * updateProfileSchema.parse({
 *   params: { userId: 'user123' },
 *   body: { username: 'john_doe', bio: 'Hello world' }
 * }) // ✓ Valid
 * 
 * updateProfileSchema.parse({
 *   params: { userId: 'user123' },
 *   body: { username: 'ab' }
 * }) // ✗ Invalid: username too short
 * 
 * updateProfileSchema.parse({
 *   params: { userId: 'user123' },
 *   body: { username: 'john-doe' }
 * }) // ✗ Invalid: username contains invalid character (-)
 * 
 * updateProfileSchema.parse({
 *   params: { userId: 'user123' },
 *   body: {}
 * }) // ✗ Invalid: no fields provided
 */
export const updateProfileSchema = z.object({
  params: z.object({
    userId: userIdSchema,
  }),
  body: z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
    bio: z.string().max(500).optional(),
  }).refine(
    (data) => Object.keys(data).length > 0 && (data.username !== undefined || data.bio !== undefined),
    { message: 'At least one field must be provided' }
  ),
});

/**
 * Full challenge creation schema
 * 
 * Validates data for creating a complete challenge with all fields.
 * This is used for the POST /api/challenges endpoint.
 * 
 * Fields:
 * - creator_id: ID of the user creating the challenge
 * - creator_username: Username of the creator
 * - title: Challenge title (1-200 chars, trimmed)
 * - image_url: URL of the challenge image
 * - image_descriptions: Optional array of image descriptions (max 500 chars each)
 * - tags: Array of tags (1-10 tags, each 1-50 chars)
 * - correct_answer: The correct answer (1-200 chars, trimmed)
 * - answer_explanation: Optional explanation of the answer (max 1000 chars)
 * - answer_set: Optional pre-generated answer sets for validation
 * - max_score: Maximum score for the challenge (positive integer)
 * - score_deduction_per_hint: Points deducted per hint (non-negative integer)
 * 
 * @example
 * fullChallengeCreationSchema.parse({
 *   body: {
 *     creator_id: 'user123',
 *     creator_username: 'john_doe',
 *     title: 'Guess the City',
 *     image_url: 'https://example.com/image.jpg',
 *     tags: ['geography', 'cities'],
 *     correct_answer: 'Paris',
 *     max_score: 100,
 *     score_deduction_per_hint: 10
 *   }
 * }) // ✓ Valid
 */
export const fullChallengeCreationSchema = z.object({
  body: z.object({
    // creator_id and creator_username are optional - server sets them from context
    creator_id: z.string().optional().default(''),
    creator_username: z.string().optional().default(''),
    title: z.string().min(1).max(200).refine(
      (val) => val.trim().length > 0,
      { message: 'Title cannot be empty or only whitespace' }
    ).transform((val) => val.trim()),
    // Accept comma-separated URLs (2-3 images required)
    image_url: z.string().min(1).refine(
      (val) => {
        const urls = val.split(',').map(u => u.trim()).filter(u => u.length > 0);
        if (urls.length < 2 || urls.length > 3) return false;
        // Validate each URL
        return urls.every(url => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        });
      },
      { message: 'Must provide 2-3 valid image URLs separated by commas' }
    ),
    image_descriptions: z.array(
      z.string().max(500).refine(
        (val) => val.trim().length > 0,
        { message: 'Image description cannot be empty or only whitespace' }
      ).transform((val) => val.trim())
    ).optional(),
    tags: z.array(
      z.string().min(1).max(50).refine(
        (val) => val.trim().length > 0,
        { message: 'Tag cannot be empty or only whitespace' }
      ).transform((val) => val.trim())
    ).min(1).max(10),
    correct_answer: z.string().min(1).max(200).refine(
      (val) => val.trim().length > 0,
      { message: 'Answer cannot be empty or only whitespace' }
    ).transform((val) => val.trim()),
    answer_explanation: z.string().max(1000).optional(),
    answer_set: z.object({
      correct: z.array(z.string().min(1).max(200)),
      close: z.array(z.string().min(1).max(200)),
    }).optional(),
    max_score: z.number().int().positive(),
    score_deduction_per_hint: z.number().int().nonnegative(),
  }),
});

/**
 * Challenge preview schema
 * 
 * Validates data for generating a challenge preview/answer set.
 * This is used for the POST /api/challenges/preview endpoint.
 * 
 * Note: creator_id and creator_username are optional here because they
 * are set by the server from the authenticated user context.
 * 
 * @example
 * challengePreviewSchema.parse({
 *   body: {
 *     title: 'Guess the City',
 *     image_url: 'https://example.com/img1.jpg,https://example.com/img2.jpg',
 *     tags: ['geography'],
 *     correct_answer: 'Paris',
 *     max_score: 100,
 *     score_deduction_per_hint: 10
 *   }
 * }) // ✓ Valid
 */
export const challengePreviewSchema = z.object({
  body: z.object({
    // creator_id and creator_username are optional - server sets them from context
    creator_id: z.string().optional().default(''),
    creator_username: z.string().optional().default(''),
    title: z.string().min(1).max(200).refine(
      (val) => val.trim().length > 0,
      { message: 'Title cannot be empty or only whitespace' }
    ).transform((val) => val.trim()),
    // Accept comma-separated URLs (2-3 images required)
    image_url: z.string().min(1).refine(
      (val) => {
        const urls = val.split(',').map(u => u.trim()).filter(u => u.length > 0);
        if (urls.length < 2 || urls.length > 3) return false;
        // Validate each URL
        return urls.every(url => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        });
      },
      { message: 'Must provide 2-3 valid image URLs separated by commas' }
    ),
    image_descriptions: z.array(
      z.string().max(500).refine(
        (val) => val.trim().length > 0,
        { message: 'Image description cannot be empty or only whitespace' }
      ).transform((val) => val.trim())
    ).optional(),
    tags: z.array(
      z.string().min(1).max(50).refine(
        (val) => val.trim().length > 0,
        { message: 'Tag cannot be empty or only whitespace' }
      ).transform((val) => val.trim())
    ).min(1).max(10),
    correct_answer: z.string().min(1).max(200).refine(
      (val) => val.trim().length > 0,
      { message: 'Answer cannot be empty or only whitespace' }
    ).transform((val) => val.trim()),
    answer_explanation: z.string().max(1000).optional(),
    answer_set: z.object({
      correct: z.array(z.string().min(1).max(200)),
      close: z.array(z.string().min(1).max(200)),
    }).optional(),
    max_score: z.number().int().positive(),
    score_deduction_per_hint: z.number().int().nonnegative(),
  }),
});

/**
 * Hint reveal schema
 * 
 * Validates data for revealing a hint during gameplay.
 * This is used for the POST /api/attempts/hint endpoint.
 * 
 * Fields:
 * - challengeId: UUID of the challenge
 * - imageIndex: Index of the image to reveal (non-negative integer)
 * - hintCost: Cost in points to reveal the hint (non-negative integer)
 * 
 * @example
 * revealHintSchema.parse({
 *   body: {
 *     challengeId: '550e8400-e29b-41d4-a716-446655440000',
 *     imageIndex: 0,
 *     hintCost: 10
 *   }
 * }) // ✓ Valid
 * 
 * revealHintSchema.parse({
 *   body: {
 *     challengeId: 'not-a-uuid',
 *     imageIndex: -1,
 *     hintCost: -5
 *   }
 * }) // ✗ Invalid: not a UUID, negative index, negative cost
 */
export const revealHintSchema = z.object({
  body: z.object({
    challengeId: uuidSchema,
    imageIndex: z.number().int().nonnegative(),
    hintCost: z.number().int().nonnegative(),
  }),
});

// Type inference exports
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type GetChallengeInput = z.infer<typeof getChallengeSchema>;
export type SubmitGuessInput = z.infer<typeof submitGuessSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type FullChallengeCreationInput = z.infer<typeof fullChallengeCreationSchema>;
export type ChallengePreviewInput = z.infer<typeof challengePreviewSchema>;
export type RevealHintInput = z.infer<typeof revealHintSchema>;
