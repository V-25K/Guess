/**
 * Base Repository
 * 
 * Abstract base class providing common database operations for all repositories.
 * Handles Supabase REST API interactions with consistent error handling and type safety.
 */

import type { Context } from '@devvit/public-api';
import { getSupabaseConfig } from '../utils/config-cache.js';

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
   * @returns Response or null on error
   */
  private async executeRequest(
    url: string,
    method: HttpMethod,
    anonKey: string,
    body?: string,
    additionalHeaders?: Record<string, string>
  ): Promise<Response | null> {
    try {
      const response = await fetch(url, {
        method,
        headers: this.createHeaders(anonKey, additionalHeaders),
        body,
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorDetails = '';
        try {
          const errorBody = await response.text();
          errorDetails = errorBody ? ` - ${errorBody}` : '';
        } catch (e) {
          // Ignore if we can't read the error body
        }
        
        console.error(`${method} request failed: ${response.status} ${response.statusText}${errorDetails}`);
        console.error(`URL: ${url}`);
        return null;
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error(`${method} request error: ${errorMessage}`);
      console.error(`URL: ${url}`);
      return null;
    }
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
   * @returns Array of records (empty array on error)
   */
  protected async query<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
    try {
      const config = await this.getSupabaseConfig();
      const url = this.buildQueryUrl(table, options, config.url);
      
      const response = await this.executeRequest(url, 'GET', config.anonKey);
      if (!response) {
        console.error(`Error querying ${table}: No response received`);
        return [];
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Better error logging
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(`Error querying ${table}:`, errorMessage);
      if (errorStack) {
        console.error('Stack trace:', errorStack);
      }
      return [];
    }
  }

  /**
   * Execute SELECT query that returns a single record
   * @param table - Table name
   * @param options - Query options for filtering
   * @returns Single record or null if not found
   */
  protected async queryOne<T>(table: string, options: QueryOptions = {}): Promise<T | null> {
    const results = await this.query<T>(table, { ...options, limit: 1 });
    return results[0] || null;
  }

  /**
   * Insert a new record
   * @param table - Table name
   * @param data - Record data to insert
   * @returns Inserted record or null on error
   */
  protected async insert<T>(table: string, data: Partial<T>): Promise<T | null> {
    try {
      const config = await this.getSupabaseConfig();
      const url = `${config.url}/rest/v1/${table}`;
      
      const response = await this.executeRequest(
        url,
        'POST',
        config.anonKey,
        JSON.stringify(data),
        { 'Prefer': 'return=representation' }
      );

      if (!response) {
        console.error(`Error inserting into ${table}: No response received`);
        return null;
      }

      const result = await response.json();
      return result[0] || null;
    } catch (error) {
      // Better error logging
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(`Error inserting into ${table}:`, errorMessage);
      if (errorStack) {
        console.error('Stack trace:', errorStack);
      }
      return null;
    }
  }

  /**
   * Update existing records matching filter
   * @param table - Table name
   * @param filter - Key-value pairs for filtering records to update
   * @param data - Updated field values
   * @returns True if successful, false otherwise
   */
  protected async update<T>(
    table: string,
    filter: Record<string, string>,
    data: Partial<T>
  ): Promise<boolean> {
    try {
      const config = await this.getSupabaseConfig();
      const url = this.buildFilterUrl(table, filter, config.url);
      
      const response = await this.executeRequest(
        url,
        'PATCH',
        config.anonKey,
        JSON.stringify(data)
      );

      return response !== null;
    } catch (error) {
      console.error(`Error updating ${table}:`, error);
      return false;
    }
  }

  /**
   * Delete records matching filter
   * @param table - Table name
   * @param filter - Key-value pairs for filtering records to delete
   * @returns True if successful, false otherwise
   */
  protected async delete(table: string, filter: Record<string, string>): Promise<boolean> {
    try {
      const config = await this.getSupabaseConfig();
      const url = this.buildFilterUrl(table, filter, config.url);
      
      const response = await this.executeRequest(url, 'DELETE', config.anonKey);
      return response !== null;
    } catch (error) {
      console.error(`Error deleting from ${table}:`, error);
      return false;
    }
  }

  /**
   * Count records in a table with optional filtering
   * @param table - Table name
   * @param filter - Optional key-value pairs for filtering
   * @returns Record count (0 on error)
   */
  protected async count(table: string, filter?: Record<string, string>): Promise<number> {
    try {
      const config = await this.getSupabaseConfig();
      let url = `${config.url}/rest/v1/${table}?select=count`;
      
      if (filter) {
        const params = new URLSearchParams();
        Object.entries(filter).forEach(([key, value]) => {
          params.append(key, `eq.${value}`);
        });
        url += `&${params.toString()}`;
      }
      
      const response = await this.executeRequest(
        url,
        'GET',
        config.anonKey,
        undefined,
        { 'Prefer': 'count=exact' }
      );

      return response ? this.extractCount(response) : 0;
    } catch (error) {
      console.error(`Error counting ${table}:`, error);
      return 0;
    }
  }

  /**
   * Batch insert multiple records in a single request
   * @param table - Table name
   * @param data - Array of records to insert
   * @returns Array of inserted records (empty array on error)
   */
  protected async batchInsert<T>(table: string, data: Partial<T>[]): Promise<T[]> {
    if (data.length === 0) return [];

    try {
      const config = await this.getSupabaseConfig();
      const url = `${config.url}/rest/v1/${table}`;
      
      const response = await this.executeRequest(
        url,
        'POST',
        config.anonKey,
        JSON.stringify(data),
        { 'Prefer': 'return=representation' }
      );

      if (!response) return [];
      return await response.json();
    } catch (error) {
      console.error(`Error batch inserting into ${table}:`, error);
      return [];
    }
  }

  /**
   * Batch update multiple records matching filter with same updates
   * @param table - Table name
   * @param filter - Key-value pairs for filtering records to update
   * @param data - Updated field values
   * @returns Array of updated records (empty array on error)
   */
  protected async batchUpdate<T>(
    table: string,
    filter: Record<string, string>,
    data: Partial<T>
  ): Promise<T[]> {
    try {
      const config = await this.getSupabaseConfig();
      const url = this.buildFilterUrl(table, filter, config.url);
      
      const response = await this.executeRequest(
        url,
        'PATCH',
        config.anonKey,
        JSON.stringify(data),
        { 'Prefer': 'return=representation' }
      );

      if (!response) return [];
      return await response.json();
    } catch (error) {
      console.error(`Error batch updating ${table}:`, error);
      return [];
    }
  }

  /**
   * Execute a Postgres stored procedure/function via RPC
   * @param functionName - Name of the database function
   * @param params - Function parameters as key-value pairs
   * @returns Function result or null on error
   */
  protected async executeFunction<T>(
    functionName: string,
    params: Record<string, unknown>
  ): Promise<T | null> {
    try {
      const config = await this.getSupabaseConfig();
      const url = `${config.url}/rest/v1/rpc/${functionName}`;
      
      const response = await this.executeRequest(
        url,
        'POST',
        config.anonKey,
        JSON.stringify(params)
      );

      if (!response) {
        console.error(`Error executing function ${functionName}: No response received`);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(`Error executing function ${functionName}:`, errorMessage);
      console.error(`Params:`, JSON.stringify(params));
      if (errorStack) {
        console.error('Stack trace:', errorStack);
      }
      return null;
    }
  }

  /**
   * Execute a Postgres function that returns a boolean result
   * @param functionName - Name of the database function
   * @param params - Function parameters as key-value pairs
   * @returns Boolean result or false on error
   */
  protected async executeBooleanFunction(
    functionName: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const result = await this.executeFunction<boolean>(functionName, params);
      return result === true;
    } catch (error) {
      console.error(`Error executing boolean function ${functionName}:`, error);
      return false;
    }
  }
}
