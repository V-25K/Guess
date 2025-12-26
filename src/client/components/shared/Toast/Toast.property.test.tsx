/**
 * Toast Component Property Tests
 * Property-based tests for Toast component using fast-check
 * Requirements: 8.5
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { Toast, ToastType, DEFAULT_TOAST_DURATION } from './Toast';

const VALID_TYPES: ToastType[] = ['success', 'error', 'warning', 'info'];

// Tailwind classes that should be present for each type
const TYPE_CLASSES: Record<ToastType, string[]> = {
  success: ['bg-success-light', 'text-success-text', 'border-success'],
  error: ['bg-error-light', 'text-error-text', 'border-error'],
  warning: ['bg-warning-light', 'text-warning-text', 'border-warning'],
  info: ['bg-info-light', 'text-info-text', 'border-info'],
};

describe('Toast Property Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  /**
   * **Feature: frontend-game-redesign, Property: Toast Auto-Dismiss**
   * 
   * For any positive duration value, when a Toast component is rendered with that duration,
   * the Toast SHALL call onDismiss after the specified duration.
   */
  it('should auto-dismiss after the specified duration for any positive duration', () => {
    fc.assert(
      fc.property(
        // Generate positive durations between 100ms and 10000ms
        fc.integer({ min: 100, max: 10000 }),
        fc.constantFrom(...VALID_TYPES),
        fc.string({ minLength: 1, maxLength: 100 }),
        (duration, type, message) => {
          const onDismiss = vi.fn();
          const testId = `test-toast-${Date.now()}`;

          render(
            <Toast
              id={testId}
              message={message}
              type={type}
              duration={duration}
              onDismiss={onDismiss}
            />
          );

          // onDismiss should not be called immediately
          expect(onDismiss).not.toHaveBeenCalled();

          // Advance time to just before the duration
          vi.advanceTimersByTime(duration - 1);
          expect(onDismiss).not.toHaveBeenCalled();

          // Advance time past the duration
          vi.advanceTimersByTime(2);
          expect(onDismiss).toHaveBeenCalledTimes(1);
          expect(onDismiss).toHaveBeenCalledWith(testId);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Toast type rendering with Tailwind classes
   * For any valid type, the toast should render with the correct Tailwind CSS classes
   */
  it('should render correct Tailwind classes for any valid type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_TYPES),
        fc.string({ minLength: 1, maxLength: 100 }),
        (type, message) => {
          const onDismiss = vi.fn();
          const testId = `test-toast-${Date.now()}`;

          const { container } = render(
            <Toast
              id={testId}
              message={message}
              type={type}
              duration={DEFAULT_TOAST_DURATION}
              onDismiss={onDismiss}
            />
          );

          const toast = container.querySelector('[role="alert"]');
          
          // Toast must exist
          expect(toast).not.toBeNull();
          
          // Toast must have the correct type-specific Tailwind classes
          const expectedClasses = TYPE_CLASSES[type];
          const toastClasses = toast?.className || '';
          
          expectedClasses.forEach((expectedClass) => {
            expect(toastClasses).toContain(expectedClass);
          });

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: frontend-game-redesign, Property 10: Reduced Motion Respect**
   * **Validates: Requirements 8.5**
   * 
   * For any Toast component, the rendered element SHALL have the motion-reduce:animate-none
   * class to respect the prefers-reduced-motion media query.
   */
  it('should have reduced motion support classes for any toast type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_TYPES),
        fc.string({ minLength: 1, maxLength: 100 }),
        (type, message) => {
          const onDismiss = vi.fn();
          const testId = `test-toast-${Date.now()}`;

          const { container } = render(
            <Toast
              id={testId}
              message={message}
              type={type}
              duration={DEFAULT_TOAST_DURATION}
              onDismiss={onDismiss}
            />
          );

          const toast = container.querySelector('[role="alert"]');
          
          // Toast must exist
          expect(toast).not.toBeNull();
          
          const toastClasses = toast?.className || '';
          
          // Toast must have animation class
          expect(toastClasses).toContain('animate-slide-up');
          
          // Toast must have reduced motion support class
          expect(toastClasses).toContain('motion-reduce:animate-none');

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Toast message display
   * For any non-empty message, the toast should display the message text
   */
  it('should display the message text for any non-empty message', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_TYPES),
        fc.string({ minLength: 1, maxLength: 200 }),
        (type, message) => {
          const onDismiss = vi.fn();
          const testId = `test-toast-${Date.now()}`;

          const { container } = render(
            <Toast
              id={testId}
              message={message}
              type={type}
              duration={DEFAULT_TOAST_DURATION}
              onDismiss={onDismiss}
            />
          );

          // Find the message text in the toast
          const toast = container.querySelector('[role="alert"]');
          
          // Toast must exist and contain the message
          expect(toast).not.toBeNull();
          expect(toast?.textContent).toContain(message);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
