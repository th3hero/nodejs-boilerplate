/**
 * Dependency Injection Container
 */

import prismaClient from '@core/database/prisma.client';

// ============================================================================
// Container Types
// ============================================================================

interface Container {
    prisma: typeof prismaClient;
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
        prisma: prismaClient
    };

    return containerInstance;
};

export const getPrisma = (): typeof prismaClient => {
    if (!containerInstance) {
        initContainer();
    }
    return containerInstance!.prisma;
};
