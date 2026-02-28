/**
 * Logging Middleware
 * HTTP request/response logging and error logging
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@services/index';
import { getRequestId, getRequestElapsedMs } from './request-context.middleware';
import { sanitizeForLog } from '@core/utils';

const httpLog = createLogger('http');
const errorLog = createLogger('error');

// ============================================================================
// HTTP Request Logging
// ============================================================================

/**
 * Log incoming HTTP requests and responses
 */
export const httpLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    // Log request start
    const startLog = {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    httpLog.info(`→ ${req.method} ${req.originalUrl}`, startLog);

    // Capture response finish
    res.on('finish', () => {
        const duration = getRequestElapsedMs() ?? 0;
        const requestId = getRequestId();

        const finishLog = {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            requestId
        };

        // Log level based on status code
        if (res.statusCode >= 500) {
            httpLog.error(`← ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, finishLog);
        } else if (res.statusCode >= 400) {
            httpLog.warn(`← ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, finishLog);
        } else {
            httpLog.info(`← ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, finishLog);
        }
    });

    next();
};

// ============================================================================
// Error Logging (for error middleware chain)
// ============================================================================

/**
 * Log errors before they reach the error handler
 * This runs before errorHandler to capture all errors
 */
export const errorLoggingMiddleware = (error: Error, req: Request, _res: Response, next: NextFunction): void => {
    const requestId = getRequestId();
    const duration = getRequestElapsedMs() ?? 0;

    errorLog.exception(`Error in ${req.method} ${req.originalUrl} (${duration}ms)`, error, {
        method: req.method,
        path: req.originalUrl,
        requestId,
        body: sanitizeForLog(req.body),
        query: sanitizeForLog(req.query),
        params: sanitizeForLog(req.params)
    });

    next(error);
};
