/**
 * Input Sanitization Middleware
 * Prevents XSS attacks by sanitizing request input
 */

import { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from '@core/utils';

/**
 * Sanitize request body and params
 * Escapes HTML special characters to prevent XSS
 * Note: req.query is read-only in Express 5, so we sanitize values in-place
 */
export const sanitizeMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
    // Sanitize request body (mutable)
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeInput(req.body);
    }

    // Sanitize query parameters in-place (req.query is read-only in Express 5)
    if (req.query && typeof req.query === 'object') {
        for (const key of Object.keys(req.query)) {
            const value = req.query[key];
            if (typeof value === 'string') {
                (req.query as Record<string, unknown>)[key] = sanitizeInput(value);
            } else if (Array.isArray(value)) {
                (req.query as Record<string, unknown>)[key] = value.map(v =>
                    typeof v === 'string' ? sanitizeInput(v) : v
                );
            }
        }
    }

    // Sanitize URL parameters in-place
    if (req.params && typeof req.params === 'object') {
        for (const key of Object.keys(req.params)) {
            const value = req.params[key];
            if (typeof value === 'string') {
                req.params[key] = sanitizeInput(value) as string;
            }
        }
    }

    next();
};
