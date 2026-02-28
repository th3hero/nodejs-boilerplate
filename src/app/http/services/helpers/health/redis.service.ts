/**
 * Redis Health Service
 */

import { getRedisClient, isRedisConfigured } from '@core/cache';
import { HealthCheckResult } from './types';

export const verifyRedisConnection = async (): Promise<HealthCheckResult> => {
    if (!isRedisConfigured()) {
        return {
            status: 'degraded',
            details: 'Redis not configured — session caching and job queues are disabled'
        };
    }

    try {
        const client = await getRedisClient();
        const needsConnect = client.status === 'wait' || client.status === 'close' || client.status === 'end';
        if (needsConnect) {
            await client.connect();
        }

        if (client.status !== 'ready') {
            return {
                status: 'degraded',
                details: `Redis status ${client.status}`
            };
        }

        const startedAt = Date.now();
        const response = await client.ping();
        const latency = Date.now() - startedAt;

        if (response !== 'PONG') {
            return {
                status: 'degraded',
                details: `Unexpected Redis response: ${response}`
            };
        }

        return {
            status: 'healthy',
            details: `Redis reachable (latency=${latency}ms)`
        };
    } catch (error) {
        if (error instanceof Error) {
            return {
                status: 'unhealthy',
                details: `Redis connection failed: ${error.message}`
            };
        }

        return {
            status: 'unhealthy',
            details: 'Redis connection failed: unknown error'
        };
    }
};
