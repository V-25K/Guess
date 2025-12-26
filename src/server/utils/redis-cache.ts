/**
 * Redis Cache Utility
 * Provides distributed caching using Devvit's Redis client
 */

import { redis } from '@devvit/web/server';

export type CacheOptions = {
    ttl: number; // Time to live in milliseconds
};

export class RedisCache {
    constructor() { }

    /**
     * Set a value in the cache with optional TTL
     */
    async set(key: string, value: any, ttl?: number): Promise<void> {
        try {
            const serialized = JSON.stringify(value);
            if (ttl) {
                await redis.set(key, serialized, { expiration: new Date(Date.now() + ttl) });
            } else {
                await redis.set(key, serialized);
            }
        } catch (error) {
            console.error(`[RedisCache] Error setting key ${key}:`, error);
        }
    }

    /**
     * Get a value from the cache
     * Returns null if not found or error
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const value = await redis.get(key);
            if (!value) {
                return null;
            }
            return JSON.parse(value) as T;
        } catch (error) {
            console.error(`[RedisCache] Error getting key ${key}:`, error);
            return null;
        }
    }

    /**
     * Delete a specific key from the cache
     */
    async delete(key: string): Promise<void> {
        try {
            await redis.del(key);
        } catch (error) {
            console.error(`[RedisCache] Error deleting key ${key}:`, error);
        }
    }

    /**
     * Get or set a value using a factory function
     * If the key exists, return the cached value
     * Otherwise, call the factory function, cache the result, and return it
     */
    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        ttl?: number
    ): Promise<T | null> {
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        try {
            const value = await factory();
            if (value !== null && value !== undefined) {
                await this.set(key, value, ttl);
            }
            return value;
        } catch (error) {
            console.error(`[RedisCache] Error in getOrSet for key ${key}:`, error);
            return null;
        }
    }
}
