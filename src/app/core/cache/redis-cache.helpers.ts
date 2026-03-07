/**
 * Redis JSON cache helpers
 * Shared get/set with error handling for cache modules
 */

import type { Logger } from '@services/logger.service';
import { getRedisClient } from './redis.client';

const formatError = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

/**
 * Get JSON value from Redis, returns null on miss or error
 */
export async function redisGetJson<T>(
    key: string,
    logger: Logger,
    operation: string,
    meta?: Record<string, unknown>
): Promise<T | null> {
    try {
        const redis = await getRedisClient();
        const raw = await redis.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
        logger.warn(operation, { ...meta, error: formatError(error) });
        return null;
    }
}

/**
 * Set JSON value in Redis. Returns true on success, false on error.
 */
export async function redisSetJson(
    key: string,
    value: unknown,
    logger: Logger,
    operation: string,
    meta?: Record<string, unknown>
): Promise<boolean> {
    try {
        const redis = await getRedisClient();
        await redis.set(key, JSON.stringify(value));
        return true;
    } catch (error) {
        logger.warn(operation, { ...meta, error: formatError(error) });
        return false;
    }
}
