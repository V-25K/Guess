/**
 * Avatar Component Property Tests
 * Property-based tests for Avatar component using fast-check
 * Requirements: 8.4
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { Avatar, AvatarSize } from './Avatar';

const VALID_SIZES: AvatarSize[] = ['sm', 'md', 'lg', 'xl'];

describe('Avatar Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * **Feature: frontend-game-redesign, Property 8: Image Alt Text**
   * **Validates: Requirements 8.4**
   * 
   * For any Avatar component with an image src, the rendered img element 
   * SHALL have a non-empty alt attribute.
   */
  it('should have non-empty alt text for any avatar with image', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom(...VALID_SIZES),
        (src, alt, size) => {
          const { container } = render(
            <Avatar src={src} alt={alt} size={size} />
          );

          const img = container.querySelector('img');
          
          // Image must exist
          expect(img).not.toBeNull();
          
          // Image must have alt attribute
          expect(img?.hasAttribute('alt')).toBe(true);
          
          // Alt text must not be empty
          const altText = img?.getAttribute('alt');
          expect(altText).toBe(alt);
          expect(altText?.length).toBeGreaterThan(0);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Fallback avatar has aria-label
   * For any Avatar component without an image (fallback state), 
   * the rendered element SHALL have an aria-label for accessibility.
   */
  it('should have aria-label for fallback avatar', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom(...VALID_SIZES),
        (alt, size) => {
          const { container } = render(
            <Avatar alt={alt} size={size} />
          );

          // Should render fallback (no img element)
          const img = container.querySelector('img');
          expect(img).toBeNull();
          
          // Should have a div with role="img" and aria-label
          const fallbackDiv = container.querySelector('[role="img"]');
          expect(fallbackDiv).not.toBeNull();
          
          // Fallback must have aria-label
          expect(fallbackDiv?.hasAttribute('aria-label')).toBe(true);
          
          // aria-label must match the alt prop
          const ariaLabel = fallbackDiv?.getAttribute('aria-label');
          expect(ariaLabel).toBe(alt);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Avatar renders correct size classes
   * For any valid size, the avatar should render with the correct Tailwind size classes.
   */
  it('should render correct size classes for any valid size', () => {
    const SIZE_CLASSES: Record<AvatarSize, string[]> = {
      sm: ['w-8', 'h-8'],
      md: ['w-10', 'h-10'],
      lg: ['w-12', 'h-12'],
      xl: ['w-16', 'h-16'],
    };

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom(...VALID_SIZES),
        (alt, size) => {
          const { container } = render(
            <Avatar alt={alt} size={size} />
          );

          const avatar = container.firstChild as HTMLElement;
          
          // Avatar must exist
          expect(avatar).not.toBeNull();
          
          // Avatar must have the correct size classes
          const expectedClasses = SIZE_CLASSES[size];
          const avatarClasses = avatar?.className || '';
          
          expectedClasses.forEach((expectedClass) => {
            expect(avatarClasses).toContain(expectedClass);
          });

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Fallback initials generation
   * For any alt text, the fallback should display initials derived from the alt text.
   */
  it('should generate initials from alt text for fallback', () => {
    fc.assert(
      fc.property(
        // Generate names with at least one word
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 })
          .map(words => words.join(' ')),
        (alt) => {
          const { container } = render(
            <Avatar alt={alt} />
          );

          const fallbackDiv = container.querySelector('[role="img"]');
          expect(fallbackDiv).not.toBeNull();
          
          // Get the initials text
          const initialsSpan = fallbackDiv?.querySelector('span');
          expect(initialsSpan).not.toBeNull();
          
          const initials = initialsSpan?.textContent || '';
          
          // Initials should be uppercase
          expect(initials).toBe(initials.toUpperCase());
          
          // Initials should be at most 2 characters
          expect(initials.length).toBeLessThanOrEqual(2);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
