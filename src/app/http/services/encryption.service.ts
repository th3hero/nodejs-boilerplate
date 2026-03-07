/**
 * Encryption Service
 * RSA encryption for sensitive data (bank accounts, etc.)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProjectRoot } from '@core/utils/path.utils';

const projectRoot = getProjectRoot();

// Load RSA keys for data encryption (separate from JWT keys)
const publicKey = fs.readFileSync(path.resolve(projectRoot, 'storage/keys/encryption/public.key'), 'utf8');
const privateKey = fs.readFileSync(path.resolve(projectRoot, 'storage/keys/encryption/private.key'), 'utf8');

// ============================================================================
// RSA Encryption (for small data like account numbers)
// ============================================================================

/**
 * Encrypt content using RSA public key
 * Suitable for small pieces of sensitive data
 *
 * @param content - Plain text content to encrypt (max ~190 bytes for 2048-bit key)
 * @returns Encrypted content (base64 encoded)
 */
export const encrypt = (content: string): string => {
    const buffer = Buffer.from(content, 'utf8');
    const encrypted = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        buffer
    );
    return encrypted.toString('base64');
};

/**
 * Decrypt content using RSA private key
 *
 * @param encryptedContent - Encrypted content (base64 encoded)
 * @returns Decrypted content
 */
export const decrypt = (encryptedContent: string): string => {
    const buffer = Buffer.from(encryptedContent, 'base64');
    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        buffer
    );
    return decrypted.toString('utf8');
};
