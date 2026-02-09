/**
 * Client Types Index
 * Central export point for all client-side type definitions
 */

export * from './game.types';
export * from './navigation.types';

// Re-export shared types for convenience
export type {
  GuestProfile,
  GuestProfileUpdate,
  AnyUserProfile,
  UserProfile,
  UserProfileUpdate,
  UserStats,
} from '../../shared/models/user.types';

export {
  isGuestProfile,
  isAuthenticatedProfile,
} from '../../shared/models/user.types';
