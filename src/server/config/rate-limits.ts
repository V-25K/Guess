/**
 * Rate Limit Configuration
 * 
 * Centralized configuration for all endpoint rate limits.
 * Supports runtime updates without restart.
 * 
 * Requirements: 4.1, 4.2, 4.5
 */

import { RateLimitConfig } from '../middleware/rate-limit.js';

/**
 * Rate limit configurations for all endpoints
 * Organized by route pattern
 * 
 * Note: These configurations can be updated at runtime by calling
 * updateRateLimit(). Changes take effect immediately without restart.
 * 
 * Requirements: 4.1, 4.5
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Challenge endpoints
  'GET /api/challenges': {
    limit: 100,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  'GET /api/challenges/:id': {
    limit: 100,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  'POST /api/challenges': {
    limit: 1,
    windowSeconds: 86400, // 24 hours
    message: 'You can only create one challenge per 24 hours',
    skipForModerators: true, // Mods bypass rate limit entirely
  },
  'POST /api/challenges/preview': {
    limit: 10,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  'POST /api/challenges/:id/create-post': {
    limit: 5,
    windowSeconds: 300, // 5 minutes
    roleMultipliers: { moderator: 2 },
  },
  
  // Attempt endpoints
  'POST /api/attempts/submit': {
    limit: 30,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  'POST /api/attempts/giveup': {
    limit: 10,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  'POST /api/attempts/hint': {
    limit: 20,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  'GET /api/attempts/user': {
    limit: 60,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  
  // Leaderboard endpoints
  'GET /api/leaderboard': {
    limit: 60,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  'GET /api/leaderboard/user': {
    limit: 60,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  
  // User endpoints
  'GET /api/user/profile': {
    limit: 60,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  'GET /api/user/stats': {
    limit: 60,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
  'PATCH /api/users/:userId': {
    limit: 10,
    windowSeconds: 60,
    roleMultipliers: { moderator: 2 },
  },
};

/**
 * Default rate limit for endpoints not explicitly configured
 * 
 * Applied when an endpoint doesn't have a specific configuration
 * in the RATE_LIMITS object.
 * 
 * Requirements: 4.2
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  limit: 60,
  windowSeconds: 60,
  roleMultipliers: { moderator: 2 },
};

/**
 * Rate limit for anonymous (unauthenticated) requests
 * 
 * Applied to requests without a userId, using IP-based rate limiting.
 * Stricter than authenticated user limits to prevent abuse.
 * 
 * Requirements: 3.3, 4.2
 */
export const ANONYMOUS_RATE_LIMIT: RateLimitConfig = {
  limit: 30,
  windowSeconds: 60,
  message: 'Too many requests from your IP address. Please try again later.',
};

/**
 * Update rate limit configuration at runtime
 * 
 * Changes take effect immediately for new requests without requiring
 * a system restart. Useful for responding to abuse patterns or
 * adjusting limits based on usage.
 * 
 * Requirements: 4.5
 * 
 * @param endpoint - Endpoint pattern (e.g., 'GET /api/challenges')
 * @param config - New rate limit configuration
 * 
 * @example
 * // Temporarily reduce limit for an endpoint under attack
 * updateRateLimit('POST /api/challenges', {
 *   limit: 1,
 *   windowSeconds: 3600, // 1 hour
 *   message: 'Challenge creation temporarily restricted'
 * });
 */
export function updateRateLimit(endpoint: string, config: RateLimitConfig): void {
  RATE_LIMITS[endpoint] = config;
  
  console.log(JSON.stringify({
    level: 'info',
    service: 'RateLimitConfig',
    event: 'config_updated',
    endpoint,
    limit: config.limit,
    windowSeconds: config.windowSeconds,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Get current rate limit configuration for an endpoint
 * 
 * Returns the specific configuration if available, otherwise
 * returns the default rate limit.
 * 
 * Requirements: 4.1, 4.2
 * 
 * @param endpoint - Endpoint pattern (e.g., 'GET /api/challenges')
 * @returns Rate limit configuration for the endpoint
 * 
 * @example
 * const config = getRateLimit('GET /api/challenges');
 * console.log(`Limit: ${config.limit} requests per ${config.windowSeconds}s`);
 */
export function getRateLimit(endpoint: string): RateLimitConfig {
  return RATE_LIMITS[endpoint] || DEFAULT_RATE_LIMIT;
}
