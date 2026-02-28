/**
 * Auth Module Types
 * DTOs and interfaces for authentication
 */

import { User, Role, CodeVerification, Gallery } from '@database/prisma';
import { BaseDto } from '@core/types';

type Platform = 'android' | 'ios' | 'web';

// ============================================================================
// Request DTOs
// ============================================================================

export interface SendOtpDto extends BaseDto {
    /** Country code without + (e.g., "1") */
    country_code: string;
    /** Phone number */
    phone: string;
}

export interface VerifyOtpDto extends BaseDto {
    /** Reference from sendOTP response */
    reference: string;
    /** 6-digit OTP code */
    code: string;
    /** FCM push notification token */
    fcm_token?: string;
    /** Device information */
    device?: Record<string, unknown>;
    /** Unique device identifier */
    identifier?: string;
    /** Platform type */
    platform?: Platform;
}

export interface ResendOtpDto extends BaseDto {
    /** Reference from sendOTP response */
    reference: string;
}

export interface PasswordLoginDto extends BaseDto {
    /** Email address */
    email: string;
    /** Password (min 8 chars) */
    password: string;
    /** FCM push notification token */
    fcm_token?: string;
    /** Device information */
    device?: Record<string, unknown>;
    /** Unique device identifier */
    identifier?: string;
    /** Platform type */
    platform?: Platform;
}

export interface ForgotPasswordDto extends BaseDto {
    /** Email address */
    email: string;
}

export interface ResetPasswordDto extends BaseDto {
    /** Reset token from email */
    token: string;
    /** New password */
    password: string;
    /** Password confirmation */
    password_confirmation: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface RoleData {
    id: string;
    name: string;
    slug: string;
    for_app: boolean;
    password_required: boolean;
}

export interface AvatarData {
    id: string;
    url: string | null;
}

export interface UserResponse {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | undefined;
    country_code?: string | undefined;
    role?: RoleData | undefined;
    avatar?: AvatarData | null | undefined;
    is_profile_complete?: boolean | undefined;
    is_verified?: boolean | undefined;
    phone_verified?: boolean | undefined;
    email_verified?: boolean | undefined;
}

// ============================================================================
// Internal Types
// ============================================================================

export interface FcmData {
    fcm_token?: string;
    device?: Record<string, unknown>;
    identifier?: string;
    platform?: Platform;
}

export interface RequestMeta {
    userAgent: string;
    ipAddress: string;
}

export interface SessionTokens {
    token: string;
    token_expiry: Date;
    keys: { auth: string; refresh: string };
}

export interface ResendResult {
    success: boolean;
    error?: 'max_attempts' | 'rate_limit';
    code?: number;
    attemptsRemaining?: number;
}

// ============================================================================
// Login Response Types
// ============================================================================

/** Two-factor authentication status */
export interface TwoFactorStatus {
    twoFactorEnabled: boolean;
    mfaEnabled: boolean;
}

/** Base login response - always included */
export interface LoginResponseBase {
    two_factor_enabled: boolean;
    mfa_enabled: boolean;
}

/** Login response when 2FA/MFA required */
export interface LoginResponse2FARequired extends LoginResponseBase {
    reference: string;
    expires_in: number;
}

/** Login response when no verification needed */
export interface LoginResponseAuthenticated extends LoginResponseBase {
    user: UserResponse & { is_verified: boolean };
    tokens: { auth: string; refresh: string };
    token_expiry: Date;
    permissions: Record<string, unknown>;
}

// ============================================================================
// Database Types with Relations
// ============================================================================

/** Permission record from database */
export interface PermissionRecord {
    permissions: unknown; // JSONB
}

/** Role with permission (1:1 relation) */
export interface RoleWithPermissions extends Role {
    permission: PermissionRecord | null;
}

export type UserWithRole = User & {
    role: RoleWithPermissions | null;
};

export type UserWithPassword = User & {
    role: RoleWithPermissions | null;
    passwords: Array<{
        id: bigint;
        password: string;
        salt: string;
        status: boolean;
    }>;
};

export type VerificationWithUser = CodeVerification & {
    user: UserWithRole;
};

export type UserFullProfile = User & {
    role: RoleWithPermissions | null;
    avatar: Gallery | null;
};
