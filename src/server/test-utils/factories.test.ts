/**
 * Tests for Test Data Factories
 */

import { describe, it, expect } from 'vitest';
import { createMockUser, createMockChallenge, createMockAttempt, createMockContext } from './factories.js';

describe('Test Data Factories', () => {
  describe('createMockUser', () => {
    it('should create a valid user object', () => {
      const user = createMockUser();

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.user_id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.total_points).toBeGreaterThanOrEqual(0);
      expect(user.level).toBeGreaterThanOrEqual(1);
      expect(user.role).toMatch(/^(player|mod)$/);
    });

    it('should accept overrides', () => {
      const user = createMockUser({ username: 'test-user', level: 5 });

      expect(user.username).toBe('test-user');
      expect(user.level).toBe(5);
    });
  });

  describe('createMockChallenge', () => {
    it('should create a valid challenge object', () => {
      const challenge = createMockChallenge();

      expect(challenge).toBeDefined();
      expect(challenge.id).toBeDefined();
      expect(challenge.creator_id).toBeDefined();
      expect(challenge.title).toBeDefined();
      expect(challenge.correct_answer).toBeDefined();
      expect(challenge.max_score).toBeGreaterThan(0);
      expect(Array.isArray(challenge.tags)).toBe(true);
    });

    it('should accept overrides', () => {
      const challenge = createMockChallenge({ title: 'Test Challenge', max_score: 100 });

      expect(challenge.title).toBe('Test Challenge');
      expect(challenge.max_score).toBe(100);
    });
  });

  describe('createMockAttempt', () => {
    it('should create a valid attempt object', () => {
      const attempt = createMockAttempt();

      expect(attempt).toBeDefined();
      expect(attempt.id).toBeDefined();
      expect(attempt.user_id).toBeDefined();
      expect(attempt.challenge_id).toBeDefined();
      expect(attempt.attempts_made).toBeGreaterThanOrEqual(1);
      expect(typeof attempt.is_solved).toBe('boolean');
      expect(Array.isArray(attempt.hints_used)).toBe(true);
    });

    it('should accept overrides', () => {
      const attempt = createMockAttempt({ is_solved: true, points_earned: 50 });

      expect(attempt.is_solved).toBe(true);
      expect(attempt.points_earned).toBe(50);
    });
  });

  describe('createMockContext', () => {
    it('should create a valid context object', () => {
      const context = createMockContext();

      expect(context).toBeDefined();
      expect(context.subredditId).toBeDefined();
      expect(context.userId).toBeDefined();
      expect(context.userId).toMatch(/^t2_/);
      expect(context.appName).toBe('guess-the-link-test');
    });

    it('should accept overrides', () => {
      const context = createMockContext({ userId: 't2_customuser' as `t2_${string}` });

      expect(context.userId).toBe('t2_customuser');
    });
  });
});
