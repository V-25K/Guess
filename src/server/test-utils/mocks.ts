/**
 * Mock Objects and Helpers
 * Provides helper functions for creating mock responses and objects
 */

import { vi } from 'vitest';

/**
 * Creates a mock fetch response for successful database queries
 * @param data - The data to return in the response
 * @param headers - Optional headers to include in the response
 * @returns A mock Response object that simulates a successful fetch
 */
export function createMockFetchSuccess<T>(data: T, headers?: Record<string, string>) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    headers: new Headers(headers || {}),
  } as Response);
}

/**
 * Creates a mock fetch response for database errors
 * @param status - HTTP status code for the error
 * @param statusText - HTTP status text for the error
 * @returns A mock Response object that simulates a failed fetch
 */
export function createMockFetchError(status: number, statusText: string) {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: async () => ({ error: statusText }),
    headers: new Headers(),
  } as Response);
}

/**
 * Creates a mock settings object for Devvit configuration
 * @returns A mock settings object with get method for retrieving configuration values
 */
export function createMockSettings() {
  return {
    get: vi.fn((key: string) => {
      if (key === 'SUPABASE_URL') return Promise.resolve('https://test.supabase.co');
      if (key === 'SUPABASE_ANON_KEY') return Promise.resolve('test-anon-key');
      return Promise.resolve(null);
    }),
  };
}
