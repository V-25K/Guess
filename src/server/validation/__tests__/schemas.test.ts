/**
 * Unit tests for base validation schemas
 */

import { describe, it, expect } from 'vitest';
import { 
  userIdSchema, 
  uuidSchema, 
  paginationSchema,
  createChallengeSchema,
  getChallengeSchema,
  submitGuessSchema,
  updateProfileSchema
} from '../schemas';
import { ZodError } from 'zod';

describe('userIdSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid user IDs', () => {
      expect(() => userIdSchema.parse('user123')).not.toThrow();
      expect(() => userIdSchema.parse('t2_abc123')).not.toThrow();
      expect(() => userIdSchema.parse('a')).not.toThrow();
    });

    it('should accept user IDs at max length (100 chars)', () => {
      const maxLengthId = 'a'.repeat(100);
      expect(() => userIdSchema.parse(maxLengthId)).not.toThrow();
    });
  });

  describe('invalid inputs', () => {
    it('should reject empty strings', () => {
      expect(() => userIdSchema.parse('')).toThrow(ZodError);
    });

    it('should reject user IDs over 100 characters', () => {
      const tooLongId = 'a'.repeat(101);
      expect(() => userIdSchema.parse(tooLongId)).toThrow(ZodError);
    });

    it('should reject non-string values', () => {
      expect(() => userIdSchema.parse(123)).toThrow(ZodError);
      expect(() => userIdSchema.parse(null)).toThrow(ZodError);
      expect(() => userIdSchema.parse(undefined)).toThrow(ZodError);
    });
  });
});

describe('uuidSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid UUID v4 format', () => {
      expect(() => uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
      expect(() => uuidSchema.parse('123e4567-e89b-12d3-a456-426614174000')).not.toThrow();
    });
  });

  describe('invalid inputs', () => {
    it('should reject non-UUID strings', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow(ZodError);
      expect(() => uuidSchema.parse('12345')).toThrow(ZodError);
    });

    it('should reject malformed UUIDs', () => {
      expect(() => uuidSchema.parse('550e8400-e29b-41d4-a716')).toThrow(ZodError);
      expect(() => uuidSchema.parse('550e8400e29b41d4a716446655440000')).toThrow(ZodError);
    });

    it('should reject non-string values', () => {
      expect(() => uuidSchema.parse(123)).toThrow(ZodError);
      expect(() => uuidSchema.parse(null)).toThrow(ZodError);
    });
  });
});

describe('paginationSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid pagination parameters', () => {
      const result = paginationSchema.parse({ page: 1, limit: 20 });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should accept string numbers and coerce them', () => {
      const result = paginationSchema.parse({ page: '2', limit: '50' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should accept optional sortBy and order', () => {
      const result = paginationSchema.parse({
        page: 1,
        limit: 10,
        sortBy: 'points',
        order: 'asc',
      });
      expect(result.sortBy).toBe('points');
      expect(result.order).toBe('asc');
    });

    it('should accept pagination at boundaries', () => {
      const minResult = paginationSchema.parse({ page: 1, limit: 1 });
      expect(minResult.limit).toBe(1);

      const maxResult = paginationSchema.parse({ page: 1, limit: 100 });
      expect(maxResult.limit).toBe(100);
    });
  });

  describe('default values', () => {
    it('should use default page (1) when not provided', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
    });

    it('should use default limit (20) when not provided', () => {
      const result = paginationSchema.parse({});
      expect(result.limit).toBe(20);
    });

    it('should use default order (desc) when not provided', () => {
      const result = paginationSchema.parse({});
      expect(result.order).toBe('desc');
    });

    it('should leave sortBy undefined when not provided', () => {
      const result = paginationSchema.parse({});
      expect(result.sortBy).toBeUndefined();
    });
  });

  describe('invalid inputs', () => {
    it('should reject page of 0 or negative', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow(ZodError);
      expect(() => paginationSchema.parse({ page: -1 })).toThrow(ZodError);
    });

    it('should reject limit below 1', () => {
      expect(() => paginationSchema.parse({ limit: 0 })).toThrow(ZodError);
      expect(() => paginationSchema.parse({ limit: -5 })).toThrow(ZodError);
    });

    it('should reject limit above 100', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow(ZodError);
      expect(() => paginationSchema.parse({ limit: 200 })).toThrow(ZodError);
    });

    it('should reject non-integer page values', () => {
      expect(() => paginationSchema.parse({ page: 1.5 })).toThrow(ZodError);
    });

    it('should reject non-integer limit values', () => {
      expect(() => paginationSchema.parse({ limit: 20.7 })).toThrow(ZodError);
    });

    it('should reject invalid sortBy values', () => {
      expect(() => paginationSchema.parse({ sortBy: 'invalid_field' })).toThrow(ZodError);
    });

    it('should reject invalid order values', () => {
      expect(() => paginationSchema.parse({ order: 'invalid' })).toThrow(ZodError);
    });
  });
});

describe('createChallengeSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid challenge creation data', () => {
      const validData = {
        body: {
          answer: 'Paris',
          hints: ['Capital city', 'In France'],
          difficulty: 'easy' as const,
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(validData)).not.toThrow();
    });

    it('should accept all difficulty levels', () => {
      const difficulties = ['easy', 'medium', 'hard'] as const;
      
      difficulties.forEach(difficulty => {
        const data = {
          body: {
            answer: 'Test Answer',
            hints: ['Hint 1'],
            difficulty,
            creatorId: 'user123',
          },
        };
        
        expect(() => createChallengeSchema.parse(data)).not.toThrow();
      });
    });

    it('should accept 1 to 4 hints', () => {
      const testCases = [
        ['Hint 1'],
        ['Hint 1', 'Hint 2'],
        ['Hint 1', 'Hint 2', 'Hint 3'],
        ['Hint 1', 'Hint 2', 'Hint 3', 'Hint 4'],
      ];
      
      testCases.forEach(hints => {
        const data = {
          body: {
            answer: 'Test Answer',
            hints,
            difficulty: 'medium' as const,
            creatorId: 'user123',
          },
        };
        
        expect(() => createChallengeSchema.parse(data)).not.toThrow();
      });
    });

    it('should trim whitespace from answer and hints', () => {
      const data = {
        body: {
          answer: '  Paris  ',
          hints: ['  Capital city  ', '  In France  '],
          difficulty: 'easy' as const,
          creatorId: 'user123',
        },
      };
      
      const result = createChallengeSchema.parse(data);
      expect(result.body.answer).toBe('Paris');
      expect(result.body.hints[0]).toBe('Capital city');
      expect(result.body.hints[1]).toBe('In France');
    });

    it('should accept answer at max length (200 chars)', () => {
      const data = {
        body: {
          answer: 'a'.repeat(200),
          hints: ['Hint 1'],
          difficulty: 'hard' as const,
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).not.toThrow();
    });

    it('should accept hints at max length (500 chars each)', () => {
      const data = {
        body: {
          answer: 'Test Answer',
          hints: ['a'.repeat(500)],
          difficulty: 'medium' as const,
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).not.toThrow();
    });
  });

  describe('invalid inputs', () => {
    it('should reject empty answer', () => {
      const data = {
        body: {
          answer: '',
          hints: ['Hint 1'],
          difficulty: 'easy' as const,
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject answer over 200 characters', () => {
      const data = {
        body: {
          answer: 'a'.repeat(201),
          hints: ['Hint 1'],
          difficulty: 'easy' as const,
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject empty hints array', () => {
      const data = {
        body: {
          answer: 'Test Answer',
          hints: [],
          difficulty: 'easy' as const,
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject more than 4 hints', () => {
      const data = {
        body: {
          answer: 'Test Answer',
          hints: ['Hint 1', 'Hint 2', 'Hint 3', 'Hint 4', 'Hint 5'],
          difficulty: 'easy' as const,
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject hints with empty strings', () => {
      const data = {
        body: {
          answer: 'Test Answer',
          hints: ['Hint 1', ''],
          difficulty: 'easy' as const,
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject hints over 500 characters', () => {
      const data = {
        body: {
          answer: 'Test Answer',
          hints: ['a'.repeat(501)],
          difficulty: 'easy' as const,
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid difficulty enum', () => {
      const data = {
        body: {
          answer: 'Test Answer',
          hints: ['Hint 1'],
          difficulty: 'invalid',
          creatorId: 'user123',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid creatorId (empty string)', () => {
      const data = {
        body: {
          answer: 'Test Answer',
          hints: ['Hint 1'],
          difficulty: 'easy' as const,
          creatorId: '',
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid creatorId (too long)', () => {
      const data = {
        body: {
          answer: 'Test Answer',
          hints: ['Hint 1'],
          difficulty: 'easy' as const,
          creatorId: 'a'.repeat(101),
        },
      };
      
      expect(() => createChallengeSchema.parse(data)).toThrow(ZodError);
    });
  });
});

describe('getChallengeSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid UUID challengeId', () => {
      const data = {
        params: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
        },
      };
      
      expect(() => getChallengeSchema.parse(data)).not.toThrow();
    });

    it('should accept various valid UUID formats', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '00000000-0000-0000-0000-000000000000',
      ];
      
      validUUIDs.forEach(uuid => {
        const data = {
          params: {
            challengeId: uuid,
          },
        };
        
        expect(() => getChallengeSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('invalid inputs', () => {
    it('should reject non-UUID challengeId', () => {
      const data = {
        params: {
          challengeId: 'not-a-uuid',
        },
      };
      
      expect(() => getChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject malformed UUID', () => {
      const data = {
        params: {
          challengeId: '550e8400-e29b-41d4-a716',
        },
      };
      
      expect(() => getChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject UUID without hyphens', () => {
      const data = {
        params: {
          challengeId: '550e8400e29b41d4a716446655440000',
        },
      };
      
      expect(() => getChallengeSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject empty string', () => {
      const data = {
        params: {
          challengeId: '',
        },
      };
      
      expect(() => getChallengeSchema.parse(data)).toThrow(ZodError);
    });
  });
});

describe('submitGuessSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid guess submission', () => {
      const validData = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'Paris',
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(validData)).not.toThrow();
    });

    it('should accept guess at max length (200 chars)', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'a'.repeat(200),
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).not.toThrow();
    });

    it('should accept guess at min length (1 char)', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'a',
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).not.toThrow();
    });

    it('should trim whitespace from guess (XSS prevention)', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: '  Paris  ',
          userId: 'user123',
        },
      };
      
      const result = submitGuessSchema.parse(data);
      expect(result.body.guess).toBe('Paris');
    });

    it('should accept various valid UUIDs for challengeId', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '00000000-0000-0000-0000-000000000000',
      ];
      
      validUUIDs.forEach(uuid => {
        const data = {
          body: {
            challengeId: uuid,
            guess: 'Test Guess',
            userId: 'user123',
          },
        };
        
        expect(() => submitGuessSchema.parse(data)).not.toThrow();
      });
    });

    it('should accept various valid user IDs', () => {
      const validUserIds = ['user123', 't2_abc123', 'a', 'a'.repeat(100)];
      
      validUserIds.forEach(userId => {
        const data = {
          body: {
            challengeId: '550e8400-e29b-41d4-a716-446655440000',
            guess: 'Test Guess',
            userId,
          },
        };
        
        expect(() => submitGuessSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('invalid inputs', () => {
    it('should reject non-UUID challengeId', () => {
      const data = {
        body: {
          challengeId: 'not-a-uuid',
          guess: 'Paris',
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject malformed UUID challengeId', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716',
          guess: 'Paris',
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject UUID without hyphens', () => {
      const data = {
        body: {
          challengeId: '550e8400e29b41d4a716446655440000',
          guess: 'Paris',
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject empty guess', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: '',
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject guess over 200 characters', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'a'.repeat(201),
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject empty userId', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'Paris',
          userId: '',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject userId over 100 characters', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'Paris',
          userId: 'a'.repeat(101),
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject non-string guess', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 123,
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing challengeId', () => {
      const data = {
        body: {
          guess: 'Paris',
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing guess', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'user123',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing userId', () => {
      const data = {
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'Paris',
        },
      };
      
      expect(() => submitGuessSchema.parse(data)).toThrow(ZodError);
    });
  });
});

describe('updateProfileSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid profile update with username', () => {
      const validData = {
        params: {
          userId: 'user123',
        },
        body: {
          username: 'john_doe',
        },
      };
      
      expect(() => updateProfileSchema.parse(validData)).not.toThrow();
    });

    it('should accept valid profile update with bio', () => {
      const validData = {
        params: {
          userId: 'user123',
        },
        body: {
          bio: 'Hello, I am a developer!',
        },
      };
      
      expect(() => updateProfileSchema.parse(validData)).not.toThrow();
    });

    it('should accept valid profile update with both username and bio', () => {
      const validData = {
        params: {
          userId: 'user123',
        },
        body: {
          username: 'jane_smith',
          bio: 'Software engineer and puzzle enthusiast',
        },
      };
      
      expect(() => updateProfileSchema.parse(validData)).not.toThrow();
    });

    it('should accept username with alphanumeric characters', () => {
      const validUsernames = ['user123', 'JohnDoe', 'test_user', 'abc', 'ABC123'];
      
      validUsernames.forEach(username => {
        const data = {
          params: { userId: 'user123' },
          body: { username },
        };
        
        expect(() => updateProfileSchema.parse(data)).not.toThrow();
      });
    });

    it('should accept username at min length (3 chars)', () => {
      const data = {
        params: { userId: 'user123' },
        body: { username: 'abc' },
      };
      
      expect(() => updateProfileSchema.parse(data)).not.toThrow();
    });

    it('should accept username at max length (30 chars)', () => {
      const data = {
        params: { userId: 'user123' },
        body: { username: 'a'.repeat(30) },
      };
      
      expect(() => updateProfileSchema.parse(data)).not.toThrow();
    });

    it('should accept bio at max length (500 chars)', () => {
      const data = {
        params: { userId: 'user123' },
        body: { bio: 'a'.repeat(500) },
      };
      
      expect(() => updateProfileSchema.parse(data)).not.toThrow();
    });

    it('should accept empty bio', () => {
      const data = {
        params: { userId: 'user123' },
        body: { bio: '' },
      };
      
      expect(() => updateProfileSchema.parse(data)).not.toThrow();
    });

    it('should accept various valid user IDs in params', () => {
      const validUserIds = ['user123', 't2_abc123', 'a', 'a'.repeat(100)];
      
      validUserIds.forEach(userId => {
        const data = {
          params: { userId },
          body: { username: 'test_user' },
        };
        
        expect(() => updateProfileSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('invalid inputs', () => {
    it('should reject username that is too short (less than 3 chars)', () => {
      const data = {
        params: { userId: 'user123' },
        body: { username: 'ab' },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject username that is too long (more than 30 chars)', () => {
      const data = {
        params: { userId: 'user123' },
        body: { username: 'a'.repeat(31) },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject username with invalid characters (hyphens)', () => {
      const data = {
        params: { userId: 'user123' },
        body: { username: 'john-doe' },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject username with invalid characters (spaces)', () => {
      const data = {
        params: { userId: 'user123' },
        body: { username: 'john doe' },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject username with invalid characters (special chars)', () => {
      const invalidUsernames = ['john@doe', 'user!123', 'test#user', 'user$name', 'test%user'];
      
      invalidUsernames.forEach(username => {
        const data = {
          params: { userId: 'user123' },
          body: { username },
        };
        
        expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
      });
    });

    it('should reject bio that is too long (more than 500 chars)', () => {
      const data = {
        params: { userId: 'user123' },
        body: { bio: 'a'.repeat(501) },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject empty update (no fields provided)', () => {
      const data = {
        params: { userId: 'user123' },
        body: {},
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject update with only undefined fields', () => {
      const data = {
        params: { userId: 'user123' },
        body: { username: undefined, bio: undefined },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid userId in params (empty string)', () => {
      const data = {
        params: { userId: '' },
        body: { username: 'test_user' },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid userId in params (too long)', () => {
      const data = {
        params: { userId: 'a'.repeat(101) },
        body: { username: 'test_user' },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing params', () => {
      const data = {
        body: { username: 'test_user' },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing body', () => {
      const data = {
        params: { userId: 'user123' },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject non-string username', () => {
      const data = {
        params: { userId: 'user123' },
        body: { username: 123 },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject non-string bio', () => {
      const data = {
        params: { userId: 'user123' },
        body: { bio: 123 },
      };
      
      expect(() => updateProfileSchema.parse(data)).toThrow(ZodError);
    });
  });
});
