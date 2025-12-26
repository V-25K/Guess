/**
 * Unit tests for Result adapter utilities
 * Tests exception handling with tryCatch functions
 */

import { describe, it, expect } from 'vitest';
import {
    tryCatch,
    tryCatchSync,
} from './result-adapters.js';
import { isOk, isErr } from './result.js';
import {
    validationError,
    databaseError,
    internalError,
} from '../models/errors.js';

describe('result-adapters', () => {

    describe('tryCatch', () => {
        it('should return Ok for successful async operations', async () => {
            const fn = async () => 'success';
            const errorMapper = (error: unknown) => internalError(String(error));
            
            const result = await tryCatch(fn, errorMapper);
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toBe('success');
            }
        });

        it('should catch exceptions and return Err', async () => {
            const fn = async () => {
                throw new Error('Operation failed');
            };
            const errorMapper = (error: unknown) => 
                databaseError('operation', error instanceof Error ? error.message : String(error));
            
            const result = await tryCatch(fn, errorMapper);
            
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.type).toBe('database');
                if (result.error.type === 'database') {
                    expect(result.error.message).toBe('Operation failed');
                }
            }
        });

        it('should handle async operations that return values', async () => {
            const fn = async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return { data: 'async result' };
            };
            const errorMapper = (error: unknown) => internalError(String(error));
            
            const result = await tryCatch(fn, errorMapper);
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toEqual({ data: 'async result' });
            }
        });

        it('should use errorMapper to transform exceptions', async () => {
            const fn = async () => {
                throw new Error('Redis connection timeout');
            };
            const errorMapper = (error: unknown) => 
                databaseError('redis.get', error instanceof Error ? error.message : String(error));
            
            const result = await tryCatch(fn, errorMapper);
            
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.type).toBe('database');
                if (result.error.type === 'database') {
                    expect(result.error.operation).toBe('redis.get');
                    expect(result.error.message).toBe('Redis connection timeout');
                }
            }
        });

        it('should handle non-Error exceptions', async () => {
            const fn = async () => {
                throw 'string error';
            };
            const errorMapper = (error: unknown) => internalError(String(error));
            
            const result = await tryCatch(fn, errorMapper);
            
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.type).toBe('internal');
                if (result.error.type === 'internal') {
                    expect(result.error.message).toBe('string error');
                }
            }
        });
    });

    describe('tryCatchSync', () => {
        it('should return Ok for successful sync operations', () => {
            const fn = () => 'success';
            const errorMapper = (error: unknown) => internalError(String(error));
            
            const result = tryCatchSync(fn, errorMapper);
            
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value).toBe('success');
            }
        });

        it('should catch exceptions and return Err', () => {
            const fn = () => {
                throw new Error('Parse failed');
            };
            const errorMapper = (error: unknown) => 
                validationError([{ 
                    field: 'json', 
                    message: error instanceof Error ? error.message : String(error) 
                }]);
            
            const result = tryCatchSync(fn, errorMapper);
            
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.type).toBe('validation');
                if (result.error.type === 'validation') {
                    expect(result.error.fields[0].message).toBe('Parse failed');
                }
            }
        });

        it('should handle JSON parsing', () => {
            const validJson = '{"key": "value"}';
            const invalidJson = '{invalid}';
            const errorMapper = (error: unknown) => 
                validationError([{ field: 'json', message: String(error) }]);
            
            const validResult = tryCatchSync(() => JSON.parse(validJson), errorMapper);
            const invalidResult = tryCatchSync(() => JSON.parse(invalidJson), errorMapper);
            
            expect(isOk(validResult)).toBe(true);
            expect(isErr(invalidResult)).toBe(true);
        });
    });

});
