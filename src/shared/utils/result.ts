/**
 * Result type for explicit error handling
 * A discriminated union representing either success (Ok) or failure (Err)
 */
export type Result<T, E> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Helper type for extracting success type from Result
 */
export type OkType<R> = R extends Result<infer T, any> ? T : never;

/**
 * Helper type for extracting error type from Result
 */
export type ErrType<R> = R extends Result<any, infer E> ? E : never;

/**
 * Create a successful Result containing a value
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create a failed Result containing an error
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Type guard to check if a Result is Ok
 * Narrows the type to allow safe access to the value
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true;
}

/**
 * Type guard to check if a Result is Err
 * Narrows the type to allow safe access to the error
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}

/**
 * Transform the value inside an Ok Result
 * If the Result is Err, returns the Err unchanged
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Transform the error inside an Err Result
 * If the Result is Ok, returns the Ok unchanged
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chain Result-returning operations (monadic bind)
 * If the Result is Ok, applies the function to the value
 * If the Result is Err, short-circuits and returns the Err
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Extract the value from an Ok Result
 * Throws an error if the Result is Err
 * @throws {Error} If the Result is Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Called unwrap on an Err Result: ${JSON.stringify(result.error)}`);
}

/**
 * Extract the value from a Result, or return a default value if Err
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Extract the value from a Result, or compute a default value from the error
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  if (isOk(result)) {
    return result.value;
  }
  return fn(result.error);
}
