/**
 * Database Cleanup Service
 * Automated cleanup to prevent database bloat and maintain performance
 * 
 * Features:
 * - Remove old attempt_guesses (configurable retention period)
 * - Remove inactive user profiles (never attempted challenges)
 * - Remove old guest user profiles (configurable retention period)
 * - Optimize database tables after cleanup
 * 
 * Requirements: Database optimization, storage management
 */

import type { Context } from '@devvit/server/server-context';
import { BaseService } from './base.service.js';
import type { Result } from '../../shared/utils/result.js';
import { isOk } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { databaseError } from '../../shared/models/errors.js';
import { tryCatch } from '../../shared/utils/result-adapters.js';

export interface DatabaseCleanupResult {
  operation: string;
  itemsDeleted: number;
  details: {
    retentionDays?: number;
    guestDeleted?: number;
    authDeleted?: number;
    attemptsDeleted?: number;
    guessesDeleted?: number;
    oldestActivity?: string;
    totalPointsLost?: number;
    oldestDeleted?: string;
    newestDeleted?: string;
    startTime?: string;
    endTime?: string;
    durationSeconds?: number;
    totalItemsDeleted?: number;
    message?: string;
    currentStats?: any;
  };
}

export interface DatabaseOptimizationResult {
  tableName: string;
  operation: string;
  status: string;
}

export interface ComprehensiveCleanupResult {
  cleanupResults: DatabaseCleanupResult[];
  optimizationResults: DatabaseOptimizationResult[];
  summary: {
    totalItemsDeleted: number;
    totalDurationSeconds: number;
    tablesOptimized: number;
    startTime: string;
    endTime: string;
  };
}

export class DatabaseCleanupService extends BaseService {
  private supabaseUrl: string = '';
  private supabaseKey: string = '';

  constructor(context: Context) {
    super(context);
  }

  /**
   * Set Supabase configuration for direct database access
   */
  setSupabaseConfig(url: string, key: string): void {
    this.supabaseUrl = url;
    this.supabaseKey = key;
  }

  /**
   * Execute comprehensive database cleanup
   * Removes old data and optimizes tables
   */
  async executeComprehensiveCleanup(
    guessRetentionDays: number = 30,
    inactiveUserDays: number = 7,
    guestRetentionDays: number = 30
  ): Promise<Result<ComprehensiveCleanupResult, AppError>> {
    return tryCatch(
      async () => {
        if (!this.supabaseUrl || !this.supabaseKey) {
          throw new Error('Supabase configuration not set');
        }

        const startTime = new Date().toISOString();

        // Execute comprehensive cleanup
        const cleanupResults = await this.runComprehensiveCleanup(
          guessRetentionDays,
          inactiveUserDays,
          guestRetentionDays
        );

        // Optimize database tables
        const optimizationResults = await this.optimizeDatabaseTables();

        const endTime = new Date().toISOString();
        const totalItemsDeleted = cleanupResults.reduce((sum, result) => sum + result.itemsDeleted, 0);
        const totalDurationSeconds = cleanupResults.find(r => r.operation === 'cleanup_summary')?.details.durationSeconds || 0;

        return {
          cleanupResults,
          optimizationResults,
          summary: {
            totalItemsDeleted,
            totalDurationSeconds,
            tablesOptimized: optimizationResults.length / 2, // Each table has VACUUM + ANALYZE
            startTime,
            endTime,
          },
        };
      },
      (error) => databaseError('executeComprehensiveCleanup', String(error))
    );
  }

  /**
   * Run the comprehensive cleanup function in the database
   */
  private async runComprehensiveCleanup(
    guessRetentionDays: number,
    inactiveUserDays: number,
    guestRetentionDays: number
  ): Promise<DatabaseCleanupResult[]> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/comprehensive_database_cleanup`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_guess_retention_days: guessRetentionDays,
        p_inactive_user_days: inactiveUserDays,
        p_guest_retention_days: guestRetentionDays,
      }),
    });

    if (!response.ok) {
      throw new Error(`Database cleanup failed: ${response.status} ${response.statusText}`);
    }

    const results = await response.json();
    
    return results.map((row: any) => ({
      operation: row.operation,
      itemsDeleted: row.items_deleted,
      details: row.details,
    }));
  }

  /**
   * Optimize database tables after cleanup
   */
  private async optimizeDatabaseTables(): Promise<DatabaseOptimizationResult[]> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/optimize_database_tables`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Database optimization failed: ${response.status} ${response.statusText}`);
    }

    const results = await response.json();
    
    return results.map((row: any) => ({
      tableName: row.table_name,
      operation: row.operation,
      status: row.status,
    }));
  }

  /**
   * Get database statistics before and after cleanup
   */
  async getDatabaseStatistics(): Promise<Result<{
    userProfiles: { total: number; guest: number; auth: number; neverAttempted: number };
    challengeAttempts: { total: number };
    attemptGuesses: { total: number };
  }, AppError>> {
    return tryCatch(
      async () => {
        if (!this.supabaseUrl || !this.supabaseKey) {
          throw new Error('Supabase configuration not set');
        }

        // Use direct SQL query via Supabase REST API
        const response = await fetch(`${this.supabaseUrl}/rest/v1/user_profiles?select=*`, {
          method: 'GET',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to get database statistics: ${response.status}`);
        }

        // Get user profiles count from header
        const countHeader = response.headers.get('content-range');
        const totalUsers = countHeader ? parseInt(countHeader.split('/')[1]) : 0;

        // Get the actual data to count guests/auth/never attempted
        const userProfiles = await response.json();
        
        const guestUsers = userProfiles.filter((u: any) => u.is_guest === true).length;
        const authUsers = userProfiles.filter((u: any) => u.is_guest === false).length;
        const neverAttempted = userProfiles.filter((u: any) => u.challenges_attempted === 0).length;

        // Get attempts count
        const attemptsResponse = await fetch(`${this.supabaseUrl}/rest/v1/challenge_attempts?select=*`, {
          method: 'GET',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Prefer': 'count=exact',
          },
        });

        const attemptsCountHeader = attemptsResponse.headers.get('content-range');
        const totalAttempts = attemptsCountHeader ? parseInt(attemptsCountHeader.split('/')[1]) : 0;

        // Get guesses count
        const guessesResponse = await fetch(`${this.supabaseUrl}/rest/v1/attempt_guesses?select=*`, {
          method: 'GET',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Prefer': 'count=exact',
          },
        });

        const guessesCountHeader = guessesResponse.headers.get('content-range');
        const totalGuesses = guessesCountHeader ? parseInt(guessesCountHeader.split('/')[1]) : 0;

        return {
          userProfiles: {
            total: totalUsers,
            guest: guestUsers,
            auth: authUsers,
            neverAttempted: neverAttempted,
          },
          challengeAttempts: {
            total: totalAttempts,
          },
          attemptGuesses: {
            total: totalGuesses,
          },
        };
      },
      (error) => databaseError('getDatabaseStatistics', String(error))
    );
  }

  /**
   * Execute cleanup with custom parameters for testing
   */
  async executeCustomCleanup(params: {
    guessRetentionDays?: number;
    inactiveUserDays?: number;
    guestRetentionDays?: number;
    dryRun?: boolean;
  }): Promise<Result<ComprehensiveCleanupResult, AppError>> {
    const {
      guessRetentionDays = 30,
      inactiveUserDays = 7,
      guestRetentionDays = 30,
      dryRun = false,
    } = params;

    if (dryRun) {
      // For dry run, just return statistics without actually cleaning
      const statsResult = await this.getDatabaseStatistics();
      if (!isOk(statsResult)) {
        return statsResult as Result<ComprehensiveCleanupResult, AppError>;
      }

      return {
        ok: true,
        value: {
          cleanupResults: [
            {
              operation: 'dry_run',
              itemsDeleted: 0,
              details: {
                message: 'Dry run - no data deleted',
                currentStats: statsResult.value,
              },
            },
          ],
          optimizationResults: [],
          summary: {
            totalItemsDeleted: 0,
            totalDurationSeconds: 0,
            tablesOptimized: 0,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
          },
        },
      };
    }

    return this.executeComprehensiveCleanup(
      guessRetentionDays,
      inactiveUserDays,
      guestRetentionDays
    );
  }
}