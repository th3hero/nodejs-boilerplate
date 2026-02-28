/**
 * Config Cache
 * Redis-based caching for system configurations
 */

import { getRedisClient } from '@core/cache';
import { createLogger } from '@services/logger.service';

const logger = createLogger('config:cache');

const CACHE_PREFIX = 'app:config:';

// ============================================================================
// Types
// ============================================================================

export interface CachedConfig {
    key: string;
    value: string;
    type: string;
    description: string | null;
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get a single config value from cache
 */
export const getCachedConfig = async (key: string): Promise<CachedConfig | null> => {
    try {
        const redis = await getRedisClient();
        const cached = await redis.get(`${CACHE_PREFIX}${key}`);

        if (!cached) {
            return null;
        }

        return JSON.parse(cached) as CachedConfig;
    } catch (error) {
        logger.warn('Cache get failed', {
            key,
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
};

/**
 * Set a single config in cache
 */
export const setCachedConfig = async (config: CachedConfig): Promise<void> => {
    try {
        const redis = await getRedisClient();
        await redis.set(`${CACHE_PREFIX}${config.key}`, JSON.stringify(config));
        logger.debug('Config cached', { key: config.key });
    } catch (error) {
        logger.warn('Cache set failed', {
            key: config.key,
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

/**
 * Set all configs in cache (batch operation)
 */
export const setAllCachedConfigs = async (configs: CachedConfig[]): Promise<void> => {
    try {
        const redis = await getRedisClient();
        const pipeline = redis.pipeline();

        for (const config of configs) {
            pipeline.set(`${CACHE_PREFIX}${config.key}`, JSON.stringify(config));
        }

        await pipeline.exec();
        logger.debug('All configs cached', { count: configs.length });
    } catch (error) {
        logger.warn('Cache set all failed', {
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

/**
 * Invalidate a single config from cache
 */
export const invalidateCachedConfig = async (key: string): Promise<void> => {
    try {
        const redis = await getRedisClient();
        await redis.del(`${CACHE_PREFIX}${key}`);
        logger.debug('Config cache invalidated', { key });
    } catch (error) {
        logger.warn('Cache invalidate failed', {
            key,
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
