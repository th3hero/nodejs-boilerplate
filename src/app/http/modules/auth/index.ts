/**
 * Auth Module Export
 */

export { default as routes } from './routes';
export { default as controller } from './controller';
export { default as service } from './service';
export { default as repository } from './repository';
export * from './types';
export * from './validation';

// Cache exports for external use (e.g., admin ban/suspend user, permission updates)
export { invalidateAllUserSessions, invalidateRoleSessions } from './cache';

// Queue exports for initialization
export { initSessionUpdateWorker, shutdownSessionQueue } from './queue';
