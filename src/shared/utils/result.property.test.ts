/**
 * Property-based tests for Result type system
 * 
 * **Feature: result-pattern**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  type Result,
} from './result.js';

describe('Result Type Properties', () => {
  // Arbitraries for generating test data
  const anyValue = fc.anything();
  const anyError = fc.anything();
  const anyFunction = fc.func(fc.anything());
  
  /**
   * **Feature: result-pattern, Property 1: Ok variant storage**
   * 
   * *For any* value of type T, creating an Ok Result with that value should store
   * the value such that it can be retrieved unchanged
   * 
   * **Validates: Requirements 1.2**
   */
  describe('Property 1: Ok variant storage', () => {
    it('should store and retrieve Ok values unchanged', () => {
      fc.assert(
        fc.property(anyValue, (value) => {
          const result = ok(value);
          
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.value).toEqual(value);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 2: Err variant storage**
   * 
   * *For any* error of type E, creating an Err Result with that error should store
   * the error such that it can be retrieved unchanged
   * 
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Err variant storage', () => {
    it('should store and retrieve Err values unchanged', () => {
      fc.assert(
        fc.property(anyError, (error) => {
          const result = err(error);
          
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error).toEqual(error);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 3: Pattern matching correctness**
   * 
   * *For any* Result, pattern matching on the ok discriminant should provide
   * type-safe access to either the value (when ok is true) or the error (when ok is false)
   * 
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: Pattern matching correctness', () => {
    it('should allow pattern matching on Ok results', () => {
      fc.assert(
        fc.property(anyValue, (value) => {
          const result = ok(value);
          
          if (result.ok) {
            expect(result.value).toEqual(value);
          } else {
            // Should never reach here for Ok results
            expect(true).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should allow pattern matching on Err results', () => {
      fc.assert(
        fc.property(anyError, (error) => {
          const result = err(error);
          
          if (result.ok) {
            // Should never reach here for Err results
            expect(true).toBe(false);
          } else {
            expect(result.error).toEqual(error);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 4: isOk type guard correctness**
   * 
   * *For any* Result, isOk() should return true if and only if the Result is an Ok variant
   * 
   * **Validates: Requirements 2.3**
   */
  describe('Property 4: isOk type guard correctness', () => {
    it('should return true for Ok results', () => {
      fc.assert(
        fc.property(anyValue, (value) => {
          const result = ok(value);
          expect(isOk(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for Err results', () => {
      fc.assert(
        fc.property(anyError, (error) => {
          const result = err(error);
          expect(isOk(result)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 5: isErr type guard correctness**
   * 
   * *For any* Result, isErr() should return true if and only if the Result is an Err variant
   * 
   * **Validates: Requirements 2.4**
   */
  describe('Property 5: isErr type guard correctness', () => {
    it('should return true for Err results', () => {
      fc.assert(
        fc.property(anyError, (error) => {
          const result = err(error);
          expect(isErr(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for Ok results', () => {
      fc.assert(
        fc.property(anyValue, (value) => {
          const result = ok(value);
          expect(isErr(result)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 6: map preserves Ok and transforms value**
   * 
   * *For any* Ok Result and any transformation function, map() should return
   * an Ok Result with the transformed value
   * 
   * **Validates: Requirements 2.5**
   */
  describe('Property 6: map preserves Ok and transforms value', () => {
    it('should transform Ok values', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          (value, addend) => {
            const result = ok(value);
            const mapped = map(result, (v) => v + addend);
            
            expect(isOk(mapped)).toBe(true);
            if (isOk(mapped)) {
              expect(mapped.value).toBe(value + addend);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 7: map preserves Err unchanged**
   * 
   * *For any* Err Result and any transformation function, map() should return
   * the same Err Result unchanged
   * 
   * **Validates: Requirements 2.5**
   */
  describe('Property 7: map preserves Err unchanged', () => {
    it('should not transform Err values', () => {
      fc.assert(
        fc.property(anyError, (error) => {
          const result: Result<number, any> = err(error);
          const mapped = map(result, (v) => v + 1);
          
          expect(isErr(mapped)).toBe(true);
          if (isErr(mapped)) {
            expect(mapped.error).toEqual(error);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 8: mapErr preserves Ok unchanged**
   * 
   * *For any* Ok Result and any error transformation function, mapErr() should return
   * the same Ok Result unchanged
   * 
   * **Validates: Requirements 2.6**
   */
  describe('Property 8: mapErr preserves Ok unchanged', () => {
    it('should not transform Ok values', () => {
      fc.assert(
        fc.property(anyValue, (value) => {
          const result = ok(value);
          const mapped = mapErr(result, (e: any) => `Error: ${e}`);
          
          expect(isOk(mapped)).toBe(true);
          if (isOk(mapped)) {
            expect(mapped.value).toEqual(value);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 9: mapErr transforms Err**
   * 
   * *For any* Err Result and any error transformation function, mapErr() should return
   * an Err Result with the transformed error
   * 
   * **Validates: Requirements 2.6**
   */
  describe('Property 9: mapErr transforms Err', () => {
    it('should transform Err values', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (error, prefix) => {
            const result: Result<number, string> = err(error);
            const mapped = mapErr(result, (e) => prefix + e);
            
            expect(isErr(mapped)).toBe(true);
            if (isErr(mapped)) {
              expect(mapped.error).toBe(prefix + error);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 10: flatMap left identity**
   * 
   * *For any* value and function that returns a Result, flatMap(ok(value), f) should equal f(value)
   * 
   * **Validates: Requirements 2.7**
   */
  describe('Property 10: flatMap left identity', () => {
    it('should satisfy left identity law', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          (value, multiplier) => {
            const f = (v: number): Result<number, string> => ok(v * multiplier);
            
            const leftSide = flatMap(ok(value), f);
            const rightSide = f(value);
            
            expect(leftSide).toEqual(rightSide);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 11: flatMap right identity**
   * 
   * *For any* Result r, flatMap(r, ok) should equal r
   * 
   * **Validates: Requirements 2.7**
   */
  describe('Property 11: flatMap right identity', () => {
    it('should satisfy right identity law for Ok', () => {
      fc.assert(
        fc.property(anyValue, (value) => {
          const result = ok(value);
          const mapped = flatMap(result, ok);
          
          expect(mapped).toEqual(result);
        }),
        { numRuns: 100 }
      );
    });

    it('should satisfy right identity law for Err', () => {
      fc.assert(
        fc.property(anyError, (error) => {
          const result: Result<any, any> = err(error);
          const mapped = flatMap(result, ok);
          
          expect(mapped).toEqual(result);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 12: flatMap associativity**
   * 
   * *For any* Result r and functions f and g, flatMap(flatMap(r, f), g) should equal
   * flatMap(r, x => flatMap(f(x), g))
   * 
   * **Validates: Requirements 2.7**
   */
  describe('Property 12: flatMap associativity', () => {
    it('should satisfy associativity law', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          fc.integer(),
          (value, add1, add2) => {
            const result = ok(value);
            const f = (v: number): Result<number, string> => ok(v + add1);
            const g = (v: number): Result<number, string> => ok(v + add2);
            
            const leftSide = flatMap(flatMap(result, f), g);
            const rightSide = flatMap(result, (x) => flatMap(f(x), g));
            
            expect(leftSide).toEqual(rightSide);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: result-pattern, Property 13: flatMap short-circuits on Err**
   * 
   * *For any* Err Result and any function, flatMap() should return the Err Result
   * without calling the function
   * 
   * **Validates: Requirements 2.7**
   */
  describe('Property 13: flatMap short-circuits on Err', () => {
    it('should not call function for Err results', () => {
      fc.assert(
        fc.property(anyError, (error) => {
          const result: Result<number, any> = err(error);
          let functionCalled = false;
          
          const mapped = flatMap(result, (v) => {
            functionCalled = true;
            return ok(v + 1);
          });
          
          expect(functionCalled).toBe(false);
          expect(isErr(mapped)).toBe(true);
          if (isErr(mapped)) {
            expect(mapped.error).toEqual(error);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Additional tests for unwrap functions
  describe('Unwrap functions', () => {
    it('unwrap should extract Ok values', () => {
      fc.assert(
        fc.property(anyValue, (value) => {
          const result = ok(value);
          expect(unwrap(result)).toEqual(value);
        }),
        { numRuns: 100 }
      );
    });

    it('unwrap should throw for Err values', () => {
      fc.assert(
        fc.property(anyError, (error) => {
          const result = err(error);
          expect(() => unwrap(result)).toThrow();
        }),
        { numRuns: 100 }
      );
    });

    it('unwrapOr should return value for Ok', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          (value, defaultValue) => {
            const result = ok(value);
            expect(unwrapOr(result, defaultValue)).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unwrapOr should return default for Err', () => {
      fc.assert(
        fc.property(
          anyError,
          fc.integer(),
          (error, defaultValue) => {
            const result: Result<number, any> = err(error);
            expect(unwrapOr(result, defaultValue)).toBe(defaultValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unwrapOrElse should return value for Ok', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          (value, fallback) => {
            const result = ok(value);
            expect(unwrapOrElse(result, () => fallback)).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unwrapOrElse should compute default for Err', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.integer(),
          (error, fallback) => {
            const result: Result<number, string> = err(error);
            expect(unwrapOrElse(result, (e) => e.length + fallback)).toBe(error.length + fallback);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
