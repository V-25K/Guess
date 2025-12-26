/**
 * ErrorBoundary Tests
 * Tests for error boundary behavior
 * 
 * **Feature: frontend-audit-refactor, Property 8: Error State Handling**
 * **Validates: Requirements 7.5**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, within } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';

// Suppress console.error during tests since we're testing error handling
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
  cleanup();
});

// Component that throws an error
function ThrowingComponent({ error }: { error: Error }): never {
  throw error;
}

// Component that conditionally throws
function ConditionalThrowingComponent({ 
  shouldThrow, 
  error 
}: { 
  shouldThrow: boolean; 
  error: Error;
}): React.ReactElement | never {
  if (shouldThrow) {
    throw error;
  }
  return <div data-testid="success">Success</div>;
}

// Test error samples
const testErrors = [
  new Error('Test error message'),
  (() => { const e = new Error('Type error'); e.name = 'TypeError'; return e; })(),
  (() => { const e = new Error('Reference error'); e.name = 'ReferenceError'; return e; })(),
];

describe('ErrorBoundary Tests', () => {
  describe('Error State Handling', () => {
    it.each(testErrors)('should catch error: %s', (error) => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowingComponent error={error} />
        </ErrorBoundary>
      );

      const scope = within(container);
      expect(scope.getByRole('alert')).toBeInTheDocument();
      expect(scope.getByText('Something went wrong')).toBeInTheDocument();
    });

    it.each(testErrors)('should call onError callback for: %s', (error) => {
      const onError = vi.fn();
      
      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent error={error} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: error.message }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it.each(testErrors)('should display error details when showDetails is true for: %s', (error) => {
      const { container } = render(
        <ErrorBoundary showDetails={true}>
          <ThrowingComponent error={error} />
        </ErrorBoundary>
      );

      const scope = within(container);
      expect(scope.getByText('Error Details')).toBeInTheDocument();
    });

    it.each(testErrors)('should allow recovery via Try Again button for: %s', (error) => {
      const onReset = vi.fn();
      
      const { container } = render(
        <ErrorBoundary onReset={onReset}>
          <ThrowingComponent error={error} />
        </ErrorBoundary>
      );

      const scope = within(container);
      const tryAgainButton = scope.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainButton);

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('should render custom fallback when provided', () => {
      const error = new Error('Test error');
      const fallbackText = 'Custom fallback content';
      
      const { container } = render(
        <ErrorBoundary fallback={<div data-testid="custom-fallback">{fallbackText}</div>}>
          <ThrowingComponent error={error} />
        </ErrorBoundary>
      );

      const scope = within(container);
      expect(scope.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(scope.getByText(fallbackText)).toBeInTheDocument();
    });

    it.each(testErrors)('should render children normally when no error occurs for: %s', (error) => {
      const { container } = render(
        <ErrorBoundary>
          <ConditionalThrowingComponent shouldThrow={false} error={error} />
        </ErrorBoundary>
      );

      const scope = within(container);
      expect(scope.getByTestId('success')).toBeInTheDocument();
      expect(scope.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('withErrorBoundary HOC', () => {
    it.each(testErrors)('should wrap component with error boundary for: %s', (error) => {
      const WrappedComponent = withErrorBoundary(ThrowingComponent);
      
      const { container } = render(<WrappedComponent error={error} />);

      const scope = within(container);
      expect(scope.getByRole('alert')).toBeInTheDocument();
    });

    it.each(testErrors)('should pass options to error boundary for: %s', (error) => {
      const onError = vi.fn();
      const WrappedComponent = withErrorBoundary(ThrowingComponent, {
        onError,
      });
      
      render(<WrappedComponent error={error} />);

      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it.each(testErrors)('should have proper ARIA attributes for error state for: %s', (error) => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowingComponent error={error} />
        </ErrorBoundary>
      );

      const scope = within(container);
      const alert = scope.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it.each(testErrors)('should have accessible buttons for: %s', (error) => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowingComponent error={error} />
        </ErrorBoundary>
      );

      const scope = within(container);
      const buttons = scope.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });
  });
});
