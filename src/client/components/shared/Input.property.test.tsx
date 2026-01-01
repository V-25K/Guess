/**
 * Input Component Property Tests
 * Property-based tests for Input component using fast-check
 * Requirements: 2.5
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { Input } from './Input';

describe('Input Property Tests', () => {
  // Ensure cleanup after each test
  afterEach(() => {
    cleanup();
  });

  /**
   * **Feature: frontend-audit-refactor, Property 4: Input Error Display**
   * **Validates: Requirements 2.5**
   * 
   * For any non-empty error string, when an Input component receives that error prop,
   * the rendered element SHALL display the error message and have error styling applied.
   */
  it('should display error message and apply error styling for any non-empty error string', () => {
    fc.assert(
      fc.property(
        // Generate non-empty strings for error messages
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        (errorMessage) => {
          // Clean up before each property test iteration
          cleanup();
          
          const { container } = render(<Input error={errorMessage} />);
          
          // Error message must be displayed
          const errorElement = screen.getByRole('alert');
          expect(errorElement).toBeInTheDocument();
          expect(errorElement.textContent).toContain(errorMessage);
          
          // Input container must have error styling (border-red-500 class in Tailwind)
          const inputContainer = container.querySelector('.border-red-500');
          expect(inputContainer).not.toBeNull();
          
          // Input must have aria-invalid attribute
          const inputElement = container.querySelector('input');
          expect(inputElement?.getAttribute('aria-invalid')).toBe('true');
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property: Error message has correct accessibility attributes
   * For any non-empty error string, the error message element should have role="alert"
   * and be associated with the input via aria-describedby
   */
  it('should have correct accessibility attributes for any error message', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        (errorMessage) => {
          // Clean up before each property test iteration
          cleanup();
          
          const testId = `test-input-${Math.random().toString(36).substr(2, 9)}`;
          const { container } = render(<Input id={testId} error={errorMessage} />);
          
          // Error message must have role="alert"
          const errorElement = screen.getByRole('alert');
          expect(errorElement).toBeInTheDocument();
          
          // Input must have aria-describedby pointing to error
          const inputElement = container.querySelector('input');
          const describedBy = inputElement?.getAttribute('aria-describedby');
          expect(describedBy).toBe(`${testId}-error`);
          
          // Error element must have matching id
          expect(errorElement.id).toBe(`${testId}-error`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error takes precedence over helper text
   * For any combination of error and helper text, only error should be displayed
   */
  it('should display error instead of helper text when both are provided', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (errorMessage, helperText) => {
          // Clean up before each property test iteration
          cleanup();
          
          render(<Input error={errorMessage} helperText={helperText} />);
          
          // Error message must be displayed (via role="alert")
          const errorElement = screen.getByRole('alert');
          expect(errorElement).toBeInTheDocument();
          expect(errorElement.textContent).toContain(errorMessage);
          
          // Helper text should NOT be visible when error is present
          // The component hides helper text when error exists
          expect(screen.queryByText(helperText)).not.toBeInTheDocument();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: No error styling when error prop is empty or undefined
   * For any input without error, no error styling should be applied
   */
  it('should not apply error styling when error is not provided', () => {
    fc.assert(
      fc.property(
        fc.option(fc.constant(''), { nil: undefined }),
        (errorValue) => {
          // Clean up before each property test iteration
          cleanup();
          
          const { container } = render(<Input error={errorValue ?? undefined} />);
          
          // No error styling on container (no border-red-500 class)
          const containerWithError = container.querySelector('.border-red-500');
          expect(containerWithError).toBeNull();
          
          // No aria-invalid attribute
          const inputElement = container.querySelector('input');
          expect(inputElement?.getAttribute('aria-invalid')).toBeNull();
          
          // No alert role element
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        }
      ),
      { numRuns: 100 }
    );
  });
});
