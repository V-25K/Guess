/**
 * Security Headers Middleware
 * 
 * Express middleware that adds HTTP security headers to all API responses.
 * Protects against common web vulnerabilities including XSS, clickjacking,
 * and MIME-sniffing attacks.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4
 */

import { Request, Response, NextFunction } from 'express';
import { getSecurityHeadersConfig, SecurityHeadersConfig } from '../config/security-headers.js';

/**
 * Security headers middleware for Express
 * 
 * Adds all configured security headers to HTTP responses. The middleware
 * is designed to fail gracefully - if an error occurs during header
 * application, it logs the error and continues processing to ensure
 * responses are not blocked.
 * 
 * Headers applied:
 * - Content-Security-Policy: Controls resource loading to prevent XSS
 * - X-Frame-Options: Prevents clickjacking attacks
 * - X-Content-Type-Options: Prevents MIME-sniffing
 * - Referrer-Policy: Controls referrer information leakage
 * - Permissions-Policy: Disables unnecessary browser features
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * 
 * @example
 * import express from 'express';
 * import { securityHeaders } from './middleware/security-headers';
 * 
 * const app = express();
 * app.use(securityHeaders);
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Load security headers configuration (Requirements: 1.1, 3.4)
    const config = getSecurityHeadersConfig();
    
    // Check if security headers are enabled (Requirement: 3.4)
    if (!config.enabled) {
      logHeadersDisabled(req);
      return next();
    }
    
    // Apply all security headers (Requirements: 1.1, 1.2, 1.3, 1.4, 1.5)
    applySecurityHeaders(res, config, req);
    
    // Log successful header application
    logHeadersApplied(req);
    
    // Continue to next middleware (Requirements: 3.1, 3.2)
    next();
  } catch (error) {
    // Fail gracefully: log error and continue (Requirement: 3.3)
    logHeaderError(error, req);
    next();
  }
}

/**
 * Apply all security headers to the response
 * 
 * Sets each security header on the response object. If a header fails
 * to set, the error is caught and logged, but other headers continue
 * to be applied.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * @param res - Express response object
 * @param config - Security headers configuration
 * @param req - Express request object (for logging)
 */
function applySecurityHeaders(
  res: Response,
  config: SecurityHeadersConfig,
  req: Request
): void {
  try {
    // Content-Security-Policy (Requirement: 1.2)
    if (config.contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', config.contentSecurityPolicy);
    }
  } catch (error) {
    logIndividualHeaderError('Content-Security-Policy', error, req);
  }
  
  try {
    // X-Frame-Options (Requirement: 1.3)
    if (config.xFrameOptions) {
      res.setHeader('X-Frame-Options', config.xFrameOptions);
    }
  } catch (error) {
    logIndividualHeaderError('X-Frame-Options', error, req);
  }
  
  try {
    // X-Content-Type-Options (Requirement: 1.4)
    if (config.xContentTypeOptions) {
      res.setHeader('X-Content-Type-Options', config.xContentTypeOptions);
    }
  } catch (error) {
    logIndividualHeaderError('X-Content-Type-Options', error, req);
  }
  
  try {
    // Referrer-Policy (Requirement: 1.5)
    if (config.referrerPolicy) {
      res.setHeader('Referrer-Policy', config.referrerPolicy);
    }
  } catch (error) {
    logIndividualHeaderError('Referrer-Policy', error, req);
  }
  
  try {
    // Permissions-Policy (Requirement: 1.1)
    if (config.permissionsPolicy) {
      res.setHeader('Permissions-Policy', config.permissionsPolicy);
    }
  } catch (error) {
    logIndividualHeaderError('Permissions-Policy', error, req);
  }
}

/**
 * Log successful header application
 * 
 * Logs structured information about security headers being applied
 * to a request for audit and debugging purposes.
 * 
 * @param req - Express request object
 */
function logHeadersApplied(_req: Request): void {
  // Disabled verbose logging - uncomment for debugging
}

/**
 * Log when security headers are disabled
 * 
 * @param req - Express request object
 */
function logHeadersDisabled(req: Request): void {
  console.log(JSON.stringify({
    level: 'info',
    service: 'SecurityHeadersMiddleware',
    event: 'headers_disabled',
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log error during header application
 * 
 * Logs structured error information when the middleware encounters
 * an error. This ensures errors are tracked for monitoring while
 * not blocking the response.
 * 
 * Requirement: 3.3
 * 
 * @param error - Error that occurred
 * @param req - Express request object
 */
function logHeaderError(error: unknown, req: Request): void {
  let errorMessage: string;
  try {
    errorMessage = error instanceof Error ? error.message : String(error);
  } catch {
    // Handle cases where String(error) fails (e.g., objects with broken toString)
    errorMessage = '[object Object]';
  }
  
  console.error(JSON.stringify({
    level: 'error',
    service: 'SecurityHeadersMiddleware',
    event: 'header_application_error',
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log error for individual header
 * 
 * Logs when a specific header fails to set, allowing other headers
 * to continue being applied.
 * 
 * Requirement: 3.3
 * 
 * @param headerName - Name of the header that failed
 * @param error - Error that occurred
 * @param req - Express request object
 */
function logIndividualHeaderError(
  headerName: string,
  error: unknown,
  req: Request
): void {
  console.error(JSON.stringify({
    level: 'error',
    service: 'SecurityHeadersMiddleware',
    event: 'individual_header_error',
    header: headerName,
    error: error instanceof Error ? error.message : String(error),
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
  }));
}
