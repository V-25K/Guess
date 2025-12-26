/**
 * Security Headers Integration Tests
 * Tests that security headers middleware is properly integrated with routes
 * and works with other middleware (rate limiting, validation)
 * 
 * Requirements: 3.2, 3.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { securityHeaders } from './security-headers.js';
import { rateLimit } from './rate-limit.js';
import { RATE_LIMITS } from '../config/rate-limits.js';

// Mock dependencies
vi.mock('@devvit/web/server', () => ({
  context: {
    userId: 'test-user-123',
    username: 'testuser',
  },
  redis: {
    get: vi.fn(),
    watch: vi.fn(),
    multi: vi.fn(),
    incrBy: vi.fn(),
    expire: vi.fn(),
    exec: vi.fn(),
    zAdd: vi.fn(),
    zRemRangeByScore: vi.fn(),
    zCount: vi.fn(),
    zRangeByScore: vi.fn(),
  },
}));

vi.mock('../services/rate-limit.service.js', () => {
  return {
    RateLimitService: class {
      checkLimit = vi.fn().mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 60000,
        current: 1,
      });
    },
  };
});

vi.mock('../services/rate-limit-monitor.service.js', () => {
  return {
    RateLimitMonitorService: class {
      trackViolation = vi.fn().mockResolvedValue(undefined);
      trackFailOpen = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe('Security Headers Integration', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let setHeaderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock response
    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn().mockReturnThis();
    setHeaderMock = vi.fn().mockReturnThis();

    mockReq = {
      method: 'GET',
      path: '/api/challenges',
      headers: {},
      socket: {
        remoteAddress: '192.168.1.1',
      } as any,
    } as Request;

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
      setHeader: setHeaderMock as any,
    } as Response;

    mockNext = vi.fn();
  });

  describe('Middleware Chain Integration', () => {
    it('should work with rate limiting middleware', async () => {
      // Requirements: 3.2 - Test security headers work with rate limiting middleware
      
      // Apply security headers first
      securityHeaders(mockReq, mockRes, mockNext);
      
      // Verify security headers were set
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
      
      // Verify next() was called to continue to rate limiting
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith(); // No error passed
      
      // Now apply rate limiting middleware
      const rateLimitMiddleware = rateLimit(RATE_LIMITS['GET /api/challenges']);
      await rateLimitMiddleware(mockReq, mockRes, mockNext);
      
      // Verify rate limit headers were also set
      expect(setHeaderMock).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should not interfere with validation middleware', () => {
      // Requirements: 3.2 - Test security headers work with validation middleware
      
      // Apply security headers
      securityHeaders(mockReq, mockRes, mockNext);
      
      // Verify next() was called without error
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith(); // No error passed
      
      // Request should remain unchanged for validation
      expect(mockReq.method).toBe('GET');
      expect(mockReq.path).toBe('/api/challenges');
    });

    it('should apply headers before route handlers execute', () => {
      // Requirements: 3.4 - Ensure middleware applies to all /api/ routes
      
      const testRoutes = [
        '/api/challenges',
        '/api/challenges/550e8400-e29b-41d4-a716-446655440000',
        '/api/attempts/submit',
        '/api/attempts/hint',
        '/api/leaderboard',
        '/api/user/profile',
        '/api/user/stats',
      ];

      testRoutes.forEach(route => {
        vi.clearAllMocks();
        
        const testReq = {
          ...mockReq,
          path: route,
        } as Request;
        
        securityHeaders(testReq, mockRes, mockNext);
        
        // Verify all security headers are set
        expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
        expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
        expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
        expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
        expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
        
        // Verify next() was called
        expect(mockNext).toHaveBeenCalledOnce();
      });
    });
  });

  describe('Headers Applied Consistently Across Routes', () => {
    it('should apply headers to challenge list endpoint', () => {
      // Requirements: 3.4 - Test headers are applied consistently across all API routes
      const testReq = {
        ...mockReq,
        method: 'GET',
        path: '/api/challenges',
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should apply headers to challenge get endpoint', () => {
      // Requirements: 3.4 - Test headers are applied consistently across all API routes
      const testReq = {
        ...mockReq,
        method: 'GET',
        path: '/api/challenges/550e8400-e29b-41d4-a716-446655440000',
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should apply headers to challenge creation endpoint', () => {
      // Requirements: 3.4 - Test headers are applied consistently across all API routes
      const testReq = {
        ...mockReq,
        method: 'POST',
        path: '/api/challenges',
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should apply headers to attempt submission endpoint', () => {
      // Requirements: 3.4 - Test headers are applied consistently across all API routes
      const testReq = {
        ...mockReq,
        method: 'POST',
        path: '/api/attempts/submit',
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should apply headers to hint reveal endpoint', () => {
      // Requirements: 3.4 - Test headers are applied consistently across all API routes
      const testReq = {
        ...mockReq,
        method: 'POST',
        path: '/api/attempts/hint',
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should apply headers to leaderboard endpoint', () => {
      // Requirements: 3.4 - Test headers are applied consistently across all API routes
      const testReq = {
        ...mockReq,
        method: 'GET',
        path: '/api/leaderboard',
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should apply headers to user profile endpoint', () => {
      // Requirements: 3.4 - Test headers are applied consistently across all API routes
      const testReq = {
        ...mockReq,
        method: 'GET',
        path: '/api/user/profile',
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should apply headers to user stats endpoint', () => {
      // Requirements: 3.4 - Test headers are applied consistently across all API routes
      const testReq = {
        ...mockReq,
        method: 'GET',
        path: '/api/user/stats',
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
      expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('Full Request/Response Flow', () => {
    it('should include security headers in full request flow', () => {
      // Requirements: 3.2, 3.4 - Test full request/response flow includes security headers
      
      // Simulate full middleware chain
      securityHeaders(mockReq, mockRes, mockNext);
      
      // Verify all security headers are present
      const headerCalls = setHeaderMock.mock.calls;
      const headerNames = headerCalls.map(call => call[0]);
      
      expect(headerNames).toContain('Content-Security-Policy');
      expect(headerNames).toContain('X-Frame-Options');
      expect(headerNames).toContain('X-Content-Type-Options');
      expect(headerNames).toContain('Referrer-Policy');
      expect(headerNames).toContain('Permissions-Policy');
      
      // Verify next() was called to continue processing
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should not modify request body during processing', () => {
      // Requirements: 3.2 - Test that security headers don't break existing functionality
      const testReq = {
        ...mockReq,
        method: 'POST',
        path: '/api/attempts/submit',
        body: {
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          guess: 'Test guess',
        },
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      // Request body should remain unchanged
      expect(testReq.body).toEqual({
        challengeId: '550e8400-e29b-41d4-a716-446655440000',
        guess: 'Test guess',
      });
      
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should not modify query parameters during processing', () => {
      // Requirements: 3.2 - Test that security headers don't break existing functionality
      const testReq = {
        ...mockReq,
        method: 'GET',
        path: '/api/challenges',
        query: {
          page: '1',
          limit: '20',
        },
      } as unknown as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      // Query parameters should remain unchanged
      expect(testReq.query).toEqual({
        page: '1',
        limit: '20',
      });
      
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should work with different HTTP methods', () => {
      // Requirements: 3.4 - Test headers are applied consistently across all API routes
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      
      methods.forEach(method => {
        vi.clearAllMocks();
        
        const testReq = {
          ...mockReq,
          method,
          path: '/api/test',
        } as Request;
        
        securityHeaders(testReq, mockRes, mockNext);
        
        // Verify all security headers are set regardless of method
        expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
        expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
        expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
        expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
        expect(setHeaderMock).toHaveBeenCalledWith('Permissions-Policy', expect.any(String));
        
        expect(mockNext).toHaveBeenCalledOnce();
      });
    });
  });

  describe('Middleware Order Verification', () => {
    it('should work when placed after body parsers', () => {
      // Requirements: 3.2 - Verify middleware positioning
      
      // Simulate request with parsed body (as if body parser already ran)
      const testReq = {
        ...mockReq,
        body: { test: 'data' },
      } as Request;
      
      securityHeaders(testReq, mockRes, mockNext);
      
      // Should work normally
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should work before route handlers', () => {
      // Requirements: 3.2 - Verify middleware positioning
      
      securityHeaders(mockReq, mockRes, mockNext);
      
      // Should call next() to allow route handlers to run
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith(); // No error passed
    });

    it('should not interfere with subsequent middleware', async () => {
      // Requirements: 3.2 - Test security headers work with other middleware
      
      // Apply security headers
      securityHeaders(mockReq, mockRes, mockNext);
      
      // Verify it called next() without error
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith();
      
      // Apply rate limiting (simulating middleware chain)
      vi.clearAllMocks();
      const rateLimitMiddleware = rateLimit(RATE_LIMITS['GET /api/challenges']);
      await rateLimitMiddleware(mockReq, mockRes, mockNext);
      
      // Rate limiting should work normally
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('Header Values Verification', () => {
    it('should set correct CSP header value', () => {
      // Requirements: 3.4 - Verify correct header values
      securityHeaders(mockReq, mockRes, mockNext);
      
      const cspCall = setHeaderMock.mock.calls.find(call => call[0] === 'Content-Security-Policy');
      expect(cspCall).toBeDefined();
      expect(cspCall![1]).toContain("default-src 'self'");
    });

    it('should set correct X-Frame-Options value', () => {
      // Requirements: 3.4 - Verify correct header values
      securityHeaders(mockReq, mockRes, mockNext);
      
      const frameOptionsCall = setHeaderMock.mock.calls.find(call => call[0] === 'X-Frame-Options');
      expect(frameOptionsCall).toBeDefined();
      expect(frameOptionsCall![1]).toBe('SAMEORIGIN');
    });

    it('should set correct X-Content-Type-Options value', () => {
      // Requirements: 3.4 - Verify correct header values
      securityHeaders(mockReq, mockRes, mockNext);
      
      const contentTypeCall = setHeaderMock.mock.calls.find(call => call[0] === 'X-Content-Type-Options');
      expect(contentTypeCall).toBeDefined();
      expect(contentTypeCall![1]).toBe('nosniff');
    });

    it('should set correct Referrer-Policy value', () => {
      // Requirements: 3.4 - Verify correct header values
      securityHeaders(mockReq, mockRes, mockNext);
      
      const referrerCall = setHeaderMock.mock.calls.find(call => call[0] === 'Referrer-Policy');
      expect(referrerCall).toBeDefined();
      expect(referrerCall![1]).toBe('strict-origin-when-cross-origin');
    });

    it('should set correct Permissions-Policy value', () => {
      // Requirements: 3.4 - Verify correct header values
      securityHeaders(mockReq, mockRes, mockNext);
      
      const permissionsCall = setHeaderMock.mock.calls.find(call => call[0] === 'Permissions-Policy');
      expect(permissionsCall).toBeDefined();
      expect(permissionsCall![1]).toContain('geolocation=()');
    });
  });
});
