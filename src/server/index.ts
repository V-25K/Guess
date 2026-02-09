/**
 * Express Server Entry Point
 * Handles all HTTP requests for the Devvit Web application
 * 
 * Requirements: 8.1, 8.5
 * Phase 4: Performance & Operations
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import { createServer, getServerPort } from '@devvit/web/server';
import { userRoutes } from './routes/user.routes.js';
import { guestRoutes } from './routes/guest.routes.js';
import { challengeRoutes } from './routes/challenge.routes.js';
import { attemptRoutes } from './routes/attempt.routes.js';
import { leaderboardRoutes } from './routes/leaderboard.routes.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { postDeleteRoutes } from './triggers/post-delete.js';
import { accountDeleteRoutes } from './triggers/account-delete.js';
import { menuRoutes } from './routes/menu.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { schedulerRoutes } from './routes/scheduler.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { securityHeaders } from './middleware/security-headers.js';
import { metricsMiddleware } from './utils/metrics.js';
import { createLogger } from './utils/logger.js';

// Create structured logger for server
const logger = createLogger({ service: 'Server' });

// Create Express app
const app = express();

// Request logging with structured logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Metrics middleware - tracks request duration and counts
app.use(metricsMiddleware());

// Middleware for parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware for anonymous user tracking
// This provides a session ID for anonymous users without violating privacy rules
app.use(session({
  secret: process.env.SESSION_SECRET || 'devvit-session-secret-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  name: 'devvit.session',
}));

// Enhanced context middleware - adds session ID for anonymous users
app.use((req: Request, _res: Response, next: NextFunction) => {
  const { userId } = require('@devvit/web/server').context;
  
  // For anonymous users, create a stable identifier
  if (!userId) {
    // Create a stable anonymous ID based on request characteristics
    // This is more reliable than express sessions in Devvit environment
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    
    // Create a hash-like identifier (simplified for demo)
    const stableId = Buffer.from(`${ip}-${userAgent}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const anonymousUserId = `anon_${stableId}`;
    
    // Add to request for use in routes
    (req as any).effectiveUserId = anonymousUserId;
    (req as any).isAnonymous = true;
    
    console.log(`Anonymous user ID: ${anonymousUserId} (IP: ${ip.substring(0, 8)}...)`);
  } else {
    (req as any).effectiveUserId = userId;
    (req as any).isAnonymous = false;
  }
  
  next();
});

// Security headers middleware - applies to all routes
// Positioned after body parsers but before route handlers
// Requirements: 3.1, 3.2, 3.4
app.use(securityHeaders);

// API Routes with rate limiting
// Challenge endpoints
app.use('/api/challenges', challengeRoutes);

// Attempt endpoints
app.use('/api/attempts', attemptRoutes);

// Leaderboard endpoints
app.use('/api/leaderboard', leaderboardRoutes);

// User endpoints
app.use('/api/user', userRoutes);

// Guest user endpoints
app.use('/api/guest', guestRoutes);

// Subscription endpoints
app.use('/api/subscription', subscriptionRoutes);

// Menu action handlers
app.use('/internal/menu', menuRoutes);

// Trigger Handlers
app.use('/internal/triggers/post-delete', postDeleteRoutes);
app.use('/internal/triggers/account-delete', accountDeleteRoutes);

// Health check routes (comprehensive health monitoring)
app.use('/api/health', healthRoutes);

// Scheduler routes (for Devvit scheduled tasks)
app.use('/internal/scheduler', schedulerRoutes);

// Admin routes (for moderator actions)
app.use('/internal/admin', adminRoutes);

// Root endpoint for debugging
app.get('/', (_req: Request, res: Response) => {
  res.json({ 
    message: 'Guess The Link API Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check context
app.get('/api/debug/context', (_req: Request, res: Response) => {
  const { userId, username, subredditName, postData } = require('@devvit/web/server').context;
  res.json({ 
    userId: userId || 'not set',
    username: username || 'not set',
    subredditName: subredditName || 'not set',
    hasContext: !!(userId && username),
    postData: postData || null
  });
});

// Debug endpoint to check if guest user exists
app.get('/api/debug/guest/:guestId', async (req: Request, res: Response) => {
  try {
    const guestId = req.params.guestId;
    const userRepo = new (require('./repositories/user.repository.js').UserRepository)(require('@devvit/web/server').context);
    const userService = new (require('./services/user.service.js').UserService)(require('@devvit/web/server').context, userRepo);
    
    const result = await userService.getGuestProfile(guestId);
    const { isOk } = require('../shared/utils/result.js');
    
    if (isOk(result) && result.value) {
      res.json({ 
        exists: true, 
        profile: result.value,
        message: 'Guest user found in database'
      });
    } else {
      res.json({ 
        exists: false, 
        error: result.error || 'Guest user not found',
        message: 'Guest user does not exist in database'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      exists: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error checking guest user'
    });
  }
});

// Endpoint to get post data for the current post
app.get('/api/post-data', (_req: Request, res: Response) => {
  const { postData } = require('@devvit/web/server').context;
  res.json(postData || {});
});

// Global error handling middleware (must be last)
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled server error', err, {
    method: req.method,
    url: req.url,
  });
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Get port from Devvit environment
const port = getServerPort();

// Export app for testing
export { app };

// Create and start server
const server = createServer(app);
server.on('error', (err) => logger.error('Server error', err));
server.listen(port);
