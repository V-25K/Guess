/**
 * Custom Assertion Helpers
 * Provides assertion helpers for testing Result pattern integration
 */

import { expect } from 'vitest';
import { isOk, isErr } from '../../shared/utils/result.js';
import type { Result } from '../../shared/utils/result.js';
import type { AppError, DatabaseError } from '../../shared/models/errors.js';

/**
 * Asserts that a Result is in the Ok state and returns the value
 * @param result - The Result to check
 * @returns The value from the Ok Result
 * @throws {Error} If the Result is Err
 */
export function expectOk<T, E>(result: Result<T, E>): T {
  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    return result.value;
  }
  throw new Error('Expected Ok but got Err');
}

/**
 * Asserts that a Result is in the Err state and returns the error
 * @param result - The Result to check
 * @returns The error from the Err Result
 * @throws {Error} If the Result is Ok
 */
export function expectErr<T, E>(result: Result<T, E>): E {
  expect(isErr(result)).toBe(true);
  if (isErr(result)) {
    return result.error;
  }
  throw new Error('Expected Err but got Ok');
}

/**
 * Asserts that a Result is Ok and the value matches the expected value
 * @param result - The Result to check
 * @param expected - The expected value
 */
export function expectOkValue<T, E>(result: Result<T, E>, expected: T): void {
  const value = expectOk(result);
  expect(value).toEqual(expected);
}

/**
 * Asserts that a Result is Err with a DatabaseError
 * @param result - The Result to check
 * @returns The DatabaseError from the Err Result
 */
export function expectDatabaseError<T>(result: Result<T, AppError>): DatabaseError {
  const error = expectErr(result);
  expect(error.type).toBe('database');
  return error as DatabaseError;
}
