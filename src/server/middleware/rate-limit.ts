/**
 * Rate Limit Middleware
 * Provides HTTP-level rate limiting for API endpoints
 * 
 * Requirements: 2.1, 3.1, 3.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 10.2
 */

import { Request, Response, NextFunction } from 'express';
import { context, settings } from '@devvit/web/server';
import { timingSafeEqual } from 'crypto';
import { RateLimitService, RateLimitResult } from '../services/rate-limit.service.js';
import { RateLimitMonitorService } from '../services/rate-limit-monitor.service.js';

/**
 * Rate limit configuration for an endpoint
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the time window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional custom key generator */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain conditions */
  skip?: (req: Request) => boolean;
  /** Custom message for rate limit exceeded */
  message?: string;
  /** Role-based limit multipliers (e.g., { moderator: 2 }) */
  roleMultipliers?: Record<string, number>;
  /** Skip rate limiting entirely for moderators */
  skipForModerators?: boolean;
}

/**
 * Creates rate limiting middleware for Express routes
 * 
 * @param config - Rate limit configuration
 * @returns Express middleware function
 * 
 * Requirements: 2.1, 3.1, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 10.2
 * 
 * @example
 * app.get('/api/challenges', 
 *   rateLimit({ limit: 100, windowSeconds: 60 }),
 *   challengeHandler
 * );
 */
export function rateLimit(config: RateLimitConfig) {
  const rateLimitService = new RateLimitService();
  const monitorService = new RateLimitMonitorService();
  
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Check for internal bypass token (Requirement: 8.1, 8.2)
      if (await isInternalRequest(req)) {
        logInternalBypass(req);
        return next();
      }
      
      // Extract rate limit key (userId or IP) (Requirement: 2.1, 3.1)
      const key = config.keyGenerator 
        ? config.keyGenerator(req)
        : getRateLimitKey(req);
      
      // Check if we should skip rate limiting
      if (config.skip && config.skip(req)) {
        return next();
      }
      
      // Skip rate limiting for moderators if configured
      if (config.skipForModerators && isModerator()) {
        console.log(JSON.stringify({
          level: 'info',
          service: 'RateLimitMiddleware',
          event: 'moderator_bypass',
          userId: context.userId,
          endpoint: `${req.method} ${req.path}`,
          timestamp: new Date().toISOString(),
        }));
        return next();
      }
      
      // Apply role-based limit multipliers (Requirement: 2.5, 4.3)
      const effectiveLimit = getEffectiveLimit(config, req);
      
      // Check rate limit with timeout (Requirement: 10.2)
      const result = await Promise.race([
        rateLimitService.checkLimit(
          key,
          effectiveLimit,
          config.windowSeconds
        ),
        createTimeout(100), // 100ms timeout
      ]);
      
      // Add rate limit headers (Requirements: 5.1, 5.2, 5.3)
      res.setHeader('X-RateLimit-Limit', effectiveLimit.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining).toString());
      res.setHeader('X-RateLimit-Reset', result.resetTime.toString());
      
      // If limit exceeded, return 429 (Requirements: 6.1, 6.2, 5.4)
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        
        // Log rate limit violation (Requirement: 6.5, 9.1, 9.2, 9.3)
        await logRateLimitViolation(
          req,
          key,
          effectiveLimit,
          config.windowSeconds,
          monitorService
        );
        
        res.status(429).json({
          error: config.message || 'Too many requests, please try again later',
          retryAfter,
          limit: effectiveLimit,
          windowSeconds: config.windowSeconds,
        });
        return;
      }
      
      next();
    } catch (error) {
      // Fail open: allow request if rate limiting fails (Requirement: 10.1, 10.2, 10.3)
      console.error('Rate limiting error (failing open):', error);
      await logFailOpen(error, monitorService);
      next();
    }
  };
}

/**
 * Check if request is from internal service
 * Uses constant-time comparison to prevent timing attacks
 * 
 * Requirements: 8.1, 8.2
 */
async function isInternalRequest(req: Request): Promise<boolean> {
  const internalToken = req.headers['x-internal-token'];
  
  // Get expected token from settings, fallback to env for local dev
  let expectedToken: string | undefined;
  try {
    expectedToken = await settings.get('internalApiToken') as string;
  } catch {
    // Fallback to environment variable for local development
    expectedToken = process.env.INTERNAL_API_TOKEN;
  }
  
  if (!internalToken || !expectedToken) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(String(internalToken)),
      Buffer.from(expectedToken)
    );
  } catch {
    // If buffers are different lengths, timingSafeEqual throws
    return false;
  }
}

/**
 * Get effective limit based on user role
 * 
 * Requirements: 2.5, 4.3
 */
function getEffectiveLimit(config: RateLimitConfig, _req: Request): number {
  const { userId } = context;
  
  if (!userId || !config.roleMultipliers) {
    return config.limit;
  }
  
  // Get user role from context
  const userRole = getUserRole(userId);
  const multiplier = config.roleMultipliers[userRole] || 1;
  
  return Math.floor(config.limit * multiplier);
}

/**
 * List of moderator user IDs who bypass rate limits
 * In production, this should be fetched from settings or the Reddit API
 */
const MODERATOR_USER_IDS = new Set([
  't2_rnf5uobwt', // Acceptable_Boat5305 - dev account
]);

/**
 * Check if current user is a moderator
 * 
 * Requirements: 2.5
 */
function isModerator(): boolean {
  const { userId } = context;
  
  if (!userId) return false;
  
  // Check against known moderator list
  if (MODERATOR_USER_IDS.has(userId)) {
    return true;
  }
  
  // Check moderator status from Devvit context
  const ctx = context as any;
  
  // Try different possible moderator indicators
  if (ctx.moderator === true) return true;
  if (ctx.isModerator === true) return true;
  if (ctx.userIsModerator === true) return true;
  
  return false;
}

/**
 * Get user role from context or cache
 * 
 * Requirements: 2.5
 */
function getUserRole(_userId: string): string {
  if (isModerator()) {
    return 'moderator';
  }
  
  return 'user';
}

/**
 * Create a timeout promise that fails open
 * 
 * Requirements: 10.2
 */
function createTimeout(ms: number): Promise<RateLimitResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        allowed: true,
        remaining: 0,
        resetTime: Date.now() + ms,
        current: 0,
      });
    }, ms);
  });
}

/**
 * Extracts rate limit key from request
 * Uses userId for authenticated requests, IP for anonymous
 * 
 * Requirements: 2.1, 3.1
 */
function getRateLimitKey(req: Request): string {
  const { userId } = context;
  
  if (userId) {
    return `user:${userId}`;
  }
  
  // For anonymous requests, use IP address (Requirement: 3.1)
  const ip = getClientIP(req);
  return `ip:${ip}`;
}

/**
 * Extracts client IP address from request
 * Handles proxies and load balancers
 * Validates IPv4 and IPv6 addresses
 * 
 * Requirements: 3.1, 3.2, 3.5
 */
function getClientIP(req: Request): string {
  // Check X-Forwarded-For header (set by proxies)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = ips.split(',')[0].trim();
    
    // Validate IP format (Requirement: 3.5)
    if (isValidIP(ip)) {
      return ip;
    }
  }
  
  // Check X-Real-IP header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    const ip = Array.isArray(realIP) ? realIP[0] : realIP;
    if (isValidIP(ip)) {
      return ip;
    }
  }
  
  // Fallback to socket address (Requirement: 3.2)
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Validate IP address format (IPv4 and IPv6)
 * 
 * Requirements: 3.5
 */
export function isValidIP(ip: string): boolean {
  // IPv4 pattern: xxx.xxx.xxx.xxx
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // IPv6 pattern (simplified): supports standard and compressed formats
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  
  if (ipv4Pattern.test(ip)) {
    // Validate IPv4 octets are in range 0-255
    const octets = ip.split('.');
    return octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  return ipv6Pattern.test(ip);
}

/**
 * Log rate limit violation for monitoring
 * 
 * Logs structured violation data and tracks it in the monitoring service
 * for metrics and analysis.
 * 
 * Requirements: 6.5, 9.1, 9.2, 9.3
 */
async function logRateLimitViolation(
  req: Request,
  key: string,
  limit: number,
  windowSeconds: number,
  monitorService: RateLimitMonitorService
): Promise<void> {
  const endpoint = `${req.method} ${req.path}`;
  
  // Structured logging (Requirements: 9.1, 9.2, 9.3)
  console.log(JSON.stringify({
    level: 'warn',
    service: 'RateLimitMiddleware',
    event: 'rate_limit_exceeded',
    userId: context.userId || 'anonymous',
    ip: getClientIP(req),
    endpoint,
    key,
    limit,
    windowSeconds,
    timestamp: new Date().toISOString(),
  }));
  
  // Track violation in monitoring service (Requirements: 9.1, 9.2, 9.4)
  await monitorService.trackViolation(key, endpoint, limit, windowSeconds);
}

/**
 * Log internal bypass for audit
 * 
 * Requirements: 8.3
 */
function logInternalBypass(req: Request): void {
  console.log(JSON.stringify({
    level: 'info',
    service: 'RateLimitMiddleware',
    event: 'internal_bypass',
    endpoint: `${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log fail-open event for monitoring
 * 
 * Logs structured fail-open data and tracks it in the monitoring service
 * for system health monitoring.
 * 
 * Requirements: 10.3, 10.5
 */
async function logFailOpen(
  error: any,
  monitorService: RateLimitMonitorService
): Promise<void> {
  const errorMessage = error?.message || String(error);
  
  // Structured logging (Requirement: 10.3)
  console.error(JSON.stringify({
    level: 'error',
    service: 'RateLimitMiddleware',
    event: 'fail_open',
    error: errorMessage,
    timestamp: new Date().toISOString(),
  }));
  
  // Track fail-open event in monitoring service (Requirements: 10.3, 10.5)
  await monitorService.trackFailOpen(errorMessage);
}
