/**
 * Services Index
 * Central export point for all service classes
 */

export * from './base.service.js';
export * from './cache.service.js';
export * from './user.service.js';
export * from './challenge.service.js';
export * from './attempt.service.js';
export * from './comment.service.js';
export * from './leaderboard.service.js';

export * from './answer-set-generator.service.js';
// Export local validation service with explicit type re-export to avoid ValidationResult conflict
export { LocalValidationService, type LocalValidationResult } from './local-validation.service.js';
export * from './preload.service.js';
export * from './rate-limit.service.js';
export * from './rate-limit-monitor.service.js';

// Phase 4: Performance & Operations
export * from './health.service.js';
export * from './cache-warming.service.js';
export * from './data-loader.service.js';

// User services (refactored into focused services)
export * from './user/index.js';
