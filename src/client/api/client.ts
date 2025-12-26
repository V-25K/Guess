/**
 * API Client Module
 * Handles all HTTP communication with the server endpoints
 * 
 * Requirements:
 * - 6.2: Add typed interfaces for all API payloads
 * - 7.5: Implement error boundary and error handling
 */

import type { UserProfile, UserStats, Challenge, ChallengeCreate, GameChallenge, AttemptResult, ChallengeAttempt } from './types';
import type { LeaderboardResponse, AnswerSetPreview, UserRankResponse, HintRevealResponse, ChallengePostResponse } from './types';
import { ApiError, ApiErrorCode } from './errors';

// Re-export types for convenience
export type { LeaderboardEntry, LeaderboardResponse, AnswerSetPreview } from './types';

/**
 * API Client class for making requests to server endpoints
 */
export class ApiClient {
  private baseUrl = '/api';
  private defaultTimeout = 30000; // 30 seconds

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
   * Fetch user profile
   */
  async getUserProfile(): Promise<UserProfile> {
    return this.request<UserProfile>(`${this.baseUrl}/user/profile`);
  }

  /**
   * Fetch user statistics
   */
  async getUserStats(): Promise<UserStats> {
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
   * Submit a guess for a challenge
   */
  async submitGuess(challengeId: string, guess: string): Promise<AttemptResult> {
    return this.request<AttemptResult>(`${this.baseUrl}/attempts/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId, guess }),
    });
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
   */
  async getLeaderboard(limit: number = 10, page: number = 1): Promise<LeaderboardResponse> {
    return this.request<LeaderboardResponse>(`${this.baseUrl}/leaderboard?limit=${limit}&page=${page}`);
  }

  /**
   * Fetch user's rank on leaderboard
   */
  async getUserRank(): Promise<UserRankResponse> {
    return this.request<UserRankResponse>(
      `${this.baseUrl}/leaderboard/user`
    );
  }

  /**
   * Get the current user's attempt for a specific challenge
   */
  async getAttempt(challengeId: string): Promise<ChallengeAttempt | null> {
    return this.request<ChallengeAttempt | null>(`${this.baseUrl}/attempts/challenge/${challengeId}`);
  }

  /**
   * Reveal a hint for a challenge attempt
   */
  async revealHint(challengeId: string, imageIndex: number, hintCost: number = 10): Promise<HintRevealResponse> {
    return this.request<HintRevealResponse>(`${this.baseUrl}/attempts/hint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId, imageIndex, hintCost }),
    });
  }

  /**
   * Create a Reddit post for a challenge
   */
  async createChallengePost(challengeId: string): Promise<ChallengePostResponse> {
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
   * Subscribe the current user to the subreddit
   */
  async subscribeToSubreddit(): Promise<{ success: boolean; message: string }> {
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
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Re-export error types for convenience
export { ApiError, ApiErrorCode } from './errors';
