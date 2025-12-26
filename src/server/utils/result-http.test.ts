/**
 * Unit tests for HTTP Response Handler
 * 
 * Tests the handleResult and withResult functions for proper HTTP response handling.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleResult, withResult } from './result-http.js';
import { ok, err } from '../../shared/utils/result.js';
import {
  validationError,
  notFoundError,
  rateLimitError,
  databaseError,
  externalApiError,
  internalError,
} from '../../shared/models/errors.js';

describe('result-http', () => {
  let mockRes: Partial<Response>;
  let mockReq: Partial<Request>;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
    
    mockRes = {
      status: statusSpy as any,
      json: jsonSpy as any,
    };

    mockReq = {};
  });

  describe('handleResult', () => {
    it('should return 200 for Ok results', () => {
      // Requirement 5.1: WHEN an API route receives an Ok Result THEN the system SHALL return HTTP 200
      const result = ok({ userId: '123', username: 'testuser' });
      
      handleResult(result, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ userId: '123', username: 'testuser' });
    });

    it('should return 400 for ValidationError', () => {
      // Requirement 5.3: WHEN an API route encounters a validation error THEN the system SHALL return HTTP 400
      const result = err(validationError([
        { field: 'email', message: 'Invalid email format' },
        { field: 'age', message: 'Must be at least 18' }
      ]));
      
      handleResult(result, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Validation failed',
        fields: [
          { field: 'email', message: 'Invalid email format' },
          { field: 'age', message: 'Must be at least 18' }
        ]
      });
    });

    it('should return 404 for NotFoundError', () => {
      // Requirement 5.4: WHEN an API route encounters a not found error THEN the system SHALL return HTTP 404
      const result = err(notFoundError('User', 'user123'));
      
      handleResult(result, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'User not found',
        resource: 'User',
        identifier: 'user123'
      });
    });

    it('should return 429 for RateLimitError', () => {
      // Requirement 5.2: WHEN an API route receives an Err Result THEN the system SHALL return an appropriate HTTP error status
      const result = err(rateLimitError(5000));
      
      handleResult(result, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Rate limit exceeded',
        retryAfterMs: 5000
      });
    });

    it('should return 500 for DatabaseError without exposing details', () => {
      // Requirement 5.5: WHEN an API route encounters an internal error THEN the system SHALL return HTTP 500 with a safe error message
      // Requirement 5.6: Test sensitive error details are not exposed to clients
      const result = err(databaseError('redis.get', 'Connection timeout to Redis server'));
      
      handleResult(result, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Database error'
      });
      
      // Verify sensitive details are NOT in the response
      const responseBody = jsonSpy.mock.calls[0][0];
      expect(responseBody).not.toHaveProperty('operation');
      expect(responseBody).not.toHaveProperty('message');
      expect(JSON.stringify(responseBody)).not.toContain('redis.get');
      expect(JSON.stringify(responseBody)).not.toContain('Connection timeout');
    });

    it('should return 502 for ExternalApiError', () => {
      // Requirement 5.2: WHEN an API route receives an Err Result THEN the system SHALL return an appropriate HTTP error status
      const result = err(externalApiError('Reddit API', 'Service unavailable', 503));
      
      handleResult(result, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(502);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'External service error: Reddit API'
      });
    });

    it('should return 500 for InternalError without exposing details', () => {
      // Requirement 5.5: WHEN an API route encounters an internal error THEN the system SHALL return HTTP 500 with a safe error message
      // Requirement 5.6: Test sensitive error details are not exposed to clients
      const result = err(internalError('Unexpected null pointer', new Error('Stack trace here')));
      
      handleResult(result, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
      
      // Verify sensitive details are NOT in the response
      const responseBody = jsonSpy.mock.calls[0][0];
      expect(responseBody).not.toHaveProperty('message');
      expect(responseBody).not.toHaveProperty('cause');
      expect(JSON.stringify(responseBody)).not.toContain('null pointer');
      expect(JSON.stringify(responseBody)).not.toContain('Stack trace');
    });

    it('should include appropriate fields in error responses', () => {
      // Requirement 5.2: Test error responses include appropriate fields
      
      // ValidationError should include fields array
      const validationResult = err(validationError([{ field: 'name', message: 'Required' }]));
      handleResult(validationResult, mockRes as Response);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          fields: expect.any(Array)
        })
      );
      
      // NotFoundError should include resource and identifier
      statusSpy.mockClear();
      jsonSpy.mockClear();
      const notFoundResult = err(notFoundError('Challenge', 'ch123'));
      handleResult(notFoundResult, mockRes as Response);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          resource: 'Challenge',
          identifier: 'ch123'
        })
      );
      
      // RateLimitError should include retryAfterMs
      statusSpy.mockClear();
      jsonSpy.mockClear();
      const rateLimitResult = err(rateLimitError(3000));
      handleResult(rateLimitResult, mockRes as Response);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          retryAfterMs: 3000
        })
      );
    });
  });

  describe('withResult', () => {
    it('should handle successful Results', async () => {
      // Requirement 5.1: WHEN an API route receives an Ok Result THEN the system SHALL return HTTP 200
      const handler = withResult(async (req, res) => {
        return ok({ data: 'success' });
      });
      
      await handler(mockReq as Request, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ data: 'success' });
    });

    it('should handle error Results', async () => {
      // Requirement 5.2: WHEN an API route receives an Err Result THEN the system SHALL return an appropriate HTTP error status
      const handler = withResult(async (req, res) => {
        return err(notFoundError('Item', 'item456'));
      });
      
      await handler(mockReq as Request, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Item not found',
        resource: 'Item',
        identifier: 'item456'
      });
    });

    it('should catch unexpected errors and return 500', async () => {
      // Requirement 5.2: Test withResult wrapper catches unexpected errors
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const handler = withResult(async (req, res) => {
        throw new Error('Unexpected error');
      });
      
      await handler(mockReq as Request, mockRes as Response);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
      
      consoleErrorSpy.mockRestore();
    });

    it('should not expose error details when catching unexpected errors', async () => {
      // Requirement 5.6: Test sensitive error details are not exposed to clients
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const handler = withResult(async (req, res) => {
        throw new Error('Database password is: secret123');
      });
      
      await handler(mockReq as Request, mockRes as Response);
      
      const responseBody = jsonSpy.mock.calls[0][0];
      expect(JSON.stringify(responseBody)).not.toContain('secret123');
      expect(JSON.stringify(responseBody)).not.toContain('Database password');
      expect(responseBody).toEqual({ error: 'Internal server error' });
      
      consoleErrorSpy.mockRestore();
    });

    it('should pass request and response to handler', async () => {
      // Verify that the handler receives the correct req and res objects
      const handlerSpy = vi.fn().mockResolvedValue(ok({ test: 'data' }));
      const handler = withResult(handlerSpy);
      
      await handler(mockReq as Request, mockRes as Response);
      
      expect(handlerSpy).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });
});
