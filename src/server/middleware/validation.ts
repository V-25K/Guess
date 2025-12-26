/**
 * Validation middleware for Express routes
 * 
 * This middleware provides automatic request validation using Zod schemas,
 * ensuring that only valid data reaches route handlers.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Validation schema that can validate multiple request parts
 */
export interface ValidationSchema {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
  query?: z.ZodSchema;
}

/**
 * Validated request with typed data
 */
export interface ValidatedRequest<T> extends Request {
  validated: T;
}

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse {
  error: string;
  details: ValidationErrorDetail[];
}

/**
 * Formats Zod validation errors into API-friendly format
 * 
 * @param error - Zod validation error
 * @returns Formatted error response
 */
export function formatValidationError(error: ZodError): ValidationErrorResponse {
  return {
    error: 'Validation failed',
    details: error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Creates validation middleware for Express routes
 * 
 * @param schema - Zod schema or object with body/params/query schemas
 * @returns Express middleware function
 * 
 * @example
 * // Single schema validation
 * app.post('/api/challenges', 
 *   validateRequest(createChallengeSchema),
 *   (req: ValidatedRequest<CreateChallengeInput>, res) => {
 *     const { answer, hints } = req.validated.body;
 *     // TypeScript knows the exact types!
 *   }
 * );
 * 
 * @example
 * // Multi-part validation
 * app.post('/api/challenges', 
 *   validateRequest({ body: createChallengeSchema }),
 *   (req: ValidatedRequest<{ body: CreateChallengeInput }>, res) => {
 *     const { answer } = req.validated.body;
 *   }
 * );
 */
export function validateRequest<T>(
  schema: z.ZodSchema | ValidationSchema
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Determine if schema is a single schema or multi-part
      const isMultiPart = 'body' in schema || 'params' in schema || 'query' in schema;
      
      if (isMultiPart) {
        // Validate each part separately
        const validated: any = {};
        const multiSchema = schema as ValidationSchema;
        
        if (multiSchema.body) {
          validated.body = await multiSchema.body.parseAsync(req.body);
        }
        if (multiSchema.params) {
          validated.params = await multiSchema.params.parseAsync(req.params);
        }
        if (multiSchema.query) {
          validated.query = await multiSchema.query.parseAsync(req.query);
        }
        
        (req as ValidatedRequest<T>).validated = validated as T;
      } else {
        // Validate entire request object
        const validated = await (schema as z.ZodSchema).parseAsync({
          body: req.body,
          params: req.params,
          query: req.query,
        });
        
        (req as ValidatedRequest<T>).validated = validated as T;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = formatValidationError(error);
        res.status(400).json(formattedError);
      } else {
        // Unexpected error
        console.error('Validation middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}
