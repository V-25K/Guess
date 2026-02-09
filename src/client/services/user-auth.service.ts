/**
 * User Authentication Service
 * Handles both authenticated and anonymous users using session-based identification
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 7.1
 */

import type { AnyUserProfile } from '../../shared/models/user.types';
import { isGuestProfile } from '../../shared/models/user.types';
import { apiClient } from '../api/client';

/**
 * User Authentication Service Interface
 * Defines operations for managing both authenticated and anonymous users
 */
export interface IUserAuthService {
  getCurrentUser(): Promise<AnyUserProfile>;
  isAuthenticated(): boolean;
  isAnonymous(): boolean;
  getUserId(): string;
  getUsername(): string;
  refreshUserProfile(): Promise<AnyUserProfile>;
  reset(): void;
}

/**
 * User Authentication Service Implementation
 * Uses session-based identification for anonymous users (no more local guest profiles)
 */
export class UserAuthService implements IUserAuthService {
  private currentUser: AnyUserProfile | null = null;
  private authenticationChecked = false;

  /**
   * Get the current user (authenticated or anonymous via session)
   * Requirements: 1.1, 1.2, 1.3, 1.4
   * 
   * This method now relies on server-side session management for anonymous users
   */
  async getCurrentUser(): Promise<AnyUserProfile> {
    // If we already have a user, return it
    if (this.currentUser) {
      return this.currentUser;
    }

    this.authenticationChecked = true;
    
    try {
      // Try to get user profile (works for both authenticated and anonymous users)
      // The server will handle session-based identification for anonymous users
      const userProfile = await apiClient.getCurrentUserProfile();
      this.currentUser = userProfile;
      
      // Clear guest mode from API client (server handles identification now)
      apiClient.clearGuestMode();
      
      return userProfile;
    } catch (error) {
      // If we can't get any user profile, create a minimal anonymous profile
      // This should rarely happen with the new session-based approach
      console.debug('Failed to get user profile, creating minimal anonymous profile:', error);
      
      const anonymousProfile: AnyUserProfile = {
        id: `anon_${Date.now()}`,
        username: 'anonymous',
        total_points: 0,
        total_experience: 0,
        level: 1,
        challenges_created: 0,
        challenges_attempted: 0,
        challenges_solved: 0,
        current_streak: 0,
        best_streak: 0,
        last_challenge_created_at: null,
        role: 'player' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isGuest: true as const,
        is_subscribed: false,
        subscribed_at: null,
      };
      
      this.currentUser = anonymousProfile;
      return anonymousProfile;
    }
  }

  /**
   * Check if the current user is authenticated (not anonymous)
   * Requirements: 7.1
   */
  isAuthenticated(): boolean {
    if (!this.authenticationChecked || !this.currentUser) {
      return false;
    }
    return !isGuestProfile(this.currentUser);
  }

  /**
   * Check if the current user is anonymous
   * Requirements: 7.1
   */
  isAnonymous(): boolean {
    if (!this.authenticationChecked || !this.currentUser) {
      return false;
    }
    return isGuestProfile(this.currentUser);
  }

  /**
   * Get the current user's ID
   * Works for both authenticated and anonymous users
   */
  getUserId(): string {
    if (!this.currentUser) {
      throw new Error('No user available. Call getCurrentUser() first.');
    }
    
    if (isGuestProfile(this.currentUser)) {
      return this.currentUser.id;
    } else {
      return this.currentUser.user_id;
    }
  }

  /**
   * Get the current user's username
   * Works for both authenticated and anonymous users
   */
  getUsername(): string {
    if (!this.currentUser) {
      throw new Error('No user available. Call getCurrentUser() first.');
    }
    
    return this.currentUser.username;
  }

  /**
   * Refresh the user profile from the server
   * Requirements: 1.1, 1.2, 1.3, 1.4
   */
  async refreshUserProfile(): Promise<AnyUserProfile> {
    // Clear current user and fetch fresh profile
    this.currentUser = null;
    this.authenticationChecked = false;
    
    return this.getCurrentUser();
  }

  /**
   * Reset the service state
   * Used for testing or when switching contexts
   */
  reset(): void {
    this.currentUser = null;
    this.authenticationChecked = false;
    
    // Clear guest mode from API client
    apiClient.clearGuestMode();
  }

  /**
   * Force authentication check
   * Useful for retrying authentication after network issues
   */
  async recheckAuthentication(): Promise<AnyUserProfile> {
    return this.refreshUserProfile();
  }

  /**
   * Check if authentication has been attempted
   */
  hasCheckedAuthentication(): boolean {
    return this.authenticationChecked;
  }
}

/**
 * Default user authentication service instance
 */
export const userAuthService = new UserAuthService();