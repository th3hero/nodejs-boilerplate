/**
 * Sanitization Utilities
 * Input sanitization and data masking
 */

// ============================================================================
// Sensitive Fields for Logging
// ============================================================================

const SENSITIVE_FIELDS = [
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'key',
    'api_key',
    'apikey',
    'access_token',
    'refresh_token',
    'auth_token',
    'session_id',
    'jwt',
    'authorization',
    'credit_card',
    'card_number',
    'cvv',
    'ssn',
    'sin', // Canadian Social Insurance Number
    'account_number',
    'transit_number',
    'routing_number'
];

const isSensitiveField = (fieldName: string): boolean => {
    const lower = fieldName.toLowerCase();
    return SENSITIVE_FIELDS.some(pattern => lower.includes(pattern));
};

// ============================================================================
// Log Sanitization (Mask Sensitive Data)
// ============================================================================

type SanitizedValue = string | number | boolean | null | undefined | SanitizedObject | SanitizedValue[];

interface SanitizedObject {
    [key: string]: SanitizedValue;
}

/**
 * Sanitize object for logging (masks sensitive fields)
 */
export const sanitizeForLog = (obj: unknown): SanitizedValue => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj !== 'object') {
        return obj as string | number | boolean;
    }

    if (Array.isArray(obj)) {
        return obj.map(sanitizeForLog);
    }

    const sanitized: SanitizedObject = {};
    for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = isSensitiveField(key) ? '[REDACTED]' : sanitizeForLog(value);
    }

    return sanitized;
};

// ============================================================================
// Input Sanitization (XSS Prevention)
// ============================================================================

const HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#96;'
    // Note: '/' is NOT escaped - it's not dangerous for XSS and breaks MIME types
};

/**
 * Escape HTML special characters
 * Only escapes characters that can be used in XSS attacks
 */
const escapeHtml = (str: string): string => {
    return str.replace(/[&<>"'`]/g, char => HTML_ENTITIES[char] ?? char);
};

/**
 * Sanitize string input (escape HTML, trim whitespace)
 */
const sanitizeString = (str: string): string => {
    return escapeHtml(str.trim());
};

/**
 * Sanitize object recursively (for request body)
 */
export const sanitizeInput = <T>(input: T): T => {
    if (input === null || input === undefined) {
        return input;
    }

    if (typeof input === 'string') {
        return sanitizeString(input) as T;
    }

    if (typeof input !== 'object') {
        return input;
    }

    if (Array.isArray(input)) {
        return input.map(sanitizeInput) as T;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        sanitized[key] = sanitizeInput(value);
    }

    return sanitized as T;
};

// ============================================================================
// Phone Number Sanitization
// ============================================================================

/**
 * Remove non-digit characters from phone number
 */
export const cleanPhoneNumber = (phone: string): string => {
    return phone.replace(/\D/g, '');
};
