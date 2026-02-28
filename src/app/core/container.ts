/**
 * Dependency Injection Container
 */

import prismaClient from '@core/database/prisma.client';
import { createLogger, Logger } from '@services/logger.service';

// ============================================================================
// Container Types
// ============================================================================

export interface Container {
    prisma: typeof prismaClient;
    createLogger: (context: string) => Logger;
}

// ============================================================================
// Container Singleton
// ============================================================================

let containerInstance: Container | null = null;

export const initContainer = (): Container => {
    if (containerInstance) {
        return containerInstance;
    }

    containerInstance = {
        prisma: prismaClient,
        createLogger
    };

    return containerInstance;
};

export const getPrisma = (): typeof prismaClient => {
    if (!containerInstance) {
        initContainer();
    }
    return containerInstance!.prisma;
};
