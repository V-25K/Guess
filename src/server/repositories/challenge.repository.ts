/**
 * Challenge Repository
 * Handles all database operations for challenges
 */

import type { Context } from '@devvit/server/server-context';
import { BaseRepository } from './base.repository.js';
import type { Challenge, ChallengeCreate, ChallengeFilters } from '../../shared/models/challenge.types.js';
import type { Result } from '../../shared/utils/result.js';
import { isErr } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { databaseError } from '../../shared/models/errors.js';
import { tryCatch } from '../../shared/utils/result-adapters.js';

export class ChallengeRepository extends BaseRepository {
  private readonly TABLE = 'challenges';

  constructor(context: Context) {
    super(context);
  }

  /**
   * Find all challenges with optional filters
   */
  async findAll(filters?: ChallengeFilters): Promise<Result<Challenge[], AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();

        // Build query URL
        let url = `${config.url}/rest/v1/${this.TABLE}?select=*`;

        // Add tag filtering if specified
        if (filters?.tags && filters.tags.length > 0) {
          // Use cs (contains) operator for array containment
          const tagFilter = `{${filters.tags.join(',')}}`;
          url += `&tags=cs.${tagFilter}`;
        }

        // Add creator filter if specified
        if (filters?.creatorId) {
          url += `&creator_id=eq.${filters.creatorId}`;
        }

        // Add ordering
        url += '&order=created_at.desc';

        // Add pagination
        if (filters?.limit) {
          url += `&limit=${filters.limit}`;
        }

        if (filters?.offset) {
          url += `&offset=${filters.offset}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      },
      (error) => databaseError('findAll', String(error))
    );
  }

  /**
   * Find challenge by ID
   */
  async findById(challengeId: string): Promise<Result<Challenge | null, AppError>> {
    return this.queryOne<Challenge>(this.TABLE, {
      filter: { id: `eq.${challengeId}` },
    });
  }

  /**
   * Find challenge by Reddit post ID
   */
  async findByPostId(postId: string): Promise<Result<Challenge | null, AppError>> {
    return this.queryOne<Challenge>(this.TABLE, {
      filter: { reddit_post_id: `eq.${postId}` },
    });
  }

  /**
   * Create a new challenge
   */
  async create(challenge: ChallengeCreate): Promise<Result<Challenge, AppError>> {
    return this.insert<Challenge>(this.TABLE, challenge);
  }

  /**
   * Find challenges by creator ID
   */
  async findByCreator(creatorId: string): Promise<Result<Challenge[], AppError>> {
    return this.query<Challenge>(this.TABLE, {
      filter: { creator_id: `eq.${creatorId}` },
      order: 'created_at.desc',
    });
  }

  /**
   * Update a challenge
   */
  override async update(challengeId: string, updates: Partial<Challenge>): Promise<Result<boolean, AppError>> {
    return super.update(this.TABLE, { id: challengeId }, updates);
  }

  /**
   * Delete a challenge by ID
   */
  async deleteChallenge(challengeId: string): Promise<Result<boolean, AppError>> {
    return super.delete(this.TABLE, { id: challengeId });
  }
  /**
   * Increment the players_played count for a challenge
   */
  async incrementPlayersPlayed(challengeId: string): Promise<Result<boolean, AppError>> {
    return this.executeBooleanFunction('increment_players_played', {
      p_challenge_id: challengeId,
    });
  }

  /**
   * Increment the players_completed count for a challenge
   */
  async incrementPlayersCompleted(challengeId: string): Promise<Result<boolean, AppError>> {
    return tryCatch(
      async () => {
        // Fallback: Read-Modify-Write since RPC might be missing
        const challengeResult = await this.findById(challengeId);
        if (isErr(challengeResult)) {
          throw new Error(JSON.stringify(challengeResult.error));
        }

        const challenge = challengeResult.value;
        if (!challenge) {
          throw new Error('Challenge not found');
        }

        const updateResult = await this.update(challengeId, {
          players_completed: (challenge.players_completed || 0) + 1
        });

        if (isErr(updateResult)) {
          throw new Error(JSON.stringify(updateResult.error));
        }

        return updateResult.value;
      },
      (error) => databaseError('incrementPlayersCompleted', String(error))
    );
  }
}
