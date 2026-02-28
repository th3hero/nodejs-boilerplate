/**
 * Config Controller
 * Handles system configuration endpoints
 */

import type { Request, Response } from 'express';

import { ERROR_CODES } from '@core/constants';
import { createLogger } from '@services/index';
import { Controller } from '@http/controllers/controller';

import service from './service';
import { CreateConfigDto, UpdateConfigDto } from './types';
import { createConfigRules, updateConfigRules } from './validation';

const log = createLogger('admin:config');

// ============================================================================
// Controller
// ============================================================================

export class ConfigController extends Controller {
    constructor() {
        super();
    }

    /**
     * GET /admin/config - List all configurations
     */
    public list = async (_req: Request, res: Response): Promise<Response | void> => {
        const configs = await service.getAll();

        return this.sendSuccessResponse(res, { configs, total: configs.length }, 'Configurations fetched', 200);
    };

    /**
     * GET /admin/config/:key - Get single configuration
     */
    public get = async (req: Request, res: Response): Promise<Response | void> => {
        const key = this.parseStringParam(req, res, 'key', 'Key');
        if (!key) return;

        const config = await service.getByKey(key);

        if (!config) {
            return this.sendErrorResponse(
                res,
                { key: 'Configuration not found' },
                ERROR_CODES.NOT_FOUND,
                'Configuration not found',
                404
            );
        }

        return this.sendSuccessResponse(res, { config }, 'Configuration fetched', 200);
    };

    /**
     * POST /admin/config - Create new configuration
     * Requires super_admin role
     */
    public create = async (req: Request, res: Response): Promise<Response | void> => {
        const data = await this.validate<CreateConfigDto>(req, res, createConfigRules);
        if (!data) return;

        // Check if key already exists
        const exists = await service.exists(data.key);
        if (exists) {
            return this.sendErrorResponse(
                res,
                { key: 'Configuration key already exists' },
                ERROR_CODES.ALREADY_EXISTS,
                'Configuration key already exists',
                409
            );
        }

        // Validate value matches type
        const typeValidation = service.validateValueType(data.value, data.type);
        if (!typeValidation.valid) {
            return this.sendErrorResponse(
                res,
                { value: typeValidation.error },
                ERROR_CODES.VALIDATION_ERROR,
                typeValidation.error ?? 'Invalid value for type',
                422
            );
        }

        const config = await service.create(data);
        const adminId = this.getAuthUserId(req);
        log.info('Config created by admin', {
            key: data.key,
            adminId: adminId?.toString()
        });

        return this.sendSuccessResponse(res, { config }, 'Configuration created', 201);
    };

    /**
     * PUT /admin/config/:key - Update configuration
     * Requires super_admin role
     */
    public update = async (req: Request, res: Response): Promise<Response | void> => {
        const key = this.parseStringParam(req, res, 'key', 'Key');
        if (!key) return;

        const data = await this.validate<UpdateConfigDto>(req, res, updateConfigRules);
        if (!data) return;

        // Check if config exists
        const existing = await service.getByKey(key);
        if (!existing) {
            return this.sendErrorResponse(
                res,
                { key: 'Configuration not found' },
                ERROR_CODES.NOT_FOUND,
                'Configuration not found',
                404
            );
        }

        // Validate value matches existing type
        const typeValidation = service.validateValueType(data.value, existing.type);
        if (!typeValidation.valid) {
            return this.sendErrorResponse(
                res,
                { value: typeValidation.error },
                ERROR_CODES.VALIDATION_ERROR,
                typeValidation.error ?? 'Invalid value for type',
                422
            );
        }

        const config = await service.update(key, data);
        const adminId = this.getAuthUserId(req);
        log.info('Config updated by admin', {
            key,
            adminId: adminId?.toString(),
            oldValue: existing.value,
            newValue: data.value
        });

        return this.sendSuccessResponse(res, { config }, 'Configuration updated', 200);
    };
}

export default new ConfigController();
