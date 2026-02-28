/**
 * Database Health Service
 */

import { createLogger } from '@services/logger.service';
import { HealthCheckResult } from './types';
import { getPrismaClient } from '@database/prisma.client';

const logger = createLogger('health:database');

export const verifyDatabaseConnection = async (): Promise<HealthCheckResult> => {
    const startTime = process.hrtime.bigint();
    try {
        const prisma = getPrismaClient();
        await prisma.$queryRaw`SELECT 1`;
        const endTime = process.hrtime.bigint();
        const latency = Number(endTime - startTime) / 1_000_000; // Convert nanoseconds to milliseconds

        return {
            status: 'healthy',
            details: `PostgreSQL reachable (latency=${latency.toFixed(0)}ms)`
        };
    } catch (error) {
        if (error instanceof Error) {
            logger.error('PostgreSQL health check failed', { error: error.message, stack: error.stack });
            return {
                status: 'unhealthy',
                details: `PostgreSQL connection failed: ${error.message}`
            };
        }

        return {
            status: 'unhealthy',
            details: 'PostgreSQL connection failed: unknown error'
        };
    }
};
