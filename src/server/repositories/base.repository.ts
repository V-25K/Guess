/**
 * Base Repository
 * 
 * Abstract base class providing common database operations for all repositories.
 * Handles Supabase REST API interactions with consistent error handling and type safety.
 * Uses Result pattern for explicit error handling.
 */

import type { Context } from '@devvit/server/server-context';
import { getSupabaseConfig } from '../utils/config-cache.js';
import type { Result } from '../../shared/utils/result.js';
import { ok } from '../../shared/utils/result.js';
import type { AppError } from '../../shared/models/errors.js';
import { databaseError } from '../../shared/models/errors.js';
import { tryCatch } from '../../shared/utils/result-adapters.js';

/**
 * Query options for SELECT operations
 * @property select - Columns to select (default: '*')
 * @property order - Sort order (e.g., 'created_at.desc')
 * @property limit - Maximum number of records to return
 * @property offset - Number of records to skip (for pagination)
 * @property filter - Key-value pairs for filtering (automatically prefixed with 'eq.')
 */
export type QueryOptions = {
  select?: string;
  order?: string;
  limit?: number;
  offset?: number;
  filter?: Record<string, string>;
};

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export abstract class BaseRepository {
  constructor(protected context: Context) {}

  /**
   * Get cached Supabase configuration
   * @returns Supabase URL and anonymous key
   */
  protected async getSupabaseConfig(): Promise<SupabaseConfig> {
    return getSupabaseConfig(this.context);
  }

  /**
   * Build Supabase REST API URL with query parameters
   * @param table - Table name
   * @param options - Query options for filtering, sorting, and pagination
   * @returns Complete URL with query string
   */
  private buildQueryUrl(table: string, options: QueryOptions, baseUrl: string): string {
    const params = new URLSearchParams();
    
    params.append('select', options.select || '*');
    
    if (options.order) params.append('order', options.order);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    
    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params.append(key, value);
      });
    }
    
    return `${baseUrl}/rest/v1/${table}?${params.toString()}`;
  }

  /**
   * Build URL with equality filters for update/delete operations
   * @param table - Table name
   * @param filter - Key-value pairs for filtering
   * @param baseUrl - Supabase base URL
   * @returns Complete URL with filter query string
   */
  private buildFilterUrl(table: string, filter: Record<string, string>, baseUrl: string): string {
    const params = new URLSearchParams();
    
    Object.entries(filter).forEach(([key, value]) => {
      params.append(key, `eq.${value}`);
    });
    
    return `${baseUrl}/rest/v1/${table}?${params.toString()}`;
  }

  /**
   * Create standard headers for Supabase requests
   * @param anonKey - Supabase anonymous key
   * @param additionalHeaders - Optional additional headers
   * @returns Headers object
   */
  private createHeaders(anonKey: string, additionalHeaders?: Record<string, string>): Record<string, string> {
    return {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };
  }

  /**
   * Execute HTTP request with consistent error handling
   * @param url - Request URL
   * @param method - HTTP method
   * @param anonKey - Supabase anonymous key
   * @param body - Optional request body
   * @param additionalHeaders - Optional additional headers
   * @returns Result containing Response or DatabaseError
   */
  private async executeRequest(
    url: string,
    method: HttpMethod,
    anonKey: string,
    body?: string,
    additionalHeaders?: Record<string, string>
  ): Promise<Result<Response, AppError>> {
    return tryCatch(
      async () => {
        const response = await fetch(url, {
          method,
          headers: this.createHeaders(anonKey, additionalHeaders),
          body,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      },
      (error) => databaseError(method.toLowerCase(), String(error))
    );
  }

  /**
   * Extract count from Supabase content-range header
   * @param response - HTTP response
   * @returns Count or 0 if not found
   */
  private extractCount(response: Response): number {
    const countHeader = response.headers.get('content-range');
    if (!countHeader) return 0;

    const match = countHeader.match(/\/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Execute SELECT query on a table
   * @param table - Table name
   * @param options - Query options for filtering, sorting, and pagination
   * @returns Result containing array of records or DatabaseError
   */
  protected async query<T>(table: string, options: QueryOptions = {}): Promise<Result<T[], AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        const url = this.buildQueryUrl(table, options, config.url);
        
        const responseResult = await this.executeRequest(url, 'GET', config.anonKey);
        if (responseResult.ok === false) {
          throw new Error(JSON.stringify(responseResult.error));
        }

        const data = await responseResult.value.json();
        return data;
      },
      (error) => databaseError('query', String(error))
    );
  }

  /**
   * Execute SELECT query that returns a single record
   * @param table - Table name
   * @param options - Query options for filtering
   * @returns Result containing single record (or null if not found) or DatabaseError
   */
  protected async queryOne<T>(table: string, options: QueryOptions = {}): Promise<Result<T | null, AppError>> {
    return tryCatch(
      async () => {
        const resultsResult = await this.query<T>(table, { ...options, limit: 1 });
        if (resultsResult.ok === false) {
          throw new Error(JSON.stringify(resultsResult.error));
        }
        return resultsResult.value[0] || null;
      },
      (error) => databaseError('queryOne', String(error))
    );
  }

  /**
   * Insert a new record
   * @param table - Table name
   * @param data - Record data to insert
   * @returns Result containing inserted record or DatabaseError
   */
  protected async insert<T>(table: string, data: Partial<T>): Promise<Result<T, AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/${table}`;
        
        const responseResult = await this.executeRequest(
          url,
          'POST',
          config.anonKey,
          JSON.stringify(data),
          { 'Prefer': 'return=representation' }
        );

        if (responseResult.ok === false) {
          throw new Error(JSON.stringify(responseResult.error));
        }

        const result = await responseResult.value.json();
        const record = result[0];
        if (!record) {
          throw new Error('Insert succeeded but no record returned');
        }
        return record;
      },
      (error) => databaseError('insert', String(error))
    );
  }

  /**
   * Update existing records matching filter
   * @param table - Table name
   * @param filter - Key-value pairs for filtering records to update
   * @param data - Updated field values
   * @returns Result containing true on success or DatabaseError
   */
  protected async update<T>(
    table: string,
    filter: Record<string, string>,
    data: Partial<T>
  ): Promise<Result<boolean, AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        const url = this.buildFilterUrl(table, filter, config.url);
        
        const responseResult = await this.executeRequest(
          url,
          'PATCH',
          config.anonKey,
          JSON.stringify(data)
        );

        if (responseResult.ok === false) {
          throw new Error(JSON.stringify(responseResult.error));
        }

        return true;
      },
      (error) => databaseError('update', String(error))
    );
  }

  /**
   * Delete records matching filter
   * @param table - Table name
   * @param filter - Key-value pairs for filtering records to delete
   * @returns Result containing true on success or DatabaseError
   */
  protected async delete(table: string, filter: Record<string, string>): Promise<Result<boolean, AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        const url = this.buildFilterUrl(table, filter, config.url);
        
        const responseResult = await this.executeRequest(url, 'DELETE', config.anonKey);
        if (responseResult.ok === false) {
          throw new Error(JSON.stringify(responseResult.error));
        }
        return true;
      },
      (error) => databaseError('delete', String(error))
    );
  }

  /**
   * Count records in a table with optional filtering
   * @param table - Table name
   * @param filter - Optional key-value pairs for filtering
   * @returns Result containing record count or DatabaseError
   */
  protected async count(table: string, filter?: Record<string, string>): Promise<Result<number, AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        let url = `${config.url}/rest/v1/${table}?select=count`;
        
        if (filter) {
          const params = new URLSearchParams();
          Object.entries(filter).forEach(([key, value]) => {
            params.append(key, `eq.${value}`);
          });
          url += `&${params.toString()}`;
        }
        
        const responseResult = await this.executeRequest(
          url,
          'GET',
          config.anonKey,
          undefined,
          { 'Prefer': 'count=exact' }
        );

        if (responseResult.ok === false) {
          throw new Error(JSON.stringify(responseResult.error));
        }

        return this.extractCount(responseResult.value);
      },
      (error) => databaseError('count', String(error))
    );
  }

  /**
   * Batch insert multiple records in a single request
   * @param table - Table name
   * @param data - Array of records to insert
   * @returns Result containing array of inserted records or DatabaseError
   */
  protected async batchInsert<T>(table: string, data: Partial<T>[]): Promise<Result<T[], AppError>> {
    if (data.length === 0) return ok([]);

    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/${table}`;
        
        const responseResult = await this.executeRequest(
          url,
          'POST',
          config.anonKey,
          JSON.stringify(data),
          { 'Prefer': 'return=representation' }
        );

        if (responseResult.ok === false) {
          throw new Error(JSON.stringify(responseResult.error));
        }

        return await responseResult.value.json();
      },
      (error) => databaseError('batchInsert', String(error))
    );
  }

  /**
   * Batch update multiple records matching filter with same updates
   * @param table - Table name
   * @param filter - Key-value pairs for filtering records to update
   * @param data - Updated field values
   * @returns Result containing array of updated records or DatabaseError
   */
  protected async batchUpdate<T>(
    table: string,
    filter: Record<string, string>,
    data: Partial<T>
  ): Promise<Result<T[], AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        const url = this.buildFilterUrl(table, filter, config.url);
        
        const responseResult = await this.executeRequest(
          url,
          'PATCH',
          config.anonKey,
          JSON.stringify(data),
          { 'Prefer': 'return=representation' }
        );

        if (responseResult.ok === false) {
          throw new Error(JSON.stringify(responseResult.error));
        }

        return await responseResult.value.json();
      },
      (error) => databaseError('batchUpdate', String(error))
    );
  }

  /**
   * Execute a Postgres stored procedure/function via RPC
   * @param functionName - Name of the database function
   * @param params - Function parameters as key-value pairs
   * @returns Result containing function result or DatabaseError
   */
  protected async executeFunction<T>(
    functionName: string,
    params: Record<string, unknown>
  ): Promise<Result<T, AppError>> {
    return tryCatch(
      async () => {
        const config = await this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/rpc/${functionName}`;
        
        const responseResult = await this.executeRequest(
          url,
          'POST',
          config.anonKey,
          JSON.stringify(params)
        );

        if (responseResult.ok === false) {
          throw new Error(JSON.stringify(responseResult.error));
        }
        
        // Handle empty response body gracefully
        const text = await responseResult.value.text();
        if (!text || text.trim() === '') {
          return null as T;
        }
        
        return JSON.parse(text);
      },
      (error) => databaseError('executeFunction', String(error))
    );
  }

  /**
   * Execute a Postgres function that returns a boolean result
   * @param functionName - Name of the database function
   * @param params - Function parameters as key-value pairs
   * @returns Result containing boolean result or DatabaseError
   */
  protected async executeBooleanFunction(
    functionName: string,
    params: Record<string, unknown>
  ): Promise<Result<boolean, AppError>> {
    return tryCatch(
      async () => {
        const result = await this.executeFunction<boolean | null>(functionName, params);
        if (result.ok === false) {
          throw new Error(JSON.stringify(result.error));
        }
        // Handle null/undefined as false, otherwise check for true
        return result.value === true;
      },
      (error) => databaseError('executeBooleanFunction', String(error))
    );
  }
}
