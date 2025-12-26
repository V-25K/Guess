/**
 * User Services Index
 * Central export point for all user-related service classes
 * 
 * This module provides three focused services following the Single Responsibility Principle:
 * - UserCacheService: Redis caching operations for user profiles
 * - UserProfileService: Profile CRUD operations
 * - UserProgressionService: XP, levels, and streak management
 */

// Export individual services
export { UserCacheService, PROFILE_CACHE_TTL } from './user-cache.service.js';
export { UserProfileService } from './user-profile.service.js';
export { UserProgressionService } from './user-progression.service.js';
