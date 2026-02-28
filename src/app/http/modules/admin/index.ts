/**
 * Admin Module Export
 */

import { Router } from 'express';
import { routes as configRoutes } from './config';
import { routes as rolesRoutes } from './roles';
import { routes as permissionsRoutes } from './permissions';

const router = Router();

router.use('/config', configRoutes);
router.use('/roles', rolesRoutes);
router.use('/permissions', permissionsRoutes);

export default router;
