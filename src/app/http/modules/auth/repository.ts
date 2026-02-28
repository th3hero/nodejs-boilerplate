/**
 * Auth Module Repository
 * Database operations for authentication
 */

import { CodeVerificationPurpose, GalleryStatus, MagicTokenPurpose, Platform } from '@database/prisma';
import { BaseRepository } from '@core/database/base.repository';
import environment from '@config/environment.config';
import { UserWithRole, UserWithPassword, VerificationWithUser, UserFullProfile } from './types';

// ============================================================================
// Include Configurations
// ============================================================================

const ROLE_WITH_PERMISSIONS_INCLUDE = {
    permission: { select: { permissions: true } }
} as const;

const USER_WITH_ROLE_INCLUDE = {
    role: { include: ROLE_WITH_PERMISSIONS_INCLUDE }
} as const;

const USER_FULL_PROFILE_INCLUDE = {
    role: { include: ROLE_WITH_PERMISSIONS_INCLUDE },
    avatar: true
} as const;

const USER_WITH_PASSWORD_INCLUDE = {
    role: { include: ROLE_WITH_PERMISSIONS_INCLUDE },
    passwords: {
        where: { status: true, expired: false },
        orderBy: { createdAt: 'desc' as const },
        take: 1
    }
} as const;

const VERIFICATION_WITH_USER_INCLUDE = {
    user: { include: USER_WITH_ROLE_INCLUDE }
} as const;

const PLACEHOLDER_EMAIL_SUFFIX = environment.auth.placeholderEmailSuffix;

// ============================================================================
// Repository Class
// ============================================================================

export class AuthRepository extends BaseRepository {
    // ========================================================================
    // User Operations
    // ========================================================================

    async findUserByPhone(countryCode: string, phone: string): Promise<UserWithRole | null> {
        return this.prisma.user.findFirst({
            where: { countryCode, phone },
            include: USER_WITH_ROLE_INCLUDE
        }) as Promise<UserWithRole | null>;
    }

    async findUserByEmail(email: string): Promise<UserWithPassword | null> {
        return this.prisma.user.findFirst({
            where: {
                email: email.toLowerCase(),
                NOT: {
                    email: {
                        endsWith: PLACEHOLDER_EMAIL_SUFFIX
                    }
                }
            },
            include: USER_WITH_PASSWORD_INCLUDE
        }) as Promise<UserWithPassword | null>;
    }

    async findUserById(id: bigint): Promise<UserWithRole | null> {
        return this.prisma.user.findUnique({
            where: { id },
            include: USER_WITH_ROLE_INCLUDE
        }) as Promise<UserWithRole | null>;
    }

    async findUserFullProfile(id: bigint): Promise<UserFullProfile | null> {
        return this.prisma.user.findUnique({
            where: { id },
            include: USER_FULL_PROFILE_INCLUDE
        }) as Promise<UserFullProfile | null>;
    }

    async updateUserAvatar(userId: bigint, avatarId: bigint | null): Promise<UserFullProfile | null> {
        return this.prisma.user.update({
            where: { id: userId },
            data: { avatarId },
            include: USER_FULL_PROFILE_INCLUDE
        }) as Promise<UserFullProfile | null>;
    }

    async findGalleryForUser(galleryId: bigint, userId: bigint) {
        return this.prisma.gallery.findFirst({
            where: {
                id: galleryId,
                uploadedById: userId,
                status: GalleryStatus.uploaded
            }
        });
    }

    async createUser(countryCode: string, phone: string, roleId: bigint): Promise<UserWithRole> {
        return this.prisma.user.create({
            data: {
                firstName: '',
                lastName: '',
                email: `${countryCode}${phone}${PLACEHOLDER_EMAIL_SUFFIX}`,
                countryCode,
                phone,
                roleId
            },
            include: USER_WITH_ROLE_INCLUDE
        }) as Promise<UserWithRole>;
    }

    async updateUser(userId: bigint, data: Record<string, unknown>): Promise<UserWithRole> {
        return this.prisma.user.update({
            where: { id: userId },
            data,
            include: USER_WITH_ROLE_INCLUDE
        }) as Promise<UserWithRole>;
    }

    async incrementLoginAttempts(
        userId: bigint,
        currentAttempts: number,
        maxAttempts: number,
        lockoutMinutes: number
    ): Promise<{ newAttempts: number; isLocked: boolean }> {
        const newAttempts = currentAttempts + 1;
        const isLocked = newAttempts >= maxAttempts;

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                loginAttempts: newAttempts,
                ...(isLocked && {
                    inactiveTill: new Date(Date.now() + lockoutMinutes * 60 * 1000)
                })
            }
        });

        return { newAttempts, isLocked };
    }

    // ========================================================================
    // Role Operations
    // ========================================================================

    async findRoleBySlug(slug: string) {
        return this.prisma.role.findUnique({
            where: { slug }
        });
    }

    // ========================================================================
    // Verification (OTP) Operations
    // ========================================================================

    async createVerification(
        userId: bigint,
        reference: string,
        purpose: CodeVerificationPurpose,
        code: number,
        expiresAt: Date
    ) {
        return this.prisma.codeVerification.create({
            data: {
                userId,
                reference,
                purpose,
                phoneCode: code,
                expiredAt: expiresAt
            }
        });
    }

    async findVerificationByReference(reference: string): Promise<VerificationWithUser | null> {
        return this.prisma.codeVerification.findUnique({
            where: { reference },
            include: VERIFICATION_WITH_USER_INCLUDE
        }) as Promise<VerificationWithUser | null>;
    }

    async updateVerificationForResend(id: bigint, code: number, expiresAt: Date, resendAttempts: number) {
        return this.prisma.codeVerification.update({
            where: { id },
            data: {
                phoneCode: code,
                expiredAt: expiresAt,
                resendAttempts,
                lastResendAt: new Date()
            }
        });
    }

    async deleteVerification(id: bigint) {
        return this.prisma.codeVerification.delete({
            where: { id }
        });
    }

    // ========================================================================
    // Session Operations
    // ========================================================================

    async createSession(
        userId: bigint,
        token: string,
        userAgent: string,
        ipAddress: string,
        expiresAt: Date,
        verified = true
    ) {
        return this.prisma.loginSession.create({
            data: {
                userId,
                token,
                userAgent: { raw: userAgent },
                ipAddress,
                expiresAt,
                verified
            }
        });
    }

    async revokeSession(sessionId: bigint) {
        return this.prisma.loginSession.update({
            where: { id: sessionId },
            data: {
                status: false,
                revokedAt: new Date()
            }
        });
    }

    async refreshSession(sessionId: bigint, newToken: string, expiresAt: Date) {
        return this.prisma.loginSession.update({
            where: { id: sessionId },
            data: {
                token: newToken,
                expiresAt,
                lastUsed: new Date()
            }
        });
    }

    async revokeAllUserSessions(userId: bigint) {
        return this.prisma.loginSession.updateMany({
            where: { userId, status: true },
            data: {
                status: false,
                revokedAt: new Date()
            }
        });
    }

    // ========================================================================
    // FCM Token Operations
    // ========================================================================

    async upsertFcmToken(
        userId: bigint,
        fcmToken: string,
        identifier: string,
        platform: Platform,
        device: Record<string, unknown>
    ) {
        const deviceJson = device as Parameters<typeof this.prisma.fcmToken.create>[0]['data']['device'];

        return this.prisma.fcmToken.upsert({
            where: { identifier },
            update: {
                token: fcmToken,
                platform,
                device: deviceJson,
                lastSeenAt: new Date(),
                status: true
            },
            create: {
                userId,
                token: fcmToken,
                identifier,
                platform,
                device: deviceJson,
                lastSeenAt: new Date()
            }
        });
    }

    // ========================================================================
    // Magic Token (Password Reset) Operations
    // ========================================================================

    async createPasswordResetToken(userId: bigint, token: string, email: string, expiresAt: Date) {
        return this.prisma.magicToken.create({
            data: {
                userId,
                token,
                email,
                purpose: MagicTokenPurpose.password_reset,
                expiresAt
            }
        });
    }

    async findMagicTokenByToken(token: string) {
        return this.prisma.magicToken.findUnique({
            where: { token }
        });
    }

    // ========================================================================
    // Transaction: Reset Password
    // ========================================================================

    async resetPassword(userId: bigint, hashedPassword: string, salt: string, tokenId: bigint) {
        return this.transaction(async tx => {
            await tx.password.updateMany({
                where: { userId, status: true },
                data: { status: false, expired: true, expiredAt: new Date() }
            });

            await tx.password.create({
                data: { userId, password: hashedPassword, salt }
            });

            await tx.magicToken.update({
                where: { id: tokenId },
                data: { used: true, usedAt: new Date() }
            });

            await tx.loginSession.updateMany({
                where: { userId, status: true },
                data: { status: false, revokedAt: new Date() }
            });
        });
    }
}

// ============================================================================
// Export Singleton
// ============================================================================

export default new AuthRepository();
