/**
 * Guest Profile Generation Utilities
 * Handles automatic generation of guest user profiles with unique identifiers
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import type { GuestProfile } from '../../shared/models/user.types';

/**
 * Error types for guest profile generation
 */
export class GuestProfileGenerationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'GuestProfileGenerationError';
  }
}

/**
 * Generate a UUID v4 using crypto.randomUUID() with fallback
 * Requirements: 2.1
 */
function generateUUID(): string {
  // Try modern crypto.randomUUID() first
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      console.warn('crypto.randomUUID() failed, falling back to timestamp-based ID:', error);
    }
  }

  // Fallback to timestamp-based ID generation
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  
  // Format as UUID-like string
  return `${timestamp}-${randomPart}-${randomPart2}-${Date.now().toString(36)}`;
}

/**
 * Generate a random suffix for guest usernames
 * Requirements: 2.2
 */
function generateRandomSuffix(): string {
  const adjectives = [
    'happy', 'clever', 'bright', 'swift', 'brave', 'calm', 'wise', 'kind',
    'bold', 'quick', 'smart', 'cool', 'neat', 'fun', 'nice', 'good',
    'fast', 'sharp', 'clear', 'warm', 'fresh', 'clean', 'pure', 'true'
  ];
  
  const nouns = [
    'cat', 'dog', 'bird', 'fish', 'bear', 'wolf', 'fox', 'deer',
    'lion', 'tiger', 'eagle', 'hawk', 'owl', 'duck', 'swan', 'bee',
    'star', 'moon', 'sun', 'tree', 'rock', 'wave', 'wind', 'fire'
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);

  return `${adjective}_${noun}_${number}`;
}

/**
 * Generate a unique guest username with "guest_" prefix
 * Requirements: 2.2
 */
function generateGuestUsername(): string {
  const suffix = generateRandomSuffix();
  return `guest_${suffix}`;
}

/**
 * Create default guest profile statistics
 * Requirements: 2.3
 */
function createDefaultGuestStats(): Pick<GuestProfile, 
  'total_points' | 'total_experience' | 'level' | 'challenges_created' | 
  'challenges_attempted' | 'challenges_solved' | 'current_streak' | 
  'best_streak' | 'last_challenge_created_at'
> {
  return {
    total_points: 0,
    total_experience: 0,
    level: 1,
    challenges_created: 0,
    challenges_attempted: 0,
    challenges_solved: 0,
    current_streak: 0,
    best_streak: 0,
    last_challenge_created_at: null,
  };
}

/**
 * Generate a complete guest profile with unique ID and username
 * Requirements: 2.1, 2.2, 2.3
 */
export function generateGuestProfile(): GuestProfile {
  try {
    const id = generateUUID();
    const username = generateGuestUsername();
    const now = new Date().toISOString();
    const defaultStats = createDefaultGuestStats();

    const profile: GuestProfile = {
      id,
      username,
      ...defaultStats,
      role: 'player',
      created_at: now,
      updated_at: now,
      isGuest: true,
    };

    return profile;
  } catch (error) {
    throw new GuestProfileGenerationError(
      'Failed to generate guest profile',
      error as Error
    );
  }
}

/**
 * Generate a guest username with collision handling
 * Appends additional random characters if needed
 * Requirements: 2.2
 */
export function generateUniqueGuestUsername(existingUsernames: Set<string> = new Set()): string {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const username = generateGuestUsername();
    
    if (!existingUsernames.has(username)) {
      return username;
    }
    
    attempts++;
  }

  // If we still have collisions after max attempts, append timestamp
  const timestamp = Date.now().toString(36);
  const baseUsername = generateGuestUsername();
  return `${baseUsername}_${timestamp}`;
}

/**
 * Validate that a username follows guest username format
 * Requirements: 2.2
 */
export function isValidGuestUsername(username: string): boolean {
  if (!username.startsWith('guest_')) {
    return false;
  }

  // Check that it has content after the prefix
  const suffix = username.substring(6); // Remove "guest_" prefix
  if (suffix.length === 0) {
    return false;
  }

  // Check for valid characters (alphanumeric and underscores only)
  const validPattern = /^[a-zA-Z0-9_]+$/;
  return validPattern.test(suffix);
}

/**
 * Extract the suffix from a guest username
 * Requirements: 2.2
 */
export function getGuestUsernameSuffix(username: string): string | null {
  if (!isValidGuestUsername(username)) {
    return null;
  }

  return username.substring(6); // Remove "guest_" prefix
}

/**
 * Generate multiple guest profiles for testing purposes
 * Requirements: 2.1, 2.2, 2.3
 */
export function generateMultipleGuestProfiles(count: number): GuestProfile[] {
  if (count <= 0 || count > 1000) {
    throw new GuestProfileGenerationError('Count must be between 1 and 1000');
  }

  const profiles: GuestProfile[] = [];
  const usedUsernames = new Set<string>();

  for (let i = 0; i < count; i++) {
    try {
      const profile = generateGuestProfile();
      
      // Ensure username uniqueness within the batch
      if (usedUsernames.has(profile.username)) {
        profile.username = generateUniqueGuestUsername(usedUsernames);
      }
      
      usedUsernames.add(profile.username);
      profiles.push(profile);
    } catch (error) {
      throw new GuestProfileGenerationError(
        `Failed to generate guest profile ${i + 1} of ${count}`,
        error as Error
      );
    }
  }

  return profiles;
}

/**
 * Check if the browser supports modern UUID generation
 */
export function supportsNativeUUID(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
}

/**
 * Get information about the guest profile generation capabilities
 */
export function getGenerationInfo(): {
  supportsNativeUUID: boolean;
  canGenerate: boolean;
  lastGeneratedAt: string | null;
} {
  return {
    supportsNativeUUID: supportsNativeUUID(),
    canGenerate: true, // Always true since we have fallbacks
    lastGeneratedAt: null, // Could be tracked if needed
  };
}