import { ERROR_CODES } from '@core/constants';
import type { DocsRouteContract } from '@/docs/types';
import { rulesToOpenApiSchema } from '@/docs/rule-schema';
import { authMiddlewareErrorResponses, errorEnvelope, jsonResponse, successEnvelope } from '@/docs/openapi.helpers';
import {
    forgotPasswordRules,
    passwordLoginRules,
    resendOtpRules,
    resetPasswordRules,
    sendOtpRules,
    verifyOtpRules
} from './validation';

const twoFactorStatusSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        two_factor_enabled: { type: 'boolean' },
        mfa_enabled: { type: 'boolean' }
    },
    required: ['two_factor_enabled', 'mfa_enabled']
};

const roleSchema = {
    type: 'object',
    nullable: true,
    additionalProperties: false,
    properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        for_app: { type: 'boolean' },
        password_required: { type: 'boolean' }
    }
};

const avatarSchema = {
    type: 'object',
    nullable: true,
    additionalProperties: false,
    properties: {
        id: { type: 'string' },
        reference: { type: 'string' },
        path: { type: 'string' },
        thumbnail: { type: 'string', nullable: true },
        bucket: { type: 'string' },
        is_public: { type: 'boolean' },
        url: { type: 'string', nullable: true }
    }
};

const userSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        id: { type: 'string' },
        first_name: { type: 'string', nullable: true },
        last_name: { type: 'string', nullable: true },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', nullable: true },
        country_code: { type: 'string', nullable: true },
        role: roleSchema,
        avatar: avatarSchema,
        is_verified: { type: 'boolean' }
    },
    required: ['id', 'email', 'is_verified']
};

const tokenSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        auth: { type: 'string' },
        refresh: { type: 'string' }
    },
    required: ['auth', 'refresh']
};

const commonAuthSuccessSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        ...twoFactorStatusSchema.properties,
        user: userSchema,
        tokens: tokenSchema,
        token_expiry: { type: 'string', format: 'date-time' },
        permissions: { type: 'object', additionalProperties: true }
    },
    required: ['two_factor_enabled', 'mfa_enabled', 'user', 'tokens', 'token_expiry', 'permissions']
};

const verificationRequiredSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        ...twoFactorStatusSchema.properties,
        reference: { type: 'string' },
        expires_in: { type: 'integer' }
    },
    required: ['two_factor_enabled', 'mfa_enabled', 'reference', 'expires_in']
};

const authErrorSchema = errorEnvelope('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS, {
    type: 'object',
    additionalProperties: true
});

export const authDocsContracts: DocsRouteContract[] = [
    {
        method: 'post',
        path: '/auth/phone',
        summary: 'Send login OTP to phone',
        description: 'Creates customer user if phone is not registered and sends OTP reference.',
        operationId: 'auth_sendPhoneOtp',
        tags: ['Auth'],
        requestBody: {
            required: true,
            description: 'Phone details for OTP login',
            schema: rulesToOpenApiSchema(sendOtpRules)
        },
        responses: {
            '200': jsonResponse(
                'OTP generated successfully',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            reference: { type: 'string' },
                            expires_in: { type: 'integer' },
                            otp: { type: 'string', nullable: true, description: 'Available only in development' }
                        },
                        required: ['reference', 'expires_in']
                    },
                    'OTP sent successfully'
                )
            ),
            '422': jsonResponse(
                'Validation error',
                errorEnvelope('Input validation failed', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            '500': jsonResponse(
                'System configuration error',
                errorEnvelope('System configuration error', ERROR_CODES.INTERNAL_SERVER_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'post',
        path: '/auth/verify/{type}',
        summary: 'Verify OTP / 2FA / MFA code',
        description: 'Verifies code and completes login/session flow.',
        operationId: 'auth_verifyOtp',
        tags: ['Auth'],
        pathParameters: [
            {
                in: 'path',
                name: 'type',
                required: true,
                schema: { type: 'string', enum: ['otp', '2fa', 'mfa', 'email'] },
                description: 'Verification purpose type'
            }
        ],
        requestBody: {
            required: true,
            description: 'Verification payload',
            schema: rulesToOpenApiSchema(verifyOtpRules)
        },
        responses: {
            '200': jsonResponse('Verification successful', successEnvelope(commonAuthSuccessSchema, 'Login successful')),
            '400': jsonResponse(
                'Invalid or expired token/code',
                errorEnvelope('Invalid verification code', ERROR_CODES.INVALID_2FA_CODE, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            '401': jsonResponse('Invalid credentials', authErrorSchema),
            '404': jsonResponse(
                'User not found',
                errorEnvelope('User not found', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            '422': jsonResponse(
                'Validation error',
                errorEnvelope('Validation failed', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'post',
        path: '/auth/otp/resend',
        summary: 'Resend verification OTP',
        description: 'Resends OTP using existing reference. Protected by resend limits.',
        operationId: 'auth_resendOtp',
        tags: ['Auth'],
        requestBody: {
            required: true,
            description: 'Reference returned by previous OTP request',
            schema: rulesToOpenApiSchema(resendOtpRules)
        },
        responses: {
            '200': jsonResponse(
                'OTP resent',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            reference: { type: 'string' },
                            expires_in: { type: 'integer' },
                            attempts_remaining: { type: 'integer' },
                            otp: { type: 'string', nullable: true }
                        },
                        required: ['reference', 'expires_in', 'attempts_remaining']
                    },
                    'OTP resent'
                )
            ),
            '404': jsonResponse(
                'Reference not found',
                errorEnvelope('Invalid reference', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            '429': jsonResponse(
                'Too many attempts',
                errorEnvelope('Too many requests', ERROR_CODES.TOO_MANY_ATTEMPTS, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'post',
        path: '/auth/login',
        summary: 'Email/password login',
        description: 'Authenticates user via password. Can return 2FA/MFA verification response.',
        operationId: 'auth_passwordLogin',
        tags: ['Auth'],
        requestBody: {
            required: true,
            description: 'Credentials and optional device metadata',
            schema: rulesToOpenApiSchema(passwordLoginRules)
        },
        responses: {
            '200': jsonResponse(
                'Login response',
                successEnvelope(
                    {
                        oneOf: [commonAuthSuccessSchema, verificationRequiredSchema]
                    },
                    'Login successful'
                )
            ),
            '401': jsonResponse('Invalid credentials or session', authErrorSchema),
            '403': jsonResponse(
                'Permission denied / account suspended',
                errorEnvelope('Permission denied', ERROR_CODES.PERMISSION_DENIED, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            '423': jsonResponse(
                'Account locked',
                errorEnvelope('Account locked', ERROR_CODES.ACCOUNT_LOCKED, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            '422': jsonResponse(
                'Validation error',
                errorEnvelope('Input validation failed', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'post',
        path: '/auth/password/forgot',
        summary: 'Request password reset',
        description: 'Always returns success message to avoid user enumeration.',
        operationId: 'auth_forgotPassword',
        tags: ['Auth'],
        requestBody: {
            required: true,
            description: 'Email for reset request',
            schema: rulesToOpenApiSchema(forgotPasswordRules)
        },
        responses: {
            '200': jsonResponse(
                'Password reset request accepted',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            message: { type: 'string' },
                            reset_token: { type: 'string', nullable: true, description: 'Available only in development' }
                        },
                        required: ['message']
                    },
                    'Password reset requested'
                )
            ),
            '422': jsonResponse(
                'Validation error',
                errorEnvelope('Input validation failed', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'post',
        path: '/auth/password/reset',
        summary: 'Reset password with token',
        description: 'Consumes password reset token and updates password.',
        operationId: 'auth_resetPassword',
        tags: ['Auth'],
        requestBody: {
            required: true,
            description: 'Reset token and new password',
            schema: rulesToOpenApiSchema(resetPasswordRules)
        },
        responses: {
            '200': jsonResponse(
                'Password updated',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            message: { type: 'string' }
                        },
                        required: ['message']
                    },
                    'Password reset successful'
                )
            ),
            '400': jsonResponse(
                'Invalid token',
                errorEnvelope('Invalid token', ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            '404': jsonResponse(
                'User not found',
                errorEnvelope('User not found', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            '422': jsonResponse(
                'Validation error',
                errorEnvelope('Passwords do not match', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'get',
        path: '/auth/me',
        summary: 'Get authenticated user profile',
        description: 'Returns the complete profile of current authenticated user.',
        operationId: 'auth_getMe',
        tags: ['Auth'],
        requiresAuth: true,
        responses: {
            '200': jsonResponse(
                'Current user profile',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            user: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    ...userSchema.properties,
                                    avatar_id: { type: 'string', nullable: true },
                                    latitude: { type: 'number', nullable: true },
                                    longitude: { type: 'number', nullable: true },
                                    mfa_enabled: { type: 'boolean' },
                                    otp_auth: { type: 'boolean' },
                                    status: { type: 'string' },
                                    remarks: { type: 'string', nullable: true },
                                    last_login_at: { type: 'string', format: 'date-time', nullable: true },
                                    verified: { type: 'boolean' },
                                    email_verified: { type: 'boolean' },
                                    email_verified_at: { type: 'string', format: 'date-time', nullable: true },
                                    phone_verified: { type: 'boolean' },
                                    phone_verified_at: { type: 'string', format: 'date-time', nullable: true },
                                    created_at: { type: 'string', format: 'date-time' },
                                    updated_at: { type: 'string', format: 'date-time' }
                                },
                                required: ['id', 'email', 'status', 'created_at', 'updated_at']
                            }
                        },
                        required: ['user']
                    },
                    'User fetched'
                )
            ),
            ...authMiddlewareErrorResponses(),
            '404': jsonResponse(
                'User not found',
                errorEnvelope('User not found', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'put',
        path: '/auth/me/avatar',
        summary: 'Update user avatar reference',
        description: 'Sets or clears current user avatar using gallery reference.',
        operationId: 'auth_updateAvatar',
        tags: ['Auth'],
        requiresAuth: true,
        requestBody: {
            required: true,
            description: 'Avatar ID from gallery or null to remove',
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    avatar_id: {
                        type: 'string',
                        nullable: true
                    }
                },
                required: ['avatar_id']
            }
        },
        responses: {
            '200': jsonResponse(
                'Avatar updated',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            avatar_id: { type: 'string', nullable: true },
                            avatar: avatarSchema
                        },
                        required: ['avatar_id', 'avatar']
                    },
                    'Avatar updated'
                )
            ),
            ...authMiddlewareErrorResponses(),
            '404': jsonResponse(
                'User/gallery not found',
                errorEnvelope('Gallery not found or not accessible', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            '422': jsonResponse(
                'Validation error',
                errorEnvelope('Invalid avatar ID', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'post',
        path: '/auth/logout',
        summary: 'Logout current session',
        description: 'Invalidates authenticated session token.',
        operationId: 'auth_logout',
        tags: ['Auth'],
        requiresAuth: true,
        responses: {
            '200': jsonResponse(
                'Logout successful',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            message: { type: 'string' }
                        },
                        required: ['message']
                    },
                    'Logout successful'
                )
            ),
            ...authMiddlewareErrorResponses(),
            '404': jsonResponse(
                'Session not found',
                errorEnvelope('Session not found', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'post',
        path: '/auth/refresh',
        summary: 'Refresh access token',
        description: 'Rotates session and returns fresh auth/refresh tokens.',
        operationId: 'auth_refreshToken',
        tags: ['Auth'],
        requiresAuth: true,
        responses: {
            '200': jsonResponse('Token refreshed', successEnvelope(commonAuthSuccessSchema, 'Token refreshed')),
            ...authMiddlewareErrorResponses(),
            '404': jsonResponse(
                'User not found',
                errorEnvelope('User not found', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    }
];
