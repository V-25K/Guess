/**
 * ErrorBoundary Component
 * Catches and displays component errors with recovery options
 */

import React, { Component, ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary component for catching and displaying component errors
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
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const showDetails = this.props.showDetails ?? process.env.NODE_ENV === 'development';

      return (
        <div 
          className="flex items-center justify-center min-h-full p-6 bg-[#FFF8F0] dark:bg-[#0f1419]"
          role="alert" 
          aria-live="assertive"
        >
          <div className="flex flex-col items-center gap-4 max-w-md p-8 bg-white dark:bg-[#1a2332] border-2 border-red-500 dark:border-red-500/50 rounded-2xl shadow-lg">
            <div className="text-5xl leading-none" aria-hidden="true">
              ⚠️
            </div>

            <div className="flex flex-col items-center gap-1 text-center">
              <h2 className="m-0 text-xl font-bold text-red-500 dark:text-red-400">
                Something went wrong
              </h2>
              <p className="m-0 text-sm text-neutral-500 dark:text-white/50">
                An unexpected error occurred. Please try again or reload the page.
              </p>
            </div>

            {showDetails && this.state.error && (
              <details className="w-full border border-neutral-200 dark:border-white/[0.12] rounded-xl overflow-hidden">
                <summary className="px-3 py-2 text-sm font-medium text-neutral-500 dark:text-white/50 bg-neutral-100 dark:bg-[#243044] cursor-pointer select-none hover:bg-neutral-200 dark:hover:bg-[#2d3a4f] focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] focus:ring-inset">
                  Error Details
                </summary>
                <div className="p-3 bg-red-50 dark:bg-red-500/10">
                  <p className="m-0 mb-1 text-xs font-medium text-red-600 dark:text-red-400 break-words">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="m-0 p-2 font-mono text-xs text-neutral-500 dark:text-white/50 bg-neutral-100 dark:bg-[#243044] rounded-lg overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2 w-full">
              <button
                onClick={this.handleReset}
                className="
                  flex-1 px-4 py-2 text-sm font-medium
                  bg-game-primary text-white
                  border-none rounded-game-md cursor-pointer
                  transition-all duration-200
                  hover:-translate-y-0.5 motion-reduce:hover:translate-y-0
                  active:translate-y-0
                  focus:outline-none focus:ring-2 focus:ring-game-primary focus:ring-offset-2
                "
                type="button"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="
                  flex-1 px-4 py-2 text-sm font-medium
                  bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white
                  border border-neutral-200 dark:border-neutral-700 rounded-game-md cursor-pointer
                  transition-all duration-200
                  hover:-translate-y-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 motion-reduce:hover:translate-y-0
                  active:translate-y-0
                  focus:outline-none focus:ring-2 focus:ring-game-primary focus:ring-offset-2
                "
                type="button"
              >
                Reload Page
              </button>
            </div>

            <p className="m-0 text-xs text-neutral-400 dark:text-white/30 text-center">
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    onReset?: () => void;
    showDetails?: boolean;
  }
): React.FC<P> {
  return (props: P) => {
    return (
      <ErrorBoundary
        fallback={options?.fallback}
        onError={options?.onError}
        onReset={options?.onReset}
        showDetails={options?.showDetails}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
