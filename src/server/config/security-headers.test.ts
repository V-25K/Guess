/**
 * Unit tests for security headers configuration
 * 
 * Tests default configuration values, environment loading,
 * invalid configuration handling, and header value formatting.
 * 
 * Requirements: 2.2, 5.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SecurityHeadersConfig,
  DEFAULT_SECURITY_HEADERS,
  getSecurityHeadersConfig,
} from './security-headers.js';

describe('Security Headers Configuration', () => {
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
  
  describe('DEFAULT_SECURITY_HEADERS', () => {
    it('should have secure default values', () => {
      expect(DEFAULT_SECURITY_HEADERS.enabled).toBe(true);
      expect(DEFAULT_SECURITY_HEADERS.xFrameOptions).toBe('SAMEORIGIN');
      expect(DEFAULT_SECURITY_HEADERS.xContentTypeOptions).toBe('nosniff');
    });
    
    it('should have a valid Content-Security-Policy', () => {
      const csp = DEFAULT_SECURITY_HEADERS.contentSecurityPolicy;
      
      // Should contain essential directives
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src");
      expect(csp).toContain("style-src");
      expect(csp).toContain("img-src");
      expect(csp).toContain("font-src");
      expect(csp).toContain("connect-src");
      
      // Should allow React requirements
      expect(csp).toContain("'unsafe-inline'");
      expect(csp).toContain("'unsafe-eval'");
    });
    
    it('should have a valid Referrer-Policy', () => {
      const policy = DEFAULT_SECURITY_HEADERS.referrerPolicy;
      expect(policy).toBe('strict-origin-when-cross-origin');
    });
    
    it('should have a valid Permissions-Policy', () => {
      const policy = DEFAULT_SECURITY_HEADERS.permissionsPolicy;
      
      // Should disable unnecessary features
      expect(policy).toContain('geolocation=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('camera=()');
    });
    
    it('should have properly formatted header values', () => {
      // No leading/trailing whitespace
      expect(DEFAULT_SECURITY_HEADERS.contentSecurityPolicy.trim()).toBe(
        DEFAULT_SECURITY_HEADERS.contentSecurityPolicy
      );
      expect(DEFAULT_SECURITY_HEADERS.referrerPolicy.trim()).toBe(
        DEFAULT_SECURITY_HEADERS.referrerPolicy
      );
      expect(DEFAULT_SECURITY_HEADERS.permissionsPolicy.trim()).toBe(
        DEFAULT_SECURITY_HEADERS.permissionsPolicy
      );
      
      // No empty values
      expect(DEFAULT_SECURITY_HEADERS.contentSecurityPolicy.length).toBeGreaterThan(0);
      expect(DEFAULT_SECURITY_HEADERS.referrerPolicy.length).toBeGreaterThan(0);
      expect(DEFAULT_SECURITY_HEADERS.permissionsPolicy.length).toBeGreaterThan(0);
    });
  });
  
  describe('getSecurityHeadersConfig', () => {
    it('should return default configuration when no environment variables are set', () => {
      const config = getSecurityHeadersConfig();
      
      expect(config).toEqual(DEFAULT_SECURITY_HEADERS);
    });
    
    it('should load enabled flag from environment', () => {
      process.env.SECURITY_HEADERS_ENABLED = 'false';
      const config = getSecurityHeadersConfig();
      
      expect(config.enabled).toBe(false);
    });
    
    it('should load CSP from environment', () => {
      const customCSP = "default-src 'none'; script-src 'self'";
      process.env.CSP_POLICY = customCSP;
      const config = getSecurityHeadersConfig();
      
      expect(config.contentSecurityPolicy).toBe(customCSP);
    });
    
    it('should load X-Frame-Options from environment', () => {
      process.env.X_FRAME_OPTIONS = 'DENY';
      const config = getSecurityHeadersConfig();
      
      expect(config.xFrameOptions).toBe('DENY');
    });
    
    it('should load Referrer-Policy from environment', () => {
      const customPolicy = 'no-referrer';
      process.env.REFERRER_POLICY = customPolicy;
      const config = getSecurityHeadersConfig();
      
      expect(config.referrerPolicy).toBe(customPolicy);
    });
    
    it('should handle case-insensitive enabled flag', () => {
      process.env.SECURITY_HEADERS_ENABLED = 'TRUE';
      const config1 = getSecurityHeadersConfig();
      expect(config1.enabled).toBe(true);
      
      process.env.SECURITY_HEADERS_ENABLED = 'False';
      const config2 = getSecurityHeadersConfig();
      expect(config2.enabled).toBe(false);
    });
    
    it('should handle case-insensitive X-Frame-Options', () => {
      process.env.X_FRAME_OPTIONS = 'deny';
      const config1 = getSecurityHeadersConfig();
      expect(config1.xFrameOptions).toBe('DENY');
      
      process.env.X_FRAME_OPTIONS = 'sameorigin';
      const config2 = getSecurityHeadersConfig();
      expect(config2.xFrameOptions).toBe('SAMEORIGIN');
    });
  });
  
  describe('Invalid configuration handling', () => {
    it('should fall back to default for invalid enabled flag', () => {
      process.env.SECURITY_HEADERS_ENABLED = 'invalid';
      const config = getSecurityHeadersConfig();
      
      expect(config.enabled).toBe(DEFAULT_SECURITY_HEADERS.enabled);
    });
    
    it('should fall back to default for invalid X-Frame-Options', () => {
      process.env.X_FRAME_OPTIONS = 'INVALID';
      const config = getSecurityHeadersConfig();
      
      expect(config.xFrameOptions).toBe(DEFAULT_SECURITY_HEADERS.xFrameOptions);
    });
    
    it('should fall back to default for empty CSP', () => {
      process.env.CSP_POLICY = '';
      const config = getSecurityHeadersConfig();
      
      expect(config.contentSecurityPolicy).toBe(DEFAULT_SECURITY_HEADERS.contentSecurityPolicy);
    });
    
    it('should fall back to default for whitespace-only CSP', () => {
      process.env.CSP_POLICY = '   ';
      const config = getSecurityHeadersConfig();
      
      expect(config.contentSecurityPolicy).toBe(DEFAULT_SECURITY_HEADERS.contentSecurityPolicy);
    });
    
    it('should fall back to default for empty Referrer-Policy', () => {
      process.env.REFERRER_POLICY = '';
      const config = getSecurityHeadersConfig();
      
      expect(config.referrerPolicy).toBe(DEFAULT_SECURITY_HEADERS.referrerPolicy);
    });
    
    it('should trim whitespace from environment values', () => {
      process.env.CSP_POLICY = "  default-src 'self'  ";
      process.env.REFERRER_POLICY = "  no-referrer  ";
      const config = getSecurityHeadersConfig();
      
      expect(config.contentSecurityPolicy).toBe("default-src 'self'");
      expect(config.referrerPolicy).toBe('no-referrer');
    });
    
    it('should handle multiple environment variables together', () => {
      process.env.SECURITY_HEADERS_ENABLED = 'false';
      process.env.CSP_POLICY = "default-src 'none'";
      process.env.X_FRAME_OPTIONS = 'DENY';
      process.env.REFERRER_POLICY = 'no-referrer';
      
      const config = getSecurityHeadersConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.contentSecurityPolicy).toBe("default-src 'none'");
      expect(config.xFrameOptions).toBe('DENY');
      expect(config.referrerPolicy).toBe('no-referrer');
    });
    
    it('should use defaults for all fields when environment has invalid values', () => {
      process.env.SECURITY_HEADERS_ENABLED = 'invalid';
      process.env.CSP_POLICY = '';
      process.env.X_FRAME_OPTIONS = 'INVALID';
      process.env.REFERRER_POLICY = '';
      
      const config = getSecurityHeadersConfig();
      
      expect(config).toEqual(DEFAULT_SECURITY_HEADERS);
    });
  });
  
  describe('Header value formatting', () => {
    it('should ensure all header values are strings', () => {
      const config = getSecurityHeadersConfig();
      
      expect(typeof config.contentSecurityPolicy).toBe('string');
      expect(typeof config.xFrameOptions).toBe('string');
      expect(typeof config.xContentTypeOptions).toBe('string');
      expect(typeof config.referrerPolicy).toBe('string');
      expect(typeof config.permissionsPolicy).toBe('string');
    });
    
    it('should ensure all header values are non-empty', () => {
      const config = getSecurityHeadersConfig();
      
      expect(config.contentSecurityPolicy.length).toBeGreaterThan(0);
      expect(config.xFrameOptions.length).toBeGreaterThan(0);
      expect(config.xContentTypeOptions.length).toBeGreaterThan(0);
      expect(config.referrerPolicy.length).toBeGreaterThan(0);
      expect(config.permissionsPolicy.length).toBeGreaterThan(0);
    });
    
    it('should ensure header values have no leading/trailing whitespace', () => {
      const config = getSecurityHeadersConfig();
      
      expect(config.contentSecurityPolicy.trim()).toBe(config.contentSecurityPolicy);
      expect(config.xFrameOptions.trim()).toBe(config.xFrameOptions);
      expect(config.xContentTypeOptions.trim()).toBe(config.xContentTypeOptions);
      expect(config.referrerPolicy.trim()).toBe(config.referrerPolicy);
      expect(config.permissionsPolicy.trim()).toBe(config.permissionsPolicy);
    });
  });
});
