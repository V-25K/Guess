/**
 * HTTP Response Handler for Result Pattern
 * 
 * Provides Express-compatible response handlers for Results, following Devvit Web patterns.
 * Maps Result types to appropriate HTTP status codes and response bodies.
 * 
 * @module result-http
 */

import type { Request, Response } from 'express';
import type { Result } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { isOk } from '../../shared/utils/result.js';

/**
 * Handle a Result in an Express route handler
 * Automatically sets appropriate status codes and response bodies
 * 
 * @param result - The Result to handle
 * @param res - Express Response object
 * 
 * @example
 * ```typescript
 * const result = await userService.getUserProfile(userId);
 * return handleResult(result, res);
 * ```
 */
export function handleResult<T>(
  result: Result<T, AppError>,
  res: Response
): void {
  if (isOk(result)) {
    // Success case - return data directly (Devvit Web pattern)
    res.status(200).json(result.value);
  } else {
    // Error case - map to appropriate HTTP response
    const { status, body } = errorToHttp(result.error);
    res.status(status).json(body);
  }
}

/**
 * Map AppError to HTTP status code and response body
 * Follows Devvit Web error response patterns
 * 
 * @param error - The AppError to map
 * @returns Object containing HTTP status code and response body
 */
function errorToHttp(error: AppError): { status: number; body: any } {
  switch (error.type) {
    case 'validation':
      // Check if this is an authentication error (field: 'auth')
      const isAuthError = error.fields.some(f => f.field === 'auth');
      if (isAuthError) {
        return {
          status: 401,
          body: {
            error: 'Unauthorized'
          }
        };
      }
      return { 
        status: 400, 
        body: { 
          error: 'Validation failed', 
          fields: error.fields 
        } 
      };
    case 'not_found':
      return { 
        status: 404, 
        body: { 
          error: `${error.resource} not found`,
          resource: error.resource,
          identifier: error.identifier
        } 
      };
    case 'rate_limit':
      return { 
        status: 429, 
        body: { 
          error: 'Rate limit exceeded', 
          retryAfterMs: error.timeRemainingMs 
        } 
      };
    case 'database':
      // Don't expose internal database details to clients
      return { 
        status: 500, 
        body: { 
          error: 'Database error' 
        } 
      };
    case 'external_api':
      return { 
        status: 502, 
        body: { 
          error: `External service error: ${error.service}` 
        } 
      };
    case 'internal':
      // Don't expose internal error details to clients
      return { 
        status: 500, 
        body: { 
          error: 'Internal server error' 
        } 
      };
  }
}

/**
 * Async wrapper for route handlers that return Results
 * Automatically handles Result responses and catches unexpected errors
 * 
 * @param handler - Async function that returns a Result
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * router.get('/profile', withResult(async (req, res) => {
 *   const result = await userService.getUserProfile(userId);
 *   return result;
 * }));
 * ```
 */
export function withResult<T>(
  handler: (req: Request, res: Response) => Promise<Result<T, AppError>>
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await handler(req, res);
      
      // Log errors for debugging
      if (!isOk(result)) {
        console.error('[withResult] Error result:', JSON.stringify(result.error, null, 2));
      }
      
      handleResult(result, res);
    } catch (error) {
      // Unexpected error - log and return 500
      console.error('[withResult] Unexpected error in route handler:', error);
      if (error instanceof Error) {
        console.error('[withResult] Error stack:', error.stack);
      }
      // Don't expose error details to clients for security
      res.status(500).json({ 
        error: 'Internal server error'
      });
    }
  };
}
