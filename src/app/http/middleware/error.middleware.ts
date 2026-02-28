/**
 * Error Handling Middleware
 * Global error handler for the application
 */

import { Request, Response, NextFunction } from 'express';
import { isAppError } from '@core/errors';
import { ERROR_CODES } from '@core/constants';
import { createLogger } from '@services/index';
import { getRequestId } from './request-context.middleware';
import environment from '@config/environment.config';

const log = createLogger('error');

// ============================================================================
// Environment Check
// ============================================================================

const { isDev } = environment.basic;

// ============================================================================
// Error Response Format
// ============================================================================

interface ErrorResponse {
    success: false;
    message: string;
    error_code: string;
    error: Record<string, unknown>;
    timestamp: string;
    requestId: string | undefined;
    stack?: string;
}

// ============================================================================
// Global Error Handler
// ============================================================================

/**
 * Global error handling middleware
 * Catches all errors and returns consistent error response
 */
export const errorHandler = (error: Error, req: Request, res: Response, _next: NextFunction): Response => {
    const requestId = getRequestId();

    // Log the error
    log.exception('Unhandled error', error, {
        path: req.originalUrl,
        method: req.method,
        requestId
    });

    // Handle AppError (our custom errors)
    if (isAppError(error)) {
        const response: ErrorResponse = {
            success: false,
            message: error.message,
            error_code: error.errorCode,
            error: error.details ?? { message: error.message },
            timestamp: error.timestamp,
            requestId
        };

        if (isDev && error.stack) {
            response.stack = error.stack;
        }

        return res.status(error.statusCode).json(response);
    }

    // Handle Prisma errors
    if (error.name === 'PrismaClientKnownRequestError') {
        const prismaError = error as Error & { code?: string; meta?: { target?: string[] } };

        // Unique constraint violation
        if (prismaError.code === 'P2002') {
            const target = prismaError.meta?.target?.join(', ') ?? 'field';
            return res.status(409).json({
                success: false,
                message: `A record with this ${target} already exists`,
                error_code: 'DUPLICATE',
                error: { field: target },
                timestamp: new Date().toISOString(),
                requestId
            });
        }

        // Record not found
        if (prismaError.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
                error_code: ERROR_CODES.NOT_FOUND,
                error: { message: 'The requested resource was not found' },
                timestamp: new Date().toISOString(),
                requestId
            });
        }
    }

    // Handle validation errors from express-validator or similar
    if (error.name === 'ValidationError') {
        return res.status(422).json({
            success: false,
            message: 'Validation failed',
            error_code: ERROR_CODES.VALIDATION_ERROR,
            error: { message: error.message },
            timestamp: new Date().toISOString(),
            requestId
        });
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            error_code: ERROR_CODES.TOKEN_INVALID,
            error: { message: error.message },
            timestamp: new Date().toISOString(),
            requestId
        });
    }

    // Default: Internal Server Error
    const response: ErrorResponse = {
        success: false,
        message: isDev ? error.message : 'Internal Server Error',
        error_code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        error: {
            message: isDev ? error.message : 'An unexpected error occurred',
            ...(isDev && { name: error.name })
        },
        timestamp: new Date().toISOString(),
        requestId
    };

    if (isDev && error.stack) {
        response.stack = error.stack;
    }

    return res.status(500).json(response);
};

// ============================================================================
// Not Found Handler
// ============================================================================

/**
 * Handler for 404 - Route not found
 */
export const notFoundHandler = (req: Request, res: Response): Response => {
    return res.status(404).json({
        success: false,
        message: 'Route not found',
        error_code: ERROR_CODES.NOT_FOUND,
        error: {
            path: req.originalUrl,
            method: req.method
        },
        timestamp: new Date().toISOString(),
        requestId: getRequestId()
    });
};
