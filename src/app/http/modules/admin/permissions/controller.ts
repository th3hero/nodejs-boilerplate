/**
 * Permissions Controller
 * Handles permission viewing endpoints
 */

import type { Request, Response } from 'express';

import { Controller } from '@http/controllers/controller';

import service from './service';

// ============================================================================
// Controller
// ============================================================================

export class PermissionsController extends Controller {
    constructor() {
        super();
    }

    /**
     * GET /admin/permissions/modules - Get available permission modules
     */
    public getModules = async (_req: Request, res: Response): Promise<Response | void> => {
        const modules = service.getAvailableModules();

        return this.sendSuccessResponse(res, { modules }, 'Permission modules fetched', 200);
    };

    /**
     * GET /admin/permissions - Get all role permissions summary
     */
    public list = async (_req: Request, res: Response): Promise<Response | void> => {
        const permissions = await service.getAllRolePermissions();

        return this.sendSuccessResponse(
            res,
            { permissions, total: permissions.length },
            'Role permissions fetched',
            200
        );
    };
}

export default new PermissionsController();
