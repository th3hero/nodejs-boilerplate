import * as Sentry from '@sentry/node';
import environment from '@config/environment.config';
import { createLogger } from './logger.service';

const log = createLogger('sentry');
let initialized = false;
type SentryTagValue = string | number | boolean;
type SentryTags = Record<string, SentryTagValue>;

export const initSentry = (): void => {
    if (initialized) {
        return;
    }

    const { dsn, sendDefaultPii } = environment.sentry;
    if (!dsn) {
        log.warn('Sentry is disabled because SENTRY_DSN is not configured');
        return;
    }

    Sentry.init({
        dsn,
        sendDefaultPii
    });

    initialized = true;
    log.info('Sentry initialized');
};

export const captureException = (
    error: unknown,
    context?: Record<string, unknown>,
    tags?: SentryTags
): void => {
    if (!initialized) {
        return;
    }

    Sentry.withScope(scope => {
        if (tags) {
            Object.entries(tags).forEach(([key, value]) => {
                scope.setTag(key, String(value));
            });
        }

        if (context) {
            scope.setContext('request', context);
        }

        Sentry.captureException(error);
    });
};

export const captureMessage = (
    message: string,
    level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'error',
    context?: Record<string, unknown>,
    tags?: SentryTags
): void => {
    if (!initialized) {
        return;
    }

    Sentry.withScope(scope => {
        scope.setLevel(level);

        if (tags) {
            Object.entries(tags).forEach(([key, value]) => {
                scope.setTag(key, String(value));
            });
        }

        if (context) {
            scope.setContext('request', context);
        }

        Sentry.captureMessage(message);
    });
};
