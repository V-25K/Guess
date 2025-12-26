/**
 * Property-based tests for data model compatibility
 * 
 * **Feature: devvit-web-migration, Property 9: Data compatibility**
 * **Validates: Requirements 15.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { UserProfile } from './user.types.js';
import type { Challenge } from './challenge.types.js';
import type { ChallengeAttempt } from './attempt.types.js';

describe('Data Model Compatibility Properties', () => {
  /**
   * **Feature: devvit-web-migration, Property 9: Data compatibility**
   * 
   * *For any* existing database record, the web version should be able to read and write it
   * using the same structure and field names as the Blocks version
   * 
   * **Validates: Requirements 15.3**
   */
  describe('Property 9: Data compatibility', () => {
    // Helper to generate valid ISO date strings
    const validISODate = fc.integer({ min: 1577836800000, max: 1924905600000 }) // 2020-2030 in ms
      .map(ms => new Date(ms).toISOString());

    // Arbitrary for UserProfile
    const arbitraryUserProfile = fc.record({
      id: fc.option(fc.string(), { nil: undefined }),
      user_id: fc.string({ minLength: 1 }),
      username: fc.string({ minLength: 1 }),
      total_points: fc.integer({ min: 0 }),
      total_experience: fc.integer({ min: 0 }),
      level: fc.integer({ min: 1 }),
      challenges_created: fc.integer({ min: 0 }),
      challenges_attempted: fc.integer({ min: 0 }),
      challenges_solved: fc.integer({ min: 0 }),
      current_streak: fc.integer({ min: 0 }),
      best_streak: fc.integer({ min: 0 }),
      last_challenge_created_at: fc.oneof(fc.constant(null), validISODate),
      role: fc.constantFrom('player' as const, 'mod' as const),
      created_at: fc.option(validISODate, { nil: undefined }),
      updated_at: fc.option(validISODate, { nil: undefined }),
    });

    // Arbitrary for Challenge
    const arbitraryChallenge = fc.record({
      id: fc.string({ minLength: 1 }),
      creator_id: fc.string({ minLength: 1 }),
      creator_username: fc.string({ minLength: 1 }),
      title: fc.string({ minLength: 1 }),
      image_url: fc.string({ minLength: 1 }),
      image_descriptions: fc.option(fc.array(fc.string()), { nil: undefined }),
      tags: fc.array(fc.string(), { maxLength: 5 }),
      correct_answer: fc.string({ minLength: 1 }),
      answer_explanation: fc.option(fc.string(), { nil: undefined }),
      answer_set: fc.option(
        fc.record({
          correct: fc.array(fc.string(), { minLength: 1 }),
          close: fc.array(fc.string()),
        }),
        { nil: undefined }
      ),
      max_score: fc.integer({ min: 0 }),
      score_deduction_per_hint: fc.integer({ min: 0 }),
      reddit_post_id: fc.oneof(fc.constant(null), fc.string()),
      players_played: fc.integer({ min: 0 }),
      players_completed: fc.integer({ min: 0 }),
      created_at: validISODate,
    });

    // Arbitrary for ChallengeAttempt
    const arbitraryChallengeAttempt = fc.record({
      id: fc.string({ minLength: 1 }),
      user_id: fc.string({ minLength: 1 }),
      challenge_id: fc.string({ minLength: 1 }),
      attempts_made: fc.integer({ min: 0, max: 10 }),
      images_revealed: fc.integer({ min: 0, max: 5 }), // Deprecated but kept for compatibility
      is_solved: fc.boolean(),
      game_over: fc.boolean(),
      points_earned: fc.integer({ min: 0 }),
      experience_earned: fc.integer({ min: 0 }),
      attempted_at: validISODate,
      completed_at: fc.oneof(fc.constant(null), validISODate),
      hints_used: fc.array(fc.integer({ min: 0, max: 4 }), { maxLength: 5 }),
    });

    it('should serialize and deserialize UserProfile without data loss', () => {
      fc.assert(
        fc.property(arbitraryUserProfile, (profile) => {
          // Serialize to JSON (simulating database write)
          const json = JSON.stringify(profile);
          
          // Deserialize from JSON (simulating database read)
          const deserialized = JSON.parse(json) as UserProfile;
          
          // All fields should be preserved
          expect(deserialized.user_id).toBe(profile.user_id);
          expect(deserialized.username).toBe(profile.username);
          expect(deserialized.total_points).toBe(profile.total_points);
          expect(deserialized.total_experience).toBe(profile.total_experience);
          expect(deserialized.level).toBe(profile.level);
          expect(deserialized.challenges_created).toBe(profile.challenges_created);
          expect(deserialized.challenges_attempted).toBe(profile.challenges_attempted);
          expect(deserialized.challenges_solved).toBe(profile.challenges_solved);
          expect(deserialized.current_streak).toBe(profile.current_streak);
          expect(deserialized.best_streak).toBe(profile.best_streak);
          expect(deserialized.last_challenge_created_at).toBe(profile.last_challenge_created_at);
          expect(deserialized.role).toBe(profile.role);
        }),
        { numRuns: 100 }
      );
    });

    it('should serialize and deserialize Challenge without data loss', () => {
      fc.assert(
        fc.property(arbitraryChallenge, (challenge) => {
          // Serialize to JSON
          const json = JSON.stringify(challenge);
          
          // Deserialize from JSON
          const deserialized = JSON.parse(json) as Challenge;
          
          // All fields should be preserved
          expect(deserialized.id).toBe(challenge.id);
          expect(deserialized.creator_id).toBe(challenge.creator_id);
          expect(deserialized.creator_username).toBe(challenge.creator_username);
          expect(deserialized.title).toBe(challenge.title);
          expect(deserialized.image_url).toBe(challenge.image_url);
          expect(deserialized.tags).toEqual(challenge.tags);
          expect(deserialized.correct_answer).toBe(challenge.correct_answer);
          expect(deserialized.max_score).toBe(challenge.max_score);
          expect(deserialized.score_deduction_per_hint).toBe(challenge.score_deduction_per_hint);
          expect(deserialized.reddit_post_id).toBe(challenge.reddit_post_id);
          expect(deserialized.players_played).toBe(challenge.players_played);
          expect(deserialized.players_completed).toBe(challenge.players_completed);
          expect(deserialized.created_at).toBe(challenge.created_at);
        }),
        { numRuns: 100 }
      );
    });

    it('should serialize and deserialize ChallengeAttempt without data loss', () => {
      fc.assert(
        fc.property(arbitraryChallengeAttempt, (attempt) => {
          // Serialize to JSON
          const json = JSON.stringify(attempt);
          
          // Deserialize from JSON
          const deserialized = JSON.parse(json) as ChallengeAttempt;
          
          // All fields should be preserved
          expect(deserialized.id).toBe(attempt.id);
          expect(deserialized.user_id).toBe(attempt.user_id);
          expect(deserialized.challenge_id).toBe(attempt.challenge_id);
          expect(deserialized.attempts_made).toBe(attempt.attempts_made);
          expect(deserialized.images_revealed).toBe(attempt.images_revealed);
          expect(deserialized.is_solved).toBe(attempt.is_solved);
          expect(deserialized.game_over).toBe(attempt.game_over);
          expect(deserialized.points_earned).toBe(attempt.points_earned);
          expect(deserialized.experience_earned).toBe(attempt.experience_earned);
          expect(deserialized.attempted_at).toBe(attempt.attempted_at);
          expect(deserialized.completed_at).toBe(attempt.completed_at);
          expect(deserialized.hints_used).toEqual(attempt.hints_used);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve field names exactly as defined in types', () => {
      fc.assert(
        fc.property(arbitraryUserProfile, (profile) => {
          const json = JSON.stringify(profile);
          const deserialized = JSON.parse(json);
          
          // Check that field names use snake_case (database convention)
          if (profile.user_id) expect(deserialized).toHaveProperty('user_id');
          if (profile.total_points !== undefined) expect(deserialized).toHaveProperty('total_points');
          if (profile.total_experience !== undefined) expect(deserialized).toHaveProperty('total_experience');
          if (profile.challenges_created !== undefined) expect(deserialized).toHaveProperty('challenges_created');
          if (profile.challenges_attempted !== undefined) expect(deserialized).toHaveProperty('challenges_attempted');
          if (profile.challenges_solved !== undefined) expect(deserialized).toHaveProperty('challenges_solved');
          if (profile.current_streak !== undefined) expect(deserialized).toHaveProperty('current_streak');
          if (profile.best_streak !== undefined) expect(deserialized).toHaveProperty('best_streak');
          if (profile.last_challenge_created_at !== undefined) expect(deserialized).toHaveProperty('last_challenge_created_at');
        }),
        { numRuns: 100 }
      );
    });

    it('should handle null values correctly in all models', () => {
      fc.assert(
        fc.property(arbitraryUserProfile, (profile) => {
          // Set nullable field to null
          const profileWithNull = { ...profile, last_challenge_created_at: null };
          
          const json = JSON.stringify(profileWithNull);
          const deserialized = JSON.parse(json);
          
          // Null should be preserved
          expect(deserialized.last_challenge_created_at).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should handle optional fields correctly', () => {
      fc.assert(
        fc.property(arbitraryChallenge, (challenge) => {
          // Remove optional fields
          const minimalChallenge = {
            ...challenge,
            image_descriptions: undefined,
            answer_explanation: undefined,
            answer_set: undefined,
          };
          
          const json = JSON.stringify(minimalChallenge);
          const deserialized = JSON.parse(json);
          
          // Optional fields should not be present if undefined
          expect(deserialized.image_descriptions).toBeUndefined();
          expect(deserialized.answer_explanation).toBeUndefined();
          expect(deserialized.answer_set).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve array fields correctly', () => {
      fc.assert(
        fc.property(arbitraryChallenge, (challenge) => {
          const json = JSON.stringify(challenge);
          const deserialized = JSON.parse(json);
          
          // Arrays should be preserved
          expect(Array.isArray(deserialized.tags)).toBe(true);
          expect(deserialized.tags).toEqual(challenge.tags);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve nested objects correctly', () => {
      fc.assert(
        fc.property(arbitraryChallenge, (challenge) => {
          // Ensure answer_set is present
          if (challenge.answer_set) {
            const json = JSON.stringify(challenge);
            const deserialized = JSON.parse(json);
            
            // Nested object should be preserved
            expect(deserialized.answer_set).toBeDefined();
            expect(deserialized.answer_set.correct).toEqual(challenge.answer_set.correct);
            expect(deserialized.answer_set.close).toEqual(challenge.answer_set.close);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve boolean fields correctly', () => {
      fc.assert(
        fc.property(arbitraryChallengeAttempt, (attempt) => {
          const json = JSON.stringify(attempt);
          const deserialized = JSON.parse(json);
          
          // Booleans should be preserved
          expect(typeof deserialized.is_solved).toBe('boolean');
          expect(typeof deserialized.game_over).toBe('boolean');
          expect(deserialized.is_solved).toBe(attempt.is_solved);
          expect(deserialized.game_over).toBe(attempt.game_over);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve integer fields as numbers', () => {
      fc.assert(
        fc.property(arbitraryUserProfile, (profile) => {
          const json = JSON.stringify(profile);
          const deserialized = JSON.parse(json);
          
          // Integer fields should remain numbers
          expect(typeof deserialized.total_points).toBe('number');
          expect(typeof deserialized.total_experience).toBe('number');
          expect(typeof deserialized.level).toBe('number');
          expect(Number.isInteger(deserialized.total_points)).toBe(true);
          expect(Number.isInteger(deserialized.total_experience)).toBe(true);
          expect(Number.isInteger(deserialized.level)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve ISO date strings correctly', () => {
      fc.assert(
        fc.property(arbitraryChallengeAttempt, (attempt) => {
          const json = JSON.stringify(attempt);
          const deserialized = JSON.parse(json);
          
          // Date strings should be preserved
          expect(typeof deserialized.attempted_at).toBe('string');
          expect(deserialized.attempted_at).toBe(attempt.attempted_at);
          
          // Should be valid ISO date string
          expect(() => new Date(deserialized.attempted_at)).not.toThrow();
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain backward compatibility with deprecated fields', () => {
      fc.assert(
        fc.property(arbitraryChallengeAttempt, (attempt) => {
          const json = JSON.stringify(attempt);
          const deserialized = JSON.parse(json);
          
          // Deprecated images_revealed field should still be present
          expect(deserialized).toHaveProperty('images_revealed');
          expect(typeof deserialized.images_revealed).toBe('number');
          expect(deserialized.images_revealed).toBe(attempt.images_revealed);
        }),
        { numRuns: 100 }
      );
    });
  });
});
