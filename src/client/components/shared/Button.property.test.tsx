/**
 * Button Component Property Tests
 * Property-based tests for Button component using fast-check
 * Requirements: 4.5
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { Button, ButtonVariant, ButtonSize } from './Button';

const VALID_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];
const VALID_SIZES: ButtonSize[] = ['xs', 'sm', 'md', 'lg'];

// Tailwind classes that should be present for each variant
// Note: These match the actual variantStyles in Button.tsx
const VARIANT_CLASSES: Record<ButtonVariant, string[]> = {
  primary: ['bg-game-primary', 'text-white'],
  secondary: ['bg-white', 'border'],
  ghost: ['bg-transparent', 'text-neutral-700'],
  danger: ['bg-red-500', 'text-white'],
};

// Tailwind classes that should be present for each size
// Note: These match the actual sizeStyles in Button.tsx
const SIZE_CLASSES: Record<ButtonSize, string[]> = {
  xs: ['px-2', 'text-xs'],
  sm: ['px-3', 'text-sm'],
  md: ['px-4', 'text-base', 'min-h-touch'],
  lg: ['px-6', 'text-lg'],
};

describe('Button Property Tests', () => {
  /**
   * **Feature: frontend-game-redesign, Property 2: Button Variant Styling**
   * **Validates: Requirements 4.5**
   * 
   * For any valid variant value (primary, secondary, danger, ghost), 
   * when a Button component receives that variant prop, 
   * the rendered element SHALL contain CSS classes specific to that variant.
   */
  it('should render correct Tailwind classes for any valid variant', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_VARIANTS),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test</Button>);
          const button = container.querySelector('button');
          
          // Button must exist
          expect(button).not.toBeNull();
          
          // Button must have the correct variant-specific Tailwind classes
          const expectedClasses = VARIANT_CLASSES[variant];
          const buttonClasses = button?.className || '';
          
          expectedClasses.forEach((expectedClass) => {
            expect(buttonClasses).toContain(expectedClass);
          });
          
          // Button must have base Tailwind classes
          expect(buttonClasses).toContain('inline-flex');
          expect(buttonClasses).toContain('items-center');
          expect(buttonClasses).toContain('justify-center');
          expect(buttonClasses).toContain('rounded-full');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: frontend-game-redesign, Property: Button Size Styling**
   * 
   * For any valid size value (sm, md, lg), 
   * when a Button component receives that size prop, 
   * the rendered element SHALL contain CSS classes specific to that size.
   */
  it('should render correct Tailwind classes for any valid size', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_SIZES),
        (size) => {
          const { container } = render(<Button size={size}>Test</Button>);
          const button = container.querySelector('button');
          
          // Button must exist
          expect(button).not.toBeNull();
          
          // Button must have the correct size-specific Tailwind classes
          const expectedClasses = SIZE_CLASSES[size];
          const buttonClasses = button?.className || '';
          
          expectedClasses.forEach((expectedClass) => {
            expect(buttonClasses).toContain(expectedClass);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Combined property test: variant and size combinations
   * For any combination of valid variant and size, the button should have both sets of classes
   */
  it('should render correct Tailwind classes for any variant and size combination', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_VARIANTS),
        fc.constantFrom(...VALID_SIZES),
        (variant, size) => {
          const { container } = render(
            <Button variant={variant} size={size}>Test</Button>
          );
          const button = container.querySelector('button');
          
          // Button must exist
          expect(button).not.toBeNull();
          
          const buttonClasses = button?.className || '';
          
          // Button must have variant-specific classes
          const variantClasses = VARIANT_CLASSES[variant];
          variantClasses.forEach((expectedClass) => {
            expect(buttonClasses).toContain(expectedClass);
          });
          
          // Button must have size-specific classes
          const sizeClasses = SIZE_CLASSES[size];
          sizeClasses.forEach((expectedClass) => {
            expect(buttonClasses).toContain(expectedClass);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: frontend-game-redesign, Property: Focus Accessibility**
   * **Validates: Requirements 8.3**
   * 
   * For any Button component, the rendered element SHALL have focus ring classes
   * for accessibility compliance.
   */
  it('should have focus ring classes for accessibility', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_VARIANTS),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test</Button>);
          const button = container.querySelector('button');
          
          expect(button).not.toBeNull();
          
          const buttonClasses = button?.className || '';
          
          // Button must have focus ring classes for accessibility
          expect(buttonClasses).toContain('focus:ring-2');
          expect(buttonClasses).toContain('focus:ring-game-primary');
        }
      ),
      { numRuns: 100 }
    );
  });
});
