import os from 'node:os';
import environment from '@config/environment.config';
import { verifyDatabaseConnection } from './database.service';
import { verifyRedisConnection } from './redis.service';
import { verifyKeyFiles } from './key-file.service';
import { HealthCheckResult, ServiceHealthStatus } from './types';

export interface HealthSnapshot {
    overallStatus: ServiceHealthStatus;
    checks: {
        database: HealthCheckResult;
        redis: HealthCheckResult;
        keyFiles: HealthCheckResult;
        systemResources: HealthCheckResult;
    };
}

const evaluateSystemResources = (): HealthCheckResult => {
    const freeMemoryBytes = os.freemem();
    const totalMemoryBytes = os.totalmem();
    const freeMemoryRatio = totalMemoryBytes > 0 ? freeMemoryBytes / totalMemoryBytes : 0;
    const [oneMinuteLoad] = os.loadavg();
    let loadAverage = 0;
    if (typeof oneMinuteLoad === 'number' && Number.isFinite(oneMinuteLoad)) {
        loadAverage = oneMinuteLoad;
    }
    const cpuCount = Math.max(os.cpus().length, 1);
    const {
        minFreeMemoryRatio = 0.03,
        maxLoadAverageMultiplier = 1.5,
        maxLoadAverageAbsolute = 6
    } = environment.systemResources ?? {};

    const memoryThresholdBreached = freeMemoryRatio < minFreeMemoryRatio;
    const loadThreshold = Math.min(cpuCount * maxLoadAverageMultiplier, maxLoadAverageAbsolute);
    const loadThresholdBreached = loadAverage > loadThreshold;

    if (memoryThresholdBreached || loadThresholdBreached) {
        return {
            status: 'degraded',
            details: `High resource usage detected (freeMemoryRatio=${freeMemoryRatio.toFixed(
                2
            )}, loadAverage=${loadAverage.toFixed(2)}, thresholds: minFreeMemoryRatio=${minFreeMemoryRatio.toFixed(
                2
            )}, maxLoad=${loadThreshold.toFixed(2)})`
        };
    }

    return {
        status: 'healthy',
        details: `System resources nominal (freeMemoryRatio=${freeMemoryRatio.toFixed(
            2
        )}, loadAverage=${loadAverage.toFixed(2)})`
    };
};

const deriveOverallStatus = (checks: HealthSnapshot['checks']): ServiceHealthStatus => {
    const statuses = Object.values(checks).map(check => check.status);

    if (statuses.includes('unhealthy')) {
        return 'unhealthy';
    }

    if (statuses.includes('degraded')) {
        return 'degraded';
    }

    if (statuses.every(status => status === 'unknown')) {
        return 'unknown';
    }

    return 'healthy';
};

export const getHealthSnapshot = async (): Promise<HealthSnapshot> => {
    const [database, redis] = await Promise.all([
        verifyDatabaseConnection().catch((error: Error) => ({
            status: 'unhealthy' as ServiceHealthStatus,
            details: `Database check failed: ${error.message}`
        })),
        verifyRedisConnection().catch((error: Error) => ({
            status: 'unhealthy' as ServiceHealthStatus,
            details: `Redis check failed: ${error.message}`
        }))
    ]);

    const checks: HealthSnapshot['checks'] = {
        database,
        redis,
        keyFiles: await verifyKeyFiles(),
        systemResources: evaluateSystemResources()
    };

    return {
        overallStatus: deriveOverallStatus(checks),
        checks
    };
};
