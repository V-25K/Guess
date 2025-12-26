/**
 * Unit Tests for Rate Limit Configuration
 * 
 * Tests specific examples and edge cases for rate limit configuration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  RATE_LIMITS, 
  DEFAULT_RATE_LIMIT, 
  ANONYMOUS_RATE_LIMIT,
  updateRateLimit,
  getRateLimit 
} from './rate-limits.js';

describe('Rate Limit Configuration', () => {
  /**
   * Test that unconfigured endpoints use default limit
   * Requirements: 4.2
   */
  describe('Default rate limit fallback', () => {
    it('should return default rate limit for unconfigured endpoint', () => {
      const endpoint = 'GET /api/unconfigured-endpoint';
      const config = getRateLimit(endpoint);
      
      expect(config).toEqual(DEFAULT_RATE_LIMIT);
      expect(config.limit).toBe(DEFAULT_RATE_LIMIT.limit);
      expect(config.windowSeconds).toBe(DEFAULT_RATE_LIMIT.windowSeconds);
    });
    
    it('should return default rate limit for non-existent endpoint', () => {
      const endpoint = 'POST /api/does-not-exist';
      const config = getRateLimit(endpoint);
      
      expect(config).toEqual(DEFAULT_RATE_LIMIT);
    });
    
    it('should return default rate limit for empty endpoint string', () => {
      const endpoint = '';
      const config = getRateLimit(endpoint);
      
      expect(config).toEqual(DEFAULT_RATE_LIMIT);
    });
    
    it('should return configured limit for known endpoint', () => {
      const endpoint = 'GET /api/challenges';
      const config = getRateLimit(endpoint);
      
      expect(config).not.toEqual(DEFAULT_RATE_LIMIT);
      expect(config.limit).toBe(100);
      expect(config.windowSeconds).toBe(60);
    });
    
    it('should return default after removing a configured endpoint', () => {
      const endpoint = 'GET /api/test-endpoint';
      
      // Add a configuration
      updateRateLimit(endpoint, { limit: 50, windowSeconds: 30 });
      let config = getRateLimit(endpoint);
      expect(config.limit).toBe(50);
      
      // Remove it by setting to undefined (simulating deletion)
      delete RATE_LIMITS[endpoint];
      
      // Should now return default
      config = getRateLimit(endpoint);
      expect(config).toEqual(DEFAULT_RATE_LIMIT);
    });
  });
  
  /**
   * Test that all predefined endpoints have configurations
   */
  describe('Predefined endpoint configurations', () => {
    it('should have configuration for challenge list endpoint', () => {
      const config = getRateLimit('GET /api/challenges');
      expect(config.limit).toBe(100);
      expect(config.windowSeconds).toBe(60);
      expect(config.roleMultipliers).toEqual({ moderator: 2 });
    });
    
    it('should have configuration for challenge creation endpoint', () => {
      const config = getRateLimit('POST /api/challenges');
      expect(config.limit).toBe(1);
      expect(config.windowSeconds).toBe(86400); // 24 hours
      expect(config.message).toBe('You can only create one challenge per 24 hours');
    });
    
    it('should have configuration for guess submission endpoint', () => {
      const config = getRateLimit('POST /api/attempts/submit');
      expect(config.limit).toBe(30);
      expect(config.windowSeconds).toBe(60);
    });
    
    it('should have configuration for leaderboard endpoint', () => {
      const config = getRateLimit('GET /api/leaderboard');
      expect(config.limit).toBe(60);
      expect(config.windowSeconds).toBe(60);
    });
  });
  
  /**
   * Test anonymous rate limit configuration
   */
  describe('Anonymous rate limit', () => {
    it('should have stricter limits than default', () => {
      expect(ANONYMOUS_RATE_LIMIT.limit).toBeLessThan(DEFAULT_RATE_LIMIT.limit);
    });
    
    it('should have appropriate error message', () => {
      expect(ANONYMOUS_RATE_LIMIT.message).toContain('IP address');
    });
  });
  
  /**
   * Test configuration updates
   */
  describe('Configuration updates', () => {
    it('should update existing endpoint configuration', () => {
      const endpoint = 'GET /api/test';
      const newConfig = { limit: 100, windowSeconds: 120 };
      
      updateRateLimit(endpoint, newConfig);
      const retrieved = getRateLimit(endpoint);
      
      expect(retrieved.limit).toBe(100);
      expect(retrieved.windowSeconds).toBe(120);
    });
    
    it('should add new endpoint configuration', () => {
      const endpoint = 'POST /api/new-endpoint';
      const newConfig = { limit: 25, windowSeconds: 30 };
      
      updateRateLimit(endpoint, newConfig);
      const retrieved = getRateLimit(endpoint);
      
      expect(retrieved.limit).toBe(25);
      expect(retrieved.windowSeconds).toBe(30);
    });
    
    it('should preserve other endpoint configurations when updating one', () => {
      const endpoint1 = 'GET /api/endpoint1';
      const endpoint2 = 'GET /api/endpoint2';
      
      updateRateLimit(endpoint1, { limit: 10, windowSeconds: 60 });
      updateRateLimit(endpoint2, { limit: 20, windowSeconds: 60 });
      
      // Update endpoint1
      updateRateLimit(endpoint1, { limit: 15, windowSeconds: 60 });
      
      // endpoint2 should be unchanged
      const config2 = getRateLimit(endpoint2);
      expect(config2.limit).toBe(20);
    });
  });
});
