import { PrismaClient } from './prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import environment from '@config/environment.config';

// Prisma Client singleton
let prisma: PrismaClient | null = null;
let pool: Pool | null = null;

export const getPrismaClient = (): PrismaClient => {
    if (prisma) {
        return prisma;
    }

    const logLevel = environment.basic.isDev ? ['error', 'warn'] : ['error'];
    const connectionString = environment.database.url;

    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new Pool({
        connectionString,
        max: environment.database.pool.max,
        idleTimeoutMillis: environment.database.pool.idleTimeoutMillis,
        connectionTimeoutMillis: environment.database.pool.connectionTimeoutMillis
    });
    const adapter = new PrismaPg(pool);

    prisma = new PrismaClient({
        adapter,
        log: logLevel.map(level => ({
            level: level as 'error' | 'warn',
            emit: 'stdout' as const
        }))
    });

    return prisma;
};

export default getPrismaClient();
