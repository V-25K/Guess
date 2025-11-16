/**
 * Challenge Repository
 * Handles all database operations for challenges
 */

import type { Context } from '@devvit/public-api';
import { BaseRepository } from './base.repository.js';
import type { Challenge, ChallengeCreate, ChallengeFilters } from '../../shared/models/challenge.types.js';

export class ChallengeRepository extends BaseRepository {
  private readonly TABLE = 'challenges';

  constructor(context: Context) {
    super(context);
  }

  /**
   * Find all challenges with optional filters
   */
  async findAll(filters?: ChallengeFilters): Promise<Challenge[]> {
    try {
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
        const errorText = await response.text();
        console.error(`Failed to fetch challenges:`, response.status, errorText);
        return [];
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[ChallengeRepo] Error fetching challenges:', error);
      return [];
    }
  }

  /**
   * Find challenge by ID
   */
  async findById(challengeId: string): Promise<Challenge | null> {
    return this.queryOne<Challenge>(this.TABLE, {
      filter: { id: `eq.${challengeId}` },
    });
  }

  /**
   * Find challenge by Reddit post ID
   */
  async findByPostId(postId: string): Promise<Challenge | null> {
    return this.queryOne<Challenge>(this.TABLE, {
      filter: { reddit_post_id: `eq.${postId}` },
    });
  }

  /**
   * Create a new challenge
   */
  async create(challenge: ChallengeCreate): Promise<Challenge | null> {
    return this.insert<Challenge>(this.TABLE, challenge);
  }

  /**
   * Find challenges by creator ID
   */
  async findByCreator(creatorId: string): Promise<Challenge[]> {
    return this.query<Challenge>(this.TABLE, {
      filter: { creator_id: `eq.${creatorId}` },
      order: 'created_at.desc',
    });
  }

  /**
   * Update a challenge
   */
  override async update(challengeId: string, updates: Partial<Challenge>): Promise<boolean> {
    return super.update(this.TABLE, { id: challengeId }, updates);
  }

  /**
   * Delete a challenge by ID
   */
  async deleteChallenge(challengeId: string): Promise<boolean> {
    return super.delete(this.TABLE, { id: challengeId });
  }
}
