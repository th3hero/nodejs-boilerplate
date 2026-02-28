/**
 * Config Service
 * Business logic for system configurations with caching
 */

import { ConfigValueType } from '@database/prisma';
import { createLogger } from '@services/logger.service';

import repository from './repository';
import { getCachedConfig, setCachedConfig, setAllCachedConfigs, invalidateCachedConfig, CachedConfig } from './cache';
import { ConfigEntity, ConfigResponse, CreateConfigDto, UpdateConfigDto } from './types';

// ============================================================================
// Constants
// ============================================================================

const CACHE_HIT_LOG = 'Configs served from cache';

const log = createLogger('config');

// ============================================================================
// Helpers
// ============================================================================

const parseValue = (value: string, type: ConfigValueType): string | number | boolean | object => {
    switch (type) {
        case 'number':
            return parseFloat(value);
        case 'boolean':
            return value === 'true' || value === '1';
        case 'json':
            try {
                return JSON.parse(value) as object;
            } catch {
                return value;
            }
        default:
            return value;
    }
};

const entityToResponse = (entity: ConfigEntity): ConfigResponse => ({
    id: entity.id.toString(),
    key: entity.key,
    value: entity.value,
    parsed_value: parseValue(entity.value, entity.type),
    type: entity.type,
    description: entity.description,
    created_at: entity.createdAt.toISOString(),
    updated_at: entity.updatedAt.toISOString()
});

const entityToCached = (entity: ConfigEntity): CachedConfig => ({
    key: entity.key,
    value: entity.value,
    type: entity.type,
    description: entity.description
});

// ============================================================================
// Service
// ============================================================================

export class ConfigService {
    /**
     * Get all configs
     * Note: Always fetches from DB for full response (ID, timestamps)
     * Cache is updated on each fetch for individual key lookups
     */
    async getAll(): Promise<ConfigResponse[]> {
        const configs = await repository.findAll();

        // Update cache for individual key lookups
        await setAllCachedConfigs(configs.map(entityToCached));

        return configs.map(entityToResponse);
    }

    /**
     * Get config by key (with caching for value lookups)
     */
    async getByKey(key: string): Promise<ConfigResponse | null> {
        const config = await repository.findByKey(key);

        if (!config) {
            return null;
        }

        // Update cache for this key
        await setCachedConfig(entityToCached(config));

        return entityToResponse(config);
    }

    /**
     * Get config value by key (for internal use)
     * Returns parsed value, uses cache-first strategy
     */
    async getValue<T = string>(key: string, defaultValue: T): Promise<T> {
        // Try cache first
        const cached = await getCachedConfig(key);

        if (cached) {
            log.debug(CACHE_HIT_LOG, { key });
            return parseValue(cached.value, cached.type as ConfigValueType) as T;
        }

        // Fetch from database
        const config = await repository.findByKey(key);

        if (!config) {
            return defaultValue;
        }

        // Update cache
        await setCachedConfig(entityToCached(config));

        return parseValue(config.value, config.type) as T;
    }

    /**
     * Create new config
     */
    async create(data: CreateConfigDto): Promise<ConfigResponse> {
        const config = await repository.create({
            key: data.key,
            value: data.value,
            type: data.type,
            ...(data.description !== undefined && { description: data.description })
        });

        // Update cache
        await setCachedConfig(entityToCached(config));

        log.info('Config created', { key: data.key });

        return entityToResponse(config);
    }

    /**
     * Update config by key
     */
    async update(key: string, data: UpdateConfigDto): Promise<ConfigResponse> {
        const config = await repository.updateByKey(key, {
            value: data.value,
            ...(data.description !== undefined && { description: data.description })
        });

        // Invalidate and update cache
        await invalidateCachedConfig(key);
        await setCachedConfig(entityToCached(config));

        log.info('Config updated', { key });

        return entityToResponse(config);
    }

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        return repository.exists(key);
    }

    /**
     * Validate value matches type
     */
    validateValueType(value: string, type: ConfigValueType): { valid: boolean; error?: string } {
        switch (type) {
            case 'number': {
                const num = parseFloat(value);
                if (isNaN(num)) {
                    return { valid: false, error: 'Value must be a valid number' };
                }
                return { valid: true };
            }
            case 'boolean': {
                if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
                    return { valid: false, error: 'Value must be true, false, 1, or 0' };
                }
                return { valid: true };
            }
            case 'json': {
                try {
                    JSON.parse(value);
                    return { valid: true };
                } catch {
                    return { valid: false, error: 'Value must be valid JSON' };
                }
            }
            default:
                return { valid: true };
        }
    }
}

export default new ConfigService();
