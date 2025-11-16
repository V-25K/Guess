/**
 * Date Utility
 * 
 * Handles date-related operations for rate limiting and time display.
 */

/**
 * Rate limit duration in milliseconds
 * TODO: Change back to 24 hours for production (24 * 60 * 60 * 1000)
 * Currently set to 1 minute for testing
 */
export const RATE_LIMIT_DURATION_MS = 1 * 60 * 1000; // 1 minute for testing
// export const RATE_LIMIT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours for production

/**
 * Result of checking if a user can create a challenge
 */
export interface CanCreateResult {
  canCreate: boolean;
  timeRemaining: number; // milliseconds until next creation allowed
}

/**
 * Check if a user can create a new challenge based on rate limiting.
 * Users can create one challenge per 24 hours.
 * 
 * @param lastCreatedAt - Timestamp of last challenge creation (ISO string or Date), or null if never created
 * @returns Object indicating if creation is allowed and time remaining
 * 
 * @example
 * // User never created a challenge
 * canCreateChallenge(null) // { canCreate: true, timeRemaining: 0 }
 * 
 * // User created a challenge 12 hours ago
 * canCreateChallenge(new Date(Date.now() - 12 * 60 * 60 * 1000))
 * // { canCreate: false, timeRemaining: 43200000 }
 * 
 * // User created a challenge 25 hours ago
 * canCreateChallenge(new Date(Date.now() - 25 * 60 * 60 * 1000))
 * // { canCreate: true, timeRemaining: 0 }
 */
export function canCreateChallenge(
  lastCreatedAt: string | Date | null
): CanCreateResult {
  if (!lastCreatedAt) {
    return {
      canCreate: true,
      timeRemaining: 0,
    };
  }
  
  const now = Date.now();
  const lastCreatedTime = typeof lastCreatedAt === 'string' 
    ? new Date(lastCreatedAt).getTime() 
    : lastCreatedAt.getTime();
  
  const timeSinceLastCreation = now - lastCreatedTime;
  
  if (timeSinceLastCreation >= RATE_LIMIT_DURATION_MS) {
    return {
      canCreate: true,
      timeRemaining: 0,
    };
  }
  
  const timeRemaining = RATE_LIMIT_DURATION_MS - timeSinceLastCreation;
  
  return {
    canCreate: false,
    timeRemaining: Math.max(0, timeRemaining),
  };
}

/**
 * Get the time remaining until a user can create another challenge.
 * 
 * @param lastCreatedAt - Timestamp of last challenge creation (ISO string or Date), or null if never created
 * @returns Milliseconds until next creation allowed (0 if can create now)
 * 
 * @example
 * getTimeRemaining(null) // 0
 * getTimeRemaining(new Date(Date.now() - 12 * 60 * 60 * 1000)) // ~43200000 (12 hours in ms)
 */
export function getTimeRemaining(lastCreatedAt: string | Date | null): number {
  const result = canCreateChallenge(lastCreatedAt);
  return result.timeRemaining;
}

/**
 * Format milliseconds into a user-friendly time remaining string.
 * 
 * @param milliseconds - Time in milliseconds
 * @returns Formatted string (e.g., "5h 30m", "45m", "2h")
 * 
 * @example
 * formatTimeRemaining(0) // "0m"
 * formatTimeRemaining(60000) // "1m"
 * formatTimeRemaining(3600000) // "1h"
 * formatTimeRemaining(5400000) // "1h 30m"
 * formatTimeRemaining(90000) // "1m 30s"
 */
export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) {
    return '0m';
  }
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  
  if (hours === 0 && seconds > 0) {
    parts.push(`${seconds}s`);
  }
  
  return parts.join(' ') || '0m';
}

/**
 * Format a timestamp into a relative time string (e.g., "2 hours ago", "3 days ago").
 * 
 * @param timestamp - ISO string or Date object
 * @returns Formatted relative time string
 * 
 * @example
 * formatRelativeTime(new Date(Date.now() - 60000)) // "1 minute ago"
 * formatRelativeTime(new Date(Date.now() - 3600000)) // "1 hour ago"
 * formatRelativeTime(new Date(Date.now() - 86400000)) // "1 day ago"
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const now = Date.now();
  const time = typeof timestamp === 'string' 
    ? new Date(timestamp).getTime() 
    : timestamp.getTime();
  
  const diffMs = now - time;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  
  if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  
  if (diffMinutes > 0) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }
  
  return 'just now';
}
