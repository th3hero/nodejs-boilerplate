/**
 * Gallery Controller
 * Handles file upload endpoints using presigned URLs
 */

import type { Request, Response } from 'express';

import { ERROR_CODES, PERMISSION_MODULES } from '@core/constants';
import { createLogger } from '@services/index';
import { Controller } from '@http/controllers/controller';

import service from './service';
import type { UploadInitDto, UploadConfirmDto } from './types';
import { uploadInitRules, uploadConfirmRules } from './validation';

const logger = createLogger('gallery');
const GALLERY_MODULE = PERMISSION_MODULES.GALLERY;

// ============================================================================
// Controller
// ============================================================================

export class GalleryController extends Controller {
    constructor() {
        super();
    }

    /**
     * POST /gallery/init - Initialize presigned upload
     */
    public initUpload = async (req: Request, res: Response): Promise<Response | void> => {
        const data = await this.validate<UploadInitDto>(req, res, uploadInitRules);
        if (!data) return;

        const userId = this.requireAuth(req, res);
        if (!userId) return;

        try {
            const result = await service.initUpload(userId, data);

            logger.debug('Upload initialized', {
                userId: userId.toString(),
                reference: result.reference,
                bucket: result.bucket
            });

            return this.sendSuccessResponse(res, result, 'Upload initialized', 200);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to initialize upload';
            logger.error('Upload initialization failed', {
                userId: userId.toString(),
                error: message
            });

            return this.sendErrorResponse(res, { upload: message }, ERROR_CODES.VALIDATION_ERROR, message, 400);
        }
    };

    /**
     * POST /gallery/confirm - Confirm upload completion
     */
    public confirmUpload = async (req: Request, res: Response): Promise<Response | void> => {
        const data = await this.validate<UploadConfirmDto>(req, res, uploadConfirmRules);
        if (!data) return;

        const userId = this.requireAuth(req, res);
        if (!userId) return;

        const result = await service.confirmUpload(userId, data.reference);

        if (!result.success) {
            return this.sendErrorResponse(
                res,
                { upload: result.error },
                ERROR_CODES.VALIDATION_ERROR,
                result.error ?? 'Upload confirmation failed',
                400
            );
        }

        return this.sendSuccessResponse(res, { gallery: result.gallery }, 'Upload confirmed', 200);
    };

    /**
     * GET /gallery/:id - Get gallery details with view URL
     */
    public get = async (req: Request, res: Response): Promise<Response | void> => {
        const galleryId = this.parseBigIntParam(req, res, 'id', 'Gallery');
        if (!galleryId) return;

        const userId = this.getAuthUserId(req);
        const gallery = await service.getById(galleryId, userId);

        if (!gallery) {
            return this.sendErrorResponse(
                res,
                { id: 'Gallery not found' },
                ERROR_CODES.NOT_FOUND,
                'Gallery not found',
                404
            );
        }

        return this.sendSuccessResponse(res, { gallery }, 'Gallery fetched', 200);
    };

    /**
     * GET /gallery/:id/url - Get presigned view URL only
     */
    public getViewUrl = async (req: Request, res: Response): Promise<Response | void> => {
        const galleryId = this.parseBigIntParam(req, res, 'id', 'Gallery');
        if (!galleryId) return;

        const userId = this.getAuthUserId(req);
        const result = await service.getViewUrl(galleryId, userId);

        if (!result) {
            return this.sendErrorResponse(
                res,
                { id: 'Gallery not found or not ready' },
                ERROR_CODES.NOT_FOUND,
                'Gallery not found or not ready',
                404
            );
        }

        return this.sendSuccessResponse(res, result, 'View URL generated', 200);
    };

    /**
     * DELETE /gallery/:id - Delete gallery and file
     */
    public delete = async (req: Request, res: Response): Promise<Response | void> => {
        const galleryId = this.parseBigIntParam(req, res, 'id', 'Gallery');
        if (!galleryId) return;

        const userId = this.requireAuth(req, res);
        if (!userId) return;

        const result = await service.deleteGallery(galleryId, userId);

        if (!result.success) {
            const statusCode = result.error === 'Gallery not found' ? 404 : 403;
            const errorCode =
                result.error === 'Gallery not found' ? ERROR_CODES.NOT_FOUND : ERROR_CODES.PERMISSION_DENIED;

            return this.sendErrorResponse(
                res,
                { delete: result.error },
                errorCode,
                result.error ?? 'Delete failed',
                statusCode
            );
        }

        return this.sendSuccessResponse(res, { deleted: true }, 'Gallery deleted', 200);
    };

    /**
     * GET /gallery - List uploads (own or all based on scope)
     */
    public list = async (req: Request, res: Response): Promise<Response | void> => {
        const userId = this.requireAuth(req, res);
        if (!userId) return;

        const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 100);
        const offset = parseInt(req.query['offset'] as string) || 0;

        // Get owner filter based on user's scope for this module
        const ownerFilter = this.getOwnerFilter(req, GALLERY_MODULE);

        const result = await service.listUploads(ownerFilter, { limit, offset });

        return this.sendSuccessResponse(
            res,
            {
                galleries: result.galleries,
                total: result.total,
                limit,
                offset
            },
            'Galleries fetched',
            200
        );
    };
}

export default new GalleryController();
