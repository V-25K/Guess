/**
 * API Types
 * Typed interfaces for all API payloads
 * Requirements: 6.2
 */

// Re-export shared types used in API
export type { UserProfile, UserStats } from '../../shared/models/user.types';
export type { Challenge, ChallengeCreate, GameChallenge } from '../../shared/models/challenge.types';
export type { AttemptResult, ChallengeAttempt } from '../../shared/models/attempt.types';

/**
 * Leaderboard entry in the response
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
  level: number;
  challengesSolved: number;
}

/**
 * Leaderboard API response
 */
export interface UserRankData {
  rank: number | null;
  username: string;
  totalPoints: number;
  level: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  userRank: UserRankData | null;
  totalEntries: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  // kept for backward compatibility if needed, but mapped from totalEntries
  totalPlayers?: number;
}

/**
 * Answer set preview response
 */
export interface AnswerSetPreview {
  correct: string[];
  close: string[];
}

/**
 * User rank response
 */
export interface UserRankResponse {
  rank: number | null;
  totalPlayers: number;
}

/**
 * Hint reveal response
 */
export interface HintRevealResponse {
  hint: string;
  potentialScore: number;
  newTotalPoints?: number;
}

/**
 * Challenge post creation response
 */
export interface ChallengePostResponse {
  postId: string | null;
  success: boolean;
  posted: boolean;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}
