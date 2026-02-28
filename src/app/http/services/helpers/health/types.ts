export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
    status: ServiceHealthStatus;
    details: string;
}
