/**
 * Guest User Service
 * Main service class for managing guest user profiles and operations
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.5
 */

import type { GuestProfile, GuestProfileUpdate } from '../../shared/models/user.types';
import type { ChallengeAttempt } from '../../shared/models/attempt.types';
import { 
  saveGuestProfile, 
  loadGuestProfile, 
  updateGuestProfile, 
  clearGuestProfile,
  saveGuestAttempt,
  getGuestAttempt,
  loadGuestAttempts,
  getStorageInfo,
  GuestStorageError
} from '../utils/guest-storage';
import { 
  generateGuestProfile, 
  generateUniqueGuestUsername,
  isValidGuestUsername,
  GuestProfileGenerationError
} from '../utils/guest-profile-generator';

/**
 * Guest User Service Interface
 * Defines all operations for guest user management
 */
export interface IGuestUserService {
  generateGuestProfile(): GuestProfile;
  saveGuestProfile(profile: GuestProfile): void;
  loadGuestProfile(): GuestProfile | null;
  updateGuestProfile(updates: GuestProfileUpdate): GuestProfile | null;
  clearGuestProfile(): void;
  getOrCreateGuestProfile(): GuestProfile;
  saveAttempt(challengeId: string, attempt: ChallengeAttempt): void;
  getAttempt(challengeId: string): ChallengeAttempt | null;
  getAllAttempts(): Record<string, ChallengeAttempt>;
  isStorageAvailable(): boolean;
  getStorageInfo(): ReturnType<typeof getStorageInfo>;
}

/**
 * Guest User Service Implementation
 * Provides complete guest user profile management functionality
 */
export class GuestUserService implements IGuestUserService {
  /**
   * Generate a new guest profile
   * Requirements: 2.1, 2.2, 2.3
   */
  generateGuestProfile(): GuestProfile {
    try {
      return generateGuestProfile();
    } catch (error) {
      throw new GuestProfileGenerationError(
        'Failed to generate guest profile',
        error as Error
      );
    }
  }

  /**
   * Save guest profile to storage
   * Requirements: 2.4, 6.1
   */
  saveGuestProfile(profile: GuestProfile): void {
    if (!this.isValidGuestProfile(profile)) {
      throw new GuestStorageError('Invalid guest profile provided');
    }

    try {
      saveGuestProfile(profile);
    } catch (error) {
      throw new GuestStorageError(
        'Failed to save guest profile',
        error as Error
      );
    }
  }

  /**
   * Load guest profile from storage
   * Requirements: 2.5, 6.2
   */
  loadGuestProfile(): GuestProfile | null {
    try {
      return loadGuestProfile();
    } catch (error) {
      console.warn('Failed to load guest profile:', error);
      return null;
    }
  }

  /**
   * Update guest profile in storage
   * Requirements: 6.1, 6.2
   */
  updateGuestProfile(updates: GuestProfileUpdate): GuestProfile | null {
    try {
      return updateGuestProfile(updates);
    } catch (error) {
      throw new GuestStorageError(
        'Failed to update guest profile',
        error as Error
      );
    }
  }

  /**
   * Clear guest profile from storage
   * Requirements: 6.5
   */
  clearGuestProfile(): void {
    try {
      clearGuestProfile();
    } catch (error) {
      console.warn('Failed to clear guest profile:', error);
    }
  }

  /**
   * Get existing guest profile or create a new one
   * This is the main method for ensuring a guest profile exists
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  getOrCreateGuestProfile(): GuestProfile {
    // Try to load existing profile first
    const existingProfile = this.loadGuestProfile();
    if (existingProfile) {
      return existingProfile;
    }

    // Generate new profile if none exists
    try {
      const newProfile = this.generateGuestProfile();
      this.saveGuestProfile(newProfile);
      return newProfile;
    } catch (error) {
      // If storage fails, return in-memory profile
      if (error instanceof GuestStorageError) {
        console.warn('Storage failed, using in-memory guest profile:', error);
        return this.generateGuestProfile();
      }
      throw error;
    }
  }

  /**
   * Save a challenge attempt for the guest user
   */
  saveAttempt(challengeId: string, attempt: ChallengeAttempt): void {
    try {
      saveGuestAttempt(challengeId, attempt);
    } catch (error) {
      throw new GuestStorageError(
        'Failed to save guest attempt',
        error as Error
      );
    }
  }

  /**
   * Get a specific challenge attempt for the guest user
   */
  getAttempt(challengeId: string): ChallengeAttempt | null {
    try {
      return getGuestAttempt(challengeId);
    } catch (error) {
      console.warn('Failed to get guest attempt:', error);
      return null;
    }
  }

  /**
   * Get all challenge attempts for the guest user
   */
  getAllAttempts(): Record<string, ChallengeAttempt> {
    try {
      return loadGuestAttempts();
    } catch (error) {
      console.warn('Failed to load guest attempts:', error);
      return {};
    }
  }

  /**
   * Check if storage is available
   */
  isStorageAvailable(): boolean {
    return getStorageInfo().available;
  }

  /**
   * Get storage information for debugging
   */
  getStorageInfo(): ReturnType<typeof getStorageInfo> {
    return getStorageInfo();
  }

  /**
   * Validate that a profile is a valid guest profile
   */
  private isValidGuestProfile(profile: GuestProfile): boolean {
    return (
      profile &&
      typeof profile === 'object' &&
      typeof profile.id === 'string' &&
      profile.id.length > 0 &&
      typeof profile.username === 'string' &&
      isValidGuestUsername(profile.username) &&
      profile.isGuest === true &&
      profile.role === 'player' &&
      typeof profile.total_points === 'number' &&
      profile.total_points >= 0 &&
      typeof profile.total_experience === 'number' &&
      profile.total_experience >= 0 &&
      typeof profile.level === 'number' &&
      profile.level >= 1 &&
      typeof profile.challenges_created === 'number' &&
      profile.challenges_created >= 0 &&
      typeof profile.challenges_attempted === 'number' &&
      profile.challenges_attempted >= 0 &&
      typeof profile.challenges_solved === 'number' &&
      profile.challenges_solved >= 0 &&
      typeof profile.current_streak === 'number' &&
      profile.current_streak >= 0 &&
      typeof profile.best_streak === 'number' &&
      profile.best_streak >= 0 &&
      (profile.last_challenge_created_at === null || typeof profile.last_challenge_created_at === 'string') &&
      typeof profile.created_at === 'string' &&
      typeof profile.updated_at === 'string'
    );
  }

  /**
   * Migrate or repair corrupted guest profile data
   * Requirements: 6.5
   */
  repairGuestProfile(): GuestProfile {
    try {
      // Try to load existing profile
      const existingProfile = this.loadGuestProfile();
      
      if (existingProfile && this.isValidGuestProfile(existingProfile)) {
        return existingProfile;
      }

      // Clear corrupted data and create new profile
      console.warn('Corrupted guest profile detected, creating new profile');
      this.clearGuestProfile();
      
      const newProfile = this.generateGuestProfile();
      this.saveGuestProfile(newProfile);
      
      return newProfile;
    } catch (error) {
      // Last resort: return in-memory profile
      console.error('Failed to repair guest profile, using in-memory profile:', error);
      return this.generateGuestProfile();
    }
  }

  /**
   * Update guest profile statistics after gameplay
   */
  updateStats(updates: {
    pointsEarned?: number;
    experienceEarned?: number;
    challengeAttempted?: boolean;
    challengeSolved?: boolean;
    streakBroken?: boolean;
  }): GuestProfile | null {
    const currentProfile = this.loadGuestProfile();
    if (!currentProfile) {
      throw new GuestStorageError('No guest profile found to update stats');
    }

    const profileUpdates: GuestProfileUpdate = {};

    if (updates.pointsEarned !== undefined) {
      profileUpdates.total_points = currentProfile.total_points + updates.pointsEarned;
    }

    if (updates.experienceEarned !== undefined) {
      profileUpdates.total_experience = currentProfile.total_experience + updates.experienceEarned;
      // Simple level calculation (could be more sophisticated)
      profileUpdates.level = Math.floor(profileUpdates.total_experience / 1000) + 1;
    }

    if (updates.challengeAttempted) {
      profileUpdates.challenges_attempted = currentProfile.challenges_attempted + 1;
    }

    if (updates.challengeSolved) {
      profileUpdates.challenges_solved = currentProfile.challenges_solved + 1;
      profileUpdates.current_streak = currentProfile.current_streak + 1;
      
      if (profileUpdates.current_streak > currentProfile.best_streak) {
        profileUpdates.best_streak = profileUpdates.current_streak;
      }
    }

    if (updates.streakBroken) {
      profileUpdates.current_streak = 0;
    }

    return this.updateGuestProfile(profileUpdates);
  }
}

/**
 * Default guest user service instance
 */
export const guestUserService = new GuestUserService();

/**
 * Export types and errors for external use
 */
export { GuestStorageError, GuestProfileGenerationError };