/**
 * Security Headers Configuration
 * 
 * Centralized configuration for HTTP security headers that protect against
 * common web vulnerabilities including XSS, clickjacking, and MIME-sniffing.
 * 
 * Requirements: 2.1, 2.2, 2.4, 4.1, 4.3, 6.1, 6.2
 */

/**
 * Security header configuration interface
 * 
 * Defines all security headers that will be applied to API responses.
 * Each header serves a specific security purpose and follows OWASP
 * recommendations adapted for the Devvit Web platform.
 * 
 * Requirements: 2.1, 4.1
 */
export interface SecurityHeadersConfig {
  /**
   * Content Security Policy (CSP) directives
   * 
   * Controls which resources (scripts, styles, images, etc.) can be loaded
   * by the browser. Helps prevent XSS attacks by restricting resource origins.
   * 
   * Note: 'unsafe-inline' and 'unsafe-eval' are required for React and bundled
   * JavaScript to function properly in the Devvit Web environment.
   * 
   * Requirements: 1.2, 6.2
   */
  contentSecurityPolicy: string;
  
  /**
   * X-Frame-Options header value
   * 
   * Controls whether the page can be embedded in frames/iframes.
   * - DENY: Prevents all framing
   * - SAMEORIGIN: Allows framing only from same origin (required for Reddit embedding)
   * 
   * Requirements: 1.3, 6.3
   */
  xFrameOptions: 'DENY' | 'SAMEORIGIN';
  
  /**
   * X-Content-Type-Options header value
   * 
   * Prevents browsers from MIME-sniffing responses away from the declared
   * content-type. Always set to 'nosniff' for security.
   * 
   * Requirements: 1.4
   */
  xContentTypeOptions: 'nosniff';
  
  /**
   * Referrer-Policy header value
   * 
   * Controls how much referrer information is sent with requests.
   * Balances privacy with functionality requirements.
   * 
   * Requirements: 1.5, 6.4
   */
  referrerPolicy: string;
  
  /**
   * Permissions-Policy header directives
   * 
   * Controls which browser features and APIs can be used.
   * Disabling unnecessary features reduces attack surface.
   * 
   * Requirements: 6.1
   */
  permissionsPolicy: string;
  
  /**
   * Feature flag to enable/disable security headers
   * 
   * Allows disabling headers for debugging or compatibility testing.
   * Should always be true in production.
   * 
   * Requirements: 2.4
   */
  enabled: boolean;
}

/**
 * Default security headers configuration
 * 
 * Provides secure default values for all security headers, optimized for
 * the Devvit Web platform and Reddit embedding requirements.
 * 
 * These defaults follow OWASP recommendations while maintaining compatibility
 * with React, bundled JavaScript, and Reddit's webview embedding model.
 * 
 * Requirements: 2.2, 4.3, 6.1, 6.2
 */
export const DEFAULT_SECURITY_HEADERS: SecurityHeadersConfig = {
  /**
   * Content Security Policy
   * 
   * Rationale for each directive:
   * - default-src 'self': Only load resources from same origin by default
   * - script-src 'self' 'unsafe-inline' 'unsafe-eval': Allow bundled React and inline scripts
   * - style-src 'self' 'unsafe-inline': Allow inline styles for React components
   * - img-src 'self' data: https:: Allow images from same origin, data URIs, and HTTPS sources (Reddit CDN)
   * - font-src 'self' data:: Allow fonts from same origin and data URIs
   * - connect-src 'self': Only allow API calls to same origin
   * 
   * Requirements: 1.2, 6.2
   */
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",
  
  /**
   * X-Frame-Options: SAMEORIGIN
   * 
   * Allows Reddit to embed the webview while preventing external sites
   * from clickjacking attacks. Cannot use DENY as Reddit needs to embed
   * the application.
   * 
   * Requirements: 1.3, 6.3
   */
  xFrameOptions: 'SAMEORIGIN',
  
  /**
   * X-Content-Type-Options: nosniff
   * 
   * Prevents browsers from MIME-sniffing responses, which could lead to
   * security vulnerabilities if a response is interpreted as a different
   * content type than intended.
   * 
   * Requirements: 1.4
   */
  xContentTypeOptions: 'nosniff',
  
  /**
   * Referrer-Policy: strict-origin-when-cross-origin
   * 
   * Sends full referrer for same-origin requests, but only the origin
   * for cross-origin requests. Balances privacy with functionality.
   * 
   * Requirements: 1.5, 6.4
   */
  referrerPolicy: 'strict-origin-when-cross-origin',
  
  /**
   * Permissions-Policy
   * 
   * Disables unnecessary browser features to reduce attack surface:
   * - geolocation: Not needed for this application
   * - microphone: Not needed for this application
   * - camera: Not needed for this application
   * 
   * Requirements: 6.1
   */
  permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
  
  /**
   * Enabled by default
   * 
   * Security headers should always be enabled in production.
   * Can be disabled for debugging or compatibility testing.
   * 
   * Requirements: 2.4
   */
  enabled: true,
};

/**
 * Get security headers configuration for current environment
 * 
 * Loads configuration from environment variables if available,
 * otherwise returns secure defaults. Validates all configuration
 * values and falls back to defaults for invalid values.
 * 
 * Environment variables:
 * - SECURITY_HEADERS_ENABLED: 'true' or 'false'
 * - CSP_POLICY: Custom Content-Security-Policy directives
 * - X_FRAME_OPTIONS: 'DENY' or 'SAMEORIGIN'
 * - REFERRER_POLICY: Custom Referrer-Policy value
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 * 
 * @returns Security headers configuration with validated values
 * 
 * @example
 * const config = getSecurityHeadersConfig();
 * console.log(`CSP: ${config.contentSecurityPolicy}`);
 */
export function getSecurityHeadersConfig(): SecurityHeadersConfig {
  const config: SecurityHeadersConfig = { ...DEFAULT_SECURITY_HEADERS };
  
  try {
    // Load enabled flag from environment
    if (process.env.SECURITY_HEADERS_ENABLED !== undefined) {
      const enabled = process.env.SECURITY_HEADERS_ENABLED.toLowerCase();
      if (enabled === 'true' || enabled === 'false') {
        config.enabled = enabled === 'true';
      } else {
        console.warn(JSON.stringify({
          level: 'warn',
          service: 'SecurityHeadersConfig',
          event: 'invalid_config',
          field: 'enabled',
          value: process.env.SECURITY_HEADERS_ENABLED,
          message: 'Invalid SECURITY_HEADERS_ENABLED value, using default',
          timestamp: new Date().toISOString(),
        }));
      }
    }
    
    // Load CSP from environment
    if (process.env.CSP_POLICY && typeof process.env.CSP_POLICY === 'string' && process.env.CSP_POLICY.trim().length > 0) {
      config.contentSecurityPolicy = process.env.CSP_POLICY.trim();
    }
    
    // Load X-Frame-Options from environment
    if (process.env.X_FRAME_OPTIONS) {
      const xFrameOptions = process.env.X_FRAME_OPTIONS.toUpperCase();
      if (xFrameOptions === 'DENY' || xFrameOptions === 'SAMEORIGIN') {
        config.xFrameOptions = xFrameOptions;
      } else {
        console.warn(JSON.stringify({
          level: 'warn',
          service: 'SecurityHeadersConfig',
          event: 'invalid_config',
          field: 'xFrameOptions',
          value: process.env.X_FRAME_OPTIONS,
          message: 'Invalid X_FRAME_OPTIONS value, using default',
          timestamp: new Date().toISOString(),
        }));
      }
    }
    
    // Load Referrer-Policy from environment
    if (process.env.REFERRER_POLICY && typeof process.env.REFERRER_POLICY === 'string' && process.env.REFERRER_POLICY.trim().length > 0) {
      config.referrerPolicy = process.env.REFERRER_POLICY.trim();
    }
    
    // Disabled verbose config logging - uncomment for debugging
    // console.log(JSON.stringify({
    //   level: 'info',
    //   service: 'SecurityHeadersConfig',
    //   event: 'config_loaded',
    //   enabled: config.enabled,
    //   xFrameOptions: config.xFrameOptions,
    //   timestamp: new Date().toISOString(),
    // }));
    
  } catch (error) {
    // If any error occurs during configuration loading, use defaults
    console.error(JSON.stringify({
      level: 'error',
      service: 'SecurityHeadersConfig',
      event: 'config_load_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error loading security headers configuration, using defaults',
      timestamp: new Date().toISOString(),
    }));
    
    return { ...DEFAULT_SECURITY_HEADERS };
  }
  
  return config;
}
