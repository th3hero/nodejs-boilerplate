/**
 * Base Repository
 * Abstract base class for all repositories with common operations
 */

import prismaClient from './prisma.client';

// ============================================================================
// Types - Using any for PrismaClient since it's generated
// ============================================================================


type PrismaClientType = typeof prismaClient;

type TransactionClient = Parameters<Parameters<typeof prismaClient.$transaction>[0]>[0];

// ============================================================================
// Base Repository Class
// ============================================================================

export abstract class BaseRepository {
    protected readonly prisma: PrismaClientType;

    constructor(prisma?: PrismaClientType) {
        this.prisma = prisma ?? prismaClient;
    }

    /**
     * Execute operations in a transaction
     */
    protected async transaction<T>(
        fn: (tx: TransactionClient) => Promise<T>,
        options?: { maxWait?: number; timeout?: number }
    ): Promise<T> {
        return this.prisma.$transaction(fn, options);
    }

    /**
     * Execute raw SQL query
     */
    protected async rawQuery<T = unknown>(query: string, ...params: unknown[]): Promise<T> {
        return this.prisma.$queryRawUnsafe(query, ...params) as Promise<T>;
    }
}
