/**
 * Application Entry Point
 * Starts the server with optional clustering in production
 */

import cluster from 'cluster';
import os from 'os';
import http from 'http';
import app from './app';
import environment from '@config/environment.config';
import { connectDatabase, disconnectDatabase, disconnectRedisClient, initContainer } from '@core/index';
import { createLogger, captureException } from '@services/index';
import { initSessionUpdateWorker, shutdownSessionQueue } from '@http/modules/auth';

const log = createLogger('server');
const { environment: env, port } = environment.basic;
const isProduction = env === 'production';
const cpuCount = os.cpus().length;

// ============================================================================
// Cluster Mode (Production)
// ============================================================================

if (isProduction && cluster.isPrimary) {
    log.info('Starting cluster mode', { cpuCount, environment: env });

    for (let i = 0; i < cpuCount; i++) {
        cluster.fork();
    }

    cluster.on('exit', worker => {
        log.warn('Worker died, restarting...', {
            workerId: worker.id,
            pid: worker.process.pid
        });
        cluster.fork();
    });
} else {
    // ========================================================================
    // Single Process / Worker Mode
    // ========================================================================

    const startServer = async (): Promise<void> => {
        try {
            // Initialize DI container
            initContainer();

            // Connect to database
            await connectDatabase();

            // Initialize session update worker (BullMQ)
            await initSessionUpdateWorker();

            // Create HTTP server
            const server = http.createServer(app);

            server.listen(port, () => {
                log.info('Server started successfully', {
                    environment: env,
                    port,
                    pid: process.pid,
                    url: `http://127.0.0.1:${port}`
                });
            });

            // Graceful shutdown
            const gracefulShutdown = async (signal: string): Promise<void> => {
                log.info(`${signal} received, shutting down gracefully...`);

                server.close(async () => {
                    log.info('HTTP server closed');
                    await shutdownSessionQueue();
                    log.info('Session queue closed');
                    await disconnectRedisClient();
                    log.info('Redis disconnected');
                    await disconnectDatabase();
                    log.info('Database disconnected');
                    process.exit(0);
                });

                // Force shutdown after 30 seconds
                setTimeout(() => {
                    log.error('Forced shutdown after timeout');
                    process.exit(1);
                }, 30000);
            };

            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => gracefulShutdown('SIGINT'));

            // Handle uncaught exceptions
            process.on('uncaughtException', error => {
                log.error('Uncaught exception', { error: error.message, stack: error.stack });
                captureException(
                    error,
                    { type: 'uncaughtException' },
                    { module: 'process', alertType: 'uncaught-exception' }
                );
                gracefulShutdown('uncaughtException');
            });

            process.on('unhandledRejection', (reason: unknown) => {
                log.error('Unhandled rejection', {
                    reason: reason instanceof Error ? reason.message : String(reason)
                });
                captureException(
                    reason,
                    { type: 'unhandledRejection' },
                    { module: 'process', alertType: 'unhandled-rejection' }
                );
            });
        } catch (error) {
            log.error('Failed to start server', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            process.exit(1);
        }
    };

    startServer();
}
