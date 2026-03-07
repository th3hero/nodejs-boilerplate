/**
 * Password Service
 * Secure password hashing using PBKDF2 with pepper
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProjectRoot } from '@core/utils/path.utils';

const projectRoot = getProjectRoot();

// Read pepper/secret from key file (not stored in DB, adds extra layer of security)
const pepper = fs.readFileSync(path.resolve(projectRoot, 'storage/keys/encryption/private.key'), 'utf8');

// ============================================================================
// Configuration
// ============================================================================

const SALT_LENGTH = 32; // 32 bytes = 256 bits
const HASH_ITERATIONS = 100000; // PBKDF2 iterations (OWASP recommended minimum)
const HASH_KEY_LENGTH = 64; // 64 bytes = 512 bits
const HASH_ALGORITHM = 'sha512';

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate a cryptographically secure random salt
 * @returns Base64 encoded salt
 */
export const generateSalt = (): string => {
    return crypto.randomBytes(SALT_LENGTH).toString('base64');
};

/**
 * Hash a password with salt and pepper (one-way process)
 * Uses PBKDF2 which is resistant to brute-force attacks
 *
 * @param password - Plain text password
 * @param salt - Base64 encoded salt (unique per password)
 * @returns Base64 encoded hash
 */
export const hashPassword = (password: string, salt: string): string => {
    const saltBuffer = Buffer.from(salt, 'base64');

    // PBKDF2 with the user-specific salt
    const hash = crypto.pbkdf2Sync(password, saltBuffer, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM);

    // Combine with pepper (application-level secret)
    const combined = Buffer.concat([hash, Buffer.from(pepper, 'utf8')]);

    // Final hash
    const finalHash = crypto.createHash(HASH_ALGORITHM).update(combined).digest();

    return finalHash.toString('base64');
};

/**
 * Verify if a plain text password matches a hashed password
 * Uses timing-safe comparison to prevent timing attacks
 *
 * @param plainPassword - Plain text password to verify
 * @param hashedPassword - Base64 encoded hash from database
 * @param salt - Base64 encoded salt from database
 * @returns True if passwords match, false otherwise
 */
export const verifyPassword = (plainPassword: string, hashedPassword: string, salt: string): boolean => {
    try {
        const computedHash = hashPassword(plainPassword, salt);

        // Timing-safe comparison prevents timing attacks
        return crypto.timingSafeEqual(Buffer.from(computedHash, 'base64'), Buffer.from(hashedPassword, 'base64'));
    } catch {
        return false;
    }
};
