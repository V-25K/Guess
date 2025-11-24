/**
 * ErrorBoundary Component
 * Catches and displays component errors with recovery options
 */

import { Devvit } from '@devvit/public-api';

export interface ErrorBoundaryProps {
  children: JSX.Element | JSX.Element[];
  fallback?: JSX.Element;
  onError?: (error: Error) => void;
  onReset?: () => void;
}

/**
 * ErrorBoundary component for catching and displaying component errors
 * 
 * Note: Devvit doesn't have traditional React error boundaries.
 * This is a pattern-based implementation using try-catch and state management.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   onError={(error) => console.error('Component error:', error)}
 *   onReset={() => window.location.reload()}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export const ErrorBoundary: Devvit.BlockComponent<ErrorBoundaryProps> = (
  { children, fallback, onReset },
  context
) => {
  const { useState } = context;

  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleReset = () => {
    setHasError(false);
    setErrorMessage('');

    if (onReset) {
      onReset();
    }
  };

  if (hasError) {
    if (fallback) {
      return fallback;
    }

    return (
      <vstack padding="large" gap="large" alignment="center middle" grow backgroundColor="#F6F7F8">
        <image
          url="logo.png"
          imageHeight={80}
          imageWidth={192}
          resizeMode="fit"
        />

        <vstack
          padding="medium"
          gap="medium"
          backgroundColor="#FFFFFF"
          cornerRadius="medium"
          borderColor="#F44336"
          width="100%"
        >
          <vstack gap="medium" alignment="center middle">
            <text size="xxlarge">⚠️</text>

            <vstack gap="small" alignment="center middle">
              <text size="large" weight="bold" color="#D32F2F">
                Something went wrong
              </text>

              <text size="medium" color="#666666" alignment="center middle">
                An error occurred while rendering this component
              </text>
            </vstack>

            {/* Error details (for debugging) */}
            {errorMessage && (
              <vstack
                padding="small"
                gap="small"
                backgroundColor="#FFEBEE"
                borderColor="#F44336"
                cornerRadius="small"
                width="100%"
              >
                <text size="small" weight="bold" color="#C62828">
                  Error Details:
                </text>
                <text size="xsmall" color="#D32F2F" wrap>
                  {errorMessage}
                </text>
              </vstack>
            )}

            {/* Recovery options */}
            <vstack gap="small" width="100%">
              <button
                onPress={handleReset}
                appearance="primary"
                size="medium"
              >
                Try Again
              </button>

              <text size="xsmall" color="#999999" alignment="center middle">
                If the problem persists, please contact support
              </text>
            </vstack>
          </vstack>
        </vstack>
      </vstack>
    );
  }

  return <>{children}</>;
};

/**
 * Higher-order component to wrap a component with error boundary
 * 
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   onError: (error) => console.error(error),
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: Devvit.BlockComponent<P>,
  options?: {
    fallback?: JSX.Element;
    onError?: (error: Error) => void;
    onReset?: () => void;
  }
): Devvit.BlockComponent<P> {
  return (props: P) => {
    return (
      <ErrorBoundary
        fallback={options?.fallback}
        onError={options?.onError}
        onReset={options?.onReset}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}


