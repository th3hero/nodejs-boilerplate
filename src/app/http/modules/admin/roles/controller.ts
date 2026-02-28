/**
 * Roles Controller
 * Handles role management endpoints
 */

import type { Request, Response } from 'express';

import { ERROR_CODES, PERMISSION_MODULES } from '@core/constants';
import { createLogger } from '@services/index';
import { Controller } from '@http/controllers/controller';

import service from './service';
import type { CreateRoleDto, UpdateRoleDto, UpdateRolePermissionsDto } from './types';
import { createRoleRules, updateRoleRules, updatePermissionsRules } from './validation';

const log = createLogger('admin:roles');

// ============================================================================
// Controller
// ============================================================================

export class RolesController extends Controller {
    constructor() {
        super();
    }

    /**
     * GET /admin/roles - List all roles
     */
    public list = async (_req: Request, res: Response): Promise<Response | void> => {
        const roles = await service.getAll();

        return this.sendSuccessResponse(res, { roles, total: roles.length }, 'Roles fetched', 200);
    };

    /**
     * GET /admin/roles/:id - Get single role with permissions
     */
    public get = async (req: Request, res: Response): Promise<Response | void> => {
        const id = this.parseBigIntParam(req, res, 'id', 'Role');
        if (!id) return;

        const role = await service.getById(id);

        if (!role) {
            return this.sendErrorResponse(res, { id: 'Role not found' }, ERROR_CODES.NOT_FOUND, 'Role not found', 404);
        }

        return this.sendSuccessResponse(res, { role }, 'Role fetched', 200);
    };

    /**
     * POST /admin/roles - Create new role
     */
    public create = async (req: Request, res: Response): Promise<Response | void> => {
        const data = await this.validate<CreateRoleDto>(req, res, createRoleRules);
        if (!data) return;

        // Check if slug already exists
        const slugExists = await service.slugExists(data.slug);
        if (slugExists) {
            return this.sendErrorResponse(
                res,
                { slug: 'Role slug already exists' },
                ERROR_CODES.ALREADY_EXISTS,
                'Role slug already exists',
                409
            );
        }

        const role = await service.create(data);
        const adminId = this.getAuthUserId(req);

        log.info('Role created by admin', {
            roleId: role.id,
            slug: role.slug,
            adminId: adminId?.toString()
        });

        return this.sendSuccessResponse(res, { role }, 'Role created', 201);
    };

    /**
     * PUT /admin/roles/:id - Update role
     */
    public update = async (req: Request, res: Response): Promise<Response | void> => {
        const id = this.parseBigIntParam(req, res, 'id', 'Role');
        if (!id) return;

        const data = await this.validate<UpdateRoleDto>(req, res, updateRoleRules);
        if (!data) return;

        // Check if role exists
        const exists = await service.exists(id);
        if (!exists) {
            return this.sendErrorResponse(res, { id: 'Role not found' }, ERROR_CODES.NOT_FOUND, 'Role not found', 404);
        }

        const role = await service.update(id, data);
        const adminId = this.getAuthUserId(req);

        log.info('Role updated by admin', {
            roleId: role.id,
            adminId: adminId?.toString()
        });

        return this.sendSuccessResponse(res, { role }, 'Role updated', 200);
    };

    /**
     * PUT /admin/roles/:id/permissions - Update role permissions
     */
    public updatePermissions = async (req: Request, res: Response): Promise<Response | void> => {
        const id = this.parseBigIntParam(req, res, 'id', 'Role');
        if (!id) return;

        const data = await this.validate<UpdateRolePermissionsDto>(req, res, updatePermissionsRules);
        if (!data) return;

        // Check if role exists
        const exists = await service.exists(id);
        if (!exists) {
            return this.sendErrorResponse(res, { id: 'Role not found' }, ERROR_CODES.NOT_FOUND, 'Role not found', 404);
        }

        // Validate permission structure
        const validationError = this.validatePermissionsStructure(data.permissions);
        if (validationError) {
            return this.sendErrorResponse(
                res,
                { permissions: validationError },
                ERROR_CODES.VALIDATION_ERROR,
                validationError,
                422
            );
        }

        const role = await service.updatePermissions(id, data.permissions);
        const adminId = this.getAuthUserId(req);

        log.info('Role permissions updated by admin', {
            roleId: role.id,
            adminId: adminId?.toString()
        });

        return this.sendSuccessResponse(res, { role }, 'Role permissions updated', 200);
    };

    /**
     * DELETE /admin/roles/:id - Delete role
     */
    public delete = async (req: Request, res: Response): Promise<Response | void> => {
        const id = this.parseBigIntParam(req, res, 'id', 'Role');
        if (!id) return;

        // Check if role exists
        const exists = await service.exists(id);
        if (!exists) {
            return this.sendErrorResponse(res, { id: 'Role not found' }, ERROR_CODES.NOT_FOUND, 'Role not found', 404);
        }

        // Check if role has users
        const hasUsers = await service.hasUsers(id);
        if (hasUsers) {
            return this.sendErrorResponse(
                res,
                { id: 'Cannot delete role with assigned users' },
                ERROR_CODES.CONSTRAINT_VIOLATION,
                'Cannot delete role with assigned users',
                409
            );
        }

        await service.delete(id);
        const adminId = this.getAuthUserId(req);

        log.info('Role deleted by admin', {
            roleId: id.toString(),
            adminId: adminId?.toString()
        });

        return this.sendSuccessResponse(res, null, 'Role deleted', 200);
    };

    /**
     * GET /admin/roles/modules - Get available permission modules
     */
    public getModules = async (_req: Request, res: Response): Promise<Response | void> => {
        const modules = Object.entries(PERMISSION_MODULES).map(([key, value]) => ({
            key,
            module: value,
            actions: ['create', 'read', 'list', 'update', 'delete'],
            scopes: ['own', 'all']
        }));

        return this.sendSuccessResponse(res, { modules }, 'Permission modules fetched', 200);
    };

    // ============================================================================
    // Helpers
    // ============================================================================

    /**
     * Validate permissions structure including scope
     */
    private validatePermissionsStructure(permissions: Record<string, unknown>): string | null {
        const validModules = Object.values(PERMISSION_MODULES);
        const validActions = ['create', 'read', 'list', 'update', 'delete'];
        const validScopes = ['own', 'all'];

        for (const [module, perms] of Object.entries(permissions)) {
            // Check module name
            if (!validModules.includes(module as (typeof validModules)[number])) {
                return `Invalid module: ${module}. Valid modules: ${validModules.join(', ')}`;
            }

            // Check permission structure
            if (typeof perms !== 'object' || perms === null) {
                return `Permissions for module ${module} must be an object`;
            }

            const permObj = perms as Record<string, unknown>;

            // Check each action
            for (const action of validActions) {
                if (!(action in permObj)) {
                    return `Missing action '${action}' in module ${module}`;
                }
                if (typeof permObj[action] !== 'boolean') {
                    return `Action '${action}' in module ${module} must be a boolean`;
                }
            }

            // Check scope field
            if (!('scope' in permObj)) {
                return `Missing 'scope' in module ${module}. Valid scopes: ${validScopes.join(', ')}`;
            }
            if (!validScopes.includes(permObj['scope'] as string)) {
                return `Invalid scope '${permObj['scope']}' in module ${module}. Valid scopes: ${validScopes.join(
                    ', '
                )}`;
            }
        }

        return null;
    }
}

export default new RolesController();
