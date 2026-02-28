import { Router } from 'express';
import { routes as authRoutes } from './auth';
import { routes as galleryRoutes } from './gallery';
import adminModule from './admin';

const router = Router();

router.use('/auth', authRoutes);
router.use('/gallery', galleryRoutes);
router.use('/admin', adminModule);

export default router;
