/**
 * Guest Migration Service
 * Handles conversion of guest users to authenticated users
 * 
 * Requirements: REQ-1.4, REQ-7.4
 */

import { guestUserService } from './guest-user.service';
import { userAuthService } from './user-auth.service';
import { apiClient } from '../api/client';
import type { GuestProfile, UserProfile } from '../../shared/models/user.types';

export interface MigrationResult {
  success: boolean;
  message: string;
  newProfile?: UserProfile;
}

export interface MigrationData {
  guestProfile: GuestProfile;
  authenticatedUserId: string;
  authenticatedUsername: string;
}

/**
 * Service for handling guest user migration to authenticated users
 */
class GuestMigrationService {
  /**
   * Migrate guest user data to an authenticated user account
   * This would typically be called after successful OAuth authentication
   */
  async migrateGuestToAuthenticated(data: MigrationData): Promise<MigrationResult> {
    try {
      const { guestProfile, authenticatedUserId, authenticatedUsername } = data;

      // 1. Create or update authenticated user profile with guest data
      const migratedProfile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> = {
        user_id: authenticatedUserId,
        username: authenticatedUsername,
        total_points: guestProfile.total_points,
        total_experience: guestProfile.total_experience,
        level: guestProfile.level,
        challenges_created: guestProfile.challenges_created,
        challenges_attempted: guestProfile.challenges_attempted,
        challenges_solved: guestProfile.challenges_solved,
        current_streak: guestProfile.current_streak,
        best_streak: guestProfile.best_streak,
        last_challenge_created_at: guestProfile.last_challenge_created_at,
        role: guestProfile.role,
      };

      // 2. Send migration request to server
      // Note: This would require a new API endpoint for migration
      // For now, we'll simulate the process
      console.log('Migrating guest data to authenticated user:', {
        from: guestProfile.id,
        to: authenticatedUserId,
        data: migratedProfile,
      });

      // 3. Clear guest data from local storage
      guestUserService.clearGuestProfile();

      // 4. Update API client to authenticated mode
      apiClient.clearGuestMode();

      // 5. Refresh user authentication state
      await userAuthService.refreshUserProfile();

      return {
        success: true,
        message: 'Successfully migrated guest progress to your account!',
        newProfile: migratedProfile as UserProfile,
      };
    } catch (error) {
      console.error('Guest migration failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Migration failed',
      };
    }
  }

  /**
   * Check if guest migration is possible
   */
  canMigrateGuest(guestProfile: GuestProfile): boolean {
    // Check if guest has meaningful progress to migrate
    return (
      guestProfile.total_points > 0 ||
      guestProfile.challenges_attempted > 0 ||
      guestProfile.challenges_solved > 0 ||
      guestProfile.current_streak > 0
    );
  }

  /**
   * Get migration summary for display to user
   */
  getMigrationSummary(guestProfile: GuestProfile) {
    return {
      points: guestProfile.total_points,
      level: guestProfile.level,
      experience: guestProfile.total_experience,
      challengesAttempted: guestProfile.challenges_attempted,
      challengesSolved: guestProfile.challenges_solved,
      currentStreak: guestProfile.current_streak,
      bestStreak: guestProfile.best_streak,
      challengesCreated: guestProfile.challenges_created,
    };
  }

  /**
   * Estimate the value of guest progress for motivation
   */
  getProgressValue(guestProfile: GuestProfile): {
    timeInvested: string;
    achievements: string[];
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  } {
    const achievements: string[] = [];
    let rarity: 'common' | 'uncommon' | 'rare' | 'epic' = 'common';

    // Calculate estimated time invested (rough estimate)
    const estimatedMinutes = Math.max(
      guestProfile.challenges_attempted * 2, // 2 minutes per attempt
      guestProfile.challenges_solved * 5,    // 5 minutes per solve
      guestProfile.total_points / 10         // 10 points per minute
    );

    const timeInvested = estimatedMinutes < 60 
      ? `${Math.round(estimatedMinutes)} minutes`
      : `${Math.round(estimatedMinutes / 60)} hours`;

    // Determine achievements and rarity
    if (guestProfile.challenges_solved > 0) {
      achievements.push(`Solved ${guestProfile.challenges_solved} challenges`);
    }
    
    if (guestProfile.best_streak >= 3) {
      achievements.push(`${guestProfile.best_streak}-challenge streak`);
      rarity = 'uncommon';
    }
    
    if (guestProfile.level >= 3) {
      achievements.push(`Reached level ${guestProfile.level}`);
      rarity = 'uncommon';
    }
    
    if (guestProfile.total_points >= 500) {
      achievements.push(`Earned ${guestProfile.total_points} points`);
      rarity = 'rare';
    }
    
    if (guestProfile.challenges_created > 0) {
      achievements.push(`Created ${guestProfile.challenges_created} challenges`);
      rarity = 'rare';
    }
    
    if (guestProfile.best_streak >= 10 || guestProfile.total_points >= 1000) {
      rarity = 'epic';
    }

    return {
      timeInvested,
      achievements,
      rarity,
    };
  }
}

export const guestMigrationService = new GuestMigrationService();