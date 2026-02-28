/**
 * Request Context Middleware
 * Provides request correlation ID and timing for logging/tracing
 */

import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { RequestContext } from '@core/types';
import { setRequestContextGetter } from '@services/logger.service';

// ============================================================================
// Async Local Storage for Request Context
// ============================================================================

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

// Register with core logger so it can access request context
setRequestContextGetter(() => requestContextStorage.getStore());

// ============================================================================
// Middleware
// ============================================================================

/**
 * Initialize request context with correlation ID and timing
 */
export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    // Use existing request ID from header or generate new one
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    // Set correlation ID in response header
    res.setHeader('x-request-id', requestId);

    // Create context
    const context: RequestContext = {
        requestId,
        startTime: Date.now()
    };

    // Run the rest of the request in this context
    requestContextStorage.run(context, () => {
        next();
    });
};

// ============================================================================
// Context Accessors
// ============================================================================

/**
 * Get current request context (null if not in request)
 */
export const getRequestContext = (): RequestContext | undefined => {
    return requestContextStorage.getStore();
};

/**
 * Get current request ID (undefined if not in request)
 */
export const getRequestId = (): string | undefined => {
    return requestContextStorage.getStore()?.requestId;
};

/**
 * Get request elapsed time in milliseconds
 */
export const getRequestElapsedMs = (): number | undefined => {
    const ctx = requestContextStorage.getStore();
    if (!ctx) return undefined;
    return Date.now() - ctx.startTime;
};

/**
 * Set user ID in current context (after authentication)
 */
export const setContextUserId = (userId: bigint): void => {
    const ctx = requestContextStorage.getStore();
    if (ctx) {
        ctx.userId = userId;
    }
};

/**
 * Set session ID in current context (after authentication)
 */
export const setContextSessionId = (sessionId: bigint): void => {
    const ctx = requestContextStorage.getStore();
    if (ctx) {
        ctx.sessionId = sessionId;
    }
};
