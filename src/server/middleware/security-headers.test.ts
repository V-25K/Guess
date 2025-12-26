/**
 * Unit tests for security headers middleware
 * 
 * Tests verify that security headers are correctly applied to responses,
 * error handling works properly, and the middleware integrates with Express.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.3, 5.1, 5.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { securityHeaders } from './security-headers.js';
import * as securityHeadersConfig from '../config/security-headers.js';

/**
 * Create mock Express request object
 */
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/api/test',
    headers: {},
    ...overrides,
  } as Request;
}

/**
 * Create mock Express response object
 */
function createMockResponse(): Response {
  const headers: Record<string, string> = {};
  
  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    getHeader: vi.fn((name: string) => headers[name]),
    _headers: headers,
  } as unknown as Response;
  
  return res;
}

/**
 * Create mock Express next function
 */
function createMockNext(): NextFunction {
  return vi.fn() as NextFunction;
}

describe('securityHeaders middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  /**
   * Test: All headers are added to response
   * Requirement: 1.1, 5.1
   */
  it('should add all security headers to response', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    securityHeaders(req, res, next);
    
    // Verify all headers are set (Requirements: 1.1, 1.2, 1.3, 1.4, 1.5)
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.any(String)
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Frame-Options',
      expect.any(String)
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Referrer-Policy',
      expect.any(String)
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      expect.any(String)
    );
    
    // Verify next() was called (Requirement: 3.1)
    expect(next).toHaveBeenCalledOnce();
  });
  
  /**
   * Test: Specific header values match configuration
   * Requirements: 1.2, 1.3, 1.4, 1.5, 5.2
   */
  it('should set Content-Security-Policy header with correct value', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    securityHeaders(req, res, next);
    
    // Verify CSP header contains expected directives (Requirement: 1.2)
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'self'")
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("script-src")
    );
  });
  
  it('should set X-Frame-Options header to SAMEORIGIN', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    securityHeaders(req, res, next);
    
    // Verify X-Frame-Options is SAMEORIGIN for Reddit embedding (Requirement: 1.3)
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Frame-Options',
      'SAMEORIGIN'
    );
  });
  
  it('should set X-Content-Type-Options header to nosniff', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    securityHeaders(req, res, next);
    
    // Verify X-Content-Type-Options prevents MIME sniffing (Requirement: 1.4)
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff'
    );
  });
  
  it('should set Referrer-Policy header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    securityHeaders(req, res, next);
    
    // Verify Referrer-Policy is set (Requirement: 1.5)
    expect(res.setHeader).toHaveBeenCalledWith(
      'Referrer-Policy',
      'strict-origin-when-cross-origin'
    );
  });
  
  it('should set Permissions-Policy header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    securityHeaders(req, res, next);
    
    // Verify Permissions-Policy disables unnecessary features (Requirement: 1.1)
    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      expect.stringContaining('geolocation=()')
    );
  });
  
  /**
   * Test: Response body is not modified
   * Requirement: 3.1
   */
  it('should not modify response body', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    // Add a mock body to the response
    const mockBody = { data: 'test' };
    (res as any).body = mockBody;
    
    securityHeaders(req, res, next);
    
    // Verify body is unchanged (Requirement: 3.1)
    expect((res as any).body).toBe(mockBody);
    expect(next).toHaveBeenCalledOnce();
  });
  
  /**
   * Test: Error handling doesn't block responses
   * Requirement: 3.3
   */
  it('should handle errors gracefully and continue processing', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    // Mock getSecurityHeadersConfig to throw an error
    vi.spyOn(securityHeadersConfig, 'getSecurityHeadersConfig').mockImplementation(() => {
      throw new Error('Configuration error');
    });
    
    // Should not throw, should call next() (Requirement: 3.3)
    expect(() => securityHeaders(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledOnce();
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalled();
  });
  
  it('should continue if individual header setting fails', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    // Mock setHeader to throw on first call, succeed on others
    let callCount = 0;
    res.setHeader = vi.fn((name: string, value: string) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Header setting failed');
      }
      return res;
    }) as any;
    
    // Should not throw, should call next() (Requirement: 3.3)
    expect(() => securityHeaders(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledOnce();
    
    // Verify other headers were still attempted
    expect(res.setHeader).toHaveBeenCalledTimes(5);
  });
  
  /**
   * Test: Middleware works with Express request/response objects
   * Requirement: 5.1, 5.2
   */
  it('should work with different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    
    methods.forEach(method => {
      const req = createMockRequest({ method });
      const res = createMockResponse();
      const next = createMockNext();
      
      securityHeaders(req, res, next);
      
      // Verify headers are applied regardless of method
      expect(res.setHeader).toHaveBeenCalled();
      expect(next).toHaveBeenCalledOnce();
      
      vi.clearAllMocks();
    });
  });
  
  it('should work with different request paths', () => {
    const paths = ['/api/challenges', '/api/users', '/api/leaderboard'];
    
    paths.forEach(path => {
      const req = createMockRequest({ path });
      const res = createMockResponse();
      const next = createMockNext();
      
      securityHeaders(req, res, next);
      
      // Verify headers are applied regardless of path
      expect(res.setHeader).toHaveBeenCalled();
      expect(next).toHaveBeenCalledOnce();
      
      vi.clearAllMocks();
    });
  });
  
  /**
   * Test: Disabled configuration
   */
  it('should skip header application when disabled', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    // Mock config with enabled: false
    vi.spyOn(securityHeadersConfig, 'getSecurityHeadersConfig').mockReturnValue({
      contentSecurityPolicy: "default-src 'self'",
      xFrameOptions: 'SAMEORIGIN',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'geolocation=()',
      enabled: false,
    });
    
    securityHeaders(req, res, next);
    
    // Verify no headers were set
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
  
  /**
   * Test: Logging behavior
   */
  it('should log header application', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    securityHeaders(req, res, next);
    
    // Verify logging occurred
    expect(console.log).toHaveBeenCalled();
  });
  
  it('should log errors when they occur', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();
    
    // Mock to throw error
    vi.spyOn(securityHeadersConfig, 'getSecurityHeadersConfig').mockImplementation(() => {
      throw new Error('Test error');
    });
    
    securityHeaders(req, res, next);
    
    // Verify error logging
    expect(console.error).toHaveBeenCalled();
    const errorLog = (console.error as any).mock.calls[0][0];
    expect(errorLog).toContain('error');
    expect(errorLog).toContain('Test error');
  });
});
