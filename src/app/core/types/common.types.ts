/**
 * Common Types used across the application
 */

export interface RequestContext {
    requestId: string;
    userId?: bigint;
    sessionId?: bigint;
    startTime: number;
}
