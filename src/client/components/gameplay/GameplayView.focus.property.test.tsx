/**
 * GameplayView Focus Indicator Property Tests
 * Property-based tests for focus indicator visibility
 * Requirements: 8.3
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { GameplayView } from './GameplayView';
import type { GameChallenge } from '../../../shared/models/challenge.types';

// Focus indicator classes that should be present on interactive elements
const FOCUS_INDICATOR_PATTERNS = [
  'focus:ring',
  'focus:outline',
  'focus-visible:ring',
  'focus-visible:outline',
];

/**
 * Helper to check if an element has focus indicator classes
 */
function hasFocusIndicator(className: string): boolean {
  return FOCUS_INDICATOR_PATTERNS.some(pattern => className.includes(pattern));
}

describe('GameplayView Focus Indicator Property Tests', () => {
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

  /**
   * **Feature: frontend-game-redesign, Property 9: Focus Indicator Visibility**
   * **Validates: Requirements 8.3**
   * 
   * For any interactive element (button, link) in the GameplayView,
   * when focused, the element should have visible focus styles
   * (focus:ring or focus:outline classes).
   */
  it('should have focus indicator classes on all buttons', () => {
    fc.assert(
      fc.property(
        challengeArbitrary,
        (challengeData) => {
          const challenge: GameChallenge = challengeData as GameChallenge;
          
          const { container } = render(
            <GameplayView
              challenge={challenge}
              onSubmitGuess={vi.fn().mockResolvedValue({
                isCorrect: false,
                attemptsRemaining: 9,
                potentialScore: 90,
                gameOver: false,
                explanation: 'Try again'
              })}
              onNextChallenge={vi.fn()}
              onBackToMenu={vi.fn()}
            />
          );
          
          // Get all button elements
          const buttons = container.querySelectorAll('button');
          
          // Each button should have focus indicator classes
          buttons.forEach((button) => {
            const className = button.className;
            const hasIndicator = hasFocusIndicator(className);
            
            // Assert that the button has focus indicator
            expect(hasIndicator).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: frontend-game-redesign, Property 9: Focus Indicator Visibility**
   * **Validates: Requirements 8.3**
   * 
   * For any interactive element with role="button" in the GameplayView,
   * the element should have visible focus styles.
   */
  it('should have focus indicator classes on elements with role="button"', () => {
    fc.assert(
      fc.property(
        challengeArbitrary,
        (challengeData) => {
          const challenge: GameChallenge = challengeData as GameChallenge;
          
          const { container } = render(
            <GameplayView
              challenge={challenge}
              onSubmitGuess={vi.fn().mockResolvedValue({
                isCorrect: false,
                attemptsRemaining: 9,
                potentialScore: 90,
                gameOver: false,
                explanation: 'Try again'
              })}
              onNextChallenge={vi.fn()}
              onBackToMenu={vi.fn()}
            />
          );
          
          // Get all elements with role="button"
          const roleButtons = container.querySelectorAll('[role="button"]');
          
          // Each element with role="button" should have focus indicator classes
          roleButtons.forEach((element) => {
            const className = element.className;
            const hasIndicator = hasFocusIndicator(className);
            
            // Assert that the element has focus indicator
            expect(hasIndicator).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: frontend-game-redesign, Property 9: Focus Indicator Visibility**
   * **Validates: Requirements 8.3**
   * 
   * For any input element in the GameplayView,
   * the element should have visible focus styles.
   */
  it('should have focus indicator classes on input elements', () => {
    fc.assert(
      fc.property(
        challengeArbitrary,
        (challengeData) => {
          const challenge: GameChallenge = challengeData as GameChallenge;
          
          const { container } = render(
            <GameplayView
              challenge={challenge}
              onSubmitGuess={vi.fn().mockResolvedValue({
                isCorrect: false,
                attemptsRemaining: 9,
                potentialScore: 90,
                gameOver: false,
                explanation: 'Try again'
              })}
              onNextChallenge={vi.fn()}
              onBackToMenu={vi.fn()}
            />
          );
          
          // Get all input elements
          const inputs = container.querySelectorAll('input');
          
          // Each input should have focus indicator classes
          inputs.forEach((input) => {
            const className = input.className;
            // Inputs can use focus:border or focus:ring
            const hasIndicator = hasFocusIndicator(className) || 
                                 className.includes('focus:border');
            
            // Assert that the input has focus indicator
            expect(hasIndicator).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
