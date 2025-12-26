/**
 * Result Adapter Utilities
 * Helper functions for working with Result types and handling exceptions.
 */

import { Result, ok, err } from './result.js';
import type { AppError } from '../models/errors.js';

/**
 * Wrap an async operation in try-catch and return a Result
 * Automatically converts thrown exceptions to Err Results
 * 
 * @param fn - The async function to execute
 * @param errorMapper - Function to convert caught exceptions to AppError
 * @returns Ok(value) if fn succeeds, Err(error) if fn throws
 * 
 * @example
 * const result = await tryCatch(
 *   () => redis.get(key),
 *   (error) => databaseError('redis.get', String(error))
 * );
 */
export async function tryCatch<T>(
    fn: () => Promise<T>,
    errorMapper: (error: unknown) => AppError
): Promise<Result<T, AppError>> {
    try {
        const value = await fn();
        return ok(value);
    } catch (error) {
        return err(errorMapper(error));
    }
}

/**
 * Synchronous version of tryCatch for non-async operations
 * Wrap a synchronous operation in try-catch and return a Result
 * 
 * @param fn - The function to execute
 * @param errorMapper - Function to convert caught exceptions to AppError
 * @returns Ok(value) if fn succeeds, Err(error) if fn throws
 * 
 * @example
 * const result = tryCatchSync(
 *   () => JSON.parse(jsonString),
 *   (error) => validationError([{ field: 'json', message: String(error) }])
 * );
 */
export function tryCatchSync<T>(
    fn: () => T,
    errorMapper: (error: unknown) => AppError
): Result<T, AppError> {
    try {
        const value = fn();
        return ok(value);
    } catch (error) {
        return err(errorMapper(error));
    }
}
