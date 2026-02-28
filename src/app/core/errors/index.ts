/**
 * Custom Error Classes
 * Provides typed, consistent error handling across the application
 */

import { ERROR_CODES } from '@core/constants/http.constants';

// ============================================================================
// Abstract Base
// ============================================================================

export abstract class AppError extends Error {
    abstract readonly statusCode: number;
    abstract readonly errorCode: string;
    readonly isOperational = true;
    readonly timestamp: string;

    constructor(message: string, public readonly details?: Record<string, unknown>) {
        super(message);
        this.timestamp = new Date().toISOString();
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON(): Record<string, unknown> {
        return {
            success: false,
            message: this.message,
            error_code: this.errorCode,
            error: this.details ?? { message: this.message },
            statusCode: this.statusCode,
            timestamp: this.timestamp
        };
    }
}

// ============================================================================
// 400 Bad Request
// ============================================================================

export class BadRequestError extends AppError {
    readonly statusCode = 400;
    readonly errorCode: string;

    constructor(message = 'Bad request', errorCode = ERROR_CODES.VALIDATION_ERROR, details?: Record<string, unknown>) {
        super(message, details);
        this.errorCode = errorCode;
    }
}

// ============================================================================
// 401 Unauthorized
// ============================================================================

export class UnauthorizedError extends AppError {
    readonly statusCode = 401;
    readonly errorCode: string;

    constructor(message = 'Unauthorized', errorCode = ERROR_CODES.UNAUTHORIZED, details?: Record<string, unknown>) {
        super(message, details);
        this.errorCode = errorCode;
    }
}

// ============================================================================
// 403 Forbidden
// ============================================================================

export class ForbiddenError extends AppError {
    readonly statusCode = 403;
    readonly errorCode: string;

    constructor(
        message = 'Permission denied',
        errorCode = ERROR_CODES.PERMISSION_DENIED,
        details?: Record<string, unknown>
    ) {
        super(message, details);
        this.errorCode = errorCode;
    }
}

// ============================================================================
// 404 Not Found
// ============================================================================

export class NotFoundError extends AppError {
    readonly statusCode = 404;
    readonly errorCode = ERROR_CODES.NOT_FOUND;

    constructor(message = 'Resource not found', details?: Record<string, unknown>) {
        super(message, details);
    }
}

// ============================================================================
// 409 Conflict
// ============================================================================

export class ConflictError extends AppError {
    readonly statusCode = 409;
    readonly errorCode = ERROR_CODES.ALREADY_EXISTS;

    constructor(message = 'Resource already exists', details?: Record<string, unknown>) {
        super(message, details);
    }
}

// ============================================================================
// 422 Validation Error
// ============================================================================

export class ValidationError extends AppError {
    readonly statusCode = 422;
    readonly errorCode = ERROR_CODES.VALIDATION_ERROR;

    constructor(message = 'Validation failed', details?: Record<string, unknown>) {
        super(message, details);
    }
}

// ============================================================================
// 429 Rate Limit
// ============================================================================

export class RateLimitError extends AppError {
    readonly statusCode = 429;
    readonly errorCode = ERROR_CODES.RATE_LIMIT_EXCEEDED;

    constructor(message = 'Too many requests', details?: Record<string, unknown>) {
        super(message, details);
    }
}

// ============================================================================
// 500 Internal Server Error
// ============================================================================

export class InternalError extends AppError {
    readonly statusCode = 500;
    readonly errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR;

    constructor(message = 'Internal server error', details?: Record<string, unknown>) {
        super(message, details);
    }
}

// ============================================================================
// Type guard for AppError
// ============================================================================

export const isAppError = (error: unknown): error is AppError => {
    return error instanceof AppError;
};
