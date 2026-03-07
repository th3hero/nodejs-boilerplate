/**
 * Session Cache
 * Redis-based caching for login sessions to avoid DB reads on every authenticated request
 *
 * Cache key patterns:
 * - Session: auth:session:<role>:<token>
 * - User sessions set: auth:user-sessions:<userId>
 * - Role sessions set: auth:role-sessions:<roleSlug>
 */

import { getRedisClient, redisGetJson } from '@core/cache';
import { createLogger } from '@services/logger.service';
import type { Permissions } from '@core/constants';

const logger = createLogger('auth:session-cache');

const SESSION_PREFIX = 'auth:session:';
const USER_SESSIONS_PREFIX = 'auth:user-sessions:';
const ROLE_SESSIONS_PREFIX = 'auth:role-sessions:';

// ============================================================================
// Types
// ============================================================================

export interface CachedSession {
    sessionId: string;
    userId: string;
    token: string;
    roleSlug: string;
    status: boolean;
    verified: boolean;
    expiresAt: string;
    permissions: Permissions;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        countryCode: string;
        status: string;
        verified: boolean;
        roleId: string;
        role: {
            id: string;
            name: string;
            slug: string;
            forApp: boolean;
            passwordRequired: boolean;
        };
    };
}

const buildSessionKey = (roleSlug: string, token: string): string => {
    return `${SESSION_PREFIX}${roleSlug}:${token}`;
};

// ============================================================================
// Helper Functions
// ============================================================================

const calculateTtl = (expiresAt: Date | string): number => {
    const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const ttlMs = expiry.getTime() - Date.now();
    return Math.max(1, Math.floor(ttlMs / 1000));
};

// ============================================================================
// Cache Operations
// ============================================================================

export const getCachedSession = async (roleSlug: string, token: string): Promise<CachedSession | null> => {
    const key = buildSessionKey(roleSlug, token);
    const cached = await redisGetJson<CachedSession>(key, logger, 'Session cache get failed', {
        roleSlug,
        token: token.substring(0, 8) + '...'
    });

    if (!cached) {
        logger.debug('Session cache miss', { roleSlug, token: token.substring(0, 8) + '...' });
        return null;
    }

    logger.debug('Session cache hit', { roleSlug, token: token.substring(0, 8) + '...' });
    return cached;
};

export const setCachedSession = async (roleSlug: string, token: string, session: CachedSession): Promise<void> => {
    try {
        const redis = await getRedisClient();
        const ttl = calculateTtl(session.expiresAt);
        const sessionKey = buildSessionKey(roleSlug, token);

        const pipeline = redis.pipeline();

        pipeline.setex(sessionKey, ttl, JSON.stringify(session));

        pipeline.sadd(`${USER_SESSIONS_PREFIX}${session.userId}`, `${roleSlug}:${token}`);
        pipeline.expire(`${USER_SESSIONS_PREFIX}${session.userId}`, ttl);

        pipeline.sadd(`${ROLE_SESSIONS_PREFIX}${roleSlug}`, `${session.userId}:${token}`);
        pipeline.expire(`${ROLE_SESSIONS_PREFIX}${roleSlug}`, ttl);

        await pipeline.exec();

        logger.debug('Session cached', {
            roleSlug,
            token: token.substring(0, 8) + '...',
            userId: session.userId,
            ttl
        });
    } catch (error) {
        logger.warn('Session cache set failed', {
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

export const invalidateCachedSession = async (roleSlug: string, token: string, userId?: string): Promise<void> => {
    try {
        const redis = await getRedisClient();
        const sessionKey = buildSessionKey(roleSlug, token);
        const pipeline = redis.pipeline();

        pipeline.del(sessionKey);

        if (userId) {
            pipeline.srem(`${USER_SESSIONS_PREFIX}${userId}`, `${roleSlug}:${token}`);
            pipeline.srem(`${ROLE_SESSIONS_PREFIX}${roleSlug}`, `${userId}:${token}`);
        }

        await pipeline.exec();

        logger.debug('Session cache invalidated', { roleSlug, token: token.substring(0, 8) + '...' });
    } catch (error) {
        logger.warn('Session cache invalidate failed', {
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

export const invalidateAllUserSessions = async (userId: string | bigint): Promise<number> => {
    try {
        const redis = await getRedisClient();
        const userIdStr = userId.toString();

        const entries = await redis.smembers(`${USER_SESSIONS_PREFIX}${userIdStr}`);

        if (entries.length === 0) {
            logger.debug('No sessions to invalidate for user', { userId: userIdStr });
            return 0;
        }

        const pipeline = redis.pipeline();
        for (const entry of entries) {
            const [roleSlug, token] = entry.split(':');
            if (roleSlug && token) {
                pipeline.del(buildSessionKey(roleSlug, token));
                pipeline.srem(`${ROLE_SESSIONS_PREFIX}${roleSlug}`, `${userIdStr}:${token}`);
            }
        }
        pipeline.del(`${USER_SESSIONS_PREFIX}${userIdStr}`);

        await pipeline.exec();

        logger.info('All user sessions invalidated', {
            userId: userIdStr,
            count: entries.length
        });

        return entries.length;
    } catch (error) {
        logger.warn('User sessions invalidation failed', {
            userId: userId.toString(),
            error: error instanceof Error ? error.message : String(error)
        });
        return 0;
    }
};

export const invalidateRoleSessions = async (roleSlug: string): Promise<number> => {
    try {
        const redis = await getRedisClient();

        const entries = await redis.smembers(`${ROLE_SESSIONS_PREFIX}${roleSlug}`);

        if (entries.length === 0) {
            logger.debug('No sessions to invalidate for role', { roleSlug });
            return 0;
        }

        const pipeline = redis.pipeline();
        const processedUsers = new Set<string>();

        for (const entry of entries) {
            const [userId, token] = entry.split(':');
            if (!userId || !token) continue;

            pipeline.del(buildSessionKey(roleSlug, token));
            pipeline.srem(`${USER_SESSIONS_PREFIX}${userId}`, `${roleSlug}:${token}`);

            processedUsers.add(userId);
        }

        pipeline.del(`${ROLE_SESSIONS_PREFIX}${roleSlug}`);

        await pipeline.exec();

        logger.info('All role sessions invalidated', {
            roleSlug,
            sessionCount: entries.length,
            affectedUsers: processedUsers.size
        });

        return entries.length;
    } catch (error) {
        logger.warn('Role sessions invalidation failed', {
            roleSlug,
            error: error instanceof Error ? error.message : String(error)
        });
        return 0;
    }
};
