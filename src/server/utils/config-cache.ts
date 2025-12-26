/**
 * Configuration Cache
 * Caches Supabase configuration to avoid repeated settings lookups
 * 
 * Note: Caching is disabled to ensure settings are always fetched in the correct
 * async context. This prevents "ServerCallRequired" errors when forms are submitted.
 */

import type { Context } from '@devvit/server/server-context';
import { settings } from '@devvit/web/server';

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/**
 * Get Supabase configuration without caching
 * Always fetches from settings to ensure proper async context
 * 
 * Falls back to environment variables for local development
 * 
 * This prevents "ServerCallRequired" errors that occur when cached config
 * is used from a different context (e.g., form submissions)
 */
export async function getSupabaseConfig(_context: Context): Promise<SupabaseConfig> {
  try {
    let url: string | undefined;
    let anonKey: string | undefined;
    
    // Try to get from Devvit settings first
    try {
      url = await settings.get('supabaseUrl') as string;
      anonKey = await settings.get('supabaseAnonKey') as string;
    } catch (settingsError) {
      // Settings might not be available in local development
      console.log('[Config] Settings not available, falling back to environment variables');
    }
    
    // Fallback to environment variables for local development only
    if (!url) {
      url = process.env.SUPABASE_URL;
    }
    if (!anonKey) {
      anonKey = process.env.SUPABASE_ANON_KEY;
    }
    
    if (!url || !anonKey) {
      throw new Error('Supabase configuration not found. Please set SUPABASE_URL and SUPABASE_ANON_KEY in settings or environment variables.');
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
