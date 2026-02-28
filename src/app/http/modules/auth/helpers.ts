/**
 * Auth Module Helpers
 * Utility functions for authentication
 */

import type { Response } from 'express';
import { ERROR_CODES } from '@core/constants';
import { getRequestId } from '@middleware/request-context.middleware';
import type {
    UserResponse,
    SessionTokens,
    LoginResponseAuthenticated,
    LoginResponse2FARequired,
    TwoFactorStatus
} from './types';

// ============================================================================
// Types
// ============================================================================

type ErrorData = Record<string, unknown>;

interface AccountCheckable {
    inactiveTill: Date | null;
    status: string;
}

// ============================================================================
// Error Response Helpers
// ============================================================================

const send = (res: Response, data: ErrorData, code: string, message: string, status: number): Response =>
    res.status(status).json({
        success: false,
        message,
        error_code: code,
        error: data,
        timestamp: new Date().toISOString(),
        requestId: getRequestId()
    });

/**
 * Pre-configured error responses for auth module
 */
export const errors = {
    notFound: (res: Response, field = 'resource', msg = 'Not found'): Response =>
        send(res, { [field]: msg }, ERROR_CODES.NOT_FOUND, msg, 404),

    locked: (res: Response, minutes: number): Response =>
        send(
            res,
            { message: `Account locked. Try again in ${minutes} minutes.` },
            ERROR_CODES.ACCOUNT_LOCKED,
            'Account locked',
            423
        ),

    suspended: (res: Response): Response =>
        send(res, { message: 'Account suspended' }, ERROR_CODES.ACCOUNT_SUSPENDED, 'Account suspended', 403),

    invalidCredentials: (res: Response, extra?: ErrorData): Response =>
        send(
            res,
            { email: 'Invalid credentials', ...extra },
            ERROR_CODES.INVALID_CREDENTIALS,
            'Invalid credentials',
            401
        ),

    permissionDenied: (res: Response, msg = 'Permission denied'): Response =>
        send(res, { message: msg }, ERROR_CODES.PERMISSION_DENIED, msg, 403),

    validation: (res: Response, data: ErrorData, msg = 'Validation failed'): Response =>
        send(res, data, ERROR_CODES.VALIDATION_ERROR, msg, 422),

    serverError: (res: Response, msg = 'Internal server error'): Response =>
        send(res, { message: msg }, ERROR_CODES.INTERNAL_SERVER_ERROR, msg, 500),

    tokenExpired: (res: Response, field = 'token'): Response =>
        send(res, { [field]: 'Token expired' }, ERROR_CODES.TOKEN_EXPIRED, 'Token expired', 400),

    tooMany: (res: Response, msg = 'Too many requests'): Response =>
        send(res, { message: msg }, ERROR_CODES.TOO_MANY_ATTEMPTS, msg, 429),

    sessionInvalid: (res: Response): Response =>
        send(res, { message: 'Invalid session' }, ERROR_CODES.SESSION_NOT_VALID, 'Invalid session', 401)
};

// ============================================================================
// Account Status Helpers
// ============================================================================

const isLocked = (inactiveTill: Date | null): boolean => Boolean(inactiveTill && inactiveTill > new Date());

const isSuspended = (status: string): boolean => status === 'banned' || status === 'suspended';

const lockoutMinutes = (inactiveTill: Date): number => Math.ceil((inactiveTill.getTime() - Date.now()) / 60_000);

/**
 * Check if account has issues - returns true if blocked, false if OK
 */
export const checkAccountStatus = (user: AccountCheckable, res: Response): boolean => {
    if (isLocked(user.inactiveTill)) {
        errors.locked(res, lockoutMinutes(user.inactiveTill!));
        return true;
    }
    if (isSuspended(user.status)) {
        errors.suspended(res);
        return true;
    }
    return false;
};

// ============================================================================
// Login Response Builders
// ============================================================================

/**
 * Build login response when 2FA/MFA verification is required
 */
export const buildLoginResponse2FARequired = (
    twoFactorStatus: TwoFactorStatus,
    reference: string,
    expiresInSeconds: number
): LoginResponse2FARequired => ({
    two_factor_enabled: twoFactorStatus.twoFactorEnabled,
    mfa_enabled: twoFactorStatus.mfaEnabled,
    reference,
    expires_in: expiresInSeconds
});

/**
 * Build login response when fully authenticated (no 2FA/MFA or after verification)
 */
export const buildLoginResponseAuthenticated = (
    userResponse: UserResponse,
    verified: boolean,
    session: SessionTokens,
    twoFactorStatus: TwoFactorStatus = { twoFactorEnabled: false, mfaEnabled: false },
    permissions: Record<string, unknown> = {}
): LoginResponseAuthenticated => ({
    two_factor_enabled: twoFactorStatus.twoFactorEnabled,
    mfa_enabled: twoFactorStatus.mfaEnabled,
    user: { ...userResponse, is_verified: verified },
    tokens: session.keys,
    token_expiry: session.token_expiry,
    permissions
});
