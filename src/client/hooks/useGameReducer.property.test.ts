/**
 * useGameReducer Property Tests
 * Property-based tests for game state reducer using fast-check
 * 
 * **Feature: frontend-audit-refactor, Property 7: State Update Propagation**
 * **Validates: Requirements 7.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { gameReducer } from './useGameReducer';
import type { GameState, GameAction, ViewType } from '../types/game.types';
import { createInitialGameState } from '../types/game.types';
import type { UserProfile } from '../../shared/models/user.types';
import type { GameChallenge } from '../../shared/models/challenge.types';
import type { AttemptResult } from '../../shared/models/attempt.types';

// Arbitraries for generating test data
const viewTypeArb: fc.Arbitrary<ViewType> = fc.constantFrom(
  'loading', 'menu', 'gameplay', 'profile', 'leaderboard', 'create', 'selection', 'awards'
);

// Valid date arbitrary that generates dates within a reasonable range
const validDateArb = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2030-12-31').getTime() 
}).map(timestamp => new Date(timestamp).toISOString());

const userProfileArb: fc.Arbitrary<UserProfile> = fc.record({
  user_id: fc.string({ minLength: 1, maxLength: 50 }),
  username: fc.string({ minLength: 1, maxLength: 50 }),
  total_points: fc.nat(),
  total_experience: fc.nat(),
  level: fc.integer({ min: 1, max: 100 }),
  challenges_created: fc.nat(),
  challenges_attempted: fc.nat(),
  challenges_solved: fc.nat(),
  current_streak: fc.nat(),
  best_streak: fc.nat(),
  last_challenge_created_at: fc.option(validDateArb, { nil: null }),
  role: fc.constantFrom('player', 'mod') as fc.Arbitrary<'player' | 'mod'>,
});

const gameChallengeArb: fc.Arbitrary<GameChallenge> = fc.record({
  id: fc.uuid(),
  creator_id: fc.string({ minLength: 1, maxLength: 50 }),
  creator_username: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  image_url: fc.webUrl(),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  correct_answer: fc.string({ minLength: 1, maxLength: 100 }),
  max_score: fc.integer({ min: 100, max: 1000 }),
  score_deduction_per_hint: fc.integer({ min: 10, max: 100 }),
  reddit_post_id: fc.option(fc.string(), { nil: null }),
  players_played: fc.nat(),
  players_completed: fc.nat(),
  created_at: validDateArb,
  images: fc.array(
    fc.record({
      url: fc.webUrl(),
      isRevealed: fc.boolean(),
      description: fc.option(fc.string(), { nil: undefined }),
    }),
    { minLength: 1, maxLength: 4 }
  ),
  keywords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
});

const attemptResultArb: fc.Arbitrary<AttemptResult> = fc.record({
  isCorrect: fc.boolean(),
  explanation: fc.string({ minLength: 1, maxLength: 200 }),
  attemptsRemaining: fc.integer({ min: 0, max: 5 }),
  potentialScore: fc.integer({ min: 0, max: 1000 }),
  gameOver: fc.boolean(),
});

describe('gameReducer Property Tests', () => {
  /**
   * **Feature: frontend-audit-refactor, Property 7: State Update Propagation**
   * **Validates: Requirements 7.3**
   * 
   * For any game state change (user, challenges, currentChallengeIndex), 
   * all components consuming that state SHALL re-render with the updated values.
   * 
   * This property verifies that the reducer correctly propagates state updates.
   */
  describe('State Update Propagation', () => {
    it('should propagate SET_VIEW action to currentView state', () => {
      fc.assert(
        fc.property(
          viewTypeArb,
          (newView) => {
            const initialState = createInitialGameState();
            const action: GameAction = { type: 'SET_VIEW', payload: newView };
            
            const newState = gameReducer(initialState, action);
            
            // The currentView should be updated to the new value
            expect(newState.currentView).toBe(newView);
            // Other state should remain unchanged
            expect(newState.user).toBe(initialState.user);
            expect(newState.challenges).toBe(initialState.challenges);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should propagate SET_USER action to user state', () => {
      fc.assert(
        fc.property(
          fc.option(userProfileArb, { nil: null }),
          (newUser) => {
            const initialState = createInitialGameState();
            const action: GameAction = { type: 'SET_USER', payload: newUser };
            
            const newState = gameReducer(initialState, action);
            
            // The user should be updated to the new value
            expect(newState.user).toEqual(newUser);
            // Other state should remain unchanged
            expect(newState.currentView).toBe(initialState.currentView);
            expect(newState.challenges).toBe(initialState.challenges);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should propagate SET_CHALLENGES action to challenges state', () => {
      fc.assert(
        fc.property(
          fc.array(gameChallengeArb, { maxLength: 10 }),
          (newChallenges) => {
            const initialState = createInitialGameState();
            const action: GameAction = { type: 'SET_CHALLENGES', payload: newChallenges };
            
            const newState = gameReducer(initialState, action);
            
            // The challenges should be updated to the new value
            expect(newState.challenges).toEqual(newChallenges);
            expect(newState.challenges.length).toBe(newChallenges.length);
            // Other state should remain unchanged
            expect(newState.currentView).toBe(initialState.currentView);
            expect(newState.user).toBe(initialState.user);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should propagate SET_CURRENT_CHALLENGE_INDEX action to currentChallengeIndex state', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 100 }),
          (newIndex) => {
            const initialState = createInitialGameState();
            const action: GameAction = { type: 'SET_CURRENT_CHALLENGE_INDEX', payload: newIndex };
            
            const newState = gameReducer(initialState, action);
            
            // The currentChallengeIndex should be updated to the new value
            expect(newState.currentChallengeIndex).toBe(newIndex);
            // Other state should remain unchanged
            expect(newState.currentView).toBe(initialState.currentView);
            expect(newState.user).toBe(initialState.user);
            expect(newState.challenges).toBe(initialState.challenges);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should propagate SET_ATTEMPT_RESULT action to lastAttemptResult state', () => {
      fc.assert(
        fc.property(
          fc.option(attemptResultArb, { nil: null }),
          (newResult) => {
            const initialState = createInitialGameState();
            const action: GameAction = { type: 'SET_ATTEMPT_RESULT', payload: newResult };
            
            const newState = gameReducer(initialState, action);
            
            // The lastAttemptResult should be updated to the new value
            expect(newState.lastAttemptResult).toEqual(newResult);
            // Other state should remain unchanged
            expect(newState.currentView).toBe(initialState.currentView);
            expect(newState.user).toBe(initialState.user);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should propagate loading state changes correctly', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          (userLoading, challengesLoading, submissionLoading) => {
            let state = createInitialGameState();
            
            state = gameReducer(state, { type: 'SET_USER_LOADING', payload: userLoading });
            state = gameReducer(state, { type: 'SET_CHALLENGES_LOADING', payload: challengesLoading });
            state = gameReducer(state, { type: 'SET_SUBMISSION_LOADING', payload: submissionLoading });
            
            // All loading states should be correctly updated
            expect(state.loading.user).toBe(userLoading);
            expect(state.loading.challenges).toBe(challengesLoading);
            expect(state.loading.submission).toBe(submissionLoading);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should propagate error state changes correctly', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
          fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
          fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
          (userError, challengesError, submissionError) => {
            let state = createInitialGameState();
            
            state = gameReducer(state, { type: 'SET_USER_ERROR', payload: userError });
            state = gameReducer(state, { type: 'SET_CHALLENGES_ERROR', payload: challengesError });
            state = gameReducer(state, { type: 'SET_SUBMISSION_ERROR', payload: submissionError });
            
            // All error states should be correctly updated
            expect(state.errors.user).toBe(userError);
            expect(state.errors.challenges).toBe(challengesError);
            expect(state.errors.submission).toBe(submissionError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('NEXT_CHALLENGE action', () => {
    it('should correctly cycle through challenges', () => {
      fc.assert(
        fc.property(
          fc.array(gameChallengeArb, { minLength: 1, maxLength: 10 }),
          fc.nat({ max: 100 }),
          (challenges, startIndex) => {
            // Ensure startIndex is within bounds
            const boundedStartIndex = startIndex % challenges.length;
            
            let state: GameState = {
              ...createInitialGameState(),
              challenges,
              currentChallengeIndex: boundedStartIndex,
            };
            
            const action: GameAction = { type: 'NEXT_CHALLENGE' };
            const newState = gameReducer(state, action);
            
            // The index should wrap around correctly
            const expectedIndex = (boundedStartIndex + 1) % challenges.length;
            expect(newState.currentChallengeIndex).toBe(expectedIndex);
            
            // lastAttemptResult should be cleared
            expect(newState.lastAttemptResult).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('RESET_GAME action', () => {
    it('should reset game state while preserving user', () => {
      fc.assert(
        fc.property(
          userProfileArb,
          fc.array(gameChallengeArb, { minLength: 1, maxLength: 5 }),
          viewTypeArb,
          (user, challenges, view) => {
            const state: GameState = {
              ...createInitialGameState(),
              user,
              challenges,
              currentView: view,
              currentChallengeIndex: 2,
              initialized: true,
            };
            
            const action: GameAction = { type: 'RESET_GAME' };
            const newState = gameReducer(state, action);
            
            // User should be preserved
            expect(newState.user).toEqual(user);
            // Initialized should be preserved
            expect(newState.initialized).toBe(true);
            // Other state should be reset
            expect(newState.challenges).toEqual([]);
            expect(newState.currentChallengeIndex).toBe(0);
            expect(newState.currentView).toBe('loading');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('CLEAR_ERRORS action', () => {
    it('should clear all error states', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (userError, challengesError, submissionError) => {
            const state: GameState = {
              ...createInitialGameState(),
              errors: {
                user: userError,
                challenges: challengesError,
                submission: submissionError,
              },
            };
            
            const action: GameAction = { type: 'CLEAR_ERRORS' };
            const newState = gameReducer(state, action);
            
            // All errors should be cleared
            expect(newState.errors.user).toBeNull();
            expect(newState.errors.challenges).toBeNull();
            expect(newState.errors.submission).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Reducer immutability', () => {
    it('should not mutate the original state', () => {
      fc.assert(
        fc.property(
          viewTypeArb,
          userProfileArb,
          fc.array(gameChallengeArb, { maxLength: 5 }),
          (view, user, challenges) => {
            const initialState = createInitialGameState();
            const originalState = JSON.parse(JSON.stringify(initialState));
            
            // Apply multiple actions
            let state = gameReducer(initialState, { type: 'SET_VIEW', payload: view });
            state = gameReducer(state, { type: 'SET_USER', payload: user });
            state = gameReducer(state, { type: 'SET_CHALLENGES', payload: challenges });
            
            // Original state should not be mutated
            expect(initialState).toEqual(originalState);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
