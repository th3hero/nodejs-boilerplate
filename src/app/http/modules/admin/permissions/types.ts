/**
 * Permissions Module Types
 */

import type { ModulePermissions } from '@core/constants';

// ============================================================================
// Response Types
// ============================================================================

export interface PermissionModuleInfo {
    key: string;
    module: string;
    actions: string[];
    scopes: string[];
}

export interface RolePermissionSummary {
    role_id: string;
    role_name: string;
    role_slug: string;
    permissions: Record<string, ModulePermissions>;
}
