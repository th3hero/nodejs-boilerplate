import type { DefaultJobOptions } from 'bullmq';

/**
 * Shared default BullMQ job options.
 * Modules can override per job when needed.
 */
export const DEFAULT_BULLMQ_JOB_OPTIONS: DefaultJobOptions = {
    removeOnComplete: true,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 1000
    }
};
