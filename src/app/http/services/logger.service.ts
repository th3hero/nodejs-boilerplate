/**
 * Logger Service
 * Contextual logging with request correlation
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'node:path';
import { getProjectRoot } from '@core/utils/path.utils';
import environment from '@config/environment.config';

const projectRoot = getProjectRoot();
const logsDir = path.join(projectRoot, 'storage', 'logs');

// ============================================================================
// Request Context Integration (Lazy loaded to avoid circular deps)
// ============================================================================

let getRequestContext: (() => { requestId?: string; userId?: bigint } | undefined) | null = null;

/**
 * Set the request context getter (called from app/http/middleware)
 * This allows core logger to access HTTP request context without direct dependency
 */
export const setRequestContextGetter = (getter: typeof getRequestContext): void => {
    getRequestContext = getter;
};

// ============================================================================
// Configuration
// ============================================================================

const logLevel = environment.logging.level;
const { maxSize, maxFiles, enableFile } = environment.logging;

// ============================================================================
// Formatters
// ============================================================================

const formatMeta = (meta: Record<string, unknown>): string => {
    const filtered = Object.entries(meta)
        .filter(([key]) => !['level', 'message', 'timestamp', 'context', 'requestId'].includes(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    return Object.keys(filtered).length > 0 ? ` ${JSON.stringify(filtered)}` : '';
};

const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, context, requestId, ...meta }) => {
        const ctx = context ? `[${context}]` : '';
        const reqId = requestId ? `[${requestId}]` : '';
        const metaStr = formatMeta(meta);
        return `${timestamp} ${level} ${ctx}${reqId} ${message}${metaStr}`;
    })
);

const fileFormat = winston.format.combine(winston.format.timestamp(), winston.format.json());

// ============================================================================
// Transports
// ============================================================================

const transports: winston.transport[] = [
    new winston.transports.Console({
        format: consoleFormat
    })
];

// Add file transports when enabled (default: production only)
if (enableFile) {
    transports.push(
        new DailyRotateFile({
            filename: path.join(logsDir, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize,
            maxFiles,
            format: fileFormat
        }),
        new DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize,
            maxFiles,
            format: fileFormat
        })
    );
}

// ============================================================================
// Base Logger
// ============================================================================

const baseLogger = winston.createLogger({
    level: logLevel,
    transports
});

// ============================================================================
// Logger Service Class
// ============================================================================

type LogMeta = Record<string, unknown>;

export class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    private getMeta(meta?: LogMeta): LogMeta {
        const requestContext = getRequestContext?.();
        return {
            context: this.context,
            requestId: requestContext?.requestId,
            ...meta
        };
    }

    info(message: string, meta?: LogMeta): void {
        baseLogger.info(message, this.getMeta(meta));
    }

    error(message: string, meta?: LogMeta): void {
        baseLogger.error(message, this.getMeta(meta));
    }

    warn(message: string, meta?: LogMeta): void {
        baseLogger.warn(message, this.getMeta(meta));
    }

    debug(message: string, meta?: LogMeta): void {
        baseLogger.debug(message, this.getMeta(meta));
    }

    /**
     * Log error with stack trace
     */
    exception(message: string, error: Error, meta?: LogMeta): void {
        baseLogger.error(message, {
            ...this.getMeta(meta),
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a logger with module context
 * @param context - Module or component name (e.g., 'auth', 'ride:onboarding')
 */
export const createLogger = (context: string): Logger => new Logger(context);

// ============================================================================
// Default Export
// ============================================================================

export default createLogger;
