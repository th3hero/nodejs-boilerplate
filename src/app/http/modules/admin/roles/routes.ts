/**
 * Roles Routes
 */

import { Router } from 'express';
import { authCheck, requirePermission } from '@middleware/index';
import { PERMISSION_MODULES } from '@core/constants';

import controller from './controller';

const router = Router();

// All routes require authentication
router.use(authCheck);

const { ROLES } = PERMISSION_MODULES;

// GET /admin/roles/modules - Get available permission modules (requires roles:read)
router.get('/modules', requirePermission({ module: ROLES, action: 'read' }), controller.getModules);

// GET /admin/roles - List all (requires roles:list)
router.get('/', requirePermission({ module: ROLES, action: 'list' }), controller.list);

// GET /admin/roles/:id - Get single with permissions (requires roles:read)
router.get('/:id', requirePermission({ module: ROLES, action: 'read' }), controller.get);

// POST /admin/roles - Create (requires roles:create)
router.post('/', requirePermission({ module: ROLES, action: 'create' }), controller.create);

// PUT /admin/roles/:id - Update (requires roles:update)
router.put('/:id', requirePermission({ module: ROLES, action: 'update' }), controller.update);

// PUT /admin/roles/:id/permissions - Update permissions (requires permissions:update)
router.put(
    '/:id/permissions',
    requirePermission({ module: 'permissions', action: 'update' }),
    controller.updatePermissions
);

// DELETE /admin/roles/:id - Delete (requires roles:delete)
router.delete('/:id', requirePermission({ module: ROLES, action: 'delete' }), controller.delete);

export default router;
