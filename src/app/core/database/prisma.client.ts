/**
 * Prisma Client Re-export
 * Re-exports the existing Prisma client from database folder
 */

import prismaClient from '@database/prisma.client';
import { createLogger } from '@services/logger.service';

const log = createLogger('database');

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Connect to the database
 */
export const connectDatabase = async (): Promise<void> => {
    try {
        await prismaClient.$connect();
        log.info('Database connected');
    } catch (error) {
        log.error('Database connection failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
};

/**
 * Disconnect from the database
 */
export const disconnectDatabase = async (): Promise<void> => {
    try {
        await prismaClient.$disconnect();
        log.info('Database disconnected');
    } catch (error) {
        log.error('Database disconnection failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// ============================================================================
// Export
// ============================================================================

export default prismaClient;
