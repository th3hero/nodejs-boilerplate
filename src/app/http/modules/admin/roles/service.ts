/**
 * Roles Service
 * Business logic for roles management
 */

import { createLogger } from '@services/logger.service';
import type { ModulePermissions, Permissions } from '@core/constants';
import { invalidateRoleSessions } from '@http/modules/auth/cache';

import repository from './repository';
import type {
    RoleEntity,
    RoleWithPermissionsEntity,
    RoleResponse,
    RoleWithPermissionsResponse,
    CreateRoleDto,
    UpdateRoleDto
} from './types';

// ============================================================================
// Constants
// ============================================================================

const log = createLogger('admin:roles');

// ============================================================================
// Helpers
// ============================================================================

const entityToResponse = (entity: RoleEntity): RoleResponse => ({
    id: entity.id.toString(),
    name: entity.name,
    slug: entity.slug,
    for_app: entity.forApp,
    password_required: entity.passwordRequired,
    created_at: entity.createdAt.toISOString(),
    updated_at: entity.updatedAt.toISOString()
});

const entityWithPermissionsToResponse = (entity: RoleWithPermissionsEntity): RoleWithPermissionsResponse => {
    const permRecord = entity.permission;
    const permissions: Permissions =
        permRecord?.permissions && typeof permRecord.permissions === 'object'
            ? (permRecord.permissions as Permissions)
            : {};

    return {
        ...entityToResponse(entity),
        permissions
    };
};

// ============================================================================
// Service
// ============================================================================

export class RolesService {
    async getAll(): Promise<RoleResponse[]> {
        const roles = await repository.findAll();
        return roles.map(entityToResponse);
    }

    async getById(id: bigint): Promise<RoleWithPermissionsResponse | null> {
        const role = await repository.findById(id);
        if (!role) return null;
        return entityWithPermissionsToResponse(role);
    }

    async create(data: CreateRoleDto): Promise<RoleResponse> {
        const role = await repository.create({
            name: data.name,
            slug: data.slug,
            ...(data.for_app !== undefined && { forApp: data.for_app }),
            ...(data.password_required !== undefined && { passwordRequired: data.password_required })
        });

        log.info('Role created', { id: role.id.toString(), slug: role.slug });

        return entityToResponse(role);
    }

    async update(id: bigint, data: UpdateRoleDto): Promise<RoleResponse> {
        const updateData: {
            name?: string;
            forApp?: boolean;
            passwordRequired?: boolean;
        } = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.for_app !== undefined) updateData.forApp = data.for_app;
        if (data.password_required !== undefined) updateData.passwordRequired = data.password_required;

        const role = await repository.update(id, updateData);

        log.info('Role updated', { id: role.id.toString(), slug: role.slug });

        return entityToResponse(role);
    }

    async updatePermissions(
        id: bigint,
        permissions: Record<string, ModulePermissions>
    ): Promise<RoleWithPermissionsResponse> {
        await repository.upsertPermissions(id, permissions);

        const role = await repository.findById(id);
        if (!role) {
            throw new Error('Role not found after permission update');
        }

        const invalidatedCount = await invalidateRoleSessions(role.slug);

        log.info('Role permissions updated', {
            roleId: id.toString(),
            roleSlug: role.slug,
            sessionsInvalidated: invalidatedCount
        });

        return entityWithPermissionsToResponse(role);
    }

    async delete(id: bigint): Promise<void> {
        const role = await repository.findById(id);
        if (role) {
            await invalidateRoleSessions(role.slug);
        }

        await repository.delete(id);

        log.info('Role deleted', { id: id.toString() });
    }

    async slugExists(slug: string, excludeId?: bigint): Promise<boolean> {
        return repository.slugExists(slug, excludeId);
    }

    async hasUsers(id: bigint): Promise<boolean> {
        return repository.hasUsers(id);
    }

    async exists(id: bigint): Promise<boolean> {
        const role = await repository.findById(id);
        return role !== null;
    }
}

export default new RolesService();
