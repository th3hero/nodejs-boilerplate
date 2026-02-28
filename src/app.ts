/**
 * Express Application Setup
 * Configures middleware, routes, and error handling
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';

// Config
import corsConfiguration from '@config/cors.config';
import helmetConfiguration from '@config/helmet.config';

// HTTP Middleware
import {
    requestContextMiddleware,
    sanitizeMiddleware,
    generalRateLimiter,
    httpLoggingMiddleware,
    errorLoggingMiddleware,
    errorHandler,
    notFoundHandler
} from '@middleware/index';

// Routes
import router from '@/routes';

// ============================================================================
// Application Setup
// ============================================================================

const app: Express = express();

// Request context (must be first - provides request ID for logging)
app.use(requestContextMiddleware);

// Security middleware
app.use(cors(corsConfiguration));
app.use(helmet(helmetConfiguration));
app.use(generalRateLimiter);

// Logging middleware
app.use(httpLoggingMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization (XSS prevention)
app.use(sanitizeMiddleware);

// Static files
app.use(express.static(path.join(__dirname, '../storage/assets/public')));

// Routes
app.use(router);

// Error handling
app.use(notFoundHandler);
app.use(errorLoggingMiddleware);
app.use(errorHandler);

export default app;
