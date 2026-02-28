/**
 * Authentication & Session Constants
 */

import environment from '@config/environment.config';

const { auth } = environment;

export const AUTH = {
    /** OTP expiry time in minutes */
    OTP_EXPIRY_MINUTES: auth.otpExpiryMinutes,

    /** 2FA/MFA verification expiry time in minutes */
    TWO_FACTOR_EXPIRY_MINUTES: auth.twoFactorExpiryMinutes,

    /** Maximum failed login attempts before lockout */
    MAX_LOGIN_ATTEMPTS: auth.maxLoginAttempts,

    /** Account lockout duration in minutes */
    LOCKOUT_MINUTES: auth.lockoutMinutes,

    /** Maximum OTP resend attempts per session */
    MAX_RESEND_ATTEMPTS: auth.maxResendAttempts,

    /** Cooldown between OTP resends in milliseconds */
    RESEND_COOLDOWN_MS: auth.resendCooldownSeconds * 1000,

    /** Password reset token expiry in milliseconds (1 hour) */
    PASSWORD_RESET_EXPIRY_MS: 60 * 60 * 1000,

    /** Fixed OTP code for development environment */
    DEV_OTP_CODE: 123456,

    /** Minimum password length */
    MIN_PASSWORD_LENGTH: 8,

    /** Maximum password length */
    MAX_PASSWORD_LENGTH: 128,

    /** Session token length in bytes */
    SESSION_TOKEN_BYTES: 11,

    /** Reference string length for OTP verification */
    OTP_REFERENCE_LENGTH: 32
} as const;

export const JWT = {
    /** Access token expiry */
    ACCESS_TOKEN_EXPIRY: '15m',

    /** Refresh token expiry */
    REFRESH_TOKEN_EXPIRY: '7d',

    /** Token mode: access */
    MODE_ACCESS: 0,

    /** Token mode: refresh */
    MODE_REFRESH: 1,

    /** Algorithm for signing */
    ALGORITHM: 'RS256'
} as const;
