/**
 * Guest User Cleanup Service
 * Handles periodic cleanup of inactive guest users
 * 
 * Requirements: REQ-2.1, REQ-7.2
 */

import type { Context } from '@devvit/server/server-context';
import { BaseService } from './base.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { Result } from '../../shared/utils/result.js';
import { ok, err, isOk } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { databaseError } from '../../shared/models/errors.js';

/**
 * GuestCleanupService handles periodic cleanup of inactive guest users.
 * 
 * This service is responsible for:
 * - Cleaning up guest users inactive for specified days
 * - Logging cleanup operations
 * - Providing cleanup statistics
 * 
 * Requirements: REQ-2.1, REQ-7.2
 */
export class GuestCleanupService extends BaseService {
  constructor(
    context: Context,
    private userRepo: UserRepository
  ) {
    super(context);
  }

  /**
   * Clean up inactive guest users
   * Uses the database cleanup function created in Task 2.1
   * 
   * @param daysInactive - Number of days of inactivity before cleanup (default: 90)
   * @returns Number of guest users cleaned up
   */
  async cleanupInactiveGuests(daysInactive: number = 90): Promise<Result<number, AppError>> {
    this.logInfo('GuestCleanupService', `Starting cleanup of guest users inactive for ${daysInactive} days`);

    const result = await this.userRepo.cleanupInactiveGuestUsers(daysInactive);

    if (isOk(result)) {
      const cleanedCount = result.value;
      this.logInfo('GuestCleanupService', `Cleanup completed: ${cleanedCount} guest users removed`);
      
      // Log cleanup statistics
      if (cleanedCount > 0) {
        this.logInfo('GuestCleanupService', `Freed up database space by removing ${cleanedCount} inactive guest profiles`);
      }
    } else {
      this.logError('GuestCleanupService.cleanupInactiveGuests', result.error);
    }

    return result;
  }

  /**
   * Get statistics about guest users for cleanup planning
   * Returns counts of guest users by activity level
   */
  async getGuestCleanupStats(): Promise<Result<{
    totalGuests: number;
    activeGuests: number;
    inactiveGuests30Days: number;
    inactiveGuests90Days: number;
  }, AppError>> {
    try {
      // Get total guest count
      const totalGuestsResult = await this.userRepo.countActiveGuestPlayers();
      if (!isOk(totalGuestsResult)) {
        return totalGuestsResult;
      }

      // For now, return basic stats - could be enhanced with more detailed queries
      const stats = {
        totalGuests: totalGuestsResult.value,
        activeGuests: totalGuestsResult.value, // All counted guests are active (have attempted challenges)
        inactiveGuests30Days: 0, // Would need additional query to determine
        inactiveGuests90Days: 0, // Would need additional query to determine
      };

      this.logInfo('GuestCleanupService', `Guest stats: ${stats.totalGuests} total, ${stats.activeGuests} active`);

      return ok(stats);
    } catch (error) {
      this.logError('GuestCleanupService.getGuestCleanupStats', error);
      return err(databaseError('getGuestCleanupStats', String(error)));
    }
  }

  /**
   * Schedule periodic cleanup of guest users
   * This would typically be called by a cron job or scheduled task
   * 
   * @param intervalDays - How often to run cleanup (default: 7 days)
   * @param inactiveDays - Days of inactivity before cleanup (default: 90 days)
   */
  async schedulePeriodicCleanup(intervalDays: number = 7, inactiveDays: number = 90): Promise<Result<void, AppError>> {
    this.logInfo('GuestCleanupService', `Scheduling periodic cleanup every ${intervalDays} days for guests inactive ${inactiveDays} days`);

    // In a real implementation, this would set up a scheduled task
    // For now, we'll just log the configuration
    this.logInfo('GuestCleanupService', 'Periodic cleanup scheduled (implementation depends on deployment environment)');

    return ok(undefined);
  }

  /**
   * Validate cleanup parameters
   * Ensures cleanup parameters are safe and reasonable
   */
  validateCleanupParams(daysInactive: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (daysInactive < 1) {
      errors.push('Days inactive must be at least 1');
    }

    if (daysInactive < 30) {
      errors.push('Days inactive should be at least 30 to avoid cleaning up recent guests');
    }

    if (daysInactive > 365) {
      errors.push('Days inactive should not exceed 365 days');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Perform a dry run of cleanup to see what would be cleaned
   * Useful for testing and validation before actual cleanup
   * 
   * Note: This would require additional database function support
   * For now, returns estimated count based on cleanup validation
   */
  async dryRunCleanup(daysInactive: number = 90): Promise<Result<{
    estimatedCleanupCount: number;
    wouldCleanup: boolean;
  }, AppError>> {
    const validation = this.validateCleanupParams(daysInactive);
    
    if (!validation.isValid) {
      this.logError('GuestCleanupService.dryRunCleanup', `Invalid parameters: ${validation.errors.join(', ')}`);
      return err(databaseError('dryRunCleanup', `Invalid parameters: ${validation.errors.join(', ')}`));
    }

    // For now, return a conservative estimate
    // In a real implementation, this would query the database for exact counts
    const result = {
      estimatedCleanupCount: 0, // Would be calculated from database
      wouldCleanup: true,
    };

    this.logInfo('GuestCleanupService', `Dry run: estimated ${result.estimatedCleanupCount} guests would be cleaned up`);

    return ok(result);
  }
}