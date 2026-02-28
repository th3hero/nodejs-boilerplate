/**
 * Permissions Service
 * Business logic for permissions viewing
 */

import { PERMISSION_MODULES, PERMISSION_ACTIONS, PERMISSION_SCOPES, type Permissions } from '@core/constants';

import repository from './repository';
import type { PermissionModuleInfo, RolePermissionSummary } from './types';

// ============================================================================
// Service
// ============================================================================

export class PermissionsService {
    /**
     * Get all available permission modules, actions, and scopes
     */
    getAvailableModules(): PermissionModuleInfo[] {
        return Object.entries(PERMISSION_MODULES).map(([key, module]) => ({
            key,
            module,
            actions: Object.values(PERMISSION_ACTIONS),
            scopes: Object.values(PERMISSION_SCOPES)
        }));
    }

    /**
     * Get permissions summary for all roles
     */
    async getAllRolePermissions(): Promise<RolePermissionSummary[]> {
        const permissions = await repository.findAllWithRoles();

        return permissions.map(perm => ({
            role_id: perm.role.id.toString(),
            role_name: perm.role.name,
            role_slug: perm.role.slug,
            permissions: (perm.permissions ?? {}) as Permissions
        }));
    }
}

export default new PermissionsService();
