/**
 * useChallenges Hook
 * Custom hook to fetch and manage challenges with filtering and pagination
 * 
 * Features:
 * - Fetch challenges with optional filters (tags, creator)
 * - Pagination support with limit and offset
 * - Loading and error state management
 * - Manual refresh capability
 * - Filter updates trigger automatic refetch
 */

import { useState, useAsync } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';
import type { Challenge, ChallengeFilters } from '../../shared/models/challenge.types.js';
import { ChallengeService } from '../../server/services/challenge.service.js';
import { ChallengeRepository } from '../../server/repositories/challenge.repository.js';
import { UserService } from '../../server/services/user.service.js';
import { UserRepository } from '../../server/repositories/user.repository.js';

export interface UseChallengesResult {
  challenges: Challenge[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export interface UseChallengesOptions {
  filters?: ChallengeFilters;
  pageSize?: number;
}

/**
 * Hook to manage challenges list with filtering and pagination
 * 
 * @param context - Devvit context
 * @param options - Optional filters and pagination settings
 * @returns Challenges data, loading state, error state, and control functions
 * 
 * @example
 * // Basic usage
 * const { challenges, loading, error, refresh } = useChallenges(context);
 * 
 * // With filters
 * const { challenges, loading } = useChallenges(context, {
 *   filters: { tags: ['anime'], creatorId: 'user123' },
 *   pageSize: 20
 * });
 * 
 * // With pagination
 * const { challenges, hasMore, loadMore } = useChallenges(context, { pageSize: 10 });
 * if (hasMore) {
 *   await loadMore();
 * }
 */
export function useChallenges(
  context: Context,
  options?: UseChallengesOptions
): UseChallengesResult {
  const pageSize = options?.pageSize || 50;
  
  // State for challenges data
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  
  // State for loading indicator
  const [loading, setLoading] = useState<boolean>(true);
  
  // State for error messages
  const [error, setError] = useState<string | null>(null);
  
  // State for pagination
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Fetch challenges on mount using useAsync
  useAsync<boolean>(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Initialize services
      const challengeRepo = new ChallengeRepository(context);
      const userRepo = new UserRepository(context);
      const userService = new UserService(context, userRepo);
      const challengeService = new ChallengeService(context, challengeRepo, userService);
      
      // Build filters with pagination
      const filters: ChallengeFilters = {
        ...options?.filters,
        limit: pageSize,
        offset: 0,
      };
      
      // Fetch challenges
      const fetchedChallenges = await challengeService.getChallenges(filters);
      
      setChallenges(fetchedChallenges);
      
      // Check if there are more challenges to load
      setHasMore(fetchedChallenges.length === pageSize);
      
      return true;
    } catch (err) {
      console.error('useChallenges: Error fetching challenges', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  });

  // Refresh function to reload challenges from the beginning
  const refresh = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setOffset(0);
      
      const challengeRepo = new ChallengeRepository(context);
      const userRepo = new UserRepository(context);
      const userService = new UserService(context, userRepo);
      const challengeService = new ChallengeService(context, challengeRepo, userService);
      
      const filters: ChallengeFilters = {
        ...options?.filters,
        limit: pageSize,
        offset: 0,
      };
      
      const fetchedChallenges = await challengeService.getChallenges(filters);
      
      setChallenges(fetchedChallenges);
      setHasMore(fetchedChallenges.length === pageSize);
    } catch (err) {
      console.error('useChallenges: Error refreshing challenges', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Load more function for pagination
  const loadMore = async (): Promise<void> => {
    if (loading || !hasMore) {
      return;
    }
    
    try {
      setLoading(true);
      
      const newOffset = offset + pageSize;
      
      const challengeRepo = new ChallengeRepository(context);
      const userRepo = new UserRepository(context);
      const userService = new UserService(context, userRepo);
      const challengeService = new ChallengeService(context, challengeRepo, userService);
      
      const filters: ChallengeFilters = {
        ...options?.filters,
        limit: pageSize,
        offset: newOffset,
      };
      
      const fetchedChallenges = await challengeService.getChallenges(filters);
      
      setChallenges(prev => [...prev, ...fetchedChallenges]);
      setOffset(newOffset);
      setHasMore(fetchedChallenges.length === pageSize);
    } catch (err) {
      console.error('useChallenges: Error loading more challenges', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return {
    challenges,
    loading,
    error,
    refresh,
    hasMore,
    loadMore,
  };
}

/**
 * Hook to fetch a single challenge by ID
 * 
 * @param context - Devvit context
 * @param challengeId - Challenge ID to fetch
 * @returns Challenge data, loading state, error state, and refresh function
 * 
 * @example
 * const { challenge, loading, error, refresh } = useChallengeById(context, 'challenge-123');
 */
export function useChallengeById(
  context: Context,
  challengeId: string
): {
  challenge: Challenge | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useAsync<boolean>(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const challengeRepo = new ChallengeRepository(context);
      const userRepo = new UserRepository(context);
      const userService = new UserService(context, userRepo);
      const challengeService = new ChallengeService(context, challengeRepo, userService);
      
      const fetchedChallenge = await challengeService.getChallengeById(challengeId);
      
      if (fetchedChallenge) {
        setChallenge(fetchedChallenge);
        return true;
      } else {
        setError('Challenge not found');
        return false;
      }
    } catch (err) {
      console.error('useChallengeById: Error fetching challenge', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  });

  const refresh = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const challengeRepo = new ChallengeRepository(context);
      const userRepo = new UserRepository(context);
      const userService = new UserService(context, userRepo);
      const challengeService = new ChallengeService(context, challengeRepo, userService);
      
      const fetchedChallenge = await challengeService.getChallengeById(challengeId);
      
      if (fetchedChallenge) {
        setChallenge(fetchedChallenge);
      } else {
        setError('Challenge not found');
      }
    } catch (err) {
      console.error('useChallengeById: Error refreshing challenge', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return {
    challenge,
    loading,
    error,
    refresh,
  };
}
