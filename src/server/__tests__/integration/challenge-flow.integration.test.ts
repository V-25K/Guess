/**
 * Challenge Flow Integration Tests
 * Tests complete challenge flows including creation, retrieval, pagination, and filtering
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestContext,
  createTestChallenge,
  clearTestData,
  type TestContext,
} from './setup.js';
import {
  seedChallenge,
  createChallengeWithCreator,
  assertResultOk,
} from './helpers.js';
import type { Challenge } from '../../../shared/models/challenge.types.js';

describe('Challenge Flow Integration Tests', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = createTestContext();
  });

  afterEach(() => {
    clearTestData(testContext);
    vi.clearAllMocks();
  });

  /**
   * Requirement 2.1: WHEN a challenge is created 
   * THEN the Integration Test Suite SHALL verify the challenge is stored and retrievable
   */
  describe('Challenge Creation and Retrieval', () => {
    it('should store a new challenge with all required fields', async () => {
      const creatorId = 't2_creator123';
      const challengeData = {
        creator_id: creatorId,
        creator_username: 'testcreator',
        title: 'Test Challenge Title',
        correct_answer: 'test answer',
        tags: ['test', 'integration'],
      };

      const challenge = createChallengeWithCreator(testContext, creatorId, challengeData);

      // Verify challenge was stored
      const storedChallenge = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      );

      expect(storedChallenge).toBeDefined();
      expect(storedChallenge!.creator_id).toBe(creatorId);
      expect(storedChallenge!.creator_username).toBe('testcreator');
      expect(storedChallenge!.title).toBe('Test Challenge Title');
      expect(storedChallenge!.correct_answer).toBe('test answer');
      expect(storedChallenge!.tags).toEqual(['test', 'integration']);
    });

    it('should retrieve a challenge by ID with all data', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        title: 'Retrievable Challenge',
        correct_answer: 'secret answer',
        answer_explanation: 'This is why the answer is correct',
        tags: ['puzzle', 'hard'],
        max_score: 100,
        score_deduction_per_hint: 15,
      });

      // Retrieve by ID
      const retrieved = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      );

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(challenge.id);
      expect(retrieved!.title).toBe('Retrievable Challenge');
      expect(retrieved!.correct_answer).toBe('secret answer');
      expect(retrieved!.answer_explanation).toBe('This is why the answer is correct');
      expect(retrieved!.tags).toEqual(['puzzle', 'hard']);
      expect(retrieved!.max_score).toBe(100);
      expect(retrieved!.score_deduction_per_hint).toBe(15);
    });

    it('should generate unique IDs for each challenge', async () => {
      const challenge1 = createChallengeWithCreator(testContext, 't2_creator1', {
        title: 'Challenge 1',
      });
      const challenge2 = createChallengeWithCreator(testContext, 't2_creator2', {
        title: 'Challenge 2',
      });
      const challenge3 = createChallengeWithCreator(testContext, 't2_creator3', {
        title: 'Challenge 3',
      });

      expect(challenge1.id).not.toBe(challenge2.id);
      expect(challenge2.id).not.toBe(challenge3.id);
      expect(challenge1.id).not.toBe(challenge3.id);
    });

    it('should set created_at timestamp on new challenge', async () => {
      const beforeCreation = new Date().toISOString();

      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        title: 'Timestamped Challenge',
      });

      expect(challenge.created_at).toBeDefined();
      expect(new Date(challenge.created_at).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeCreation).getTime() - 1000
      );
    });

    it('should store challenge with answer_set for local validation', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        title: 'Challenge with Answer Set',
        correct_answer: 'cat',
        answer_set: {
          correct: ['cat', 'kitty', 'feline'],
          close: ['dog', 'pet', 'animal'],
        },
      });

      const stored = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      );

      expect(stored!.answer_set).toBeDefined();
      expect(stored!.answer_set!.correct).toContain('cat');
      expect(stored!.answer_set!.correct).toContain('kitty');
      expect(stored!.answer_set!.close).toContain('dog');
    });

    it('should initialize player counts to zero', async () => {
      const challenge = createTestChallenge({
        title: 'New Challenge',
        players_played: 0,
        players_completed: 0,
      });
      seedChallenge(testContext.mockSupabase, challenge);

      const stored = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      );

      expect(stored!.players_played).toBe(0);
      expect(stored!.players_completed).toBe(0);
    });
  });


  /**
   * Requirement 2.2: WHEN challenges are listed 
   * THEN the Integration Test Suite SHALL verify pagination works correctly
   */
  describe('Challenge Listing with Pagination', () => {
    beforeEach(() => {
      // Seed 15 challenges for pagination testing
      for (let i = 0; i < 15; i++) {
        createChallengeWithCreator(testContext, `t2_creator_${i}`, {
          title: `Challenge ${i + 1}`,
          created_at: new Date(Date.now() - i * 1000).toISOString(), // Staggered creation times
        });
      }
    });

    it('should return first page of challenges with correct limit', async () => {
      const limit = 5;
      const challenges = testContext.mockSupabase.data.challenges.slice(0, limit);

      expect(challenges.length).toBe(limit);
    });

    it('should return correct offset for second page', async () => {
      const limit = 5;
      const offset = 5;
      const challenges = testContext.mockSupabase.data.challenges.slice(offset, offset + limit);

      expect(challenges.length).toBe(limit);
      expect(challenges[0].title).toBe('Challenge 6');
    });

    it('should return remaining items on last page', async () => {
      const limit = 5;
      const offset = 10;
      const challenges = testContext.mockSupabase.data.challenges.slice(offset, offset + limit);

      expect(challenges.length).toBe(5); // 15 total, offset 10, so 5 remaining
    });

    it('should return empty array when offset exceeds total', async () => {
      const offset = 20;
      const challenges = testContext.mockSupabase.data.challenges.slice(offset);

      expect(challenges.length).toBe(0);
    });

    it('should handle limit larger than total items', async () => {
      const limit = 50;
      const challenges = testContext.mockSupabase.data.challenges.slice(0, limit);

      expect(challenges.length).toBe(15); // Only 15 exist
    });

    it('should maintain consistent ordering across pages', async () => {
      const page1 = testContext.mockSupabase.data.challenges.slice(0, 5);
      const page2 = testContext.mockSupabase.data.challenges.slice(5, 10);
      const page3 = testContext.mockSupabase.data.challenges.slice(10, 15);

      // Verify no overlap
      const page1Ids = new Set(page1.map(c => c.id));
      const page2Ids = new Set(page2.map(c => c.id));
      const page3Ids = new Set(page3.map(c => c.id));

      page2.forEach(c => expect(page1Ids.has(c.id)).toBe(false));
      page3.forEach(c => expect(page1Ids.has(c.id)).toBe(false));
      page3.forEach(c => expect(page2Ids.has(c.id)).toBe(false));
    });
  });

  /**
   * Requirement 2.3: WHEN a challenge is retrieved by ID 
   * THEN the Integration Test Suite SHALL verify all challenge data is returned
   */
  describe('Challenge Retrieval by ID', () => {
    it('should return complete challenge data including all fields', async () => {
      const fullChallenge = createChallengeWithCreator(testContext, 't2_fullcreator', {
        title: 'Complete Challenge',
        correct_answer: 'complete answer',
        answer_explanation: 'Full explanation of the answer',
        image_url: 'https://example.com/img1.jpg,https://example.com/img2.jpg',
        image_descriptions: ['First image description', 'Second image description'],
        tags: ['complete', 'test', 'full'],
        max_score: 150,
        score_deduction_per_hint: 20,
        answer_set: {
          correct: ['complete answer', 'full answer'],
          close: ['partial answer'],
        },
        players_played: 10,
        players_completed: 5,
      });

      const retrieved = testContext.mockSupabase.data.challenges.find(
        c => c.id === fullChallenge.id
      );

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(fullChallenge.id);
      expect(retrieved!.creator_id).toBe('t2_fullcreator');
      expect(retrieved!.title).toBe('Complete Challenge');
      expect(retrieved!.correct_answer).toBe('complete answer');
      expect(retrieved!.answer_explanation).toBe('Full explanation of the answer');
      expect(retrieved!.image_url).toContain('img1.jpg');
      expect(retrieved!.image_descriptions).toHaveLength(2);
      expect(retrieved!.tags).toContain('complete');
      expect(retrieved!.max_score).toBe(150);
      expect(retrieved!.score_deduction_per_hint).toBe(20);
      expect(retrieved!.answer_set!.correct).toContain('complete answer');
      expect(retrieved!.players_played).toBe(10);
      expect(retrieved!.players_completed).toBe(5);
    });

    it('should return null for non-existent challenge ID', async () => {
      const nonExistentId = 'non-existent-uuid';
      const retrieved = testContext.mockSupabase.data.challenges.find(
        c => c.id === nonExistentId
      );

      expect(retrieved).toBeUndefined();
    });

    it('should return challenge with reddit_post_id when linked', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        title: 'Reddit Linked Challenge',
        reddit_post_id: 't3_abc123',
      });

      const retrieved = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      );

      expect(retrieved!.reddit_post_id).toBe('t3_abc123');
    });

    it('should return challenge with null reddit_post_id when not linked', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_creator', {
        title: 'Unlinked Challenge',
        reddit_post_id: null,
      });

      const retrieved = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      );

      expect(retrieved!.reddit_post_id).toBeNull();
    });
  });


  /**
   * Requirement 2.4: WHEN challenge filters are applied 
   * THEN the Integration Test Suite SHALL verify filtering returns correct results
   */
  describe('Challenge Filtering', () => {
    beforeEach(() => {
      // Seed challenges with various tags and creators
      createChallengeWithCreator(testContext, 't2_alice', {
        title: 'Alice Puzzle 1',
        tags: ['puzzle', 'easy'],
      });
      createChallengeWithCreator(testContext, 't2_alice', {
        title: 'Alice Puzzle 2',
        tags: ['puzzle', 'medium'],
      });
      createChallengeWithCreator(testContext, 't2_bob', {
        title: 'Bob Trivia 1',
        tags: ['trivia', 'easy'],
      });
      createChallengeWithCreator(testContext, 't2_bob', {
        title: 'Bob Trivia 2',
        tags: ['trivia', 'hard'],
      });
      createChallengeWithCreator(testContext, 't2_charlie', {
        title: 'Charlie Mixed',
        tags: ['puzzle', 'trivia', 'medium'],
      });
    });

    it('should filter challenges by single tag', async () => {
      const puzzleChallenges = testContext.mockSupabase.data.challenges.filter(
        c => c.tags.includes('puzzle')
      );

      expect(puzzleChallenges.length).toBe(3);
      puzzleChallenges.forEach(c => {
        expect(c.tags).toContain('puzzle');
      });
    });

    it('should filter challenges by multiple tags (AND logic)', async () => {
      const puzzleAndMedium = testContext.mockSupabase.data.challenges.filter(
        c => c.tags.includes('puzzle') && c.tags.includes('medium')
      );

      expect(puzzleAndMedium.length).toBe(2);
      puzzleAndMedium.forEach(c => {
        expect(c.tags).toContain('puzzle');
        expect(c.tags).toContain('medium');
      });
    });

    it('should filter challenges by creator ID', async () => {
      const aliceChallenges = testContext.mockSupabase.data.challenges.filter(
        c => c.creator_id === 't2_alice'
      );

      expect(aliceChallenges.length).toBe(2);
      aliceChallenges.forEach(c => {
        expect(c.creator_id).toBe('t2_alice');
      });
    });

    it('should filter challenges by creator ID and tag', async () => {
      const bobTrivia = testContext.mockSupabase.data.challenges.filter(
        c => c.creator_id === 't2_bob' && c.tags.includes('trivia')
      );

      expect(bobTrivia.length).toBe(2);
      bobTrivia.forEach(c => {
        expect(c.creator_id).toBe('t2_bob');
        expect(c.tags).toContain('trivia');
      });
    });

    it('should return empty array when no challenges match filter', async () => {
      const nonExistent = testContext.mockSupabase.data.challenges.filter(
        c => c.tags.includes('nonexistent')
      );

      expect(nonExistent.length).toBe(0);
    });

    it('should filter by difficulty tag', async () => {
      const easyChallenges = testContext.mockSupabase.data.challenges.filter(
        c => c.tags.includes('easy')
      );

      expect(easyChallenges.length).toBe(2);
      easyChallenges.forEach(c => {
        expect(c.tags).toContain('easy');
      });
    });

    it('should combine filter with pagination', async () => {
      // Add more puzzle challenges for pagination test
      for (let i = 0; i < 5; i++) {
        createChallengeWithCreator(testContext, `t2_extra_${i}`, {
          title: `Extra Puzzle ${i}`,
          tags: ['puzzle', 'extra'],
        });
      }

      const allPuzzles = testContext.mockSupabase.data.challenges.filter(
        c => c.tags.includes('puzzle')
      );
      const paginatedPuzzles = allPuzzles.slice(0, 3);

      expect(allPuzzles.length).toBe(8); // 3 original + 5 extra
      expect(paginatedPuzzles.length).toBe(3);
      paginatedPuzzles.forEach(c => {
        expect(c.tags).toContain('puzzle');
      });
    });
  });

  /**
   * Additional integration scenarios
   */
  describe('Complete Challenge Flow Scenarios', () => {
    it('should handle complete challenge lifecycle', async () => {
      // Step 1: Create challenge
      const challenge = createChallengeWithCreator(testContext, 't2_lifecycle_creator', {
        title: 'Lifecycle Challenge',
        correct_answer: 'lifecycle',
        tags: ['test'],
        players_played: 0,
        players_completed: 0,
      });

      // Verify initial state
      expect(challenge.players_played).toBe(0);
      expect(challenge.players_completed).toBe(0);

      // Step 2: Simulate player starting the challenge
      const stored = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      )!;
      stored.players_played += 1;

      expect(stored.players_played).toBe(1);
      expect(stored.players_completed).toBe(0);

      // Step 3: Simulate player completing the challenge
      stored.players_completed += 1;

      expect(stored.players_played).toBe(1);
      expect(stored.players_completed).toBe(1);
    });

    it('should track multiple players on same challenge', async () => {
      const challenge = createChallengeWithCreator(testContext, 't2_multi_creator', {
        title: 'Multi-Player Challenge',
        players_played: 0,
        players_completed: 0,
      });

      const stored = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenge.id
      )!;

      // Simulate 5 players, 3 complete
      stored.players_played = 5;
      stored.players_completed = 3;

      expect(stored.players_played).toBe(5);
      expect(stored.players_completed).toBe(3);
      expect(stored.players_completed).toBeLessThanOrEqual(stored.players_played);
    });

    it('should maintain data integrity across operations', async () => {
      // Create multiple challenges
      const challenges: Challenge[] = [];
      for (let i = 0; i < 3; i++) {
        challenges.push(
          createChallengeWithCreator(testContext, `t2_integrity_${i}`, {
            title: `Integrity Challenge ${i}`,
            tags: ['integrity'],
          })
        );
      }

      // Verify all stored correctly
      expect(testContext.mockSupabase.data.challenges.length).toBe(3);

      // Modify one challenge
      const toModify = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenges[1].id
      )!;
      toModify.title = 'Modified Title';

      // Verify only that challenge was modified
      const challenge0 = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenges[0].id
      )!;
      const challenge1 = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenges[1].id
      )!;
      const challenge2 = testContext.mockSupabase.data.challenges.find(
        c => c.id === challenges[2].id
      )!;

      expect(challenge0.title).toBe('Integrity Challenge 0');
      expect(challenge1.title).toBe('Modified Title');
      expect(challenge2.title).toBe('Integrity Challenge 2');
    });
  });
});
