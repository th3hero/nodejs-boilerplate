/**
 * Random Generation Utilities
 * Cryptographically secure random value generation
 */

import crypto from 'node:crypto';

/**
 * Generate a numeric OTP of specified length
 * Note: In development, use a fixed OTP from constants instead
 *
 * @param length - Number of digits (default: 6)
 * @returns Random numeric OTP
 */
export const generateOTP = (length: number = 6): number => {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max + 1);
};

/**
 * Generate a random hexadecimal string
 *
 * @param length - Number of bytes (output will be 2x this in hex chars)
 * @returns Random hex string
 */
export const generateRandomString = (length: number = 16): string => {
    return crypto.randomBytes(length).toString('hex');
};
