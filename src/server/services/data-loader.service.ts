/**
 * Data Loader Service
 * Efficiently loads related data in parallel to reduce waterfall requests
 */

import type { Context } from '@devvit/public-api';
import { BaseService } from './base.service.js';
import { UserService } from './user.service.js';
import { ChallengeService } from './challenge.service.js';
import { AttemptService } from './attempt.service.js';
import { fetchRelatedData, fetchParallelSuccess } from '../../shared/utils/parallel-fetch.js';
import type { UserProfile } from '../../shared/models/user.types.js';
import type { Challenge } from '../../shared/models/challenge.types.js';
import type { ChallengeAttempt } from '../../shared/models/attempt.types.js';

export type UserDashboardData = {
  profile: UserProfile | null;
  recentChallenges: Challenge[];
  userAttempts: ChallengeAttempt[];
  userRank: number | null;
};

export type ChallengeDetailData = {
  challenge: Challenge | null;
  userAttempt: ChallengeAttempt | null;
  creatorProfile: UserProfile | null;
};

export class DataLoaderService extends BaseService {
  constructor(
    context: Context,
    private userService: UserService,
    private challengeService: ChallengeService,
    private attemptService: AttemptService
  ) {
    super(context);
  }

  /**
   * Load all data needed for user dashboard in parallel
   * Reduces load time from ~1000ms (sequential) to ~300ms (parallel)
   */
  async loadUserDashboard(userId: string, username?: string): Promise<UserDashboardData> {
    try {
      const data = await fetchRelatedData({
        profile: () => this.userService.getUserProfile(userId, username),
        recentChallenges: () => this.challengeService.getChallenges({ limit: 10 }),
        userAttempts: () => this.attemptService.getUserAttempts(userId),
        userRank: () => this.userService.getUserRank(userId),
      });

      return data;
    } catch (error) {
      this.logError('DataLoaderService.loadUserDashboard', error);
      return {
        profile: null,
        recentChallenges: [],
        userAttempts: [],
        userRank: null,
      };
    }
  }

  /**
   * Load all data needed for challenge detail page in parallel
   */
  async loadChallengeDetail(
    challengeId: string,
    userId: string
  ): Promise<ChallengeDetailData> {
    try {
      const challenge = await this.challengeService.getChallengeById(challengeId);
      
      if (!challenge) {
        return {
          challenge: null,
          userAttempt: null,
          creatorProfile: null,
        };
      }

      const attemptRepo = this.attemptService['attemptRepo'];
      const data = await fetchRelatedData({
        userAttempt: () => attemptRepo.findByUserAndChallenge(userId, challengeId),
        creatorProfile: () => this.userService.getUserProfile(challenge.creator_id),
      });

      return {
        challenge,
        ...data,
      };
    } catch (error) {
      this.logError('DataLoaderService.loadChallengeDetail', error);
      return {
        challenge: null,
        userAttempt: null,
        creatorProfile: null,
      };
    }
  }

  /**
   * Load multiple user profiles in parallel
   * Useful for leaderboard or challenge lists
   */
  async loadUserProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    const results = await fetchParallelSuccess(
      userIds.map(userId => () => this.userService.getUserProfile(userId)),
      { maxConcurrency: 5 }
    );

    const profileMap = new Map<string, UserProfile>();
    results.forEach(profile => {
      if (profile) {
        profileMap.set(profile.user_id, profile);
      }
    });

    return profileMap;
  }

  /**
   * Load multiple challenges in parallel
   */
  async loadChallenges(challengeIds: string[]): Promise<Map<string, Challenge>> {
    const results = await fetchParallelSuccess(
      challengeIds.map(id => () => this.challengeService.getChallengeById(id)),
      { maxConcurrency: 5 }
    );

    const challengeMap = new Map<string, Challenge>();
    results.forEach(challenge => {
      if (challenge) {
        challengeMap.set(challenge.id, challenge);
      }
    });

    return challengeMap;
  }

  /**
   * Prefetch data for better perceived performance
   * Call this when you know the user will need certain data soon
   */
  async prefetchUserData(userId: string, username?: string): Promise<void> {
    this.userService.getUserProfile(userId, username).catch(error => {
      this.logError('DataLoaderService.prefetchUserData', error);
    });
  }

  /**
   * Prefetch challenge data
   */
  async prefetchChallengeData(challengeId: string): Promise<void> {
    this.challengeService.getChallengeById(challengeId).catch(error => {
      this.logError('DataLoaderService.prefetchChallengeData', error);
    });
  }
}
