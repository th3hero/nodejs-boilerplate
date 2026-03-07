const timestampSchema = { type: 'string', format: 'date-time' };

export const successEnvelope = (dataSchema: Record<string, unknown>, messageExample: string): Record<string, unknown> => ({
    type: 'object',
    additionalProperties: false,
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: messageExample },
        data: dataSchema,
        statusCode: { type: 'integer', example: 200 },
        timestamp: timestampSchema,
        requestId: { type: 'string', nullable: true }
    },
    required: ['success', 'message', 'data', 'statusCode', 'timestamp']
});

export const errorEnvelope = (
    messageExample: string,
    errorCodeExample: string,
    errorSchema: Record<string, unknown>
): Record<string, unknown> => ({
    type: 'object',
    additionalProperties: false,
    properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: messageExample },
        error_code: { type: 'string', example: errorCodeExample },
        error: errorSchema,
        timestamp: timestampSchema,
        requestId: { type: 'string', nullable: true }
    },
    required: ['success', 'message', 'error_code', 'error', 'timestamp']
});

export const jsonResponse = (
    description: string,
    schema: Record<string, unknown>,
    examples?: Record<string, unknown>
): Record<string, unknown> => ({
    description,
    content: {
        'application/json': {
            schema,
            ...(examples ? { examples } : {})
        }
    }
});

export const authMiddlewareErrorResponses = (): Record<string, Record<string, unknown>> => ({
    '401': jsonResponse(
        'Authentication/session validation failed',
        errorEnvelope('Access token required', 'SESSION_NOT_VALID', {
            type: 'object',
            additionalProperties: false,
            properties: {
                message: { type: 'string' }
            },
            required: ['message']
        }),
        {
            tokenRequired: {
                summary: 'Missing bearer token',
                value: {
                    success: false,
                    message: 'Access token required',
                    error_code: 'SESSION_NOT_VALID',
                    error: { message: 'Access token required' },
                    timestamp: '2026-01-01T10:00:00.000Z',
                    requestId: 'f2fd155b-f4c0-4ac8-a68b-2f7f21c0f9ec'
                }
            },
            tokenExpired: {
                summary: 'Expired token',
                value: {
                    success: false,
                    message: 'Session has expired',
                    error_code: 'SESSION_EXPIRED',
                    error: { message: 'Session has expired' },
                    timestamp: '2026-01-01T10:00:00.000Z',
                    requestId: 'ee519a03-3646-414b-af00-cd5b2efa4b2f'
                }
            },
            tokenWrongType: {
                summary: 'Wrong token type',
                value: {
                    success: false,
                    message: 'Invalid token type. Access token required.',
                    error_code: 'TOKEN_INVALID',
                    error: { message: 'Invalid token type. Access token required.' },
                    timestamp: '2026-01-01T10:00:00.000Z',
                    requestId: '7070ba35-b90d-47e7-8320-6d85f9fa05c7'
                }
            }
        }
    ),
    '403': jsonResponse(
        'Authenticated but forbidden',
        errorEnvelope('Permission denied', 'PERMISSION_DENIED', {
            type: 'object',
            additionalProperties: false,
            properties: {
                message: { type: 'string' }
            },
            required: ['message']
        }),
        {
            suspendedAccount: {
                summary: 'Suspended or banned account',
                value: {
                    success: false,
                    message: 'Account is suspended or banned',
                    error_code: 'ACCOUNT_SUSPENDED',
                    error: { message: 'Account is suspended or banned' },
                    timestamp: '2026-01-01T10:00:00.000Z',
                    requestId: '8e8d95bc-bfee-4c72-8dc8-95a4a1bdcb5a'
                }
            },
            permissionDenied: {
                summary: 'Missing permission for route',
                value: {
                    success: false,
                    message: 'Permission denied: gallery:read',
                    error_code: 'PERMISSION_DENIED',
                    error: { message: 'Permission denied: gallery:read' },
                    timestamp: '2026-01-01T10:00:00.000Z',
                    requestId: '0f2c9f4d-cabc-4fcb-ac44-8a28f3a5ef7d'
                }
            }
        }
    )
});
