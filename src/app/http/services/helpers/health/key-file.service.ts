import { promises as fs, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import environment from '@config/environment.config';
import { HealthCheckResult } from './types';

const resolvePath = (filePath: string): string => {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    return path.resolve(process.cwd(), filePath);
};

const checkFile = async (filePath: string): Promise<HealthCheckResult> => {
    try {
        const resolvedPath = resolvePath(filePath);
        const stats = await fs.stat(resolvedPath);

        if (!stats.isFile()) {
            return {
                status: 'unhealthy',
                details: `Key path is not a file: ${resolvedPath}`
            };
        }

        if (stats.size <= 0) {
            return {
                status: 'degraded',
                details: `Key file is empty: ${resolvedPath}`
            };
        }

        await fs.access(resolvedPath, fsConstants.R_OK);

        return {
            status: 'healthy',
            details: `Key file accessible: ${resolvedPath}`
        };
    } catch (error) {
        if (error instanceof Error) {
            return {
                status: 'unhealthy',
                details: `Key file check failed for ${filePath}: ${error.message}`
            };
        }

        return {
            status: 'unhealthy',
            details: `Key file check failed for ${filePath}: unknown error`
        };
    }
};

export const verifyKeyFiles = async (): Promise<HealthCheckResult> => {
    const configuredFiles = environment.keyFiles?.required ?? [];

    if (configuredFiles.length === 0) {
        return {
            status: 'unknown',
            details: 'No key files configured'
        };
    }

    const results = await Promise.all(configuredFiles.map(checkFile));

    const statuses = results.map((result: HealthCheckResult) => result.status);

    if (statuses.includes('unhealthy')) {
        const errors = results.filter((result: HealthCheckResult) => result.status === 'unhealthy').map((result: HealthCheckResult) => result.details);
        return {
            status: 'unhealthy',
            details: errors.join('; ')
        };
    }

    if (statuses.includes('degraded')) {
        const warnings = results.filter((result: HealthCheckResult) => result.status === 'degraded').map((result: HealthCheckResult) => result.details);
        return {
            status: 'degraded',
            details: warnings.join('; ')
        };
    }

    return {
        status: 'healthy',
        details: results.map((result: HealthCheckResult) => result.details).join('; ')
    };
};
