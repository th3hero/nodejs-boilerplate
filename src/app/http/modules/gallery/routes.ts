/**
 * Gallery Routes
 * File upload endpoints using presigned URLs
 */

import { Router } from 'express';
import { authCheck, requirePermission } from '@http/middleware/auth.middleware';
import { PERMISSION_MODULES } from '@core/constants';
import controller from './controller';

const router = Router();

// All routes require authentication
router.use(authCheck);

const { GALLERY } = PERMISSION_MODULES;

/**
 * @route   POST /v1/gallery/init
 * @desc    Initialize presigned upload URL
 * @access  Authenticated - requires gallery:create
 */
router.post('/init', requirePermission({ module: GALLERY, action: 'create' }), controller.initUpload);

/**
 * @route   POST /v1/gallery/confirm
 * @desc    Confirm upload completion
 * @access  Authenticated - requires gallery:create
 */
router.post('/confirm', requirePermission({ module: GALLERY, action: 'create' }), controller.confirmUpload);

/**
 * @route   GET /v1/gallery
 * @desc    List user's uploads
 * @access  Authenticated - requires gallery:list
 */
router.get('/', requirePermission({ module: GALLERY, action: 'list' }), controller.list);

/**
 * @route   GET /v1/gallery/:id
 * @desc    Get gallery details with view URL
 * @access  Authenticated - requires gallery:read
 */
router.get('/:id', requirePermission({ module: GALLERY, action: 'read' }), controller.get);

/**
 * @route   GET /v1/gallery/:id/url
 * @desc    Get presigned view URL only
 * @access  Authenticated - requires gallery:read
 */
router.get('/:id/url', requirePermission({ module: GALLERY, action: 'read' }), controller.getViewUrl);

/**
 * @route   DELETE /v1/gallery/:id
 * @desc    Delete gallery and file
 * @access  Authenticated - requires gallery:delete
 */
router.delete('/:id', requirePermission({ module: GALLERY, action: 'delete' }), controller.delete);

export default router;
