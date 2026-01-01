/**
 * DataCleanupService
 * Service for orchestrating data cleanup operations for compliance.
 * Handles anonymization of inactive user data via Supabase REST API.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import type { Context } from '@devvit/server/server-context';
import { BaseService } from './base.service.js';
import type { Result } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { ok, err } from '../../shared/utils/result.js';
import { databaseError } from '../../shared/models/errors.js';

/**
 * Statistics returned from data cleanup operations
 */
export interface CleanupResult {
  /** Number of user profiles anonymized */
  profilesAnonymized: number;
  /** Number of challenges updated (creator_username set to [deleted]) */
  challengesUpdated: number;
  /** Number of attempts updated (if applicable) */
  attemptsUpdated: number;
  /** Time taken to execute cleanup in milliseconds */
  executionTimeMs: number;
}

/**
 * Default number of days of inactivity before anonymization
 */
const DEFAULT_DAYS_INACTIVE = 30;

/**
 * DataCleanupService - Orchestrates data cleanup operations for compliance
 * 
 * Provides:
 * - Supabase configuration management
 * - Inactive user anonymization via database function
 * - Cleanup statistics reporting
 * - Error handling with Result pattern
 */
export class DataCleanupService extends BaseService {
  private supabaseUrl: string | null = null;
  private supabaseKey: string | null = null;

  constructor(context: Context) {
    super(context);
  }

  /**
   * Configure Supabase connection
   * 
   * @param url - Supabase project URL
   * @param key - Supabase API key (anon or service role)
   * 
   * Requirements: 4.1
   */
  setSupabaseConfig(url: string, key: string): void {
    this.supabaseUrl = url;
    this.supabaseKey = key;
  }

  /**
   * Anonymize users inactive for specified days
   * 
   * Calls the database anonymize_inactive_users function via Supabase REST API.
   * Returns cleanup statistics including execution time.
   * 
   * @param daysInactive - Number of days of inactivity (default: 30)
   * @returns Result with cleanup statistics or error
   * 
   * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6
   */
  async anonymizeInactiveUsers(
    daysInactive: number = DEFAULT_DAYS_INACTIVE
  ): Promise<Result<CleanupResult, AppError>> {
    const startTime = Date.now();

    // Check if Supabase is configured (Requirement 4.2)
    if (!this.supabaseUrl || !this.supabaseKey) {
      this.logError('DataCleanupService.anonymizeInactiveUsers', 'Supabase not configured');
      return err(databaseError('anonymizeInactiveUsers', 'Supabase not configured'));
    }

    try {
      // Call the database function via Supabase REST API (Requirement 4.3)
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/rpc/anonymize_inactive_users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
          body: JSON.stringify({ p_days_inactive: daysInactive }),
        }
      );

      // Handle HTTP errors (Requirement 4.5)
      if (!response.ok) {
        const errorText = await response.text();
        this.logError('DataCleanupService.anonymizeInactiveUsers', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        return err(
          databaseError(
            'anonymizeInactiveUsers',
            `HTTP ${response.status}: ${response.statusText}`
          )
        );
      }

      // Parse the response
      const data = await response.json();
      const executionTimeMs = Date.now() - startTime;

      // Handle the response format from the database function
      // The function returns a single row with profiles_anonymized, challenges_updated, attempts_updated
      const result = Array.isArray(data) ? data[0] : data;

      // Return cleanup statistics (Requirement 4.4)
      const cleanupResult: CleanupResult = {
        profilesAnonymized: result?.profiles_anonymized ?? 0,
        challengesUpdated: result?.challenges_updated ?? 0,
        attemptsUpdated: result?.attempts_updated ?? 0,
        executionTimeMs,
      };

      this.logInfo('DataCleanupService.anonymizeInactiveUsers', 'Cleanup completed', {
        ...cleanupResult,
        daysInactive,
      });

      return ok(cleanupResult);
    } catch (error) {
      // Handle network/parsing errors (Requirement 4.5)
      const executionTimeMs = Date.now() - startTime;
      this.logError('DataCleanupService.anonymizeInactiveUsers', error, { executionTimeMs });
      
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(databaseError('anonymizeInactiveUsers', message));
    }
  }
}
