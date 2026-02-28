/**
 * Express Type Augmentation
 */

import { Request } from 'express';
import { RequestContext } from './common.types';
import type { Permissions } from '@core/constants';

// ============================================================================
// Extended User Type with Relations
// ============================================================================

export interface UserWithRole {
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
    };
    [key: string]: unknown;
}

// ============================================================================
// Login Session Type
// ============================================================================

export interface LoginSessionType {
    id: bigint;
    userId: bigint;
    token: string;
    status: boolean;
    expiresAt: Date;
    [key: string]: unknown;
}

// ============================================================================
// Authenticated Request
// ============================================================================

export interface AuthenticatedRequest extends Request {
    user: UserWithRole;
    session: LoginSessionType;
    permissions: Permissions;
    context?: RequestContext;
}
