/**
 * Config Routes
 */

import { Router } from 'express';
import { authCheck, requirePermission } from '@middleware/index';
import { PERMISSION_MODULES } from '@core/constants';

import controller from './controller';

const router = Router();

// All routes require authentication
router.use(authCheck);

const { CONFIG } = PERMISSION_MODULES;

// GET /admin/config - List all (requires config:list)
router.get('/', requirePermission({ module: CONFIG, action: 'list' }), controller.list);

// GET /admin/config/:key - Get single (requires config:read)
router.get('/:key', requirePermission({ module: CONFIG, action: 'read' }), controller.get);

// POST /admin/config - Create (requires config:create)
router.post('/', requirePermission({ module: CONFIG, action: 'create' }), controller.create);

// PUT /admin/config/:key - Update (requires config:update)
router.put('/:key', requirePermission({ module: CONFIG, action: 'update' }), controller.update);

export default router;
