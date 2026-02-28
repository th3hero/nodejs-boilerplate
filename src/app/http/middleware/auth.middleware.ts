/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user to request
 * Uses Redis cache to avoid DB reads on every request
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@services/index';
import { ERROR_CODES, ROLES, PermissionCheck, PermissionAction } from '@core/constants';
import { AuthenticatedRequest, UserWithRole } from '@core/types';
import { setContextUserId, setContextSessionId, getRequestId } from './request-context.middleware';
import { prismaClient } from '@core/database';
import { getCachedSession, setCachedSession, CachedSession } from '@http/modules/auth/cache';
import { queueSessionLastUsedUpdate } from '@http/modules/auth/queue';

// ============================================================================
// Types
// ============================================================================

interface AuthMiddlewareOptions {
    forRefresh?: boolean;
    optional?: boolean;
}

// ============================================================================
// Response Helpers
// ============================================================================

const sendError = (res: Response, message: string, errorCode: string, statusCode: number): Response => {
    return res.status(statusCode).json({
        success: false,
        message,
        error_code: errorCode,
        error: { message },
        timestamp: new Date().toISOString(),
        requestId: getRequestId()
    });
};

// ============================================================================
// Cache Helpers
// ============================================================================

const cachedToUserWithRole = (cached: CachedSession['user']): UserWithRole => ({
    id: BigInt(cached.id),
    firstName: cached.firstName,
    lastName: cached.lastName,
    email: cached.email,
    phone: cached.phone,
    countryCode: cached.countryCode,
    status: cached.status,
    verified: cached.verified,
    roleId: BigInt(cached.roleId),
    role: {
        id: BigInt(cached.role.id),
        name: cached.role.name,
        slug: cached.role.slug,
        forApp: cached.role.forApp,
        passwordRequired: cached.role.passwordRequired
    }
});

interface DbSession {
    id: bigint;
    userId: bigint;
    token: string;
    status: boolean;
    verified: boolean;
    expiresAt: Date;
    user: {
        id: bigint;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        countryCode: string;
        status: string;
        verified: boolean;
        roleId: bigint;
        role: {
            id: bigint;
            name: string;
            slug: string;
            forApp: boolean;
            passwordRequired: boolean;
            permission: { permissions: unknown } | null;
        };
    };
}

const sessionToCacheable = (session: DbSession): CachedSession => {
    const roleSlug = session.user.role.slug;
    const permRecord = session.user.role.permission;
    const permissions: CachedSession['permissions'] =
        permRecord?.permissions && typeof permRecord.permissions === 'object'
            ? (permRecord.permissions as CachedSession['permissions'])
            : {};

    return {
        sessionId: session.id.toString(),
        userId: session.userId.toString(),
        token: session.token,
        roleSlug,
        status: session.status,
        verified: session.verified,
        expiresAt: session.expiresAt.toISOString(),
        permissions,
        user: {
            id: session.user.id.toString(),
            firstName: session.user.firstName,
            lastName: session.user.lastName,
            email: session.user.email,
            phone: session.user.phone,
            countryCode: session.user.countryCode,
            status: session.user.status,
            verified: session.user.verified,
            roleId: session.user.roleId.toString(),
            role: {
                id: session.user.role.id.toString(),
                name: session.user.role.name,
                slug: session.user.role.slug,
                forApp: session.user.role.forApp,
                passwordRequired: session.user.role.passwordRequired
            }
        }
    };
};

// ============================================================================
// Core Authentication Logic
// ============================================================================

const authenticateRequest = async (
    req: Request,
    res: Response,
    next: NextFunction,
    options: AuthMiddlewareOptions = {}
): Promise<Response | void> => {
    const { forRefresh = false, optional = false } = options;
    const tokenType = forRefresh ? 'Refresh' : 'Access';

    const authHeader = req.headers.authorization || (req.headers['Authorization'] as string);

    if (!authHeader?.startsWith('Bearer ')) {
        if (optional) {
            return next();
        }
        return sendError(res, `${tokenType} token required`, ERROR_CODES.SESSION_NOT_VALID, 401);
    }

    const token = authHeader.substring(7);

    const decoded = verifyToken(token);

    if (!decoded) {
        if (optional) {
            return next();
        }
        return sendError(res, `${tokenType} token invalid or expired`, ERROR_CODES.SESSION_EXPIRED, 401);
    }

    const expectedMode = forRefresh ? 1 : 0;
    if (decoded.m !== expectedMode) {
        return sendError(res, `Invalid token type. ${tokenType} token required.`, ERROR_CODES.TOKEN_INVALID, 401);
    }

    const roleSlug = decoded.r;
    if (!roleSlug) {
        return sendError(res, 'Invalid token format. Please re-login.', ERROR_CODES.TOKEN_INVALID, 401);
    }

    let cachedSession = await getCachedSession(roleSlug, decoded.t);
    let sessionId: bigint;
    let user: UserWithRole;
    let permissions: CachedSession['permissions'] = {};

    if (cachedSession) {
        if (!cachedSession.status) {
            return sendError(res, 'Session is inactive/logged out', ERROR_CODES.SESSION_INACTIVE, 401);
        }

        if (!cachedSession.verified) {
            return sendError(res, '2FA verification required', ERROR_CODES.SESSION_NOT_VERIFIED, 401);
        }

        if (new Date(cachedSession.expiresAt) < new Date()) {
            return sendError(res, 'Session has expired', ERROR_CODES.SESSION_EXPIRED, 401);
        }

        const userStatus = cachedSession.user.status;
        if (userStatus === 'banned' || userStatus === 'suspended') {
            return sendError(res, 'Account is suspended or banned', ERROR_CODES.ACCOUNT_SUSPENDED, 403);
        }

        sessionId = BigInt(cachedSession.sessionId);
        user = cachedToUserWithRole(cachedSession.user);
        permissions = cachedSession.permissions;
    } else {
        const session = await prismaClient.loginSession.findFirst({
            where: { token: decoded.t },
            include: {
                user: {
                    include: {
                        role: {
                            include: {
                                permission: { select: { permissions: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!session) {
            if (optional) {
                return next();
            }
            return sendError(res, `${tokenType} token invalid or expired`, ERROR_CODES.SESSION_NOT_VALID, 401);
        }

        if (!session.status) {
            return sendError(res, 'Session is inactive/logged out', ERROR_CODES.SESSION_INACTIVE, 401);
        }

        if (!session.verified) {
            return sendError(res, '2FA verification required', ERROR_CODES.SESSION_NOT_VERIFIED, 401);
        }

        if (session.expiresAt < new Date()) {
            return sendError(res, 'Session has expired', ERROR_CODES.SESSION_EXPIRED, 401);
        }

        if (!session.user) {
            return sendError(res, 'User not found', ERROR_CODES.NOT_FOUND, 401);
        }

        const userStatus = session.user.status;
        if (userStatus === 'banned' || userStatus === 'suspended') {
            return sendError(res, 'Account is suspended or banned', ERROR_CODES.ACCOUNT_SUSPENDED, 403);
        }

        const cacheable = sessionToCacheable(session as DbSession);
        setCachedSession(roleSlug, decoded.t, cacheable).catch(() => {});

        sessionId = session.id;
        user = session.user as UserWithRole;
        permissions = cacheable.permissions;
    }

    queueSessionLastUsedUpdate(sessionId).catch(() => {});

    (req as AuthenticatedRequest).user = user;
    (req as AuthenticatedRequest).session = {
        id: sessionId,
        userId: user.id,
        token: decoded.t,
        status: true,
        expiresAt: cachedSession ? new Date(cachedSession.expiresAt) : new Date()
    };
    (req as AuthenticatedRequest).permissions = permissions;

    setContextUserId(user.id);
    setContextSessionId(sessionId);

    next();
};

// ============================================================================
// Middleware Factory
// ============================================================================

export const createAuthMiddleware = (options: AuthMiddlewareOptions = {}) => {
    return (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        return authenticateRequest(req, res, next, options);
    };
};

// ============================================================================
// Pre-configured Middleware
// ============================================================================

export const authCheck = createAuthMiddleware({ forRefresh: false });

export const authRefresh = createAuthMiddleware({ forRefresh: true });

// ============================================================================
// Permission-based Authorization
// ============================================================================

const hasPermission = (
    permissions: CachedSession['permissions'],
    module: string,
    actions: PermissionAction | PermissionAction[]
): boolean => {
    const modulePerms = permissions[module as keyof typeof permissions];
    if (!modulePerms) return false;

    const actionsArray = Array.isArray(actions) ? actions : [actions];
    return actionsArray.some(action => modulePerms[action as keyof typeof modulePerms] === true);
};

export const requirePermission = (checks: PermissionCheck | PermissionCheck[]) => {
    return (req: Request, res: Response, next: NextFunction): Response | void => {
        const authReq = req as AuthenticatedRequest;
        const user = authReq.user;
        const permissions = authReq.permissions;

        if (!user) {
            return sendError(res, 'Authentication required', ERROR_CODES.SESSION_NOT_VALID, 401);
        }

        if (user.role?.slug === ROLES.SUPER_ADMIN) {
            return next();
        }

        if (!permissions) {
            return sendError(res, 'Permissions not loaded', ERROR_CODES.PERMISSION_DENIED, 403);
        }

        const checksArray = Array.isArray(checks) ? checks : [checks];

        for (const check of checksArray) {
            if (!hasPermission(permissions, check.module, check.action)) {
                return sendError(
                    res,
                    `Permission denied: ${check.module}:${
                        Array.isArray(check.action) ? check.action.join('|') : check.action
                    }`,
                    ERROR_CODES.PERMISSION_DENIED,
                    403
                );
            }
        }

        next();
    };
};
