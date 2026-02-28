import Redis from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import environment from '@config/environment.config';

/**
 * Create a BullMQ-compatible Redis connection.
 * Keep this separate from app Redis client to avoid blocking-mode conflicts.
 */
export const createBullMqConnection = (): ConnectionOptions => {
    const redisUrl = environment.redis.url;
    if (!redisUrl) {
        throw new Error('REDIS_URL is not configured');
    }

    return new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
    }) as unknown as ConnectionOptions;
};
