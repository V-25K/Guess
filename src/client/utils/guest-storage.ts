/**
 * Guest User Local Storage Utilities
 * Handles persistence and retrieval of guest user profiles from browser storage
 * 
 * Requirements: 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type { GuestProfile } from '../../shared/models/user.types';
import type { ChallengeAttempt } from '../../shared/models/attempt.types';

/**
 * Local storage keys for guest user data
 */
const STORAGE_KEYS = {
  GUEST_PROFILE: 'guest-profile',
  GUEST_ATTEMPTS: 'guest-attempts',
  GUEST_SETTINGS: 'guest-settings',
} as const;

/**
 * Guest storage schema for local storage structure
 */
export interface GuestStorageSchema {
  'guest-profile': GuestProfile;
  'guest-attempts': Record<string, ChallengeAttempt>; // challengeId -> attempt
  'guest-settings': {
    created_at: string;
    last_sync: string;
  };
}

/**
 * Error types for guest storage operations
 */
export class GuestStorageError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'GuestStorageError';
  }
}

/**
 * Check if local storage is available and accessible
 */
function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely parse JSON from storage with error handling
 */
function safeParseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse JSON from storage:', error);
    return null;
  }
}

/**
 * Safely stringify data for storage with error handling
 */
function safeStringifyJSON(data: unknown): string | null {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.warn('Failed to stringify data for storage:', error);
    return null;
  }
}

/**
 * Save guest profile to local storage
 * Requirements: 6.1, 6.3, 6.5
 */
export function saveGuestProfile(profile: GuestProfile): void {
  if (!isStorageAvailable()) {
    throw new GuestStorageError('Local storage is not available');
  }

  try {
    const serialized = safeStringifyJSON(profile);
    if (!serialized) {
      throw new GuestStorageError('Failed to serialize guest profile');
    }

    localStorage.setItem(STORAGE_KEYS.GUEST_PROFILE, serialized);
    
    // Update settings with last sync time
    const settings = loadGuestSettings() || {
      created_at: profile.created_at,
      last_sync: new Date().toISOString(),
    };
    settings.last_sync = new Date().toISOString();
    saveGuestSettings(settings);
    
  } catch (error) {
    if (error instanceof GuestStorageError) {
      throw error;
    }
    throw new GuestStorageError('Failed to save guest profile to storage', error as Error);
  }
}

/**
 * Load guest profile from local storage
 * Requirements: 6.2, 6.5
 */
export function loadGuestProfile(): GuestProfile | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GUEST_PROFILE);
    const profile = safeParseJSON<GuestProfile>(stored);
    
    if (profile && isValidGuestProfile(profile)) {
      return profile;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load guest profile from storage:', error);
    return null;
  }
}

/**
 * Update guest profile in local storage
 * Requirements: 6.1, 6.2
 */
export function updateGuestProfile(updates: Partial<GuestProfile>): GuestProfile | null {
  const currentProfile = loadGuestProfile();
  if (!currentProfile) {
    throw new GuestStorageError('No guest profile found to update');
  }

  const updatedProfile: GuestProfile = {
    ...currentProfile,
    ...updates,
    updated_at: new Date().toISOString(),
    // Ensure these fields cannot be changed
    id: currentProfile.id,
    isGuest: true,
    created_at: currentProfile.created_at,
  };

  saveGuestProfile(updatedProfile);
  return updatedProfile;
}

/**
 * Clear guest profile from local storage
 * Requirements: 6.5
 */
export function clearGuestProfile(): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.GUEST_ATTEMPTS);
    localStorage.removeItem(STORAGE_KEYS.GUEST_SETTINGS);
  } catch (error) {
    console.warn('Failed to clear guest profile from storage:', error);
  }
}

/**
 * Save guest attempt to local storage
 */
export function saveGuestAttempt(challengeId: string, attempt: ChallengeAttempt): void {
  if (!isStorageAvailable()) {
    throw new GuestStorageError('Local storage is not available');
  }

  try {
    const attempts = loadGuestAttempts();
    attempts[challengeId] = attempt;
    
    const serialized = safeStringifyJSON(attempts);
    if (!serialized) {
      throw new GuestStorageError('Failed to serialize guest attempts');
    }

    localStorage.setItem(STORAGE_KEYS.GUEST_ATTEMPTS, serialized);
  } catch (error) {
    if (error instanceof GuestStorageError) {
      throw error;
    }
    throw new GuestStorageError('Failed to save guest attempt to storage', error as Error);
  }
}

/**
 * Load guest attempts from local storage
 */
export function loadGuestAttempts(): Record<string, ChallengeAttempt> {
  if (!isStorageAvailable()) {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GUEST_ATTEMPTS);
    const attempts = safeParseJSON<Record<string, ChallengeAttempt>>(stored);
    return attempts || {};
  } catch (error) {
    console.warn('Failed to load guest attempts from storage:', error);
    return {};
  }
}

/**
 * Get specific guest attempt by challenge ID
 */
export function getGuestAttempt(challengeId: string): ChallengeAttempt | null {
  const attempts = loadGuestAttempts();
  return attempts[challengeId] || null;
}

/**
 * Save guest settings to local storage
 */
function saveGuestSettings(settings: GuestStorageSchema['guest-settings']): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    const serialized = safeStringifyJSON(settings);
    if (serialized) {
      localStorage.setItem(STORAGE_KEYS.GUEST_SETTINGS, serialized);
    }
  } catch (error) {
    console.warn('Failed to save guest settings:', error);
  }
}

/**
 * Load guest settings from local storage
 */
function loadGuestSettings(): GuestStorageSchema['guest-settings'] | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GUEST_SETTINGS);
    return safeParseJSON<GuestStorageSchema['guest-settings']>(stored);
  } catch (error) {
    console.warn('Failed to load guest settings:', error);
    return null;
  }
}

/**
 * Validate that a profile object is a valid guest profile
 */
function isValidGuestProfile(profile: unknown): profile is GuestProfile {
  if (!profile || typeof profile !== 'object') {
    return false;
  }

  const p = profile as Record<string, unknown>;
  
  return (
    typeof p.id === 'string' &&
    typeof p.username === 'string' &&
    p.username.startsWith('guest_') &&
    typeof p.total_points === 'number' &&
    typeof p.total_experience === 'number' &&
    typeof p.level === 'number' &&
    typeof p.challenges_created === 'number' &&
    typeof p.challenges_attempted === 'number' &&
    typeof p.challenges_solved === 'number' &&
    typeof p.current_streak === 'number' &&
    typeof p.best_streak === 'number' &&
    (p.last_challenge_created_at === null || typeof p.last_challenge_created_at === 'string') &&
    p.role === 'player' &&
    typeof p.created_at === 'string' &&
    typeof p.updated_at === 'string' &&
    p.isGuest === true
  );
}

/**
 * Get storage usage information for debugging
 */
export function getStorageInfo(): {
  available: boolean;
  hasProfile: boolean;
  profileSize: number;
  attemptsCount: number;
  lastSync: string | null;
} {
  const available = isStorageAvailable();
  const profile = loadGuestProfile();
  const attempts = loadGuestAttempts();
  const settings = loadGuestSettings();

  return {
    available,
    hasProfile: !!profile,
    profileSize: profile ? JSON.stringify(profile).length : 0,
    attemptsCount: Object.keys(attempts).length,
    lastSync: settings?.last_sync || null,
  };
}