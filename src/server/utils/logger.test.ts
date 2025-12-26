/**
 * Logger Utility Tests
 * Tests for structured logging functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, createLogger, type LogLevel } from './logger.js';

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      const logger = new Logger({ service: 'TestService' });
      logger.info('Test message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(logEntry.level).toBe('info');
      expect(logEntry.message).toBe('Test message');
      expect(logEntry.context.service).toBe('TestService');
    });

    it('should log warn messages', () => {
      const logger = new Logger();
      logger.warn('Warning message');

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.warn.mock.calls[0][0]);
      expect(logEntry.level).toBe('warn');
      expect(logEntry.message).toBe('Warning message');
    });

    it('should log error messages with error details', () => {
      const logger = new Logger();
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toBe('Error occurred');
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Test error');
    });

    it('should respect minimum log level', () => {
      const logger = new Logger({}, { minLevel: 'warn' });
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');

      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('context', () => {
    it('should include default context in all logs', () => {
      const logger = new Logger({ service: 'MyService', version: '1.0.0' });
      logger.info('Test');

      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(logEntry.context.service).toBe('MyService');
      expect(logEntry.context.version).toBe('1.0.0');
    });

    it('should merge additional context', () => {
      const logger = new Logger({ service: 'MyService' });
      logger.info('Test', { userId: '123', action: 'login' });

      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(logEntry.context.service).toBe('MyService');
      expect(logEntry.context.userId).toBe('123');
      expect(logEntry.context.action).toBe('login');
    });

    it('should create child logger with extended context', () => {
      const parentLogger = new Logger({ service: 'MyService' });
      const childLogger = parentLogger.child({ requestId: 'req-123' });
      
      childLogger.info('Child log');

      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(logEntry.context.service).toBe('MyService');
      expect(logEntry.context.requestId).toBe('req-123');
    });
  });

  describe('timing', () => {
    it('should track operation duration with startTimer', async () => {
      const logger = new Logger();
      const endTimer = logger.startTimer('TestOperation');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      endTimer();

      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(logEntry.message).toBe('TestOperation completed');
      expect(logEntry.context.duration).toBeGreaterThanOrEqual(10);
      expect(logEntry.context.operation).toBe('TestOperation');
    });

    it('should track async operation with timed()', async () => {
      const logger = new Logger();
      
      const result = await logger.timed('AsyncOperation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      expect(result).toBe('success');
      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(logEntry.context.success).toBe(true);
      expect(logEntry.context.duration).toBeGreaterThanOrEqual(10);
    });

    it('should log error when timed operation fails', async () => {
      const logger = new Logger();
      
      await expect(
        logger.timed('FailingOperation', async () => {
          throw new Error('Operation failed');
        })
      ).rejects.toThrow('Operation failed');

      const logEntry = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logEntry.message).toBe('FailingOperation failed');
      expect(logEntry.context.success).toBe(false);
    });
  });

  describe('createLogger', () => {
    it('should create a logger with context', () => {
      const logger = createLogger({ service: 'TestService' });
      logger.info('Test');

      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(logEntry.context.service).toBe('TestService');
    });
  });

  describe('error formatting', () => {
    it('should format Error objects', () => {
      const logger = new Logger();
      const error = new Error('Test error');
      logger.error('Error', error);

      const logEntry = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Test error');
      expect(logEntry.error.stack).toBeDefined();
    });

    it('should handle non-Error objects', () => {
      const logger = new Logger();
      logger.error('Error', 'string error');

      const logEntry = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logEntry.error.name).toBe('UnknownError');
      expect(logEntry.error.message).toBe('string error');
    });

    it('should exclude stack trace when configured', () => {
      const logger = new Logger({}, { minLevel: 'info', includeStackTrace: false });
      const error = new Error('Test error');
      logger.error('Error', error);

      const logEntry = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logEntry.error.stack).toBeUndefined();
    });
  });

  describe('timestamp', () => {
    it('should include ISO timestamp in logs', () => {
      const logger = new Logger();
      logger.info('Test');

      const logEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(logEntry.timestamp).toBeDefined();
      expect(() => new Date(logEntry.timestamp)).not.toThrow();
    });
  });
});
