/**
 * Property-based tests for Redis key patterns used in the application
 * 
 * **Feature: devvit-web-migration, Property 8: Redis key pattern preservation**
 * **Validates: Requirements 15.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CacheKeyBuilder } from '../../shared/utils/cache.js';

describe('Redis Key Pattern Properties', () => {
  /**
   * **Feature: devvit-web-migration, Property 8: Redis key pattern preservation**
   * 
   * *For any* Redis operation, the key format should follow the same namespace pattern
   * as the Blocks version (e.g., 'user:{userId}:profile')
   * 
   * **Validates: Requirements 15.2**
   */
  describe('Property 8: Redis key pattern preservation', () => {
    // Arbitrary for valid identifiers (no colons)
    const validIdentifier = fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
      !s.includes(':') && s.trim() !== ''
    );

    it('should generate user profile keys with pattern user:{userId}:profile', () => {
      fc.assert(
        fc.property(validIdentifier, (userId) => {
          const key = CacheKeyBuilder.createKey('user', userId, 'profile');
          
          // Should match expected pattern
          expect(key).toBe(`user:${userId}:profile`);
          
          // Should match namespace pattern
          const pattern = /^user:[^:]+:profile$/;
          expect(pattern.test(key)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate challenge keys with pattern challenge:{challengeId}', () => {
      fc.assert(
        fc.property(validIdentifier, (challengeId) => {
          const key = CacheKeyBuilder.createKey('challenge', challengeId);
          
          // Should match expected pattern
          expect(key).toBe(`challenge:${challengeId}`);
          
          // Should match namespace pattern
          const pattern = /^challenge:[^:]+$/;
          expect(pattern.test(key)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate leaderboard keys with pattern leaderboard:global', () => {
      const key = CacheKeyBuilder.createKey('leaderboard', 'global');
      
      // Should match expected pattern
      expect(key).toBe('leaderboard:global');
      
      // Should match namespace pattern
      const pattern = /^leaderboard:global$/;
      expect(pattern.test(key)).toBe(true);
    });

    it('should generate attempt keys with pattern attempt:{userId}:{challengeId}', () => {
      fc.assert(
        fc.property(validIdentifier, validIdentifier, (userId, challengeId) => {
          const key = CacheKeyBuilder.createKey('attempt', userId, challengeId);
          
          // Should match expected pattern
          expect(key).toBe(`attempt:${userId}:${challengeId}`);
          
          // Should match namespace pattern
          const pattern = /^attempt:[^:]+:[^:]+$/;
          expect(pattern.test(key)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate feed keys with pattern feed:{type}', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('recent', 'popular', 'unsolved'),
          (feedType) => {
            const key = CacheKeyBuilder.createKey('feed', feedType);
            
            // Should match expected pattern
            expect(key).toBe(`feed:${feedType}`);
            
            // Should match namespace pattern
            const pattern = /^feed:[^:]+$/;
            expect(pattern.test(key)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve entity types across all keys', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('user', 'challenge', 'attempt', 'leaderboard', 'feed'),
          validIdentifier,
          (entity, identifier) => {
            const key = CacheKeyBuilder.createKey(entity, identifier);
            const parsed = CacheKeyBuilder.parseKey(key);
            
            // Entity should be preserved
            expect(parsed.entity).toBe(entity);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve identifiers across all keys', () => {
      fc.assert(
        fc.property(validIdentifier, validIdentifier, (entity, identifier) => {
          const key = CacheKeyBuilder.createKey(entity, identifier);
          const parsed = CacheKeyBuilder.parseKey(key);
          
          // Identifier should be preserved
          expect(parsed.identifier).toBe(identifier);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve qualifiers in three-part keys', () => {
      fc.assert(
        fc.property(
          validIdentifier,
          validIdentifier,
          fc.constantFrom('profile', 'stats', 'settings'),
          (entity, identifier, qualifier) => {
            const key = CacheKeyBuilder.createKey(entity, identifier, qualifier);
            const parsed = CacheKeyBuilder.parseKey(key);
            
            // Qualifier should be preserved
            expect(parsed.qualifier).toBe(qualifier);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate consistent keys for the same inputs', () => {
      fc.assert(
        fc.property(validIdentifier, validIdentifier, (entity, identifier) => {
          const key1 = CacheKeyBuilder.createKey(entity, identifier);
          const key2 = CacheKeyBuilder.createKey(entity, identifier);
          
          // Same inputs should produce same keys
          expect(key1).toBe(key2);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate different keys for different identifiers', () => {
      fc.assert(
        fc.property(
          validIdentifier,
          validIdentifier,
          validIdentifier,
          (entity, id1, id2) => {
            // Skip if identifiers are the same
            fc.pre(id1 !== id2);
            
            const key1 = CacheKeyBuilder.createKey(entity, id1);
            const key2 = CacheKeyBuilder.createKey(entity, id2);
            
            // Different identifiers should produce different keys
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not contain double colons in any key', () => {
      fc.assert(
        fc.property(validIdentifier, validIdentifier, (entity, identifier) => {
          const key = CacheKeyBuilder.createKey(entity, identifier);
          
          // Should not contain double colons
          expect(key).not.toContain('::');
        }),
        { numRuns: 100 }
      );
    });

    it('should not start or end with colons', () => {
      fc.assert(
        fc.property(validIdentifier, validIdentifier, (entity, identifier) => {
          const key = CacheKeyBuilder.createKey(entity, identifier);
          
          // Should not start with colon
          expect(key.startsWith(':')).toBe(false);
          
          // Should not end with colon
          expect(key.endsWith(':')).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
});
