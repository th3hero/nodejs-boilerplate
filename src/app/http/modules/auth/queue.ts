/**
 * Auth Queue
 * BullMQ-based job queue for session lastUsed updates
 *
 * Uses a debounce + throttle ceiling pattern:
 * - Every authenticated request buffers the latest activity time in Redis
 * - A delayed BullMQ job fires after a quiet period (debounce)
 * - If activity continues, the job re-schedules itself up to a max wait ceiling
 * - On flush, the most recent timestamp is written to DB in a single write
 */

import { Queue, Worker, Job } from 'bullmq';
import environment from '@config/environment.config';
import { getRedisClient } from '@core/cache';
import { createBullMqConnection, DEFAULT_BULLMQ_JOB_OPTIONS } from '@core/queue';
import { createLogger } from '@services/logger.service';
import { prismaClient } from '@core/database';

const logger = createLogger('auth:queue');

// ============================================================================
// Configuration
// ============================================================================

const QUEUE_NAME = 'auth-session-updates';

/** Quiet period before flushing — if a new request arrives within this window, the flush is deferred */
const DEBOUNCE_MS = Number.isFinite(environment.auth.sessionLastUsedDebounceMs)
    ? Math.max(1_000, environment.auth.sessionLastUsedDebounceMs)
    : 120_000;

/** Maximum time a batch can stay buffered before being force-flushed regardless of activity */
const MAX_WAIT_MS = Number.isFinite(environment.auth.sessionLastUsedMaxWaitMs)
    ? Math.max(DEBOUNCE_MS, environment.auth.sessionLastUsedMaxWaitMs)
    : 600_000;

/** Redis hash key prefix for buffered session updates */
const BUFFER_PREFIX = 'app:session-buf:';

/** Redis key TTL — safety net to auto-clean orphaned keys */
const BUFFER_TTL_S = Math.ceil((MAX_WAIT_MS + DEBOUNCE_MS) / 1000) + 60;

// ============================================================================
// Types
// ============================================================================

interface SessionFlushJob {
    sessionId: string;
}

// ============================================================================
// Queue Instance
// ============================================================================

let queue: Queue<SessionFlushJob> | null = null;
let worker: Worker<SessionFlushJob> | null = null;

const getSessionUpdateQueue = async (): Promise<Queue<SessionFlushJob>> => {
    if (queue) return queue;

    queue = new Queue<SessionFlushJob>(QUEUE_NAME, {
        connection: createBullMqConnection(),
        defaultJobOptions: DEFAULT_BULLMQ_JOB_OPTIONS
    });

    logger.info('Session update queue initialized');
    return queue;
};

// ============================================================================
// Worker
// ============================================================================

/**
 * Flush handler — runs when a delayed job fires.
 * Decides whether to flush to DB or re-schedule if there's been recent activity.
 */
const processFlushJob = async (job: Job<SessionFlushJob>): Promise<void> => {
    const { sessionId } = job.data;
    const redis = await getRedisClient();
    const key = `${BUFFER_PREFIX}${sessionId}`;

    const data = await redis.hgetall(key);
    const latestRaw = data['latestMs'] ?? data['latest'];
    const batchStartRaw = data['batchStartMs'] ?? data['batchStart'];

    if (!latestRaw || !batchStartRaw) {
        return;
    }

    const now = Date.now();
    const latestMs = Number(latestRaw);
    const batchStartMs = Number(batchStartRaw);
    if (!Number.isFinite(latestMs) || !Number.isFinite(batchStartMs)) {
        await redis.del(key);
        return;
    }
    const timeSinceLatest = now - latestMs;
    const batchAge = now - batchStartMs;

    if (timeSinceLatest < DEBOUNCE_MS && batchAge + DEBOUNCE_MS <= MAX_WAIT_MS) {
        const nextDelay = Math.min(DEBOUNCE_MS, MAX_WAIT_MS - batchAge);
        const q = await getSessionUpdateQueue();
        await q.add('flush-session', { sessionId }, { delay: nextDelay });

        logger.debug('Session flush re-debounced', {
            sessionId,
            nextDelayMs: nextDelay,
            batchAgeMs: batchAge
        });
        return;
    }

    try {
        await prismaClient.loginSession.update({
            where: { id: BigInt(sessionId) },
            data: { lastUsed: new Date(latestMs) }
        });

        logger.debug('Session lastUsed flushed to DB', {
            sessionId,
            batchAgeMs: batchAge,
            timestampMs: latestMs
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes('Record to update not found')) {
            logger.debug('Session not found for lastUsed flush (likely revoked)', { sessionId });
        } else {
            throw error;
        }
    }

    await redis.del(key);
};

export const initSessionUpdateWorker = async (): Promise<Worker<SessionFlushJob>> => {
    if (worker) return worker;

    worker = new Worker<SessionFlushJob>(QUEUE_NAME, processFlushJob, {
        connection: createBullMqConnection(),
        concurrency: 5
    });

    worker.on('failed', (job, error) => {
        logger.error('Session flush job failed', {
            jobId: job?.id,
            sessionId: job?.data.sessionId,
            error: error.message
        });
    });

    logger.info('Session update worker initialized');
    return worker;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Buffer a session lastUsed update.
 *
 * Each call stores the current timestamp in Redis. Only the first call in a batch
 * schedules a delayed flush job. The job will either flush or re-debounce when it fires.
 */
export const queueSessionLastUsedUpdate = async (sessionId: bigint): Promise<boolean> => {
    try {
        const redis = await getRedisClient();
        const key = `${BUFFER_PREFIX}${sessionId.toString()}`;
        const nowMs = Date.now();

        const txResults = await redis
            .multi()
            .hset(key, 'latestMs', String(nowMs))
            .hsetnx(key, 'batchStartMs', String(nowMs))
            .expire(key, BUFFER_TTL_S)
            .exec();

        if (!txResults) {
            throw new Error('Failed to buffer session update');
        }

        const hsetnxResult = txResults[1]?.[1];
        const isNewBatch = hsetnxResult === 1;

        if (isNewBatch) {
            const q = await getSessionUpdateQueue();
            await q.add('flush-session', { sessionId: sessionId.toString() }, { delay: DEBOUNCE_MS });

            logger.debug('Session update batch started', {
                sessionId: sessionId.toString(),
                debounceMs: DEBOUNCE_MS
            });
        }

        return true;
    } catch (error) {
        logger.warn('Failed to buffer session lastUsed update', {
            sessionId: sessionId.toString(),
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
};

// ============================================================================
// Shutdown
// ============================================================================

export const shutdownSessionQueue = async (): Promise<void> => {
    if (worker) {
        await worker.close();
        worker = null;
        logger.info('Session update worker closed');
    }

    if (queue) {
        await queue.close();
        queue = null;
        logger.info('Session update queue closed');
    }
};
