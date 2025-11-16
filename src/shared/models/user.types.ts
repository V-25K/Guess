/**
 * User Profile Types
 * Defines all types related to user profiles, statistics, and progression
 */

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
  last_challenge_created_at: string | null;
  created_at?: string;
  updated_at?: string;
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
