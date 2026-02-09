/**
 * User Profile Types
 * Defines all types related to user profiles, statistics, and progression
 */

export type UserRole = 'player' | 'mod';

export type UserProfile = {
  id?: string;
  user_id: string;
  username: string;
  total_points: number;
  total_experience: number;
  level: number;
  challenges_created: number;
  challenges_attempted: number;
  challenges_solved: number;
  current_streak: number;           // Consecutive solves without failing
  best_streak: number;              // Highest streak achieved
  last_challenge_created_at: string | null;
  role: UserRole;
  is_subscribed: boolean;           // Whether user is subscribed to the subreddit
  subscribed_at: string | null;     // When user subscribed
  created_at?: string;
  updated_at?: string;
  avatar_url?: string;
};

export type UserProfileUpdate = Partial<Omit<UserProfile, 'id' | 'user_id' | 'created_at'>>;

export type UserStats = {
  level: number;
  currentExp: number;
  expToNextLevel: number;
  totalPoints: number;
  challengesSolved: number;
  challengesAttempted: number;
  challengesCreated: number;
  successRate: number;
  rank: number | null;
};

/**
 * Guest User Profile Types
 * Defines types for unauthenticated users with automatically generated profiles
 */

export type GuestProfile = {
  id: string;                    // Generated UUID
  username: string;              // "guest_" + random suffix
  total_points: number;
  total_experience: number;
  level: number;
  challenges_created: number;
  challenges_attempted: number;
  challenges_solved: number;
  current_streak: number;
  best_streak: number;
  last_challenge_created_at: string | null;
  role: 'player';
  is_subscribed: boolean;        // Whether guest is subscribed to the subreddit
  subscribed_at: string | null;  // When guest subscribed
  created_at: string;
  updated_at: string;
  isGuest: true;                 // Flag to identify guest users
};

export type GuestProfileUpdate = Partial<Omit<GuestProfile, 'id' | 'created_at' | 'isGuest'>>;

/**
 * Union type for both authenticated and guest users
 */
export type AnyUserProfile = UserProfile | GuestProfile;

/**
 * Type guard to check if a profile is a guest profile
 */
export function isGuestProfile(profile: AnyUserProfile): profile is GuestProfile {
  return 'isGuest' in profile && profile.isGuest === true;
}

/**
 * Type guard to check if a profile is an authenticated user profile
 */
export function isAuthenticatedProfile(profile: AnyUserProfile): profile is UserProfile {
  return !('isGuest' in profile);
}
