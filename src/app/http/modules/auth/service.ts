/**
 * Auth Service
 * Business logic for authentication
 */

import { CodeVerificationPurpose, Platform } from '@database/prisma';

import { AUTH, ROLES } from '@core/constants';
import { generateOTP, generateRandomString } from '@core/utils';
import { generateTokenPair, generateSalt, hashPassword, verifyPassword as verifyPwd } from '@services/index';
import { generateViewUrl, STORAGE_BUCKETS } from '@services/storage';
import environment from '@config/environment.config';

import repository from './repository';
import type {
    FcmData,
    UserWithRole,
    UserResponse,
    AvatarData,
    RoleData,
    RequestMeta,
    SessionTokens,
    ResendResult,
    TwoFactorStatus
} from './types';
import { setCachedSession, invalidateCachedSession, invalidateAllUserSessions, CachedSession } from './cache';

// ============================================================================
// Helper Functions
// ============================================================================

const { isDev } = environment.basic;

const PLATFORM_MAP: Record<string, Platform> = {
    ios: Platform.ios,
    web: Platform.web,
    android: Platform.android
};
const PLACEHOLDER_EMAIL_SUFFIX = environment.auth.placeholderEmailSuffix;

const getPlatformValue = (platform?: string): Platform => PLATFORM_MAP[platform ?? ''] ?? Platform.android;

const calculateSessionExpiry = (): Date => {
    const refreshExpiresIn = environment.jwt?.refreshExpiresIn || '7d';
    const days = parseInt(refreshExpiresIn.replace(/\D/g, ''), 10) || 7;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const formatRoleResponse = (role: UserWithRole['role']): RoleData | undefined => {
    if (!role) return undefined;
    return {
        id: role.id.toString(),
        name: role.name,
        slug: role.slug,
        for_app: role.forApp,
        password_required: role.passwordRequired
    };
};

const generateOtpCode = (): number => (isDev ? AUTH.DEV_OTP_CODE : generateOTP(6));

const createExpiry = (minutes: number): Date => new Date(Date.now() + minutes * 60 * 1000);

/**
 * Extract permissions from user's role (1:1 relation)
 */
const extractPermissions = (user: UserWithRole): CachedSession['permissions'] => {
    const permRecord = user.role?.permission;
    if (!permRecord?.permissions || typeof permRecord.permissions !== 'object') return {};
    return permRecord.permissions as CachedSession['permissions'];
};

/**
 * Convert user and session to cacheable format
 */
const toCacheableSession = (
    sessionId: bigint,
    token: string,
    expiresAt: Date,
    user: UserWithRole,
    permissions: CachedSession['permissions'] = {},
    sessionVerified = true
): CachedSession => ({
    sessionId: sessionId.toString(),
    userId: user.id.toString(),
    token,
    roleSlug: user.role?.slug ?? ROLES.CUSTOMER,
    status: true,
    verified: sessionVerified,
    expiresAt: expiresAt.toISOString(),
    permissions,
    user: {
        id: user.id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        status: user.status,
        verified: user.verified,
        roleId: user.roleId.toString(),
        role: {
            id: user.role!.id.toString(),
            name: user.role!.name,
            slug: user.role!.slug,
            forApp: user.role!.forApp,
            passwordRequired: user.role!.passwordRequired
        }
    }
});

// ============================================================================
// Auth Service
// ============================================================================

export class AuthService {
    async generateAvatarUrl(
        avatar: { id: bigint; reference: string; isPublic: boolean; status: string } | null
    ): Promise<AvatarData | null> {
        if (!avatar || avatar.status !== 'uploaded') return null;

        try {
            const bucket = avatar.isPublic ? STORAGE_BUCKETS.PUBLIC : STORAGE_BUCKETS.DOCUMENTS;
            const viewUrlResult = await generateViewUrl(avatar.reference, bucket);
            return {
                id: avatar.id.toString(),
                url: viewUrlResult.viewUrl
            };
        } catch {
            return {
                id: avatar.id.toString(),
                url: null
            };
        }
    }

    formatUserResponse(user: UserWithRole, includeContactInfo = true, avatarData?: AvatarData | null): UserResponse {
        const isProfileComplete = Boolean(user.firstName && user.lastName && !user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX));

        const response: UserResponse = {
            id: user.id.toString(),
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email,
            role: formatRoleResponse(user.role),
            avatar: avatarData ?? null
        };

        if (includeContactInfo) {
            response.phone = user.phone;
            response.country_code = user.countryCode;
            response.is_profile_complete = isProfileComplete;
            response.is_verified = user.verified;
        }

        return response;
    }

    getRequestMeta(req: {
        get: (name: string) => string | undefined;
        ip?: string | undefined;
        socket?: { remoteAddress?: string | undefined } | undefined;
    }): RequestMeta {
        return {
            userAgent: req.get('user-agent') || '',
            ipAddress: req.ip ?? req.socket?.remoteAddress ?? '0.0.0.0'
        };
    }

    async findUserByPhone(countryCode: string, phone: string) {
        return repository.findUserByPhone(countryCode, phone);
    }

    async findUserByEmail(email: string) {
        return repository.findUserByEmail(email);
    }

    async findUserById(id: bigint) {
        return repository.findUserById(id);
    }

    async findUserFullProfile(id: bigint) {
        return repository.findUserFullProfile(id);
    }

    async updateUserAvatar(userId: bigint, avatarId: bigint | null) {
        return repository.updateUserAvatar(userId, avatarId);
    }

    async verifyGalleryOwnership(galleryId: bigint, userId: bigint) {
        return repository.findGalleryForUser(galleryId, userId);
    }

    async getCustomerRole() {
        return repository.findRoleBySlug(ROLES.CUSTOMER);
    }

    async createUser(countryCode: string, phone: string, roleId: bigint) {
        return repository.createUser(countryCode, phone, roleId);
    }

    async updateUserLogin(userId: bigint, updateData: Record<string, unknown>) {
        return repository.updateUser(userId, updateData);
    }

    async incrementLoginAttempts(userId: bigint, currentAttempts: number, maxAttempts: number, lockoutMinutes: number) {
        return repository.incrementLoginAttempts(userId, currentAttempts, maxAttempts, lockoutMinutes);
    }

    /**
     * Create verification record (OTP, 2FA, MFA, email verification)
     */
    async createVerification(
        userId: bigint,
        purpose: CodeVerificationPurpose,
        expiryMinutes?: number
    ): Promise<{ code: number; reference: string; expiresIn: number }> {
        const minutes = expiryMinutes ?? this.getDefaultExpiryMinutes(purpose);
        const code = generateOtpCode();
        const reference = generateRandomString(32);

        await repository.createVerification(userId, reference, purpose, code, createExpiry(minutes));

        return { code, reference, expiresIn: minutes * 60 };
    }

    private getDefaultExpiryMinutes(purpose: CodeVerificationPurpose): number {
        switch (purpose) {
            case CodeVerificationPurpose.two_factor_auth:
            case CodeVerificationPurpose.mfa_auth:
                return AUTH.TWO_FACTOR_EXPIRY_MINUTES;
            default:
                return AUTH.OTP_EXPIRY_MINUTES;
        }
    }

    async findVerification(reference: string) {
        return repository.findVerificationByReference(reference);
    }

    async deleteVerification(id: bigint) {
        return repository.deleteVerification(id);
    }

    async resendOtp(verification: {
        id: bigint;
        resendAttempts: number;
        lastResendAt: Date | null;
    }): Promise<ResendResult> {
        if (verification.resendAttempts >= AUTH.MAX_RESEND_ATTEMPTS) {
            return { success: false, error: 'max_attempts' };
        }

        const timeSinceLastResend = verification.lastResendAt
            ? Date.now() - verification.lastResendAt.getTime()
            : Infinity;

        if (timeSinceLastResend < AUTH.RESEND_COOLDOWN_MS) {
            return { success: false, error: 'rate_limit' };
        }

        const newCode = generateOtpCode();

        await repository.updateVerificationForResend(
            verification.id,
            newCode,
            createExpiry(AUTH.OTP_EXPIRY_MINUTES),
            verification.resendAttempts + 1
        );

        return {
            success: true,
            code: newCode,
            attemptsRemaining: AUTH.MAX_RESEND_ATTEMPTS - verification.resendAttempts - 1
        };
    }

    async createLoginSession(
        userId: bigint,
        userAgent: string,
        ipAddress: string,
        user: UserWithRole,
        verified = true
    ): Promise<SessionTokens> {
        const roleSlug = user.role?.slug ?? ROLES.CUSTOMER;
        const { token, tokenExpiry, keys } = generateTokenPair({ roleSlug });
        const expiresAt = calculateSessionExpiry();
        const permissions = extractPermissions(user);

        const session = await repository.createSession(userId, token, userAgent, ipAddress, expiresAt, verified);

        if (verified) {
            const cacheable = toCacheableSession(session.id, token, expiresAt, user, permissions);
            setCachedSession(roleSlug, token, cacheable).catch(() => {});
        }

        return { token, token_expiry: tokenExpiry, keys };
    }

    async completeLogin(
        user: UserWithRole,
        req: {
            get: (name: string) => string | undefined;
            ip?: string | undefined;
            socket?: { remoteAddress?: string | undefined } | undefined;
        },
        fcmData: FcmData,
        additionalUpdateData?: Record<string, unknown>
    ): Promise<{
        session: SessionTokens;
        userResponse: UserResponse;
        twoFactorStatus: TwoFactorStatus;
        permissions: Record<string, unknown>;
    }> {
        await this.upsertFcmToken(user.id, fcmData);

        const { userAgent, ipAddress } = this.getRequestMeta(req);
        const session = await this.createLoginSession(user.id, userAgent, ipAddress, user, true);

        const updateData: Record<string, unknown> = {
            lastLoginAt: new Date(),
            loginAttempts: 0,
            inactiveTill: null,
            ...additionalUpdateData
        };
        await this.updateUserLogin(user.id, updateData);

        const userWithAvatar = await repository.findUserFullProfile(user.id);
        const avatarData = userWithAvatar?.avatar ? await this.generateAvatarUrl(userWithAvatar.avatar) : null;

        const userResponse = this.formatUserResponse(user, true, avatarData);
        const { twoFactorEnabled, mfaEnabled } = this.requires2FA(user);

        const permissions = extractPermissions(user);

        return { session, userResponse, twoFactorStatus: { twoFactorEnabled, mfaEnabled }, permissions };
    }

    async logoutSession(sessionId: bigint, token: string, userId: bigint, roleSlug: string): Promise<void> {
        await repository.revokeSession(sessionId);

        invalidateCachedSession(roleSlug, token, userId.toString()).catch(() => {});
    }

    async refreshSession(
        sessionId: bigint,
        oldToken: string,
        user: UserWithRole
    ): Promise<SessionTokens & { permissions: Record<string, unknown> }> {
        const roleSlug = user.role?.slug ?? ROLES.CUSTOMER;
        const { token, tokenExpiry, keys } = generateTokenPair({ roleSlug });
        const expiresAt = calculateSessionExpiry();
        const permissions = extractPermissions(user);

        await repository.refreshSession(sessionId, token, expiresAt);

        invalidateCachedSession(roleSlug, oldToken, user.id.toString()).catch(() => {});

        const cacheable = toCacheableSession(sessionId, token, expiresAt, user, permissions);
        setCachedSession(roleSlug, token, cacheable).catch(() => {});

        return { token, token_expiry: tokenExpiry, keys, permissions };
    }

    async revokeAllUserSessions(userId: bigint): Promise<void> {
        await repository.revokeAllUserSessions(userId);

        invalidateAllUserSessions(userId).catch(() => {});
    }

    async upsertFcmToken(userId: bigint, data: FcmData): Promise<void> {
        if (!data.fcm_token || !data.identifier) return;

        await repository.upsertFcmToken(
            userId,
            data.fcm_token,
            data.identifier,
            getPlatformValue(data.platform),
            data.device || {}
        );
    }

    verifyPassword(password: string, hash: string, salt: string): boolean {
        return verifyPwd(password, hash, salt);
    }

    async createPasswordResetToken(userId: bigint, email: string): Promise<string> {
        const token = generateRandomString(32);
        const expiresAt = new Date(Date.now() + AUTH.PASSWORD_RESET_EXPIRY_MS);

        await repository.createPasswordResetToken(userId, token, email, expiresAt);

        return token;
    }

    async findPasswordResetToken(token: string) {
        return repository.findMagicTokenByToken(token);
    }

    async resetPassword(userId: bigint, password: string, tokenId: bigint): Promise<void> {
        const salt = generateSalt();
        const hashedPassword = hashPassword(password, salt);

        await repository.resetPassword(userId, hashedPassword, salt, tokenId);

        invalidateAllUserSessions(userId).catch(() => {});
    }

    requires2FA(user: UserWithRole): TwoFactorStatus & { requiresVerification: boolean } {
        const twoFactorEnabled = user.otpAuth ?? false;
        const mfaEnabled = user.mfaEnabled ?? false;
        return {
            twoFactorEnabled,
            mfaEnabled,
            requiresVerification: twoFactorEnabled || mfaEnabled
        };
    }

    verifyCode(verification: { phoneCode: number | null; emailCode: number | null }, providedCode: string): boolean {
        const code = parseInt(providedCode, 10);
        return verification.phoneCode === code || verification.emailCode === code;
    }
}

export default new AuthService();
