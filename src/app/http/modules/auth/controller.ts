/**
 * Auth Controller
 * Handles authentication endpoints
 */

import type { Request, Response } from 'express';
import { CodeVerificationPurpose } from '@database/prisma';

// Core imports
import { ERROR_CODES, AUTH } from '@core/constants';
import { cleanPhoneNumber } from '@core/utils';
import { createLogger } from '@services/index';
import { AuthenticatedRequest } from '@core/types';
import { generateViewUrl, STORAGE_BUCKETS } from '@services/storage';

// Module imports
import { Controller } from '@http/controllers/controller';
import service from './service';
import type {
    SendOtpDto,
    VerifyOtpDto,
    ResendOtpDto,
    PasswordLoginDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    UserWithRole
} from './types';
import {
    sendOtpRules,
    verifyOtpRules,
    resendOtpRules,
    passwordLoginRules,
    forgotPasswordRules,
    resetPasswordRules
} from './validation';
import { errors, checkAccountStatus, buildLoginResponse2FARequired, buildLoginResponseAuthenticated } from './helpers';
import environment from '@config/environment.config';

const { isDev } = environment.basic;

const log = createLogger('auth');

const VERIFICATION_PURPOSE_MAP: Record<string, CodeVerificationPurpose> = {
    otp: CodeVerificationPurpose.phone_auth,
    '2fa': CodeVerificationPurpose.two_factor_auth,
    mfa: CodeVerificationPurpose.mfa_auth,
    email: CodeVerificationPurpose.email_verify
};

/** Types that complete 2FA/MFA login flow (don't create new sessions) */
const TWO_FACTOR_TYPES = ['2fa', 'mfa'];

export class AuthController extends Controller {
    constructor() {
        super();
    }

    // POST /auth/phone - Send OTP to phone, creates user if not exists
    public sendOTP = async (req: Request, res: Response): Promise<Response | void> => {
        const data = await this.validate<SendOtpDto>(req, res, sendOtpRules);
        if (!data) return;

        const phone = cleanPhoneNumber(data.phone);
        const countryCode = cleanPhoneNumber(data.country_code);

        let user = await service.findUserByPhone(countryCode, phone);

        if (!user) {
            const customerRole = await service.getCustomerRole();
            if (!customerRole) {
                log.error('Customer role not found in database');
                return errors.serverError(res, 'System configuration error');
            }

            user = await service.createUser(countryCode, phone, customerRole.id);
            log.info('New user created', { userId: user.id.toString(), phone });
        }

        if (checkAccountStatus(user, res)) return;

        const { reference, expiresIn } = await service.createVerification(user.id, CodeVerificationPurpose.phone_auth);
        log.info('OTP generated', { userId: user.id.toString(), reference });

        return this.sendSuccessResponse(
            res,
            {
                reference,
                expires_in: expiresIn,
                ...(isDev && { otp: AUTH.DEV_OTP_CODE })
            },
            'OTP sent successfully',
            200
        );
    };

    // POST /auth/verify/:type - Verify OTP/2FA/MFA and create/complete session
    // Types: otp (phone login), 2fa (two-factor auth), mfa (authenticator), email (email verify)
    public verifyOTP = async (req: Request, res: Response): Promise<Response | void> => {
        const type = String(req.params['type'] || '');
        const purpose = VERIFICATION_PURPOSE_MAP[type];

        if (!purpose) {
            return errors.validation(res, { type: 'Invalid verification type' }, 'Invalid verification type');
        }

        const data = await this.validate<VerifyOtpDto>(req, res, verifyOtpRules);
        if (!data) return;

        const verification = await service.findVerification(data.reference);
        if (!verification) {
            return errors.invalidCredentials(res, { reference: 'Invalid reference' });
        }

        if (verification.expiredAt < new Date()) {
            await service.deleteVerification(verification.id);
            return errors.tokenExpired(res, 'code');
        }

        if (verification.purpose !== purpose) {
            return errors.validation(res, { type: 'Verification type mismatch' }, 'Invalid type for reference');
        }

        const { user } = verification;
        if (!user) {
            return errors.notFound(res, 'message', 'User not found');
        }

        // Verification currently supports OTP code validation.
        // Pending integration: validate MFA flow using TOTP and user.mfaSecret.
        const isValidCode = service.verifyCode(verification, data.code);

        if (!isValidCode) {
            return this.sendErrorResponse(
                res,
                { code: 'Invalid verification code' },
                ERROR_CODES.INVALID_2FA_CODE,
                'Invalid verification code',
                400
            );
        }

        // Build additional update data based on verification type
        const additionalUpdateData: Record<string, unknown> = {};
        if (purpose === CodeVerificationPurpose.phone_auth) {
            additionalUpdateData['phoneVerifiedAt'] = new Date();
        } else if (purpose === CodeVerificationPurpose.email_verify) {
            additionalUpdateData['emailVerifiedAt'] = new Date();
        }

        // Complete login and cleanup verification
        await service.deleteVerification(verification.id);
        const { session, userResponse, twoFactorStatus, permissions } = await service.completeLogin(
            user as UserWithRole,
            req,
            data,
            additionalUpdateData
        );

        const is2FAFlow = TWO_FACTOR_TYPES.includes(type);
        log.info(is2FAFlow ? 'User completed 2FA verification' : 'User logged in via OTP', {
            userId: user.id.toString(),
            type
        });

        return this.sendSuccessResponse(
            res,
            buildLoginResponseAuthenticated(userResponse, user.verified, session, twoFactorStatus, permissions),
            is2FAFlow ? 'Verification successful' : 'Login successful',
            200
        );
    };

    // POST /auth/otp/resend - Resend OTP with rate limiting
    public resendOTP = async (req: Request, res: Response): Promise<Response | void> => {
        const data = await this.validate<ResendOtpDto>(req, res, resendOtpRules);
        if (!data) return;

        const verification = await service.findVerification(data.reference);
        if (!verification) {
            return errors.notFound(res, 'reference', 'Invalid reference');
        }

        const result = await service.resendOtp(verification);

        if (!result.success) {
            const msg = result.error === 'max_attempts' ? 'Maximum resend attempts exceeded' : 'Please wait 30 seconds';
            return errors.tooMany(res, msg);
        }

        log.info('OTP resent', { reference: data.reference });

        return this.sendSuccessResponse(
            res,
            {
                reference: data.reference,
                expires_in: AUTH.OTP_EXPIRY_MINUTES * 60,
                attempts_remaining: result.attemptsRemaining,
                ...(isDev && { otp: AUTH.DEV_OTP_CODE })
            },
            'OTP resent',
            200
        );
    };

    // POST /auth/login - Email + password authentication
    public passwordLogin = async (req: Request, res: Response): Promise<Response | void> => {
        const data = await this.validate<PasswordLoginDto>(req, res, passwordLoginRules);
        if (!data) return;

        const user = await service.findUserByEmail(data.email);
        if (!user) {
            return errors.invalidCredentials(res);
        }

        if (!user.role?.passwordRequired) {
            return errors.permissionDenied(res, 'Password login not available. Use OTP.');
        }

        if (checkAccountStatus(user, res)) return;

        const activePassword = user.passwords[0];
        if (!activePassword) {
            return errors.invalidCredentials(res, { message: 'Password not set. Contact support.' });
        }

        if (!service.verifyPassword(data.password, activePassword.password, activePassword.salt)) {
            const { newAttempts, isLocked: locked } = await service.incrementLoginAttempts(
                user.id,
                user.loginAttempts,
                AUTH.MAX_LOGIN_ATTEMPTS,
                AUTH.LOCKOUT_MINUTES
            );

            if (locked) {
                log.warn('Account locked due to failed attempts', { userId: user.id.toString() });
            }

            return errors.invalidCredentials(res, { attempts_remaining: AUTH.MAX_LOGIN_ATTEMPTS - newAttempts });
        }

        // Check if 2FA/MFA is required
        const { twoFactorEnabled, mfaEnabled, requiresVerification } = service.requires2FA(
            user as unknown as UserWithRole
        );

        if (requiresVerification) {
            // Create verification record for 2FA/MFA
            // Priority: MFA (authenticator) > 2FA (OTP via email/phone)
            const purpose = mfaEnabled ? CodeVerificationPurpose.mfa_auth : CodeVerificationPurpose.two_factor_auth;
            const { reference, code, expiresIn } = await service.createVerification(user.id, purpose);

            // If 2FA (not MFA), send OTP via email/phone
            if (!mfaEnabled && twoFactorEnabled) {
                log.info('2FA OTP generated for login', { userId: user.id.toString(), reference });
                // Pending integration: dispatch 2FA OTP via notification provider (email/SMS).
                if (isDev) {
                    log.debug('2FA OTP code', { code });
                }
            } else {
                log.info('MFA verification required', { userId: user.id.toString(), reference });
            }

            return this.sendSuccessResponse(
                res,
                buildLoginResponse2FARequired({ twoFactorEnabled, mfaEnabled }, reference, expiresIn),
                mfaEnabled ? 'MFA verification required' : '2FA verification required',
                200
            );
        }

        // No 2FA/MFA required - complete login directly
        const { session, userResponse, twoFactorStatus, permissions } = await service.completeLogin(
            user as unknown as UserWithRole,
            req,
            data
        );

        log.info('User logged in via password', { userId: user.id.toString() });

        return this.sendSuccessResponse(
            res,
            buildLoginResponseAuthenticated(userResponse, user.verified, session, twoFactorStatus, permissions),
            'Login successful',
            200
        );
    };

    // POST /auth/password/forgot - Request password reset email
    public forgotPassword = async (req: Request, res: Response): Promise<Response | void> => {
        const data = await this.validate<ForgotPasswordDto>(req, res, forgotPasswordRules);
        if (!data) return;

        const user = await service.findUserByEmail(data.email);
        const successMsg = { message: 'If the email exists, a reset link has been sent.' };

        // Always return success to prevent email enumeration
        if (!user || !user.role?.passwordRequired) {
            return this.sendSuccessResponse(res, successMsg, 'Password reset requested', 200);
        }

        const token = await service.createPasswordResetToken(user.id, user.email);
        log.info('Password reset requested', { userId: user.id.toString() });

        // Pending integration: dispatch password reset email via notification provider.

        return this.sendSuccessResponse(
            res,
            {
                ...successMsg,
                ...(isDev && { reset_token: token })
            },
            'Password reset requested',
            200
        );
    };

    // POST /auth/password/reset - Reset password with token
    public resetPassword = async (req: Request, res: Response): Promise<Response | void> => {
        const data = await this.validate<ResetPasswordDto>(req, res, resetPasswordRules);
        if (!data) return;

        if (data.password !== data.password_confirmation) {
            return errors.validation(
                res,
                { password_confirmation: 'Passwords do not match' },
                'Passwords do not match'
            );
        }

        const magicToken = await service.findPasswordResetToken(data.token);

        if (!magicToken || magicToken.purpose !== 'password_reset') {
            return this.sendErrorResponse(
                res,
                { token: 'Invalid token' },
                ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN,
                'Invalid token',
                400
            );
        }

        if (magicToken.used || magicToken.expiresAt < new Date()) {
            return errors.tokenExpired(res);
        }

        if (!magicToken.userId) {
            return errors.notFound(res, 'token', 'User not found');
        }

        await service.resetPassword(magicToken.userId, data.password, magicToken.id);
        log.info('Password reset completed', { userId: magicToken.userId.toString() });

        return this.sendSuccessResponse(
            res,
            { message: 'Password reset successful. Please login.' },
            'Password reset successful',
            200
        );
    };

    // GET /auth/me - Get current authenticated user (returns all user attributes)
    public me = async (req: Request, res: Response): Promise<Response | void> => {
        const { user } = req as AuthenticatedRequest;

        if (!user) {
            return errors.notFound(res, 'message', 'User not found');
        }

        const fullUser = await service.findUserFullProfile(user.id);
        if (!fullUser) {
            return errors.notFound(res, 'message', 'User not found');
        }

        // Generate avatar URL if avatar exists
        let avatarUrl: string | null = null;
        if (fullUser.avatar && fullUser.avatar.status === 'uploaded') {
            try {
                const bucket = fullUser.avatar.isPublic ? STORAGE_BUCKETS.PUBLIC : STORAGE_BUCKETS.DOCUMENTS;
                const viewUrlResult = await generateViewUrl(fullUser.avatar.reference, bucket);
                avatarUrl = viewUrlResult.viewUrl;
            } catch {
                // If URL generation fails, leave as null
            }
        }

        // Return all user attributes from the database
        return this.sendSuccessResponse(
            res,
            {
                user: {
                    id: fullUser.id.toString(),
                    first_name: fullUser.firstName,
                    last_name: fullUser.lastName,
                    email: fullUser.email,
                    phone: fullUser.phone,
                    country_code: fullUser.countryCode,
                    avatar_id: fullUser.avatarId?.toString() ?? null,
                    avatar: fullUser.avatar
                        ? {
                              id: fullUser.avatar.id.toString(),
                              reference: fullUser.avatar.reference,
                              path: fullUser.avatar.path,
                              thumbnail: fullUser.avatar.thumbnail,
                              bucket: fullUser.avatar.bucket,
                              is_public: fullUser.avatar.isPublic,
                              url: avatarUrl
                          }
                        : null,
                    latitude: fullUser.latitude ? Number(fullUser.latitude) : null,
                    longitude: fullUser.longitude ? Number(fullUser.longitude) : null,
                    mfa_enabled: fullUser.mfaEnabled,
                    otp_auth: fullUser.otpAuth,
                    status: fullUser.status,
                    remarks: fullUser.remarks,
                    last_login_at: fullUser.lastLoginAt?.toISOString() ?? null,
                    verified: fullUser.verified,
                    email_verified: Boolean(fullUser.emailVerifiedAt),
                    email_verified_at: fullUser.emailVerifiedAt?.toISOString() ?? null,
                    phone_verified: Boolean(fullUser.phoneVerifiedAt),
                    phone_verified_at: fullUser.phoneVerifiedAt?.toISOString() ?? null,
                    created_at: fullUser.createdAt.toISOString(),
                    updated_at: fullUser.updatedAt.toISOString(),
                    role: fullUser.role
                        ? {
                              id: fullUser.role.id.toString(),
                              name: fullUser.role.name,
                              slug: fullUser.role.slug,
                              for_app: fullUser.role.forApp,
                              password_required: fullUser.role.passwordRequired
                          }
                        : null
                }
            },
            'User fetched',
            200
        );
    };

    // POST /auth/logout - Invalidate current session
    public logout = async (req: Request, res: Response): Promise<Response | void> => {
        const { session, user } = req as AuthenticatedRequest;

        if (!session || !user) {
            return errors.notFound(res, 'message', 'Session not found');
        }

        const roleSlug = user.role?.slug ?? 'customer';
        await service.logoutSession(session.id, session.token, user.id, roleSlug);
        log.info('User logged out', { userId: user.id.toString() });

        return this.sendSuccessResponse(res, { message: 'Logged out successfully' }, 'Logout successful', 200);
    };

    // POST /auth/refresh - Refresh access token using refresh token
    public refreshToken = async (req: Request, res: Response): Promise<Response | void> => {
        const { session, user } = req as AuthenticatedRequest;

        if (!session || !user) {
            return errors.sessionInvalid(res);
        }

        // Fetch user with full profile including avatar
        const fullUser = await service.findUserFullProfile(user.id);
        if (!fullUser) {
            return errors.notFound(res, 'message', 'User not found');
        }

        const newSession = await service.refreshSession(session.id, session.token, fullUser as UserWithRole);

        // Generate avatar URL if avatar exists
        const avatarData = fullUser.avatar ? await service.generateAvatarUrl(fullUser.avatar) : null;

        const userResponse = service.formatUserResponse(fullUser as UserWithRole, false, avatarData);

        return this.sendSuccessResponse(
            res,
            {
                user: userResponse,
                tokens: newSession.keys,
                token_expiry: newSession.token_expiry,
                permissions: newSession.permissions
            },
            'Token refreshed',
            200
        );
    };

    // PUT /auth/me/avatar - Update user avatar
    public updateAvatar = async (req: Request, res: Response): Promise<Response | void> => {
        const { user } = req as AuthenticatedRequest;

        if (!user) {
            return errors.notFound(res, 'message', 'User not found');
        }

        const { avatar_id } = req.body as { avatar_id: string | null };

        // Validate avatar_id if provided
        let avatarIdBigInt: bigint | null = null;
        if (avatar_id !== null && avatar_id !== undefined) {
            try {
                avatarIdBigInt = BigInt(avatar_id);
            } catch {
                return errors.validation(res, { avatar_id: 'Invalid avatar ID' });
            }

            // Verify the gallery exists and belongs to the user (or user has permission)
            const gallery = await service.verifyGalleryOwnership(avatarIdBigInt, user.id);
            if (!gallery) {
                return errors.notFound(res, 'avatar_id', 'Gallery not found or not accessible');
            }
        }

        // Update user avatar
        const updatedUser = await service.updateUserAvatar(user.id, avatarIdBigInt);
        if (!updatedUser) {
            return errors.notFound(res, 'message', 'User not found');
        }

        log.info('User avatar updated', { userId: user.id.toString(), avatarId: avatar_id });

        // Generate avatar URL if avatar exists
        let avatarUrl: string | null = null;
        if (updatedUser.avatar && updatedUser.avatar.status === 'uploaded') {
            try {
                const bucket = updatedUser.avatar.isPublic ? STORAGE_BUCKETS.PUBLIC : STORAGE_BUCKETS.DOCUMENTS;
                const viewUrlResult = await generateViewUrl(updatedUser.avatar.reference, bucket);
                avatarUrl = viewUrlResult.viewUrl;
            } catch {
                // If URL generation fails, leave as null
            }
        }

        return this.sendSuccessResponse(
            res,
            {
                avatar_id: updatedUser.avatarId?.toString() ?? null,
                avatar: updatedUser.avatar
                    ? {
                          id: updatedUser.avatar.id.toString(),
                          reference: updatedUser.avatar.reference,
                          path: updatedUser.avatar.path,
                          thumbnail: updatedUser.avatar.thumbnail,
                          bucket: updatedUser.avatar.bucket,
                          is_public: updatedUser.avatar.isPublic,
                          url: avatarUrl
                      }
                    : null
            },
            'Avatar updated',
            200
        );
    };
}

export default new AuthController();
