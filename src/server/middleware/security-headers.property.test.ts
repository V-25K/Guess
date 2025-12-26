/**
 * Property-Based Tests for Security Headers Middleware
 * 
 * Feature: security-headers, Property 1: All configured security headers are present
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.4
 * 
 * Tests the correctness properties of the security headers middleware
 * using property-based testing with fast-check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import { securityHeaders } from './security-headers.js';
import * as securityHeadersConfig from '../config/security-headers.js';

/**
 * Create mock Express request object with random properties
 */
function createMockRequest(method: string, path: string): Request {
  return {
    method,
    path,
    headers: {},
    body: {},
    params: {},
    query: {},
  } as Request;
}

/**
 * Create mock Express response object that tracks headers
 */
function createMockResponse(): { res: Response; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  
  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    getHeader: vi.fn((name: string) => headers[name]),
  } as unknown as Response;
  
  return { res, headers };
}

/**
 * Create mock Express next function
 */
function createMockNext(): NextFunction {
  return vi.fn() as NextFunction;
}

describe('Security Headers Middleware - Property Tests', () => {
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
   * Property 1: All configured security headers are present
   * Feature: security-headers, Property 1: All configured security headers are present
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.4
   * 
   * For any API request (various methods and paths), all configured security
   * headers should be present in the response.
   */
  describe('Property 1: All configured security headers are present', () => {
    it('should include all security headers for any valid API request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'),
          fc.constantFrom(
            '/api/challenges',
            '/api/users',
            '/api/leaderboard',
            '/api/attempts',
            '/api/profile',
            '/api/health'
          ),
          async (method, path) => {
            const req = createMockRequest(method, path);
            const { res, headers } = createMockResponse();
            const next = createMockNext();
            
            securityHeaders(req, res, next);
            
            // Verify all required headers are present (Requirements: 1.1, 1.2, 1.3, 1.4, 1.5)
            expect(headers['Content-Security-Policy']).toBeDefined();
            expect(headers['X-Frame-Options']).toBeDefined();
            expect(headers['X-Content-Type-Options']).toBeDefined();
            expect(headers['Referrer-Policy']).toBeDefined();
            expect(headers['Permissions-Policy']).toBeDefined();
            
            // Verify next() was called (Requirement: 3.4)
            expect(next).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should set correct header values for any request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          fc.string({ minLength: 1, maxLength: 50 }).map(s => `/api/${s}`),
          async (method, path) => {
            const req = createMockRequest(method, path);
            const { res, headers } = createMockResponse();
            const next = createMockNext();
            
            securityHeaders(req, res, next);
            
            // Verify specific header values match configuration
            expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
            expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
            expect(headers['X-Content-Type-Options']).toBe('nosniff');
            expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
            expect(headers['Permissions-Policy']).toContain('geolocation=()');
            
            expect(next).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should apply headers regardless of request body content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.anything(),
          async (body) => {
            const req = createMockRequest('POST', '/api/test');
            (req as any).body = body;
            
            const { res, headers } = createMockResponse();
            const next = createMockNext();
            
            securityHeaders(req, res, next);
            
            // All headers should still be present
            expect(headers['Content-Security-Policy']).toBeDefined();
            expect(headers['X-Frame-Options']).toBeDefined();
            expect(headers['X-Content-Type-Options']).toBeDefined();
            expect(headers['Referrer-Policy']).toBeDefined();
            expect(headers['Permissions-Policy']).toBeDefined();
            
            expect(next).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should apply headers with various request headers present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 0, maxLength: 100 })
          ),
          async (requestHeaders) => {
            const req = createMockRequest('GET', '/api/test');
            req.headers = requestHeaders;
            
            const { res, headers } = createMockResponse();
            const next = createMockNext();
            
            securityHeaders(req, res, next);
            
            // Security headers should be present regardless of request headers
            expect(headers['Content-Security-Policy']).toBeDefined();
            expect(headers['X-Frame-Options']).toBeDefined();
            expect(headers['X-Content-Type-Options']).toBeDefined();
            expect(headers['Referrer-Policy']).toBeDefined();
            expect(headers['Permissions-Policy']).toBeDefined();
            
            expect(next).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should apply headers consistently across multiple requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
              path: fc.constantFrom('/api/test1', '/api/test2', '/api/test3'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (requests) => {
            const allHeaderSets: Record<string, string>[] = [];
            
            for (const { method, path } of requests) {
              const req = createMockRequest(method, path);
              const { res, headers } = createMockResponse();
              const next = createMockNext();
              
              securityHeaders(req, res, next);
              
              allHeaderSets.push({ ...headers });
              expect(next).toHaveBeenCalledOnce();
            }
            
            // All requests should have the same security headers
            for (const headers of allHeaderSets) {
              expect(headers['Content-Security-Policy']).toBeDefined();
              expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
              expect(headers['X-Content-Type-Options']).toBe('nosniff');
              expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
              expect(headers['Permissions-Policy']).toBeDefined();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  /**
   * Property 3: Response body preservation
   * Feature: security-headers, Property 3: Response body preservation
   * Validates: Requirements 3.1
   * 
   * For any response body content, processing through the security headers
   * middleware should not modify the response body.
   */
  describe('Property 3: Response body preservation', () => {
    it('should not modify JSON response bodies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.anything(),
          async (bodyContent) => {
            const req = createMockRequest('GET', '/api/test');
            const { res } = createMockResponse();
            const next = createMockNext();
            
            // Set a body on the response
            (res as any).body = bodyContent;
            const originalBody = (res as any).body;
            
            securityHeaders(req, res, next);
            
            // Body should be unchanged (Requirement: 3.1)
            expect((res as any).body).toBe(originalBody);
            expect(next).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should not modify text response bodies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 1000 }),
          async (text) => {
            const req = createMockRequest('GET', '/api/test');
            const { res } = createMockResponse();
            const next = createMockNext();
            
            (res as any).body = text;
            const originalBody = (res as any).body;
            
            securityHeaders(req, res, next);
            
            // Body should be unchanged
            expect((res as any).body).toBe(originalBody);
            expect(next).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should not modify large response bodies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.anything(), { minLength: 100, maxLength: 500 }),
          async (largeArray) => {
            const req = createMockRequest('GET', '/api/test');
            const { res } = createMockResponse();
            const next = createMockNext();
            
            const largeBody = { data: largeArray, metadata: { count: largeArray.length } };
            (res as any).body = largeBody;
            const originalBody = (res as any).body;
            
            securityHeaders(req, res, next);
            
            // Body should be unchanged
            expect((res as any).body).toBe(originalBody);
            expect((res as any).body.data.length).toBe(largeArray.length);
            expect(next).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('should not modify nested object response bodies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.object({ maxDepth: 5 }),
          async (nestedObject) => {
            const req = createMockRequest('POST', '/api/test');
            const { res } = createMockResponse();
            const next = createMockNext();
            
            (res as any).body = nestedObject;
            const originalBody = (res as any).body;
            
            securityHeaders(req, res, next);
            
            // Body should be unchanged
            expect((res as any).body).toBe(originalBody);
            expect(next).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should not modify response bodies with special types', async () => {
      const specialBodies = [
        null,
        undefined,
        0,
        false,
        '',
        [],
        {},
        new Date(),
        Buffer.from('test'),
      ];
      
      for (const body of specialBodies) {
        const req = createMockRequest('GET', '/api/test');
        const { res } = createMockResponse();
        const next = createMockNext();
        
        (res as any).body = body;
        const originalBody = (res as any).body;
        
        securityHeaders(req, res, next);
        
        // Body should be unchanged
        expect((res as any).body).toBe(originalBody);
        expect(next).toHaveBeenCalledOnce();
      }
    });
  });
  
  /**
   * Property 4: Error resilience
   * Feature: security-headers, Property 4: Error resilience
   * Validates: Requirements 3.3
   * 
   * For any error that occurs during security header application, the middleware
   * should log the error and allow the response to complete successfully.
   */
  describe('Property 4: Error resilience', () => {
    it('should continue processing when configuration loading fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          fc.string({ minLength: 1, maxLength: 50 }).map(s => `/api/${s}`),
          async (method, path) => {
            // Create fresh spy for each run
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            const req = createMockRequest(method, path);
            const { res } = createMockResponse();
            const next = createMockNext();
            
            // Mock getSecurityHeadersConfig to throw an error
            vi.spyOn(securityHeadersConfig, 'getSecurityHeadersConfig').mockImplementation(() => {
              throw new Error('Configuration load failed');
            });
            
            // Should not throw, should call next() (Requirement: 3.3)
            expect(() => securityHeaders(req, res, next)).not.toThrow();
            expect(next).toHaveBeenCalledOnce();
            
            // Verify error was logged
            expect(errorSpy).toHaveBeenCalled();
            
            vi.restoreAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('should continue when individual header setting fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 4 }), // Which header to fail (0-4)
          async (failIndex) => {
            const req = createMockRequest('GET', '/api/test');
            const { res, headers } = createMockResponse();
            const next = createMockNext();
            
            // Mock setHeader to throw on specific call
            let callCount = 0;
            res.setHeader = vi.fn((name: string, value: string) => {
              if (callCount === failIndex) {
                callCount++;
                throw new Error(`Failed to set header: ${name}`);
              }
              headers[name] = value;
              callCount++;
              return res;
            }) as any;
            
            // Should not throw, should call next() (Requirement: 3.3)
            expect(() => securityHeaders(req, res, next)).not.toThrow();
            expect(next).toHaveBeenCalledOnce();
            
            // Verify error was logged
            expect(console.error).toHaveBeenCalled();
            
            // Verify other headers were still attempted (5 total headers)
            expect(res.setHeader).toHaveBeenCalledTimes(5);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('should handle multiple header setting failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }), // Which headers to fail
          async (failurePattern) => {
            const req = createMockRequest('POST', '/api/test');
            const { res, headers } = createMockResponse();
            const next = createMockNext();
            
            // Mock setHeader to throw based on pattern
            let callCount = 0;
            res.setHeader = vi.fn((name: string, value: string) => {
              if (failurePattern[callCount]) {
                callCount++;
                throw new Error(`Failed to set header: ${name}`);
              }
              headers[name] = value;
              callCount++;
              return res;
            }) as any;
            
            // Should not throw, should call next() (Requirement: 3.3)
            expect(() => securityHeaders(req, res, next)).not.toThrow();
            expect(next).toHaveBeenCalledOnce();
            
            // If any failures occurred, error should be logged
            if (failurePattern.some(f => f)) {
              expect(console.error).toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('should log errors with structured information', async () => {
      const req = createMockRequest('GET', '/api/test');
      const { res } = createMockResponse();
      const next = createMockNext();
      
      // Mock to throw error
      vi.spyOn(securityHeadersConfig, 'getSecurityHeadersConfig').mockImplementation(() => {
        throw new Error('Test error message');
      });
      
      securityHeaders(req, res, next);
      
      // Verify error logging with structured format
      expect(console.error).toHaveBeenCalled();
      const errorLog = (console.error as any).mock.calls[0][0];
      
      // Parse the JSON log
      const logEntry = JSON.parse(errorLog);
      expect(logEntry.level).toBe('error');
      expect(logEntry.service).toBe('SecurityHeadersMiddleware');
      expect(logEntry.event).toBe('header_application_error');
      expect(logEntry.error).toContain('Test error message');
      expect(logEntry.method).toBe('GET');
      expect(logEntry.path).toBe('/api/test');
      expect(logEntry.timestamp).toBeDefined();
      
      vi.restoreAllMocks();
    });
    
    it('should complete responses even with catastrophic errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.anything(),
          async (errorValue) => {
            const req = createMockRequest('GET', '/api/test');
            const { res } = createMockResponse();
            const next = createMockNext();
            
            // Mock to throw various error types
            vi.spyOn(securityHeadersConfig, 'getSecurityHeadersConfig').mockImplementation(() => {
              throw errorValue;
            });
            
            // Should not throw, should call next() (Requirement: 3.3)
            expect(() => securityHeaders(req, res, next)).not.toThrow();
            expect(next).toHaveBeenCalledOnce();
            
            vi.restoreAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Test that headers are applied even with edge case paths
   */
  describe('Edge cases for header presence', () => {
    it('should handle empty path', () => {
      const req = createMockRequest('GET', '');
      const { res, headers } = createMockResponse();
      const next = createMockNext();
      
      securityHeaders(req, res, next);
      
      expect(headers['Content-Security-Policy']).toBeDefined();
      expect(headers['X-Frame-Options']).toBeDefined();
      expect(headers['X-Content-Type-Options']).toBeDefined();
      expect(headers['Referrer-Policy']).toBeDefined();
      expect(headers['Permissions-Policy']).toBeDefined();
      expect(next).toHaveBeenCalledOnce();
    });
    
    it('should handle very long paths', () => {
      const longPath = '/api/' + 'a'.repeat(1000);
      const req = createMockRequest('GET', longPath);
      const { res, headers } = createMockResponse();
      const next = createMockNext();
      
      securityHeaders(req, res, next);
      
      expect(headers['Content-Security-Policy']).toBeDefined();
      expect(headers['X-Frame-Options']).toBeDefined();
      expect(headers['X-Content-Type-Options']).toBeDefined();
      expect(headers['Referrer-Policy']).toBeDefined();
      expect(headers['Permissions-Policy']).toBeDefined();
      expect(next).toHaveBeenCalledOnce();
    });
    
    it('should handle paths with special characters', () => {
      const specialPaths = [
        '/api/test?query=value',
        '/api/test#fragment',
        '/api/test%20space',
        '/api/test/../other',
      ];
      
      for (const path of specialPaths) {
        const req = createMockRequest('GET', path);
        const { res, headers } = createMockResponse();
        const next = createMockNext();
        
        securityHeaders(req, res, next);
        
        expect(headers['Content-Security-Policy']).toBeDefined();
        expect(headers['X-Frame-Options']).toBeDefined();
        expect(headers['X-Content-Type-Options']).toBeDefined();
        expect(headers['Referrer-Policy']).toBeDefined();
        expect(headers['Permissions-Policy']).toBeDefined();
        expect(next).toHaveBeenCalledOnce();
      }
    });
  });
});
