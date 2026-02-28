/**
 * Permissions Routes
 */

import { Router } from 'express';
import { authCheck, requirePermission } from '@middleware/index';
import { PERMISSION_MODULES } from '@core/constants';

import controller from './controller';

const router = Router();

// All routes require authentication
router.use(authCheck);

const { PERMISSIONS } = PERMISSION_MODULES;

// GET /admin/permissions/modules - Get available permission modules (requires permissions:read)
router.get('/modules', requirePermission({ module: PERMISSIONS, action: 'read' }), controller.getModules);

// GET /admin/permissions - List all role permissions (requires permissions:list)
router.get('/', requirePermission({ module: PERMISSIONS, action: 'list' }), controller.list);

export default router;
