/**
 * Express Server Entry Point
 * Handles all HTTP requests for the Devvit Web application
 * 
 * Requirements: 8.1, 8.5
 * Phase 4: Performance & Operations
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer, getServerPort } from '@devvit/web/server';
import { userRoutes } from './routes/user.routes.js';
import { challengeRoutes } from './routes/challenge.routes.js';
import { attemptRoutes } from './routes/attempt.routes.js';
import { leaderboardRoutes } from './routes/leaderboard.routes.js';
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

// Create and start server
const server = createServer(app);
server.on('error', (err) => logger.error('Server error', err));
server.listen(port);
