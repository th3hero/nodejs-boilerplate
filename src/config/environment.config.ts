import { config } from 'dotenv';
config({ quiet: true });

export interface Environment {
    basic: {
        environment: string;
        isDev: boolean;
        isProduction: boolean;
        port: number;
        timezone: string;
    };
    app: {
        name: string;
        version: string;
        description: string;
        url: string;
    };
    cors: {
        origin: string[];
        methods: string[];
        maxAge: number;
    };
    rateLimit: {
        windowMs: number;
        max: number;
        login: {
            windowMs: number;
            max: number;
        };
        otp: {
            windowMs: number;
            max: number;
        };
        defaultRetryAfterMs: number;
    };
    database: {
        url: string;
        pool: {
            max: number;
            idleTimeoutMillis: number;
            connectionTimeoutMillis: number;
        };
    };
    redis: {
        url: string;
        connectionName: string;
        maxRetriesPerRequest: number;
    };
    keyFiles: {
        required: string[];
    };
    systemResources: {
        minFreeMemoryRatio: number;
        maxLoadAverageMultiplier: number;
        maxLoadAverageAbsolute: number;
    };
    jwt: {
        expiresIn: string;
        refreshExpiresIn: string;
    };
    auth: {
        otpExpiryMinutes: number;
        twoFactorExpiryMinutes: number;
        maxLoginAttempts: number;
        lockoutMinutes: number;
        maxResendAttempts: number;
        resendCooldownSeconds: number;
        sessionLastUsedDebounceMs: number;
        sessionLastUsedMaxWaitMs: number;
        placeholderEmailSuffix: string;
    };
    logging: {
        level: string;
        maxSize: string;
        maxFiles: string;
        enableFile: boolean;
    };
    sentry: {
        dsn: string;
        sendDefaultPii: boolean;
    };
    docs: {
        enabled: boolean;
        path: string;
    };
    aws: {
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
        s3Bucket: string;
        s3BucketPublic: string;
    };
}

const env = process.env['NODE_ENV'] || 'development';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
    if (!value) {
        return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
    }

    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
    }

    return fallback;
};

const parseIntEnv = (key: string, fallback: string): number =>
    parseInt(process.env[key] || fallback);

const parseFloatEnv = (key: string, fallback: string): number =>
    parseFloat(process.env[key] || fallback);

const placeholderEmailSuffixRaw = process.env['AUTH_PLACEHOLDER_EMAIL_SUFFIX'] || '@temp.placeholder.local';
const placeholderEmailSuffix = placeholderEmailSuffixRaw.startsWith('@')
    ? placeholderEmailSuffixRaw.toLowerCase()
    : `@${placeholderEmailSuffixRaw.toLowerCase()}`;

const PORT = parseIntEnv('PORT', '8070');
const environment: Environment = {
    basic: {
        environment: env,
        isDev: env === 'development',
        isProduction: env === 'production',
        port: PORT,
        timezone: process.env['TIMEZONE'] || 'UTC'
    },
    app: {
        name: process.env['APP_NAME'] || 'My App',
        version: process.env['APP_VERSION'] || '1',
        description: process.env['APP_DESCRIPTION'] || 'Backend API Service',
        url: process.env['APP_URL'] || `http://127.0.0.1:${PORT}`
    },
    cors: {
        origin: process.env['CORS_ORIGIN']?.split(',').map(origin => origin.trim()) || ['*'],
        methods: process.env['CORS_METHODS']?.split(',').map(method => method.trim()) || [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS'
        ],
        maxAge: parseIntEnv('CORS_MAX_AGE', '86400')
    },
    rateLimit: {
        windowMs: parseIntEnv('RATE_LIMIT_WINDOW_MS', '60000'),
        max: parseIntEnv('RATE_LIMIT_MAX_REQUESTS', '120'),
        login: {
            windowMs: parseIntEnv('RATE_LIMIT_LOGIN_WINDOW_MS', '900000'),
            max: parseIntEnv('RATE_LIMIT_LOGIN_MAX_REQUESTS', '20')
        },
        otp: {
            windowMs: parseIntEnv('RATE_LIMIT_OTP_WINDOW_MS', '3600000'),
            max: parseIntEnv('RATE_LIMIT_OTP_MAX_REQUESTS', '5')
        },
        defaultRetryAfterMs: parseIntEnv('RATE_LIMIT_RETRY_AFTER_MS', '60000')
    },
    database: {
        url: process.env['DATABASE_URL'] || 'postgresql://postgres:change-me@127.0.0.1:5432/myapp',
        pool: {
            max: parseIntEnv('DATABASE_POOL_MAX', '10'),
            idleTimeoutMillis: parseIntEnv('DATABASE_POOL_IDLE_TIMEOUT_MS', '30000'),
            connectionTimeoutMillis: parseIntEnv('DATABASE_POOL_CONNECTION_TIMEOUT_MS', '5000')
        }
    },
    redis: {
        url: process.env['REDIS_URL'] || 'redis://127.0.0.1:6379',
        connectionName: process.env['REDIS_CONNECTION_NAME'] || 'app-service',
        maxRetriesPerRequest: parseIntEnv('REDIS_MAX_RETRIES_PER_REQUEST', '3')
    },
    keyFiles: {
        required: process.env['KEY_FILES']
            ?.split(',')
            .map(entry => entry.trim())
            .filter(Boolean) || [
            'storage/keys/api/private.key',
            'storage/keys/api/public.key',
            'storage/keys/encryption/private.key',
            'storage/keys/encryption/public.key'
        ]
    },
    systemResources: {
        minFreeMemoryRatio: parseFloatEnv('SYSTEM_RESOURCES_MIN_FREE_MEMORY_RATIO', '0.03'),
        maxLoadAverageMultiplier: parseFloatEnv('SYSTEM_RESOURCES_MAX_LOAD_MULTIPLIER', '1.5'),
        maxLoadAverageAbsolute: parseFloatEnv('SYSTEM_RESOURCES_MAX_LOAD_ABSOLUTE', '6')
    },
    jwt: {
        expiresIn: process.env['JWT_EXPIRES_IN'] || '15m',
        refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d'
    },
    auth: {
        otpExpiryMinutes: parseIntEnv('AUTH_OTP_EXPIRY_MINUTES', '10'),
        twoFactorExpiryMinutes: parseIntEnv('AUTH_2FA_EXPIRY_MINUTES', '5'),
        maxLoginAttempts: parseIntEnv('AUTH_MAX_LOGIN_ATTEMPTS', '5'),
        lockoutMinutes: parseIntEnv('AUTH_LOCKOUT_MINUTES', '30'),
        maxResendAttempts: parseIntEnv('AUTH_MAX_RESEND_ATTEMPTS', '3'),
        resendCooldownSeconds: parseIntEnv('AUTH_RESEND_COOLDOWN_SECONDS', '30'),
        sessionLastUsedDebounceMs: parseIntEnv('AUTH_SESSION_LAST_USED_DEBOUNCE_MS', '120000'),
        sessionLastUsedMaxWaitMs: parseIntEnv('AUTH_SESSION_LAST_USED_MAX_WAIT_MS', '600000'),
        placeholderEmailSuffix
    },
    logging: {
        level: process.env['LOG_LEVEL'] || (env === 'development' ? 'debug' : 'info'),
        maxSize: process.env['LOG_MAX_SIZE'] || '20m',
        maxFiles: process.env['LOG_MAX_FILES'] || '30d',
        enableFile: parseBoolean(process.env['LOG_ENABLE_FILE'], env === 'production')
    },
    sentry: {
        dsn: process.env['SENTRY_DSN'] || '',
        sendDefaultPii: parseBoolean(process.env['SENTRY_SEND_DEFAULT_PII'], true)
    },
    docs: {
        enabled: parseBoolean(process.env['DOCS_ENABLED'], env !== 'production'),
        path: process.env['DOCS_PATH'] || '/docs'
    },
    aws: {
        region: process.env['AWS_REGION'] || 'us-east-1',
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
        s3Bucket: process.env['AWS_S3_BUCKET'] || 'my-app-documents',
        s3BucketPublic: process.env['AWS_S3_BUCKET_PUBLIC'] || 'my-app-public'
    }
};

export default environment;
