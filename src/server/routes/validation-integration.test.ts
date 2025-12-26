/**
 * Validation Integration Tests
 * Tests that validation middleware is properly integrated with routes
 * 
 * Requirements: 6.1, 6.2, 8.2, 9.1, 9.2, 9.3
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  getChallengeSchema,
  submitGuessSchema,
  paginationSchema,
  updateProfileSchema,
  fullChallengeCreationSchema,
  challengePreviewSchema,
  revealHintSchema,
} from '../validation/schemas.js';

describe('Validation Integration', () => {
  describe('Challenge Routes Validation', () => {
    it('should have getChallengeSchema for GET /api/challenges/:id', () => {
      // Verify schema exists and has correct structure
      expect(getChallengeSchema).toBeDefined();
      
      // Test valid input
      const validInput = {
        params: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
        },
      };
      
      const result = getChallengeSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID in getChallengeSchema', () => {
      const invalidInput = {
        params: {
          challengeId: 'not-a-uuid',
        },
      };
      
      const result = getChallengeSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('Attempt Routes Validation', () => {
    it('should have submitGuessSchema for POST /api/attempts/submit', () => {
      // Verify schema exists and has correct structure
      expect(submitGuessSchema).toBeDefined();
      
      // Test valid input (userId comes from server context, not request body)
      const validInput = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'My guess',
        },
      };
      
      const result = submitGuessSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject empty guess in submitGuessSchema', () => {
      const invalidInput = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: '',
        },
      };
      
      const result = submitGuessSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should trim whitespace from guess (XSS prevention)', () => {
      const inputWithWhitespace = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: '  My guess  ',
        },
      };
      
      const result = submitGuessSchema.parse(inputWithWhitespace);
      expect(result.body.guess).toBe('My guess');
    });
  });

  describe('Pagination Validation', () => {
    it('should have paginationSchema for list endpoints', () => {
      // Verify schema exists
      expect(paginationSchema).toBeDefined();
      
      // Test valid input with defaults
      const validInput = {};
      
      const result = paginationSchema.parse(validInput);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.order).toBe('desc');
    });

    it('should coerce string numbers to integers', () => {
      const inputWithStrings = {
        page: '2',
        limit: '50',
      };
      
      const result = paginationSchema.parse(inputWithStrings);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
      expect(typeof result.page).toBe('number');
      expect(typeof result.limit).toBe('number');
    });

    it('should reject invalid pagination values', () => {
      const invalidInputs = [
        { page: 0 },           // page must be positive
        { page: -1 },          // page must be positive
        { limit: 0 },          // limit must be at least 1
        { limit: 101 },        // limit must be at most 100
        { order: 'invalid' },  // order must be asc or desc
      ];
      
      invalidInputs.forEach(input => {
        const result = paginationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('User Routes Validation', () => {
    it('should have updateProfileSchema for PATCH /api/users/:userId', () => {
      // Verify schema exists
      expect(updateProfileSchema).toBeDefined();
      
      // Test valid input
      const validInput = {
        params: {
          userId: 'user123',
        },
        body: {
          username: 'john_doe',
          bio: 'Hello world',
        },
      };
      
      const result = updateProfileSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid username format', () => {
      const invalidInputs = [
        {
          params: { userId: 'user123' },
          body: { username: 'ab' }, // too short
        },
        {
          params: { userId: 'user123' },
          body: { username: 'john-doe' }, // invalid character
        },
        {
          params: { userId: 'user123' },
          body: { username: 'john doe' }, // space not allowed
        },
      ];
      
      invalidInputs.forEach(input => {
        const result = updateProfileSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    it('should require at least one field in update', () => {
      const emptyUpdate = {
        params: { userId: 'user123' },
        body: {},
      };
      
      const result = updateProfileSchema.safeParse(emptyUpdate);
      expect(result.success).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should provide TypeScript type inference', () => {
      // This test verifies that types are exported and can be used
      // The actual type checking happens at compile time
      // Note: userId is obtained from server context, not request body
      
      const validGuess = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'My guess',
        },
      };
      
      const parsed = submitGuessSchema.parse(validGuess);
      
      // TypeScript should know these properties exist
      expect(parsed.body.challengeId).toBeDefined();
      expect(parsed.body.guess).toBeDefined();
    });
  });

  describe('POST /api/challenges - Challenge Creation Validation', () => {
    it('should accept valid challenge creation data', () => {
      // Requirements: 6.1, 6.2, 9.1
      const validData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the City',
          image_url: 'https://example.com/image.jpg',
          tags: ['geography', 'cities'],
          correct_answer: 'Paris',
          max_score: 100,
          score_deduction_per_hint: 10,
        },
      };

      const result = fullChallengeCreationSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.body.title).toBe('Guess the City');
        expect(result.data.body.correct_answer).toBe('Paris');
        expect(result.data.body.tags).toHaveLength(2);
      }
    });

    it('should accept challenge with optional fields', () => {
      // Requirements: 6.1, 6.2, 9.1
      const validData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the Landmark',
          image_url: 'https://example.com/landmark.jpg',
          image_descriptions: ['A tall structure', 'Made of iron'],
          tags: ['landmarks'],
          correct_answer: 'Eiffel Tower',
          answer_explanation: 'The Eiffel Tower is located in Paris, France.',
          answer_set: {
            correct: ['Eiffel Tower', 'eiffel tower', 'Tour Eiffel'],
            close: ['Paris Tower', 'French Tower'],
          },
          max_score: 150,
          score_deduction_per_hint: 15,
        },
      };

      const result = fullChallengeCreationSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.body.image_descriptions).toHaveLength(2);
        expect(result.data.body.answer_explanation).toBe('The Eiffel Tower is located in Paris, France.');
        expect(result.data.body.answer_set).toBeDefined();
      }
    });

    it('should trim whitespace from title and answer', () => {
      // Requirements: 6.1, 6.2, 9.1
      const dataWithWhitespace = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: '  Guess the City  ',
          image_url: 'https://example.com/image.jpg',
          tags: ['geography'],
          correct_answer: '  Paris  ',
          max_score: 100,
          score_deduction_per_hint: 10,
        },
      };

      const result = fullChallengeCreationSchema.parse(dataWithWhitespace);
      expect(result.body.title).toBe('Guess the City');
      expect(result.body.correct_answer).toBe('Paris');
    });

    it('should reject invalid challenge creation data - empty title', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: '',
          image_url: 'https://example.com/image.jpg',
          tags: ['geography'],
          correct_answer: 'Paris',
          max_score: 100,
          score_deduction_per_hint: 10,
        },
      };

      const result = fullChallengeCreationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        expect(result.error.issues[0].path).toContain('title');
      }
    });

    it('should reject invalid challenge creation data - empty tags array', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the City',
          image_url: 'https://example.com/image.jpg',
          tags: [],
          correct_answer: 'Paris',
          max_score: 100,
          score_deduction_per_hint: 10,
        },
      };

      const result = fullChallengeCreationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        const tagError = result.error.issues.find(e => e.path.includes('tags'));
        expect(tagError).toBeDefined();
      }
    });

    it('should reject invalid challenge creation data - too many tags', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the City',
          image_url: 'https://example.com/image.jpg',
          tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10', 'tag11'],
          correct_answer: 'Paris',
          max_score: 100,
          score_deduction_per_hint: 10,
        },
      };

      const result = fullChallengeCreationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const tagError = result.error.issues.find(e => e.path.includes('tags'));
        expect(tagError).toBeDefined();
      }
    });

    it('should reject invalid challenge creation data - invalid URL', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the City',
          image_url: 'not-a-valid-url',
          tags: ['geography'],
          correct_answer: 'Paris',
          max_score: 100,
          score_deduction_per_hint: 10,
        },
      };

      const result = fullChallengeCreationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const urlError = result.error.issues.find(e => e.path.includes('image_url'));
        expect(urlError).toBeDefined();
      }
    });

    it('should reject invalid challenge creation data - negative max_score', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the City',
          image_url: 'https://example.com/image.jpg',
          tags: ['geography'],
          correct_answer: 'Paris',
          max_score: -100,
          score_deduction_per_hint: 10,
        },
      };

      const result = fullChallengeCreationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const scoreError = result.error.issues.find(e => e.path.includes('max_score'));
        expect(scoreError).toBeDefined();
      }
    });

    it('should reject invalid challenge creation data - negative score_deduction_per_hint', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the City',
          image_url: 'https://example.com/image.jpg',
          tags: ['geography'],
          correct_answer: 'Paris',
          max_score: 100,
          score_deduction_per_hint: -10,
        },
      };

      const result = fullChallengeCreationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const deductionError = result.error.issues.find(e => e.path.includes('score_deduction_per_hint'));
        expect(deductionError).toBeDefined();
      }
    });

    it('should verify error response format matches specification', () => {
      // Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5
      const invalidData = {
        body: {
          creator_id: '',
          creator_username: 'john_doe',
          title: '',
          image_url: 'not-a-url',
          tags: [],
          correct_answer: '',
          max_score: -100,
          score_deduction_per_hint: -10,
        },
      };

      const result = fullChallengeCreationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        // Verify error structure
        expect(result.error.issues).toBeInstanceOf(Array);
        expect(result.error.issues.length).toBeGreaterThan(0);
        
        // Each error should have path and message
        result.error.issues.forEach(error => {
          expect(error.path).toBeDefined();
          expect(error.message).toBeDefined();
          expect(typeof error.message).toBe('string');
        });
      }
    });
  });

  describe('POST /api/challenges/preview - Challenge Preview Validation', () => {
    it('should accept valid challenge preview data', () => {
      // Requirements: 6.1, 6.2, 9.1
      const validData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the City',
          image_url: 'https://example.com/image.jpg',
          tags: ['geography', 'cities'],
          correct_answer: 'Paris',
          max_score: 100,
          score_deduction_per_hint: 10,
        },
      };

      const result = challengePreviewSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.body.title).toBe('Guess the City');
        expect(result.data.body.correct_answer).toBe('Paris');
      }
    });

    it('should accept preview data with all optional fields', () => {
      // Requirements: 6.1, 6.2, 9.1
      const validData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the Landmark',
          image_url: 'https://example.com/landmark.jpg',
          image_descriptions: ['A tall structure', 'Made of iron'],
          tags: ['landmarks', 'europe'],
          correct_answer: 'Eiffel Tower',
          answer_explanation: 'The Eiffel Tower is in Paris.',
          answer_set: {
            correct: ['Eiffel Tower', 'eiffel tower'],
            close: ['Paris Tower'],
          },
          max_score: 150,
          score_deduction_per_hint: 15,
        },
      };

      const result = challengePreviewSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid preview data - missing required fields', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          creator_id: 'user123',
          // Missing creator_username
          title: 'Guess the City',
          image_url: 'https://example.com/image.jpg',
          tags: ['geography'],
          correct_answer: 'Paris',
          max_score: 100,
          score_deduction_per_hint: 10,
        },
      };

      const result = challengePreviewSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const usernameError = result.error.issues.find(e => e.path.includes('creator_username'));
        expect(usernameError).toBeDefined();
      }
    });

    it('should reject invalid preview data - invalid data types', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: 'Guess the City',
          image_url: 'https://example.com/image.jpg',
          tags: ['geography'],
          correct_answer: 'Paris',
          max_score: 'not-a-number', // Should be number
          score_deduction_per_hint: 10,
        },
      };

      const result = challengePreviewSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const scoreError = result.error.issues.find(e => e.path.includes('max_score'));
        expect(scoreError).toBeDefined();
      }
    });

    it('should trim whitespace from preview data', () => {
      // Requirements: 6.1, 6.2, 9.1
      const dataWithWhitespace = {
        body: {
          creator_id: 'user123',
          creator_username: 'john_doe',
          title: '  Guess the City  ',
          image_url: 'https://example.com/image.jpg',
          tags: ['  geography  '],
          correct_answer: '  Paris  ',
          max_score: 100,
          score_deduction_per_hint: 10,
        },
      };

      const result = challengePreviewSchema.parse(dataWithWhitespace);
      expect(result.body.title).toBe('Guess the City');
      expect(result.body.correct_answer).toBe('Paris');
      expect(result.body.tags[0]).toBe('geography');
    });
  });

  describe('POST /api/attempts/hint - Hint Reveal Validation', () => {
    it('should accept valid hint reveal data', () => {
      // Requirements: 6.1, 6.2, 9.1
      const validData = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          imageIndex: 0,
          hintCost: 10,
        },
      };

      const result = revealHintSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.body.challengeId).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.data.body.imageIndex).toBe(0);
        expect(result.data.body.hintCost).toBe(10);
      }
    });

    it('should accept hint reveal with various valid values', () => {
      // Requirements: 6.1, 6.2, 9.1
      const testCases = [
        { imageIndex: 0, hintCost: 0 },
        { imageIndex: 1, hintCost: 5 },
        { imageIndex: 3, hintCost: 20 },
        { imageIndex: 10, hintCost: 100 },
      ];

      testCases.forEach(testCase => {
        const validData = {
          body: {
            challengeId: '550e8400-e29b-41d4-a716-446655440000',
            ...testCase,
          },
        };

        const result = revealHintSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid hint reveal data - invalid UUID', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          challengeId: 'not-a-uuid',
          imageIndex: 0,
          hintCost: 10,
        },
      };

      const result = revealHintSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const uuidError = result.error.issues.find(e => e.path.includes('challengeId'));
        expect(uuidError).toBeDefined();
      }
    });

    it('should reject invalid hint reveal data - negative imageIndex', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          imageIndex: -1,
          hintCost: 10,
        },
      };

      const result = revealHintSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const indexError = result.error.issues.find(e => e.path.includes('imageIndex'));
        expect(indexError).toBeDefined();
      }
    });

    it('should reject invalid hint reveal data - negative hintCost', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          imageIndex: 0,
          hintCost: -10,
        },
      };

      const result = revealHintSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const costError = result.error.issues.find(e => e.path.includes('hintCost'));
        expect(costError).toBeDefined();
      }
    });

    it('should reject invalid hint reveal data - non-integer imageIndex', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          imageIndex: 1.5,
          hintCost: 10,
        },
      };

      const result = revealHintSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const indexError = result.error.issues.find(e => e.path.includes('imageIndex'));
        expect(indexError).toBeDefined();
      }
    });

    it('should reject invalid hint reveal data - non-integer hintCost', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          imageIndex: 0,
          hintCost: 10.5,
        },
      };

      const result = revealHintSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const costError = result.error.issues.find(e => e.path.includes('hintCost'));
        expect(costError).toBeDefined();
      }
    });

    it('should reject invalid hint reveal data - missing required fields', () => {
      // Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
      const invalidData = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          // Missing imageIndex and hintCost
        },
      };

      const result = revealHintSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
        const indexError = result.error.issues.find(e => e.path.includes('imageIndex'));
        const costError = result.error.issues.find(e => e.path.includes('hintCost'));
        expect(indexError).toBeDefined();
        expect(costError).toBeDefined();
      }
    });

    it('should verify error response format for hint reveal', () => {
      // Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5
      const invalidData = {
        body: {
          challengeId: 'not-a-uuid',
          imageIndex: -1,
          hintCost: -10,
        },
      };

      const result = revealHintSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        // Verify error structure
        expect(result.error.issues).toBeInstanceOf(Array);
        expect(result.error.issues.length).toBeGreaterThan(0);
        
        // Each error should have path and message
        result.error.issues.forEach(error => {
          expect(error.path).toBeDefined();
          expect(error.message).toBeDefined();
          expect(typeof error.message).toBe('string');
        });
      }
    });
  });
});
