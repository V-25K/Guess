/**
 * Shared Setup and Teardown Utilities
 * Provides reusable setup and teardown functions for repository tests
 */

import { vi } from 'vitest';
import type { Context } from '@devvit/server/server-context';
import { createMockContext, createMockSettings } from './index.js';

/**
 * Test context for repository tests
 */
export interface RepositoryTestContext {
  mockContext: Context;
  mockFetch: ReturnType<typeof vi.fn>;
  mockSettings: ReturnType<typeof createMockSettings>;
}

/**
 * Sets up a repository test with mocked dependencies
 * @returns A test context with mocked Context, fetch, and settings
 */
export function setupRepositoryTest(): RepositoryTestContext {
  // Create mock context
  const mockContext = createMockContext();

  // Mock global fetch
  const mockFetch = vi.fn();
  global.fetch = mockFetch as any;

  // Mock settings
  const mockSettings = createMockSettings();

  // Set environment variables for Supabase config (fallback in config-cache)
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';

  return {
    mockContext,
    mockFetch,
    mockSettings,
  };
}

/**
 * Tears down a repository test by cleaning up mocks
 * Clears all mocks to prevent test pollution
 */
export function teardownRepositoryTest(): void {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
}
