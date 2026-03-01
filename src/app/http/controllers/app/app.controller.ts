/**
 * App Controller
 * System endpoints (landing, health check)
 */

import type { Request, Response } from 'express';
import { getHealthSnapshot } from '@services/helpers/health/health.service';
import { captureMessage } from '@services/index';
import environment from '@config/environment.config';

export class AppController {
    public appLanding = (_req: Request, res: Response): Response => {
        return res.status(200).json({
            success: true,
            message: 'API Service',
            version: environment.app.version,
            environment: environment.basic.environment,
            timestamp: new Date().toISOString()
        });
    };

    public appHealth = async (_req: Request, res: Response): Promise<Response> => {
        const health = await getHealthSnapshot();

        const overallStatus = health.overallStatus;
        const status = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 503 : 500;

        if (status >= 500) {
            captureMessage('Health check reported service degradation', status === 500 ? 'error' : 'warning', {
                status,
                overallStatus,
                checks: health.checks
            }, {
                module: 'app:health',
                alertType: 'health-check',
                overallStatus
            });
        }

        return res.status(status).json({
            success: overallStatus === 'healthy',
            message: `System ${overallStatus}`,
            data: health,
            timestamp: new Date().toISOString()
        });
    };
}

export default new AppController();
