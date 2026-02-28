import Redis, { type RedisOptions } from 'ioredis';
import environment from '@config/environment.config';
import { createLogger } from '@services/logger.service';

const log = createLogger('redis');

let redisClient: Redis | null = null;
let redisConnectPromise: Promise<void> | null = null;

export const isRedisConfigured = (): boolean => {
    return Boolean(environment.redis.url);
};

const createRedisOptions = (): RedisOptions => ({
    lazyConnect: true,
    maxRetriesPerRequest: environment.redis.maxRetriesPerRequest,
    enableOfflineQueue: false,
    reconnectOnError: () => true,
    retryStrategy: times => Math.min(1000 * times, 10000),
    connectionName: environment.redis.connectionName
});

const createRedisClient = (): Redis => {
    if (!environment.redis.url) {
        throw new Error('REDIS_URL is not configured');
    }

    const client = new Redis(environment.redis.url, createRedisOptions());

    client.on('error', error => {
        log.error('Redis client error', {
            message: error.message,
            stack: error.stack
        });
    });

    client.on('close', () => {
        log.warn('Redis connection closed');
    });

    return client;
};

export const getRedisClient = async (): Promise<Redis> => {
    if (!redisClient) {
        redisClient = createRedisClient();
    }

    if (redisClient.status === 'ready') {
        return redisClient;
    }

    const needsConnect =
        redisClient.status === 'wait' ||
        redisClient.status === 'close' ||
        redisClient.status === 'end' ||
        redisClient.status === 'connecting';

    if (needsConnect) {
        if (!redisConnectPromise) {
            redisConnectPromise = redisClient.connect().finally(() => {
                redisConnectPromise = null;
            });
        }
        await redisConnectPromise;
    }

    return redisClient;
};

export const disconnectRedisClient = async (): Promise<void> => {
    if (!redisClient) {
        return;
    }

    try {
        await redisClient.quit();
    } catch {
        redisClient.disconnect();
    } finally {
        redisConnectPromise = null;
        redisClient = null;
    }
};
