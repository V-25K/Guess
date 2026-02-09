/**
 * ChallengeNavigator Service
 * Handles the logic for next challenge navigation and filtering
 * 
 * Requirements: 1.2, 1.3, 1.4 - Next challenge navigation with filtering and loop handling
 */

import type { GameChallenge } from '../../../shared/models/challenge.types';
import type { 
  ChallengeState, 
  ChallengeFilterCriteria, 
  NavigationResult,
  NavigationError 
} from '../../types/navigation.types';
import type { ChallengeAttempt } from '../../../shared/models/attempt.types';
import { filterAvailableChallenges as sharedFilterAvailableChallenges } from '../../../shared/utils/challenge-utils';

export class ChallengeNavigator {
  private challengeStates: Map<string, ChallengeState> = new Map();
  private availableChallenges: GameChallenge[] = [];
  private userAttempts: ChallengeAttempt[] = [];
  private currentUserId: string = '';

  /**
   * Initialize the navigator with challenges and their states
   */
  public initialize(
    challenges: GameChallenge[], 
    challengeStates: ChallengeState[], 
    userAttempts: ChallengeAttempt[] = [], 
    currentUserId: string = ''
  ): void {
    this.availableChallenges = challenges;
    this.userAttempts = userAttempts;
    this.currentUserId = currentUserId;
    this.challengeStates.clear();
    
    challengeStates.forEach(state => {
      this.challengeStates.set(state.id, state);
    });
  }

  /**
   * Get the next available challenge in sequence
   * Requirements: 1.2, 1.4 - Navigate to next challenge with loop handling
   */
  public getNextAvailableChallenge(currentChallengeId: string): NavigationResult {
    try {
      const availableChallengeIds = this.filterAvailableChallenges();
      
      if (availableChallengeIds.length === 0) {
        return {
          success: false,
          error: 'NO_AVAILABLE_CHALLENGES',
          errorMessage: 'No challenges are available for navigation. You may have completed all available challenges.',
          fallbackOptions: ['Return to menu', 'Check for new challenges', 'Create a challenge']
        };
      }

      // Handle single challenge scenario
      if (availableChallengeIds.length === 1) {
        const singleChallengeId = availableChallengeIds[0];
        if (singleChallengeId === currentChallengeId) {
          // User is on the only available challenge - allow "refresh" by returning same challenge
          return {
            success: true,
            challengeId: singleChallengeId
          };
        } else {
          // Navigate to the single available challenge
          return {
            success: true,
            challengeId: singleChallengeId
          };
        }
      }

      const currentIndex = availableChallengeIds.indexOf(currentChallengeId);
      
      // If current challenge is not in available list, start from beginning
      if (currentIndex === -1) {
        return {
          success: true,
          challengeId: availableChallengeIds[0]
        };
      }

      // Get next challenge with wraparound
      const nextIndex = this.handleLoopNavigation(currentIndex, availableChallengeIds.length);
      
      return {
        success: true,
        challengeId: availableChallengeIds[nextIndex]
      };
    } catch (error) {
      console.error('Navigation error:', error);
      return {
        success: false,
        error: 'NAVIGATION_LOOP_FAILURE',
        errorMessage: 'Failed to determine next challenge. This may be due to a temporary issue with challenge filtering.',
        fallbackOptions: ['Try again', 'Return to menu', 'Refresh page']
      };
    }
  }

  /**
   * Filter available challenges based on criteria
   * Requirements: 1.3 - Exclude challenges that are given up, game over, or have exhausted all attempts
   * Also excludes challenges created by the current user
   */
  public filterAvailableChallenges(criteria?: Partial<ChallengeFilterCriteria>): string[] {
    // Use the shared filtering function that excludes user's own challenges
    if (this.currentUserId) {
      const filteredChallenges = sharedFilterAvailableChallenges(
        this.availableChallenges,
        this.userAttempts,
        this.currentUserId
      );
      return filteredChallenges.map(challenge => challenge.id);
    }

    // Fallback to original logic if no user ID (shouldn't happen in normal flow)
    const defaultCriteria: ChallengeFilterCriteria = {
      excludeStatuses: ['given_up', 'game_over', 'exhausted_attempts'],
      respectPermissions: true,
      includeCompleted: false,
      minAttemptsRemaining: 1,
      ...criteria
    };

    return this.availableChallenges
      .filter(challenge => {
        const state = this.challengeStates.get(challenge.id);
        
        // If no state exists, assume it's available
        if (!state) {
          return true;
        }

        // Check status exclusions
        if (defaultCriteria.excludeStatuses.includes(state.status as any)) {
          return false;
        }

        // Check attempts remaining
        if (defaultCriteria.minAttemptsRemaining && 
            state.attemptsRemaining < defaultCriteria.minAttemptsRemaining) {
          return false;
        }

        // Check if completed challenges should be included
        if (!defaultCriteria.includeCompleted && state.status === 'completed') {
          return false;
        }

        return true;
      })
      .map(challenge => challenge.id);
  }

  /**
   * Handle wraparound navigation when reaching the end of available challenges
   * Requirements: 1.4 - Loop back to first available challenge
   */
  public handleLoopNavigation(currentIndex: number, totalChallenges: number): number {
    if (totalChallenges === 0) {
      return 0;
    }

    // Wraparound to beginning if at the end
    return (currentIndex + 1) % totalChallenges;
  }

  /**
   * Get the previous available challenge in sequence
   */
  public getPreviousAvailableChallenge(currentChallengeId: string): NavigationResult {
    try {
      const availableChallengeIds = this.filterAvailableChallenges();
      
      if (availableChallengeIds.length === 0) {
        return {
          success: false,
          error: 'NO_AVAILABLE_CHALLENGES',
          errorMessage: 'No challenges are available for navigation',
          fallbackOptions: ['Return to menu', 'Refresh challenges']
        };
      }

      const currentIndex = availableChallengeIds.indexOf(currentChallengeId);
      
      // If current challenge is not in available list, start from end
      if (currentIndex === -1) {
        return {
          success: true,
          challengeId: availableChallengeIds[availableChallengeIds.length - 1]
        };
      }

      // Get previous challenge with wraparound
      const previousIndex = currentIndex === 0 
        ? availableChallengeIds.length - 1 
        : currentIndex - 1;
      
      return {
        success: true,
        challengeId: availableChallengeIds[previousIndex]
      };
    } catch (error) {
      console.error('Previous navigation error:', error);
      return {
        success: false,
        error: 'NAVIGATION_LOOP_FAILURE',
        errorMessage: 'Failed to determine previous challenge. This may be due to a temporary issue with challenge filtering.',
        fallbackOptions: ['Try again', 'Return to menu', 'Refresh page']
      };
    }
  }

  /**
   * Update the state of a specific challenge
   */
  public updateChallengeState(challengeId: string, updates: Partial<ChallengeState>): void {
    const existingState = this.challengeStates.get(challengeId);
    
    if (existingState) {
      this.challengeStates.set(challengeId, {
        ...existingState,
        ...updates,
        lastAccessed: new Date()
      });
    } else {
      // Create new state if it doesn't exist
      const newState: ChallengeState = {
        id: challengeId,
        status: 'active',
        attemptsRemaining: 10,
        lastAccessed: new Date(),
        playerProgress: {
          isCompleted: false,
          hintsUsed: 0,
          attemptsMade: 0
        },
        ...updates
      };
      this.challengeStates.set(challengeId, newState);
    }
  }

  /**
   * Get the state of a specific challenge
   */
  public getChallengeState(challengeId: string): ChallengeState | null {
    return this.challengeStates.get(challengeId) || null;
  }

  /**
   * Get all challenge states
   */
  public getAllChallengeStates(): ChallengeState[] {
    return Array.from(this.challengeStates.values());
  }

  /**
   * Check if there are any available challenges for navigation
   */
  public hasAvailableChallenges(): boolean {
    return this.filterAvailableChallenges().length > 0;
  }

  /**
   * Get the total count of available challenges
   */
  public getAvailableChallengeCount(): number {
    return this.filterAvailableChallenges().length;
  }

  /**
   * Reset all challenge states (useful for testing or user reset)
   */
  public resetChallengeStates(): void {
    this.challengeStates.clear();
  }

  /**
   * Validate that a challenge exists and is accessible
   */
  public validateChallengeAccess(challengeId: string): NavigationResult {
    const challenge = this.availableChallenges.find(c => c.id === challengeId);
    
    if (!challenge) {
      return {
        success: false,
        error: 'CHALLENGE_NOT_FOUND',
        errorMessage: `Challenge with ID ${challengeId} not found`,
        fallbackOptions: ['Return to menu', 'Browse available challenges']
      };
    }

    const availableIds = this.filterAvailableChallenges();
    if (!availableIds.includes(challengeId)) {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        errorMessage: 'This challenge is not currently available',
        fallbackOptions: ['Try a different challenge', 'Return to menu']
      };
    }

    return {
      success: true,
      challengeId
    };
  }
}