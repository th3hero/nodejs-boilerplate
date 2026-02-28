/**
 * Roles Module Types
 */

import type { ModulePermissions } from '@core/constants';

// ============================================================================
// DTOs
// ============================================================================

export interface CreateRoleDto extends Record<string, unknown> {
    name: string;
    slug: string;
    for_app?: boolean;
    password_required?: boolean;
}

export interface UpdateRoleDto extends Record<string, unknown> {
    name?: string;
    for_app?: boolean;
    password_required?: boolean;
}

export interface UpdateRolePermissionsDto extends Record<string, unknown> {
    permissions: Record<string, ModulePermissions>;
}

// ============================================================================
// Response Types
// ============================================================================

export interface RoleResponse {
    id: string;
    name: string;
    slug: string;
    for_app: boolean;
    password_required: boolean;
    created_at: string;
    updated_at: string;
}

export interface RoleWithPermissionsResponse extends RoleResponse {
    permissions: Record<string, ModulePermissions>;
}

// ============================================================================
// Internal Types
// ============================================================================

export interface RoleEntity {
    id: bigint;
    name: string;
    slug: string;
    forApp: boolean;
    passwordRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface RoleWithPermissionsEntity extends RoleEntity {
    /** Permission is 1:1 with Role (roleId has @unique constraint) */
    permission: {
        id: bigint;
        permissions: unknown; // JSONB
    } | null;
}
