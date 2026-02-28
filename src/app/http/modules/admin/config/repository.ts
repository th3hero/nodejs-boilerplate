/**
 * Config Repository
 * Database operations for system configurations
 */

import { ConfigValueType } from '@database/prisma';
import { getPrisma } from '@core/container';
import { ConfigEntity } from './types';

// ============================================================================
// Repository
// ============================================================================

export class ConfigRepository {
    /**
     * Find all configs
     */
    async findAll(): Promise<ConfigEntity[]> {
        const prisma = getPrisma();
        return prisma.systemConfig.findMany({
            orderBy: { key: 'asc' }
        });
    }

    /**
     * Find config by key
     */
    async findByKey(key: string): Promise<ConfigEntity | null> {
        const prisma = getPrisma();
        return prisma.systemConfig.findUnique({
            where: { key }
        });
    }

    /**
     * Create new config
     */
    async create(data: {
        key: string;
        value: string;
        type: ConfigValueType;
        description?: string;
    }): Promise<ConfigEntity> {
        const prisma = getPrisma();
        return prisma.systemConfig.create({
            data: {
                key: data.key,
                value: data.value,
                type: data.type,
                description: data.description ?? null
            }
        });
    }

    /**
     * Update config by key
     */
    async updateByKey(
        key: string,
        data: { value: string; description?: string }
    ): Promise<ConfigEntity> {
        const prisma = getPrisma();
        return prisma.systemConfig.update({
            where: { key },
            data: {
                value: data.value,
                ...(data.description !== undefined && { description: data.description })
            }
        });
    }

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        const prisma = getPrisma();
        const count = await prisma.systemConfig.count({
            where: { key }
        });
        return count > 0;
    }
}

export default new ConfigRepository();
