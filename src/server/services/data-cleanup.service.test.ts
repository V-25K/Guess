/**
 * Unit tests for DataCleanupService
 * 
 * Tests for Requirements 4.2, 4.4, 4.5, 4.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataCleanupService } from './data-cleanup.service.js';
import { isOk, isErr } from '../../shared/utils/result.js';

// Mock the Context type
const mockContext = {} as any;

describe('DataCleanupService', () => {
  let service: DataCleanupService;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    service = new DataCleanupService(mockContext);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('setSupabaseConfig', () => {
    it('should store Supabase configuration', () => {
      // The config is stored internally, we verify by calling anonymizeInactiveUsers
      // which should not return "Supabase not configured" error after config is set
      service.setSupabaseConfig('https://test.supabase.co', 'test-key');
      
      // Mock fetch to verify the config was stored
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ profiles_anonymized: 0, challenges_updated: 0, attempts_updated: 0 }],
      });

      // If config is set, it should attempt to call the API
      service.anonymizeInactiveUsers();
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('anonymizeInactiveUsers - Supabase not configured (Requirement 4.2)', () => {
    it('should return database error when Supabase URL is not configured', async () => {
      const result = await service.anonymizeInactiveUsers();

      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.type === 'database') {
        expect(result.error.operation).toBe('anonymizeInactiveUsers');
        expect(result.error.message).toBe('Supabase not configured');
      }
    });

    it('should return database error when only URL is configured', async () => {
      service.setSupabaseConfig('https://test.supabase.co', '');
      const result = await service.anonymizeInactiveUsers();

      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.type === 'database') {
        expect(result.error.message).toBe('Supabase not configured');
      }
    });
  });

  describe('anonymizeInactiveUsers - successful cleanup (Requirement 4.4)', () => {
    beforeEach(() => {
      service.setSupabaseConfig('https://test.supabase.co', 'test-key');
    });

    it('should return cleanup statistics on successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{
          profiles_anonymized: 5,
          challenges_updated: 10,
          attempts_updated: 25,
        }],
      });

      const result = await service.anonymizeInactiveUsers();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.profilesAnonymized).toBe(5);
        expect(result.value.challengesUpdated).toBe(10);
        expect(result.value.attemptsUpdated).toBe(25);
        // executionTimeMs should be a non-negative number (can be 0 in fast tests)
        expect(result.value.executionTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle response as single object (not array)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          profiles_anonymized: 3,
          challenges_updated: 6,
          attempts_updated: 12,
        }),
      });

      const result = await service.anonymizeInactiveUsers();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.profilesAnonymized).toBe(3);
        expect(result.value.challengesUpdated).toBe(6);
        expect(result.value.attemptsUpdated).toBe(12);
      }
    });

    it('should handle empty response with zero counts', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{}],
      });

      const result = await service.anonymizeInactiveUsers();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.profilesAnonymized).toBe(0);
        expect(result.value.challengesUpdated).toBe(0);
        expect(result.value.attemptsUpdated).toBe(0);
      }
    });
  });

  describe('anonymizeInactiveUsers - custom daysInactive parameter (Requirement 4.6)', () => {
    beforeEach(() => {
      service.setSupabaseConfig('https://test.supabase.co', 'test-key');
    });

    it('should use default 30 days when no parameter provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ profiles_anonymized: 0, challenges_updated: 0, attempts_updated: 0 }],
      });

      await service.anonymizeInactiveUsers();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/rpc/anonymize_inactive_users',
        expect.objectContaining({
          body: JSON.stringify({ p_days_inactive: 30 }),
        })
      );
    });

    it('should pass custom daysInactive parameter to API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ profiles_anonymized: 0, challenges_updated: 0, attempts_updated: 0 }],
      });

      await service.anonymizeInactiveUsers(60);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/rpc/anonymize_inactive_users',
        expect.objectContaining({
          body: JSON.stringify({ p_days_inactive: 60 }),
        })
      );
    });

    it('should pass 7 days parameter correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ profiles_anonymized: 0, challenges_updated: 0, attempts_updated: 0 }],
      });

      await service.anonymizeInactiveUsers(7);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ p_days_inactive: 7 }),
        })
      );
    });
  });

  describe('anonymizeInactiveUsers - HTTP error handling (Requirement 4.5)', () => {
    beforeEach(() => {
      service.setSupabaseConfig('https://test.supabase.co', 'test-key');
    });

    it('should return database error on HTTP 500', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Database error',
      });

      const result = await service.anonymizeInactiveUsers();

      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.type === 'database') {
        expect(result.error.operation).toBe('anonymizeInactiveUsers');
        expect(result.error.message).toBe('HTTP 500: Internal Server Error');
      }
    });

    it('should return database error on HTTP 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const result = await service.anonymizeInactiveUsers();

      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.type === 'database') {
        expect(result.error.message).toBe('HTTP 401: Unauthorized');
      }
    });

    it('should return database error on HTTP 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Function not found',
      });

      const result = await service.anonymizeInactiveUsers();

      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.type === 'database') {
        expect(result.error.message).toBe('HTTP 404: Not Found');
      }
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.anonymizeInactiveUsers();

      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.type === 'database') {
        expect(result.error.message).toBe('Network error');
      }
    });

    it('should handle JSON parsing errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      });

      const result = await service.anonymizeInactiveUsers();

      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.type === 'database') {
        expect(result.error.message).toBe('Invalid JSON');
      }
    });
  });

  describe('API request format', () => {
    beforeEach(() => {
      service.setSupabaseConfig('https://test.supabase.co', 'test-api-key');
    });

    it('should send correct headers', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ profiles_anonymized: 0, challenges_updated: 0, attempts_updated: 0 }],
      });

      await service.anonymizeInactiveUsers();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'test-api-key',
            'Authorization': 'Bearer test-api-key',
          },
        })
      );
    });

    it('should call correct endpoint URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ profiles_anonymized: 0, challenges_updated: 0, attempts_updated: 0 }],
      });

      await service.anonymizeInactiveUsers();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/rpc/anonymize_inactive_users',
        expect.any(Object)
      );
    });
  });
});
