/**
 * API Client Module
 * Handles all HTTP communication with the server endpoints
 * 
 * Requirements:
 * - 6.2: Add typed interfaces for all API payloads
 * - 7.5: Implement error boundary and error handling
 * - REQ-3.1: API client includes guest identification
 * - REQ-3.4: Guest request authentication working
 */

import type { UserProfile, UserStats, Challenge, ChallengeCreate, GameChallenge, AttemptResult, ChallengeAttempt } from './types';
import type { LeaderboardResponse, AnswerSetPreview, UserRankResponse, HintRevealResponse, ChallengePostResponse } from './types';
import type { GuestProfile, AnyUserProfile } from '../../shared/models/user.types';
import { ApiError, ApiErrorCode } from './errors';

// Re-export types for convenience
export type { LeaderboardEntry, LeaderboardResponse, AnswerSetPreview } from './types';

/**
 * API Client class for making requests to server endpoints
 * Supports both authenticated and guest users
 */
export class ApiClient {
  private baseUrl = '/api';
  private defaultTimeout = 30000; // 30 seconds
  private guestProfile: GuestProfile | null = null;

  /**
   * Set guest mode for the API client
   * REQ-3.1: API client includes guest identification
   */
  setGuestMode(guestProfile: GuestProfile): void {
    this.guestProfile = guestProfile;
  }

  /**
   * Clear guest mode (return to authenticated mode)
   */
  clearGuestMode(): void {
    this.guestProfile = null;
  }

  /**
   * Check if client is in guest mode
   */
  isGuestMode(): boolean {
    return this.guestProfile !== null;
  }

  /**
   * Get current guest profile
   */
  getGuestProfile(): GuestProfile | null {
    return this.guestProfile;
  }

  /**
   * Make a fetch request with error handling
   */
  private async request<T>(
    url: string,
    options: RequestInit = {},
    timeout?: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout ?? this.defaultTimeout
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await ApiError.fromResponse(response);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError({
            code: ApiErrorCode.TIMEOUT,
            message: 'Request timed out. Please try again.',
            cause: error,
          });
        }

        // Network error
        throw ApiError.fromNetworkError(error);
      }

      throw new ApiError({
        code: ApiErrorCode.UNKNOWN,
        message: 'An unexpected error occurred',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch user profile (authenticated users only)
   */
  async getUserProfile(): Promise<UserProfile> {
    if (this.isGuestMode()) {
      throw new ApiError({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Cannot fetch authenticated user profile in guest mode',
      });
    }
    return this.request<UserProfile>(`${this.baseUrl}/user/profile`);
  }

  /**
   * Fetch current user profile (works for both authenticated and anonymous users via session)
   * Session-based approach - server handles identification automatically
   */
  async getCurrentUserProfile(): Promise<AnyUserProfile> {
    // Use the regular profile endpoint - server handles session-based identification
    return this.request<AnyUserProfile>(`${this.baseUrl}/user/profile`);
  }

  /**
   * Create or sync guest profile with server
   * REQ-3.1: Guest-specific API methods implemented
   */
  async syncGuestProfile(guestProfile: GuestProfile): Promise<UserProfile> {
    return this.request<UserProfile>(`${this.baseUrl}/guest/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(guestProfile),
    });
  }

  /**
   * Fetch guest profile from server
   * REQ-3.1: Guest-specific API methods implemented
   */
  async getGuestProfileFromServer(guestId: string): Promise<UserProfile> {
    return this.request<UserProfile>(`${this.baseUrl}/guest/profile/${guestId}`);
  }

  /**
   * Update guest profile on server
   * REQ-3.1: Guest-specific API methods implemented
   */
  async updateGuestProfile(guestId: string, updates: Partial<GuestProfile>): Promise<UserProfile> {
    return this.request<UserProfile>(`${this.baseUrl}/guest/profile/${guestId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
  }

  /**
   * Fetch user statistics (authenticated users only)
   */
  async getUserStats(): Promise<UserStats> {
    if (this.isGuestMode()) {
      throw new ApiError({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Cannot fetch authenticated user stats in guest mode',
      });
    }
    return this.request<UserStats>(`${this.baseUrl}/user/stats`);
  }

  /**
   * Fetch guest user statistics
   * REQ-3.1: Guest-specific API methods implemented
   */
  async getGuestStats(guestId: string): Promise<UserStats> {
    return this.request<UserStats>(`${this.baseUrl}/guest/stats/${guestId}`);
  }

  /**
   * Fetch current user statistics (works for both authenticated and anonymous users via session)
   * Session-based approach - server handles identification automatically
   */
  async getCurrentUserStats(): Promise<UserStats> {
    // Use the regular stats endpoint - server handles session-based identification
    return this.request<UserStats>(`${this.baseUrl}/user/stats`);
  }

  /**
   * Fetch all challenges
   */
  async getChallenges(): Promise<GameChallenge[]> {
    return this.request<GameChallenge[]>(`${this.baseUrl}/challenges`);
  }

  /**
   * Fetch a single challenge by ID
   */
  async getChallenge(challengeId: string): Promise<GameChallenge> {
    return this.request<GameChallenge>(`${this.baseUrl}/challenges/${challengeId}`);
  }

  /**
   * Submit a guess for a challenge (works for both authenticated and anonymous users via session)
   * Session-based approach - server handles identification automatically
   */
  async submitGuess(challengeId: string, guess: string): Promise<AttemptResult> {
    // Use the regular submit endpoint - server handles session-based identification
    return this.request<AttemptResult>(`${this.baseUrl}/attempts/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId, guess }),
    });
  }

  /**
   * Submit a guess for a challenge as a guest user
   * REQ-3.1: Guest-specific API methods implemented
   */
  async submitGuestGuess(challengeId: string, guess: string): Promise<AttemptResult> {
    if (!this.guestProfile || !this.guestProfile.id || this.guestProfile.id.trim() === '') {
      throw new ApiError({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Guest profile not set for guest guess submission',
      });
    }

    try {
      return await this.request<AttemptResult>(`${this.baseUrl}/guest/attempts/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          challengeId, 
          guess, 
          guestId: this.guestProfile.id 
        }),
      });
    } catch (error) {
      // REQ-3.4: Guest error handling in place
      if (error instanceof ApiError) {
        // Add guest-specific context to error messages
        if (error.code === ApiErrorCode.NOT_FOUND) {
          throw new ApiError({
            ...error,
            message: `Guest user or challenge not found: ${error.message}`,
          });
        }
        if (error.code === ApiErrorCode.BAD_REQUEST) {
          throw new ApiError({
            ...error,
            message: `Invalid guest request: ${error.message}`,
          });
        }
      }
      throw error;
    }
  }

  /**
   * Create a new challenge
   */
  async createChallenge(challenge: ChallengeCreate): Promise<Challenge> {
    return this.request<Challenge>(`${this.baseUrl}/challenges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(challenge),
    });
  }

  /**
   * Preview answer set generation for a challenge
   * Sends full challenge data for AI to generate answer variations
   */
  async previewAnswerSet(challengeData: ChallengeCreate): Promise<AnswerSetPreview> {
    return this.request<AnswerSetPreview>(`${this.baseUrl}/challenges/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(challengeData),
    });
  }

  /**
   * Fetch leaderboard with pagination
   * Works for both authenticated and guest users
   */
  async getLeaderboard(limit: number = 10, page: number = 1): Promise<LeaderboardResponse> {
    return this.request<LeaderboardResponse>(`${this.baseUrl}/leaderboard?limit=${limit}&page=${page}`);
  }

  /**
   * Fetch user's rank on leaderboard (works for both authenticated and anonymous users via session)
   * Session-based approach - server handles identification automatically
   */
  async getUserRank(): Promise<UserRankResponse> {
    // Use the regular rank endpoint - server handles session-based identification
    return this.request<UserRankResponse>(
      `${this.baseUrl}/leaderboard/user`
    );
  }

  /**
   * Fetch guest user's rank on leaderboard
   * REQ-3.1: Guest-specific API methods implemented
   */
  async getGuestUserRank(): Promise<UserRankResponse> {
    if (!this.guestProfile) {
      throw new ApiError({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Guest profile not set for rank retrieval',
      });
    }

    try {
      return await this.request<UserRankResponse>(
        `${this.baseUrl}/leaderboard/guest/${this.guestProfile.id}`
      );
    } catch (error) {
      // REQ-3.4: Guest error handling in place
      if (error instanceof ApiError && error.code === ApiErrorCode.NOT_FOUND) {
        // Guest user not found in leaderboard, return default rank
        return {
          rank: null,
          total_users: 0,
          user_points: this.guestProfile.total_points,
        };
      }
      throw error;
    }
  }

  /**
   * Get the current user's attempt for a specific challenge (works for both authenticated and anonymous users via session)
   * Session-based approach - server handles identification automatically
   */
  async getAttempt(challengeId: string): Promise<ChallengeAttempt | null> {
    // Use the regular attempt endpoint - server handles session-based identification
    return this.request<ChallengeAttempt | null>(`${this.baseUrl}/attempts/challenge/${challengeId}`);
  }

  /**
   * Get a guest user's attempt for a specific challenge
   * REQ-3.1: Guest-specific API methods implemented
   */
  async getGuestAttempt(challengeId: string): Promise<ChallengeAttempt | null> {
    if (!this.guestProfile) {
      throw new ApiError({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Guest profile not set for attempt retrieval',
      });
    }

    try {
      return await this.request<ChallengeAttempt | null>(
        `${this.baseUrl}/guest/attempts/challenge/${challengeId}/${this.guestProfile.id}`
      );
    } catch (error) {
      // REQ-3.4: Guest error handling in place
      if (error instanceof ApiError && error.code === ApiErrorCode.NOT_FOUND) {
        // No attempt found for this guest user and challenge
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all attempts for the current guest user
   * REQ-3.1: Guest-specific API methods implemented
   */
  async getGuestAttempts(): Promise<ChallengeAttempt[]> {
    if (!this.guestProfile) {
      throw new ApiError({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Guest profile not set for attempts retrieval',
      });
    }

    try {
      return await this.request<ChallengeAttempt[]>(
        `${this.baseUrl}/guest/attempts/${this.guestProfile.id}`
      );
    } catch (error) {
      // REQ-3.4: Guest error handling in place
      if (error instanceof ApiError && error.code === ApiErrorCode.NOT_FOUND) {
        // No attempts found for this guest user
        return [];
      }
      throw error;
    }
  }

  /**
   * Reveal a hint for a challenge attempt (works for both authenticated and anonymous users via session)
   * Session-based approach - server handles identification automatically
   */
  async revealHint(challengeId: string, imageIndex: number, hintCost: number = 10): Promise<HintRevealResponse> {
    // Use the regular hint endpoint - server handles session-based identification
    return this.request<HintRevealResponse>(`${this.baseUrl}/attempts/hint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId, imageIndex, hintCost }),
    });
  }

  /**
   * Reveal a hint for a challenge attempt as a guest user
   * REQ-3.1: Guest-specific API methods implemented
   */
  async revealGuestHint(challengeId: string, imageIndex: number, hintCost: number = 10): Promise<HintRevealResponse> {
    if (!this.guestProfile) {
      throw new ApiError({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Guest profile not set for hint reveal',
      });
    }

    try {
      return await this.request<HintRevealResponse>(`${this.baseUrl}/guest/attempts/hint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          challengeId, 
          imageIndex, 
          hintCost, 
          guestId: this.guestProfile.id 
        }),
      });
    } catch (error) {
      // REQ-3.4: Guest error handling in place
      if (error instanceof ApiError) {
        if (error.code === ApiErrorCode.BAD_REQUEST) {
          throw new ApiError({
            ...error,
            message: `Invalid guest hint request: ${error.message}`,
          });
        }
        if (error.code === ApiErrorCode.FORBIDDEN) {
          throw new ApiError({
            ...error,
            message: `Insufficient points for guest user: ${error.message}`,
          });
        }
      }
      throw error;
    }
  }

  /**
   * Give up on a challenge (works for both authenticated and anonymous users via session)
   * Session-based approach - server handles identification automatically
   */
  async giveUpChallenge(challengeId: string): Promise<{ success: boolean; message: string }> {
    // Use the regular give up endpoint - server handles session-based identification
    return this.request<{ success: boolean; message: string }>(`${this.baseUrl}/attempts/giveup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId }),
    });
  }

  /**
   * Give up on a challenge as a guest user
   * REQ-3.1: Guest-specific API methods implemented
   */
  async giveUpGuestChallenge(challengeId: string): Promise<{ success: boolean; message: string }> {
    if (!this.guestProfile) {
      throw new ApiError({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Guest profile not set for give up request',
      });
    }

    try {
      return await this.request<{ success: boolean; message: string }>(`${this.baseUrl}/guest/attempts/giveup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          challengeId, 
          guestId: this.guestProfile.id 
        }),
      });
    } catch (error) {
      // REQ-3.4: Guest error handling in place
      if (error instanceof ApiError) {
        if (error.code === ApiErrorCode.NOT_FOUND) {
          throw new ApiError({
            ...error,
            message: `Guest attempt not found: ${error.message}`,
          });
        }
        if (error.code === ApiErrorCode.BAD_REQUEST) {
          throw new ApiError({
            ...error,
            message: `Invalid guest give up request: ${error.message}`,
          });
        }
      }
      throw error;
    }
  }

  /**
   * Create a Reddit post for a challenge (authenticated users only)
   * REQ-3.4: Guest error handling in place
   */
  async createChallengePost(challengeId: string): Promise<ChallengePostResponse> {
    if (this.isGuestMode()) {
      throw new ApiError({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Guest users cannot create Reddit posts. Please sign in to create posts.',
      });
    }

    return this.request<ChallengePostResponse>(
      `${this.baseUrl}/challenges/${challengeId}/create-post`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  /**
   * Subscribe the current user to the subreddit (authenticated users only)
   * REQ-3.4: Guest error handling in place
   */
  async subscribeToSubreddit(): Promise<{ success: boolean; message: string }> {
    if (this.isGuestMode()) {
      throw new ApiError({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Guest users cannot subscribe to subreddits. Please sign in to subscribe.',
      });
    }

    return this.request<{ success: boolean; message: string }>(
      `${this.baseUrl}/user/subscribe`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  /**
   * Check if a guest user exists on the server (for debugging)
   * REQ-3.1: Guest-specific API methods implemented
   */
  async checkGuestUserExists(guestId: string): Promise<{ exists: boolean; profile?: any; error?: string }> {
    try {
      const response = await fetch(`/api/debug/guest/${guestId}`);
      if (response.ok) {
        return await response.json();
      } else {
        return { exists: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { 
        exists: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Delete guest profile from server
   * REQ-3.1: Guest-specific API methods implemented
   */
  async deleteGuestProfile(guestId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `${this.baseUrl}/guest/profile/${guestId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Re-export error types for convenience
export { ApiError, ApiErrorCode } from './errors';
