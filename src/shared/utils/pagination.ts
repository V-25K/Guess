/**
 * Pagination Utility
 * Provides utilities for cursor-based and offset-based pagination
 */

export type PaginationOptions = {
  limit: number;
  offset?: number;
  cursor?: string;
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    nextOffset?: number;
    total?: number;
  };
};

/**
 * Create pagination parameters for offset-based pagination
 */
export function createOffsetPagination(
  page: number,
  pageSize: number
): { limit: number; offset: number } {
  const limit = Math.max(1, Math.min(pageSize, 100)); // Clamp between 1 and 100
  const offset = Math.max(0, (page - 1) * limit);
  
  return { limit, offset };
}

/**
 * Create a cursor from an ID or timestamp
 * Cursors are base64-encoded to obscure implementation details
 */
export function createCursor(value: string | number): string {
  const str = String(value);
  try {
    return btoa(str);
  } catch {
    return encodeURIComponent(str);
  }
}

/**
 * Decode a cursor back to its original value
 */
export function decodeCursor(cursor: string): string | null {
  try {
    return atob(cursor);
  } catch {
    try {
      return decodeURIComponent(cursor);
    } catch {
      return null;
    }
  }
}

/**
 * Create a paginated result with metadata
 */
export function createPaginatedResult<T>(
  data: T[],
  limit: number,
  options?: {
    total?: number;
    nextCursor?: string;
    currentOffset?: number;
  }
): PaginatedResult<T> {
  const hasMore = data.length === limit;
  
  return {
    data,
    pagination: {
      hasMore,
      nextCursor: options?.nextCursor,
      nextOffset: options?.currentOffset !== undefined && hasMore
        ? options.currentOffset + limit
        : undefined,
      total: options?.total,
    },
  };
}

/**
 * Calculate total pages from total items and page size
 */
export function calculateTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(
  page?: number,
  pageSize?: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (page !== undefined) {
    if (page < 1) {
      errors.push('Page must be greater than 0');
    }
    if (!Number.isInteger(page)) {
      errors.push('Page must be an integer');
    }
  }
  
  if (pageSize !== undefined) {
    if (pageSize < 1) {
      errors.push('Page size must be greater than 0');
    }
    if (pageSize > 100) {
      errors.push('Page size must not exceed 100');
    }
    if (!Number.isInteger(pageSize)) {
      errors.push('Page size must be an integer');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Default pagination constants
 */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;
