/**
 * Config Cache
 * Redis-based caching for system configurations
 */

import { getRedisClient, redisGetJson, redisSetJson } from '@core/cache';
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
    return redisGetJson<CachedConfig>(`${CACHE_PREFIX}${key}`, logger, 'Cache get failed', { key });
};

/**
 * Set a single config in cache
 */
export const setCachedConfig = async (config: CachedConfig): Promise<void> => {
    const ok = await redisSetJson(`${CACHE_PREFIX}${config.key}`, config, logger, 'Cache set failed', {
        key: config.key
    });
    if (ok) {
        logger.debug('Config cached', { key: config.key });
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
