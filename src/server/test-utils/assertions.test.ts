/**
 * Tests for Custom Assertion Helpers
 */

import { describe, it, expect } from 'vitest';
import { expectOk, expectErr, expectOkValue, expectDatabaseError } from './assertions.js';
import { ok, err } from '../../shared/utils/result.js';
import { databaseError } from '../../shared/models/errors.js';

describe('Custom Assertion Helpers', () => {
  describe('expectOk', () => {
    it('should return value from Ok result', () => {
      const result = ok(42);
      const value = expectOk(result);

      expect(value).toBe(42);
    });

    it('should throw on Err result', () => {
      const result = err('error');

      expect(() => expectOk(result)).toThrow();
    });
  });

  describe('expectErr', () => {
    it('should return error from Err result', () => {
      const result = err('test error');
      const error = expectErr(result);

      expect(error).toBe('test error');
    });

    it('should throw on Ok result', () => {
      const result = ok(42);

      expect(() => expectErr(result)).toThrow();
    });
  });

  describe('expectOkValue', () => {
    it('should verify Ok result has expected value', () => {
      const result = ok({ id: 1, name: 'test' });

      expect(() => expectOkValue(result, { id: 1, name: 'test' })).not.toThrow();
    });

    it('should throw if value does not match', () => {
      const result = ok({ id: 1, name: 'test' });

      expect(() => expectOkValue(result, { id: 2, name: 'other' })).toThrow();
    });
  });

  describe('expectDatabaseError', () => {
    it('should return DatabaseError from Err result', () => {
      const dbError = databaseError('findById', 'Connection failed');
      const result = err(dbError);

      const error = expectDatabaseError(result);

      expect(error.type).toBe('database');
      expect(error.operation).toBe('findById');
      expect(error.message).toBe('Connection failed');
    });

    it('should throw if error is not DatabaseError', () => {
      const result = err({ type: 'validation', fields: [] });

      expect(() => expectDatabaseError(result as any)).toThrow();
    });
  });
});
