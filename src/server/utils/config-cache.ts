/**
 * Configuration Cache
 * Caches Supabase configuration to avoid repeated settings lookups
 * 
 * Note: Caching is disabled to ensure settings are always fetched in the correct
 * async context. This prevents "ServerCallRequired" errors when forms are submitted.
 */

import type { Context } from '@devvit/public-api';

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/**
 * Get Supabase configuration without caching
 * Always fetches from settings to ensure proper async context
 * 
 * This prevents "ServerCallRequired" errors that occur when cached config
 * is used from a different context (e.g., form submissions)
 */
export async function getSupabaseConfig(context: Context): Promise<SupabaseConfig> {
  try {
    const settings = await context.settings.getAll();
    
    const url = settings['SUPABASE_URL'] as string;
    const anonKey = settings['SUPABASE_ANON_KEY'] as string;
    
    if (!url || !anonKey) {
      throw new Error('Supabase configuration not found. Please set SUPABASE_URL and SUPABASE_ANON_KEY in settings.');
    }
    
    return { url, anonKey };
  } catch (error) {
    throw error;
  }
}

/**
 * Clear cached configuration (no-op since caching is disabled)
 * Kept for backwards compatibility
 */
export function clearConfigCache(): void {
}

/**
 * Check if config is cached (always returns false)
 * Kept for backwards compatibility
 */
export function isConfigCached(): boolean {
  return false;
}
