/**
 * Property-based tests for security headers configuration
 * 
 * Uses fast-check to generate random invalid configurations and verify
 * that secure defaults are always applied.
 * 
 * Requirements: 2.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  DEFAULT_SECURITY_HEADERS,
  getSecurityHeadersConfig,
} from './security-headers.js';

describe('Security Headers Configuration - Property Tests', () => {
  // Store original environment variables
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.SECURITY_HEADERS_ENABLED;
    delete process.env.CSP_POLICY;
    delete process.env.X_FRAME_OPTIONS;
    delete process.env.REFERRER_POLICY;
  });
  
  afterEach(() => {
    // Restore original environment variables
    process.env = { ...originalEnv };
  });
  
  /**
   * Feature: security-headers, Property 2: Invalid configurations use secure defaults
   * Validates: Requirements 2.2
   * 
   * For any invalid or missing security header configuration value,
   * the system should apply a secure default value instead of failing
   * or applying an insecure value.
   */
  describe('Property 2: Invalid configurations use secure defaults', () => {
    it('should use secure defaults for any invalid SECURITY_HEADERS_ENABLED value', () => {
      fc.assert(
        fc.property(
          // Generate invalid enabled values (anything except 'true' or 'false' strings)
          fc.oneof(
            fc.constant(''),
            fc.constant('yes'),
            fc.constant('no'),
            fc.constant('1'),
            fc.constant('0'),
            fc.string().filter(s => s.toLowerCase() !== 'true' && s.toLowerCase() !== 'false'),
          ),
          (invalidValue) => {
            // Set invalid value
            process.env.SECURITY_HEADERS_ENABLED = invalidValue;
            
            const config = getSecurityHeadersConfig();
            
            // Should use default enabled value
            expect(config.enabled).toBe(DEFAULT_SECURITY_HEADERS.enabled);
            
            // Cleanup
            delete process.env.SECURITY_HEADERS_ENABLED;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should use secure defaults for any invalid X_FRAME_OPTIONS value', () => {
      fc.assert(
        fc.property(
          // Generate invalid X-Frame-Options values (anything except 'DENY' or 'SAMEORIGIN')
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('ALLOW'),
            fc.constant('ALLOWALL'),
            fc.constant('NONE'),
            fc.integer(),
            fc.boolean(),
            fc.string().filter(s => {
              const upper = s.toUpperCase();
              return upper !== 'DENY' && upper !== 'SAMEORIGIN';
            }),
          ),
          (invalidValue) => {
            // Set invalid value
            if (invalidValue !== null && invalidValue !== undefined) {
              process.env.X_FRAME_OPTIONS = String(invalidValue);
            }
            
            const config = getSecurityHeadersConfig();
            
            // Should use default X-Frame-Options value
            expect(config.xFrameOptions).toBe(DEFAULT_SECURITY_HEADERS.xFrameOptions);
            
            // Cleanup
            delete process.env.X_FRAME_OPTIONS;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should use secure defaults for empty or whitespace-only CSP_POLICY', () => {
      fc.assert(
        fc.property(
          // Generate empty or whitespace-only strings
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t'),
            fc.constant('\n'),
            fc.constant('\r\n'),
            fc.stringMatching(/^\s*$/), // Any whitespace-only string
          ),
          (invalidValue) => {
            process.env.CSP_POLICY = invalidValue;
            
            const config = getSecurityHeadersConfig();
            
            // Should use default CSP
            expect(config.contentSecurityPolicy).toBe(DEFAULT_SECURITY_HEADERS.contentSecurityPolicy);
            
            // Cleanup
            delete process.env.CSP_POLICY;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should use secure defaults for empty or whitespace-only REFERRER_POLICY', () => {
      fc.assert(
        fc.property(
          // Generate empty or whitespace-only strings
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t'),
            fc.constant('\n'),
            fc.constant('\r\n'),
            fc.stringMatching(/^\s*$/), // Any whitespace-only string
          ),
          (invalidValue) => {
            process.env.REFERRER_POLICY = invalidValue;
            
            const config = getSecurityHeadersConfig();
            
            // Should use default Referrer-Policy
            expect(config.referrerPolicy).toBe(DEFAULT_SECURITY_HEADERS.referrerPolicy);
            
            // Cleanup
            delete process.env.REFERRER_POLICY;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should always return a valid configuration object with all required fields', () => {
      fc.assert(
        fc.property(
          // Generate random combinations of invalid environment variables
          fc.record({
            enabled: fc.oneof(
              fc.constant(undefined),
              fc.string().filter(s => s.toLowerCase() !== 'true' && s.toLowerCase() !== 'false'),
            ),
            csp: fc.oneof(
              fc.constant(undefined),
              fc.constant(''),
              fc.stringMatching(/^\s*$/),
            ),
            xFrameOptions: fc.oneof(
              fc.constant(undefined),
              fc.string().filter(s => {
                const upper = s.toUpperCase();
                return upper !== 'DENY' && upper !== 'SAMEORIGIN';
              }),
            ),
            referrerPolicy: fc.oneof(
              fc.constant(undefined),
              fc.constant(''),
              fc.stringMatching(/^\s*$/),
            ),
          }),
          (invalidEnv) => {
            // Set invalid environment variables
            if (invalidEnv.enabled !== undefined) {
              process.env.SECURITY_HEADERS_ENABLED = invalidEnv.enabled;
            }
            if (invalidEnv.csp !== undefined) {
              process.env.CSP_POLICY = invalidEnv.csp;
            }
            if (invalidEnv.xFrameOptions !== undefined) {
              process.env.X_FRAME_OPTIONS = invalidEnv.xFrameOptions;
            }
            if (invalidEnv.referrerPolicy !== undefined) {
              process.env.REFERRER_POLICY = invalidEnv.referrerPolicy;
            }
            
            const config = getSecurityHeadersConfig();
            
            // Should have all required fields
            expect(config).toHaveProperty('contentSecurityPolicy');
            expect(config).toHaveProperty('xFrameOptions');
            expect(config).toHaveProperty('xContentTypeOptions');
            expect(config).toHaveProperty('referrerPolicy');
            expect(config).toHaveProperty('permissionsPolicy');
            expect(config).toHaveProperty('enabled');
            
            // All fields should be valid (non-empty strings or boolean)
            expect(typeof config.contentSecurityPolicy).toBe('string');
            expect(config.contentSecurityPolicy.length).toBeGreaterThan(0);
            
            expect(typeof config.xFrameOptions).toBe('string');
            expect(['DENY', 'SAMEORIGIN']).toContain(config.xFrameOptions);
            
            expect(config.xContentTypeOptions).toBe('nosniff');
            
            expect(typeof config.referrerPolicy).toBe('string');
            expect(config.referrerPolicy.length).toBeGreaterThan(0);
            
            expect(typeof config.permissionsPolicy).toBe('string');
            expect(config.permissionsPolicy.length).toBeGreaterThan(0);
            
            expect(typeof config.enabled).toBe('boolean');
            
            // Cleanup
            delete process.env.SECURITY_HEADERS_ENABLED;
            delete process.env.CSP_POLICY;
            delete process.env.X_FRAME_OPTIONS;
            delete process.env.REFERRER_POLICY;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should never return undefined or null for any configuration field', () => {
      fc.assert(
        fc.property(
          // Generate random combinations of invalid environment variables
          fc.record({
            enabled: fc.option(fc.string(), { nil: undefined }),
            csp: fc.option(fc.string(), { nil: undefined }),
            xFrameOptions: fc.option(fc.string(), { nil: undefined }),
            referrerPolicy: fc.option(fc.string(), { nil: undefined }),
          }),
          (invalidEnv) => {
            // Set environment variables (may be undefined)
            if (invalidEnv.enabled !== undefined) {
              process.env.SECURITY_HEADERS_ENABLED = invalidEnv.enabled;
            }
            if (invalidEnv.csp !== undefined) {
              process.env.CSP_POLICY = invalidEnv.csp;
            }
            if (invalidEnv.xFrameOptions !== undefined) {
              process.env.X_FRAME_OPTIONS = invalidEnv.xFrameOptions;
            }
            if (invalidEnv.referrerPolicy !== undefined) {
              process.env.REFERRER_POLICY = invalidEnv.referrerPolicy;
            }
            
            const config = getSecurityHeadersConfig();
            
            // No field should be undefined or null
            expect(config.contentSecurityPolicy).not.toBeUndefined();
            expect(config.contentSecurityPolicy).not.toBeNull();
            
            expect(config.xFrameOptions).not.toBeUndefined();
            expect(config.xFrameOptions).not.toBeNull();
            
            expect(config.xContentTypeOptions).not.toBeUndefined();
            expect(config.xContentTypeOptions).not.toBeNull();
            
            expect(config.referrerPolicy).not.toBeUndefined();
            expect(config.referrerPolicy).not.toBeNull();
            
            expect(config.permissionsPolicy).not.toBeUndefined();
            expect(config.permissionsPolicy).not.toBeNull();
            
            expect(config.enabled).not.toBeUndefined();
            expect(config.enabled).not.toBeNull();
            
            // Cleanup
            delete process.env.SECURITY_HEADERS_ENABLED;
            delete process.env.CSP_POLICY;
            delete process.env.X_FRAME_OPTIONS;
            delete process.env.REFERRER_POLICY;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
