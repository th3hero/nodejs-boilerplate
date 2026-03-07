/**
 * JWT Service
 * Handles token generation and verification using RS256
 */

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { JWT, AUTH } from '@core/constants';
import { getProjectRoot } from '@core/utils/path.utils';

const projectRoot = getProjectRoot();

// Load RSA keys
const privateKey = fs.readFileSync(path.resolve(projectRoot, 'storage/keys/api/private.key'), 'utf8');
const publicKey = fs.readFileSync(path.resolve(projectRoot, 'storage/keys/api/public.key'), 'utf8');

// ============================================================================
// Types
// ============================================================================

export interface TokenPayload {
    /** Session token reference */
    t: string;
    /** Token mode: 0 = access, 1 = refresh */
    m: number;
    /** Role slug for cache key partitioning */
    r: string;
}

export interface TokenPair {
    auth: string;
    refresh: string;
}

export interface TokenResponse {
    /** Internal session token (stored in DB) */
    token: string;
    /** Access token expiry timestamp */
    tokenExpiry: Date;
    /** JWT token pair */
    keys: TokenPair;
}

// ============================================================================
// Token Generation
// ============================================================================

export interface GenerateTokenOptions {
    /** Role slug for cache key partitioning */
    roleSlug: string;
    /** Access token expiry (default: 15m) */
    expiresIn?: string;
    /** Refresh token expiry (default: 7d) */
    refreshExpiresIn?: string;
}

/**
 * Generate session token and JWT pair (access + refresh)
 */
export const generateTokenPair = (options: GenerateTokenOptions): TokenResponse => {
    const { roleSlug, expiresIn, refreshExpiresIn } = options;
    const token = crypto.randomBytes(AUTH.SESSION_TOKEN_BYTES).toString('hex');

    const accessExpiry = expiresIn ?? JWT.ACCESS_TOKEN_EXPIRY;
    const refreshExpiry = refreshExpiresIn ?? JWT.REFRESH_TOKEN_EXPIRY;

    // Parse expiry for response
    const minutes = parseInt(accessExpiry.replace(/[^0-9]/g, ''), 10) || 15;
    const tokenExpiry = new Date(Date.now() + minutes * 60 * 1000);

    const auth = jwt.sign({ t: token, m: JWT.MODE_ACCESS, r: roleSlug }, privateKey, {
        algorithm: JWT.ALGORITHM,
        expiresIn: accessExpiry
    } as SignOptions);

    const refresh = jwt.sign({ t: token, m: JWT.MODE_REFRESH, r: roleSlug }, privateKey, {
        algorithm: JWT.ALGORITHM,
        expiresIn: refreshExpiry
    } as SignOptions);

    return { token, tokenExpiry, keys: { auth, refresh } };
};

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Verify and decode a JWT token
 * @returns Decoded payload or null if invalid
 */
export const verifyToken = (token: string): TokenPayload | null => {
    try {
        return jwt.verify(token, publicKey, { algorithms: [JWT.ALGORITHM] }) as TokenPayload;
    } catch {
        return null;
    }
};
