/**
 * GameplayView Property Tests
 * Property-based tests for GameplayView component using fast-check
 * Requirements: 3.1, 3.2, 3.4
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { getFeedbackState, FeedbackState, GameplayView } from './GameplayView';
import type { GameChallenge } from '../../../shared/models/challenge.types';

describe('GameplayView Property Tests', () => {
  /**
   * **Feature: frontend-audit-refactor, Property 6: Gameplay Feedback State**
   * **Validates: Requirements 3.4**
   * 
   * For any answer submission result (correct/incorrect/game-over), 
   * when the result is received, the Gameplay_View SHALL display 
   * the corresponding visual state (success/error message box).
   */
  describe('getFeedbackState', () => {
    it('should return success state when challenge is completed', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isGameOver
          fc.boolean(), // isCorrect
          fc.boolean(), // isCreator
          (isGameOver, isCorrect, isCreator) => {
            const result = getFeedbackState(true, isGameOver, isCorrect, isCreator);
            // When isCompleted is true, state should always be 'success'
            expect(result).toBe('success');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return success state when game is over and answer is correct', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isCreator
          (isCreator) => {
            // isCompleted = false, isGameOver = true, isCorrect = true
            const result = getFeedbackState(false, true, true, isCreator);
            expect(result).toBe('success');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error state when game is over and answer is incorrect', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isCreator
          (isCreator) => {
            // isCompleted = false, isGameOver = true, isCorrect = false
            const result = getFeedbackState(false, true, false, isCreator);
            expect(result).toBe('error');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return warning state when user is the creator and game is not over', () => {
      // isCompleted = false, isGameOver = false, isCorrect = any, isCreator = true
      const result = getFeedbackState(false, false, false, true);
      expect(result).toBe('warning');
    });

    it('should return default state when game is in progress and user is not creator', () => {
      // isCompleted = false, isGameOver = false, isCorrect = any, isCreator = false
      const result = getFeedbackState(false, false, false, false);
      expect(result).toBe('default');
    });

    it('should always return a valid FeedbackState for any combination of inputs', () => {
      const validStates: FeedbackState[] = ['default', 'success', 'error', 'warning'];
      
      fc.assert(
        fc.property(
          fc.boolean(), // isCompleted
          fc.boolean(), // isGameOver
          fc.boolean(), // isCorrect
          fc.boolean(), // isCreator
          (isCompleted, isGameOver, isCorrect, isCreator) => {
            const result = getFeedbackState(isCompleted, isGameOver, isCorrect, isCreator);
            // Result must be one of the valid states
            expect(validStates).toContain(result);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should follow priority: completed > gameOver+correct > gameOver+incorrect > creator > default', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isCompleted
          fc.boolean(), // isGameOver
          fc.boolean(), // isCorrect
          fc.boolean(), // isCreator
          (isCompleted, isGameOver, isCorrect, isCreator) => {
            const result = getFeedbackState(isCompleted, isGameOver, isCorrect, isCreator);
            
            // Priority 1: isCompleted always returns success
            if (isCompleted) {
              expect(result).toBe('success');
              return;
            }
            
            // Priority 2: gameOver + correct returns success
            if (isGameOver && isCorrect) {
              expect(result).toBe('success');
              return;
            }
            
            // Priority 3: gameOver + incorrect returns error
            if (isGameOver && !isCorrect) {
              expect(result).toBe('error');
              return;
            }
            
            // Priority 4: isCreator returns warning
            if (isCreator) {
              expect(result).toBe('warning');
              return;
            }
            
            // Default case
            expect(result).toBe('default');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ui-ux-mobile-improvements, Property 8: Gameplay Header Data Display**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * For any GameChallenge with title, creator_username, max_score, and players_played,
   * the GameplayView header should contain all four values in its rendered output.
   */
  describe('Gameplay Header Data Display', () => {
    // Generator for valid challenge data
    const challengeArbitrary = fc.record({
      id: fc.uuid(),
      creator_id: fc.uuid(),
      creator_username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      image_url: fc.webUrl(),
      tags: fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
      correct_answer: fc.string({ minLength: 1 }),
      max_score: fc.integer({ min: 1, max: 1000 }),
      score_deduction_per_hint: fc.integer({ min: 1, max: 100 }),
      reddit_post_id: fc.constant(null),
      players_played: fc.integer({ min: 0, max: 10000 }),
      players_completed: fc.integer({ min: 0, max: 10000 }),
      created_at: fc.constant('2024-01-01T00:00:00.000Z'),
      images: fc.array(
        fc.record({
          url: fc.webUrl(),
          isRevealed: fc.boolean(),
          description: fc.option(fc.string(), { nil: undefined }),
        }),
        { minLength: 1, maxLength: 4 }
      ),
      keywords: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
    }).filter(c => c.players_completed <= c.players_played);

    it('should display title, creator_username, max_score, and players_played in header', () => {
      fc.assert(
        fc.property(
          challengeArbitrary,
          (challengeData) => {
            const challenge: GameChallenge = challengeData as GameChallenge;
            
            const { container } = render(
              <GameplayView
                challenge={challenge}
                onSubmitGuess={vi.fn().mockResolvedValue({ isCorrect: false, attemptsRemaining: 9, potentialScore: 90, gameOver: false, explanation: 'Try again' })}
                onNextChallenge={vi.fn()}
                onBackToMenu={vi.fn()}
              />
            );
            
            // Check title is displayed (h1 element)
            const titleElement = container.querySelector('h1');
            expect(titleElement?.textContent).toBe(challenge.title);
            
            // Check creator username is displayed (span with "by" prefix)
            const authorElement = container.querySelector('span');
            const allSpans = container.querySelectorAll('span');
            const authorSpan = Array.from(allSpans).find(span => span.textContent?.includes('by '));
            expect(authorSpan?.textContent).toContain(challenge.creator_username);
            
            // Check max_score is displayed (initial potential score) - look for "pts" text
            const allText = container.textContent || '';
            expect(allText).toContain(String(challenge.max_score));
            
            // Check players_played is displayed in stats bar
            expect(allText).toContain(String(challenge.players_played));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ui-ux-mobile-improvements, Property 9: Image Grid Hint Slot**
   * **Validates: Requirements 3.4**
   * 
   * For any GameChallenge with fewer than 4 images, the GameplayView should render
   * exactly 4 grid slots where the (images.length + 1)th slot contains the hint message.
   */
  describe('Image Grid Hint Slot', () => {
    // Generator for challenge with 1-3 images (fewer than 4)
    const challengeWithFewerImagesArbitrary = fc.record({
      id: fc.uuid(),
      creator_id: fc.uuid(),
      creator_username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      image_url: fc.webUrl(),
      tags: fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
      correct_answer: fc.string({ minLength: 1 }),
      max_score: fc.integer({ min: 1, max: 1000 }),
      score_deduction_per_hint: fc.integer({ min: 1, max: 100 }),
      reddit_post_id: fc.constant(null),
      players_played: fc.integer({ min: 0, max: 10000 }),
      players_completed: fc.integer({ min: 0, max: 10000 }),
      created_at: fc.constant('2024-01-01T00:00:00.000Z'),
      images: fc.array(
        fc.record({
          url: fc.webUrl(),
          isRevealed: fc.boolean(),
          description: fc.option(fc.string(), { nil: undefined }),
        }),
        { minLength: 1, maxLength: 3 } // 1-3 images (fewer than 4)
      ),
      keywords: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
    }).filter(c => c.players_completed <= c.players_played);

    it('should render hint slot when fewer than 4 images exist', () => {
      fc.assert(
        fc.property(
          challengeWithFewerImagesArbitrary,
          (challengeData) => {
            const challenge: GameChallenge = challengeData as GameChallenge;
            
            const { container } = render(
              <GameplayView
                challenge={challenge}
                onSubmitGuess={vi.fn().mockResolvedValue({ isCorrect: false, attemptsRemaining: 9, potentialScore: 90, gameOver: false, explanation: 'Try again' })}
                onNextChallenge={vi.fn()}
                onBackToMenu={vi.fn()}
              />
            );
            
            // Check that the grid exists (grid with 2 columns)
            const grid = container.querySelector('.grid-cols-2');
            expect(grid).not.toBeNull();
            
            // Check that image cards match the number of images (elements with role="button" and aria-label containing "Enlarge")
            const imageCards = container.querySelectorAll('[role="button"][aria-label^="Enlarge"]');
            expect(imageCards.length).toBe(challenge.images.length);
            
            // Check that hint card exists when fewer than 4 images (contains "Tap any" text)
            const allText = container.textContent || '';
            expect(allText).toContain('Tap any');
          }
        ),
        { numRuns: 100 }
      );
    });

    // Generator for challenge with exactly 4 images
    const challengeWith4ImagesArbitrary = fc.record({
      id: fc.uuid(),
      creator_id: fc.uuid(),
      creator_username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      image_url: fc.webUrl(),
      tags: fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
      correct_answer: fc.string({ minLength: 1 }),
      max_score: fc.integer({ min: 1, max: 1000 }),
      score_deduction_per_hint: fc.integer({ min: 1, max: 100 }),
      reddit_post_id: fc.constant(null),
      players_played: fc.integer({ min: 0, max: 10000 }),
      players_completed: fc.integer({ min: 0, max: 10000 }),
      created_at: fc.constant('2024-01-01T00:00:00.000Z'),
      images: fc.array(
        fc.record({
          url: fc.webUrl(),
          isRevealed: fc.boolean(),
          description: fc.option(fc.string(), { nil: undefined }),
        }),
        { minLength: 4, maxLength: 4 } // Exactly 4 images
      ),
      keywords: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
    }).filter(c => c.players_completed <= c.players_played);

    it('should not render hint slot when exactly 4 images exist', () => {
      fc.assert(
        fc.property(
          challengeWith4ImagesArbitrary,
          (challengeData) => {
            const challenge: GameChallenge = challengeData as GameChallenge;
            
            const { container } = render(
              <GameplayView
                challenge={challenge}
                onSubmitGuess={vi.fn().mockResolvedValue({ isCorrect: false, attemptsRemaining: 9, potentialScore: 90, gameOver: false, explanation: 'Try again' })}
                onNextChallenge={vi.fn()}
                onBackToMenu={vi.fn()}
              />
            );
            
            // Check that all 4 image cards are rendered (elements with role="button" and aria-label containing "Enlarge")
            const imageCards = container.querySelectorAll('[role="button"][aria-label^="Enlarge"]');
            expect(imageCards.length).toBe(4);
            
            // Check that no hint card exists when 4 images (no "Tap any" text)
            const allText = container.textContent || '';
            expect(allText).not.toContain('Tap any');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
