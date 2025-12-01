/**
 * PreloadService
 * Manages background preloading of challenge data for smooth gameplay transitions.
 * 
 * Preloads next 2-3 challenges after current one loads to reduce perceived latency.
 * All preload operations fail silently to never block gameplay.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import type { Challenge } from '../../shared/models/challenge.types.js';

/**
 * Configuration for preload behavior
 */
export interface PreloadConfig {
  /** Number of challenges to preload (default: 3) */
  preloadCount: number;
  /** Delay in ms before starting preload after current loads (default: 100) */
  preloadDelayMs: number;
  /** Maximum number of challenges to keep in cache (default: 10) */
  maxCacheSize: number;
}

/**
 * Preloaded challenge with metadata
 */
export interface PreloadedChallenge {
  challenge: Challenge;
  preloadedAt: number;
  avatarUrl?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: PreloadConfig = {
  preloadCount: 3,
  preloadDelayMs: 100,
  maxCacheSize: 10,
};

/**
 * PreloadService - Manages background preloading of challenge data
 * 
 * Features:
 * - Preloads next 2-3 challenges after current one loads
 * - Stores preloaded challenges in memory cache
 * - Silent failure handling - never blocks gameplay
 * - Configurable preload count and cache size
 */
export class PreloadService {
  private cache: Map<string, PreloadedChallenge> = new Map();
  private config: PreloadConfig;
  private pendingPreloads: Set<string> = new Set();

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Preload next N challenges after current one loads
   * 
   * This method initiates background fetching of the next challenges
   * to reduce perceived latency when the user navigates to them.
   * 
   * @param currentIndex - Index of the current challenge in the list
   * @param challenges - Full list of challenges
   * @param fetcher - Optional function to fetch additional challenge data (e.g., avatar URLs)
   * @param count - Number of challenges to preload (default: config.preloadCount)
   * 
   * Requirements: 2.1, 2.2, 2.4
   */
  async preloadNextChallenges(
    currentIndex: number,
    challenges: Challenge[],
    fetcher?: (challenge: Challenge) => Promise<Partial<PreloadedChallenge>>,
    count: number = this.config.preloadCount
  ): Promise<void> {
    // Silent failure wrapper - never throw from preload operations
    try {
      await this.doPreload(currentIndex, challenges, fetcher, count);
    } catch (error) {
      // Log warning but don't throw (Requirement 2.3)
      console.warn('[PreloadService] Silent failure during preload:', error);
    }
  }

  /**
   * Internal preload implementation
   */
  private async doPreload(
    currentIndex: number,
    challenges: Challenge[],
    fetcher?: (challenge: Challenge) => Promise<Partial<PreloadedChallenge>>,
    count: number = this.config.preloadCount
  ): Promise<void> {
    // Validate inputs
    if (currentIndex < 0 || !challenges || challenges.length === 0) {
      return;
    }

    // Calculate which challenges to preload (next N after current)
    const startIndex = currentIndex + 1;
    const endIndex = Math.min(startIndex + count, challenges.length);

    // Get challenges to preload
    const challengesToPreload = challenges.slice(startIndex, endIndex);

    if (challengesToPreload.length === 0) {
      return;
    }

    // Add delay before starting preload (Requirement 2.4 - prioritize current challenge)
    await this.delay(this.config.preloadDelayMs);

    // Preload each challenge in parallel
    const preloadPromises = challengesToPreload.map(challenge =>
      this.preloadSingleChallenge(challenge, fetcher)
    );

    // Wait for all preloads to complete (errors are caught individually)
    await Promise.all(preloadPromises);

    // Enforce cache size limit
    this.enforceMaxCacheSize();
  }

  /**
   * Preload a single challenge with silent failure handling
   */
  private async preloadSingleChallenge(
    challenge: Challenge,
    fetcher?: (challenge: Challenge) => Promise<Partial<PreloadedChallenge>>
  ): Promise<void> {
    try {
      // Skip if already cached or being preloaded
      if (this.cache.has(challenge.id) || this.pendingPreloads.has(challenge.id)) {
        return;
      }

      // Mark as pending
      this.pendingPreloads.add(challenge.id);

      // Create preloaded entry
      const preloadedChallenge: PreloadedChallenge = {
        challenge,
        preloadedAt: Date.now(),
      };

      // Fetch additional data if fetcher provided
      if (fetcher) {
        try {
          const additionalData = await fetcher(challenge);
          Object.assign(preloadedChallenge, additionalData);
        } catch (fetchError) {
          // Log but continue - additional data is optional
          console.warn('[PreloadService] Failed to fetch additional data:', fetchError);
        }
      }

      // Store in cache
      this.cache.set(challenge.id, preloadedChallenge);
    } catch (error) {
      // Silent failure - log warning but don't throw (Requirement 2.3)
      console.warn(`[PreloadService] Failed to preload challenge ${challenge.id}:`, error);
    } finally {
      // Remove from pending
      this.pendingPreloads.delete(challenge.id);
    }
  }

  /**
   * Get a preloaded challenge if available
   * 
   * @param challengeId - ID of the challenge to retrieve
   * @returns The preloaded challenge or null if not in cache
   * 
   * Requirements: 2.1
   */
  getPreloadedChallenge(challengeId: string): PreloadedChallenge | null {
    const preloaded = this.cache.get(challengeId);
    
    if (preloaded) {
      // Remove from cache after retrieval (one-time use)
      this.cache.delete(challengeId);
      return preloaded;
    }

    return null;
  }

  /**
   * Check if a challenge is preloaded
   * 
   * @param challengeId - ID of the challenge to check
   * @returns true if the challenge is in the preload cache
   */
  hasPreloadedChallenge(challengeId: string): boolean {
    return this.cache.has(challengeId);
  }

  /**
   * Clear the entire preload cache
   */
  clearPreloadCache(): void {
    this.cache.clear();
    this.pendingPreloads.clear();
  }

  /**
   * Get the current cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get the preload configuration
   */
  getConfig(): PreloadConfig {
    return { ...this.config };
  }

  /**
   * Enforce maximum cache size by removing oldest entries
   */
  private enforceMaxCacheSize(): void {
    if (this.cache.size <= this.config.maxCacheSize) {
      return;
    }

    // Convert to array and sort by preloadedAt (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].preloadedAt - b[1].preloadedAt);

    // Remove oldest entries until we're at max size
    const toRemove = entries.slice(0, this.cache.size - this.config.maxCacheSize);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
