/**
 * Attempt Repository
 * Handles all database operations for challenge attempts
 */

import type { Context } from '@devvit/public-api';
import { BaseRepository } from './base.repository.js';
import type { ChallengeAttempt, ChallengeAttemptCreate, ChallengeAttemptUpdate, AttemptGuess, AttemptGuessCreate } from '../../shared/models/attempt.types.js';

export class AttemptRepository extends BaseRepository {
  private readonly TABLE = 'challenge_attempts';
  private readonly GUESSES_TABLE = 'attempt_guesses';

  constructor(context: Context) {
    super(context);
  }

  /**
   * Create a new challenge attempt
   */
  async create(attempt: ChallengeAttemptCreate): Promise<ChallengeAttempt | null> {
    return this.insert<ChallengeAttempt>(this.TABLE, attempt);
  }

  /**
   * Update an existing attempt
   */
  async updateAttempt(attemptId: string, updates: ChallengeAttemptUpdate): Promise<boolean> {
    return super.update(this.TABLE, { id: attemptId }, updates);
  }

  /**
   * Find all attempts by a user
   */
  async findByUser(userId: string): Promise<ChallengeAttempt[]> {
    return this.query<ChallengeAttempt>(this.TABLE, {
      filter: { user_id: `eq.${userId}` },
      order: 'attempted_at.desc',
    });
  }

  /**
   * Find all attempts for a specific challenge
   */
  async findByChallenge(challengeId: string): Promise<ChallengeAttempt[]> {
    return this.query<ChallengeAttempt>(this.TABLE, {
      filter: { challenge_id: `eq.${challengeId}` },
      order: 'attempted_at.desc',
    });
  }

  /**
   * Check if a user has attempted a challenge
   */
  async hasAttempted(userId: string, challengeId: string): Promise<boolean> {
    try {
      const config = await this.getSupabaseConfig();
      const url = `${config.url}/rest/v1/${this.TABLE}?user_id=eq.${userId}&challenge_id=eq.${challengeId}&select=id&limit=1`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a user has solved a challenge
   */
  async hasSolved(userId: string, challengeId: string): Promise<boolean> {
    try {
      const config = await this.getSupabaseConfig();
      const url = `${config.url}/rest/v1/${this.TABLE}?user_id=eq.${userId}&challenge_id=eq.${challengeId}&is_solved=eq.true&select=id&limit=1`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find a specific attempt by user and challenge
   */
  async findByUserAndChallenge(userId: string, challengeId: string): Promise<ChallengeAttempt | null> {
    try {
      const config = await this.getSupabaseConfig();
      const url = `${config.url}/rest/v1/${this.TABLE}?user_id=eq.${userId}&challenge_id=eq.${challengeId}&select=*&limit=1`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.length > 0 ? data[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Record challenge completion atomically
   * Uses Postgres function to update attempt and user profile in a single transaction
   * This prevents data inconsistency if one operation fails
   */
  async recordCompletionAtomic(
    attemptId: string,
    userId: string,
    attemptsMade: number,
    points: number,
    experience: number
  ): Promise<boolean> {
    return this.executeBooleanFunction('record_challenge_completion_v2', {
      p_attempt_id: attemptId,
      p_user_id: userId,
      p_attempts_made: attemptsMade,
      p_points: points,
      p_experience: experience,
    });
  }

  /**
   * Create a guess record in the attempt_guesses table
   */
  async createGuess(guess: AttemptGuessCreate): Promise<AttemptGuess | null> {
    return this.insert<AttemptGuess>(this.GUESSES_TABLE, guess);
  }

  /**
   * Get all guesses for an attempt
   */
  async getGuessesByAttempt(attemptId: string): Promise<AttemptGuess[]> {
    return this.query<AttemptGuess>(this.GUESSES_TABLE, {
      filter: { attempt_id: `eq.${attemptId}` },
      order: 'created_at.asc',
    });
  }
}
