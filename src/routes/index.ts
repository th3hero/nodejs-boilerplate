import { Router } from 'express';
import environment from '@config/environment.config';
import AppController from '@http/controllers/app/app.controller';
import modulesRouter from '@http/modules';

const router = Router();

router.get('/', AppController.appLanding);
router.get('/health', AppController.appHealth);
router.use(`/v${environment.app?.version}`, modulesRouter);

export default router;
