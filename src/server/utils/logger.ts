/**
 * Structured Logger Utility
 * Devvit-compatible logging with structured JSON format
 * 
 * Devvit uses console.log/console.error which are captured by `devvit logs`
 * This utility provides structured logging with consistent format and metadata
 * 
 * Requirements: Phase 4.3 - Structured Logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = {
  /** Service or component name */
  service?: string;
  /** Operation being performed */
  operation?: string;
  /** User ID if applicable */
  userId?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Additional metadata */
  [key: string]: unknown;
};

export type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
};

/**
 * Configuration for the logger
 */
export type LoggerConfig = {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include stack traces */
  includeStackTrace: boolean;
  /** Default context to include in all logs */
  defaultContext?: LogContext;
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  includeStackTrace: true,
};

/**
 * Structured Logger for Devvit applications
 * 
 * Usage:
 * ```typescript
 * const logger = new Logger({ service: 'UserService' });
 * logger.info('User created', { userId: '123' });
 * logger.error('Failed to create user', error, { userId: '123' });
 * ```
 */
export class Logger {
  private config: LoggerConfig;
  private defaultContext: LogContext;

  constructor(context?: LogContext, config?: Partial<LoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.defaultContext = context || {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger(
      { ...this.defaultContext, ...context },
      this.config
    );
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  /**
   * Start a timer for measuring operation duration
   * Returns a function to call when the operation completes
   */
  startTimer(operation: string, context?: LogContext): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.info(`${operation} completed`, { ...context, duration, operation });
    };
  }

  /**
   * Log with timing - wraps an async operation and logs duration
   */
  async timed<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.info(`${operation} completed`, { ...context, duration, operation, success: true });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`${operation} failed`, error, { ...context, duration, operation, success: false });
      throw error;
    }
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown
  ): void {
    // Check if this log level should be output
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    // Merge contexts
    const mergedContext = { ...this.defaultContext, ...context };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    // Add error details if present
    if (error) {
      entry.error = this.formatError(error);
    }

    // Output the log entry
    this.output(entry);
  }

  /**
   * Format an error for logging
   */
  private formatError(error: unknown): LogEntry['error'] {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: this.config.includeStackTrace ? error.stack : undefined,
      };
    }

    return {
      name: 'UnknownError',
      message: String(error),
    };
  }

  /**
   * Output the log entry to console
   * Devvit captures console.log/console.error for `devvit logs`
   */
  private output(entry: LogEntry): void {
    const logString = JSON.stringify(entry);

    switch (entry.level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'debug':
      case 'info':
      default:
        console.log(logString);
        break;
    }
  }
}

/**
 * Create a logger instance with default configuration
 */
export function createLogger(context?: LogContext, config?: Partial<LoggerConfig>): Logger {
  return new Logger(context, config);
}

/**
 * Global logger instance for quick access
 */
export const logger = createLogger({ service: 'GuessTheLink' });
