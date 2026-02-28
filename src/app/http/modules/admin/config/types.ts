/**
 * Config Module Types
 */

import { ConfigValueType } from '@database/prisma';

// ============================================================================
// DTOs
// ============================================================================

export interface CreateConfigDto extends Record<string, unknown> {
    key: string;
    value: string;
    type: ConfigValueType;
    description?: string;
}

export interface UpdateConfigDto extends Record<string, unknown> {
    value: string;
    description?: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface ConfigResponse {
    id: string;
    key: string;
    value: string;
    parsed_value: string | number | boolean | object;
    type: ConfigValueType;
    description: string | null;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// Internal Types
// ============================================================================

export interface ConfigEntity {
    id: bigint;
    key: string;
    value: string;
    type: ConfigValueType;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}
