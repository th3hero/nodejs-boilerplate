/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, type SendCommandFn } from 'rate-limit-redis';
import { Request, Response } from 'express';
import { ERROR_CODES } from '@core/constants';
import { getRedisClient } from '@core/cache';
import environment from '@config/environment.config';
import { createLogger } from '@services/logger.service';
import { getRequestId } from './request-context.middleware';

// ============================================================================
// Types
// ============================================================================

interface RateLimitConfig {
    key: string;
    windowMs: number;
    max: number;
    message?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

const log = createLogger('rate-limit');
let redisRateLimitEnabledLogged = false;

const getRateLimitStore = (key: string): RedisStore | undefined => {
    if (!environment.redis.url) {
        return undefined;
    }

    const sendCommand: SendCommandFn = async (...args: string[]) => {
        const [command, ...params] = args;
        if (!command) {
            throw new Error('Redis command is required for rate limit store');
        }
        const redis = await getRedisClient();
        return redis.call(command, ...params) as never;
    };

    const store = new RedisStore({
        prefix: `app:rate-limit:${key}:`,
        sendCommand
    });

    if (!redisRateLimitEnabledLogged) {
        log.info('Using Redis-backed rate limit store');
        redisRateLimitEnabledLogged = true;
    }

    return store;
};

// ============================================================================
// Rate Limit Factory
// ============================================================================

export const createRateLimit = (config: RateLimitConfig): RateLimitRequestHandler => {
    const {
        key,
        windowMs,
        max,
        message = 'Too many requests, please try again later',
        skipSuccessfulRequests = false,
        skipFailedRequests = false
    } = config;

    const store = getRateLimitStore(key);

    return rateLimit({
        windowMs,
        max,
        ...(store && { store, passOnStoreError: true }),
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        skipFailedRequests,
        handler: (_req: Request, res: Response): void => {
            res.status(429).json({
                success: false,
                message,
                error_code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
                error: { message },
                timestamp: new Date().toISOString(),
                requestId: getRequestId()
            });
        }
    });
};

// ============================================================================
// Pre-configured Rate Limiters (from environment config)
// ============================================================================

const { rateLimit: rl } = environment;

export const generalRateLimiter = createRateLimit({
    key: 'general',
    windowMs: rl.windowMs,
    max: rl.max,
    message: 'API rate limit exceeded. Please try again later.'
});

export const loginRateLimiter = createRateLimit({
    key: 'login',
    windowMs: rl.login.windowMs,
    max: rl.login.max,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    skipSuccessfulRequests: true
});

export const otpRateLimiter = createRateLimit({
    key: 'otp',
    windowMs: rl.otp.windowMs,
    max: rl.otp.max,
    message: 'Too many OTP requests. Please try again in 1 hour.'
});

export const passwordResetRateLimiter = createRateLimit({
    key: 'password-reset',
    windowMs: 300_000,
    max: 3,
    message: 'Too many password reset requests. Please try again in 5 minutes.'
});
