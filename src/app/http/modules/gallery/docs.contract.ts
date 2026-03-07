import { ERROR_CODES } from '@core/constants';
import type { DocsRouteContract } from '@/docs/types';
import { rulesToOpenApiSchema } from '@/docs/rule-schema';
import { authMiddlewareErrorResponses, errorEnvelope, jsonResponse, successEnvelope } from '@/docs/openapi.helpers';
import { uploadConfirmRules, uploadInitRules } from './validation';

const gallerySchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        id: { type: 'string' },
        reference: { type: 'string' },
        title: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        filetype: { type: 'string' },
        extension: { type: 'string' },
        size: { type: 'string' },
        height: { type: 'integer', nullable: true },
        width: { type: 'integer', nullable: true },
        bucket: { type: 'string' },
        is_public: { type: 'boolean' },
        type: { type: 'string', enum: ['image', 'video', 'pdf'] },
        status: { type: 'string', enum: ['pending', 'uploaded', 'failed'] },
        view_url: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
    },
    required: [
        'id',
        'reference',
        'filetype',
        'extension',
        'size',
        'bucket',
        'is_public',
        'type',
        'status',
        'created_at',
        'updated_at'
    ]
};

export const galleryDocsContracts: DocsRouteContract[] = [
    {
        method: 'post',
        path: '/gallery/init',
        summary: 'Initialize file upload',
        description: 'Generates a presigned upload URL and creates a pending gallery record.',
        operationId: 'gallery_initUpload',
        tags: ['Gallery'],
        requiresAuth: true,
        requestBody: {
            required: true,
            description: 'Upload metadata and destination configuration',
            schema: rulesToOpenApiSchema(uploadInitRules)
        },
        responses: {
            '200': jsonResponse(
                'Upload initialized',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            reference: { type: 'string' },
                            uploadUrl: { type: 'string' },
                            bucket: { type: 'string', enum: ['documents', 'public'] },
                            path: { type: 'string' },
                            expiresIn: { type: 'integer' },
                            galleryId: { type: 'string' }
                        },
                        required: ['reference', 'uploadUrl', 'bucket', 'path', 'expiresIn', 'galleryId']
                    },
                    'Upload initialized'
                )
            ),
            '400': jsonResponse(
                'Upload initialization failed',
                errorEnvelope('Failed to initialize upload', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            ...authMiddlewareErrorResponses(),
            '422': jsonResponse(
                'Validation failed',
                errorEnvelope('Input validation failed', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'post',
        path: '/gallery/confirm',
        summary: 'Confirm upload completion',
        description: 'Confirms uploaded object in storage and marks gallery as uploaded.',
        operationId: 'gallery_confirmUpload',
        tags: ['Gallery'],
        requiresAuth: true,
        requestBody: {
            required: true,
            description: 'Upload reference returned by init endpoint',
            schema: rulesToOpenApiSchema(uploadConfirmRules)
        },
        responses: {
            '200': jsonResponse(
                'Upload confirmed',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            gallery: gallerySchema
                        },
                        required: ['gallery']
                    },
                    'Upload confirmed'
                )
            ),
            '400': jsonResponse(
                'Confirmation failed',
                errorEnvelope('Upload confirmation failed', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            ...authMiddlewareErrorResponses(),
            '422': jsonResponse(
                'Validation failed',
                errorEnvelope('Input validation failed', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'get',
        path: '/gallery',
        summary: 'List galleries',
        description: 'Returns uploaded galleries based on permission scope with pagination.',
        operationId: 'gallery_list',
        tags: ['Gallery'],
        requiresAuth: true,
        queryParameters: [
            {
                in: 'query',
                name: 'limit',
                required: false,
                schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                description: 'Number of records to return'
            },
            {
                in: 'query',
                name: 'offset',
                required: false,
                schema: { type: 'integer', minimum: 0, default: 0 },
                description: 'Pagination offset'
            }
        ],
        responses: {
            '200': jsonResponse(
                'Galleries fetched',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            galleries: {
                                type: 'array',
                                items: gallerySchema
                            },
                            total: { type: 'integer' },
                            limit: { type: 'integer' },
                            offset: { type: 'integer' }
                        },
                        required: ['galleries', 'total', 'limit', 'offset']
                    },
                    'Galleries fetched'
                )
            ),
            ...authMiddlewareErrorResponses()
        }
    },
    {
        method: 'get',
        path: '/gallery/{id}',
        summary: 'Get gallery details',
        description: 'Returns gallery metadata and view URL when available.',
        operationId: 'gallery_getById',
        tags: ['Gallery'],
        requiresAuth: true,
        pathParameters: [
            {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'Gallery ID (bigint as string)'
            }
        ],
        responses: {
            '200': jsonResponse(
                'Gallery fetched',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            gallery: gallerySchema
                        },
                        required: ['gallery']
                    },
                    'Gallery fetched'
                )
            ),
            '400': jsonResponse(
                'Invalid gallery ID',
                errorEnvelope('Invalid Gallery ID', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            ...authMiddlewareErrorResponses(),
            '404': jsonResponse(
                'Gallery not found',
                errorEnvelope('Gallery not found', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'get',
        path: '/gallery/{id}/url',
        summary: 'Get gallery view URL',
        description: 'Generates a presigned view URL for an uploaded gallery file.',
        operationId: 'gallery_getViewUrl',
        tags: ['Gallery'],
        requiresAuth: true,
        pathParameters: [
            {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'Gallery ID (bigint as string)'
            }
        ],
        responses: {
            '200': jsonResponse(
                'View URL generated',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            viewUrl: { type: 'string' },
                            expiresIn: { type: 'integer' }
                        },
                        required: ['viewUrl', 'expiresIn']
                    },
                    'View URL generated'
                )
            ),
            '400': jsonResponse(
                'Invalid gallery ID',
                errorEnvelope('Invalid Gallery ID', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            ...authMiddlewareErrorResponses(),
            '404': jsonResponse(
                'Gallery not found or not ready',
                errorEnvelope('Gallery not found or not ready', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    },
    {
        method: 'delete',
        path: '/gallery/{id}',
        summary: 'Delete gallery',
        description: 'Deletes gallery metadata and stored file if applicable.',
        operationId: 'gallery_delete',
        tags: ['Gallery'],
        requiresAuth: true,
        pathParameters: [
            {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'Gallery ID (bigint as string)'
            }
        ],
        responses: {
            '200': jsonResponse(
                'Gallery deleted',
                successEnvelope(
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            deleted: { type: 'boolean', example: true }
                        },
                        required: ['deleted']
                    },
                    'Gallery deleted'
                )
            ),
            '400': jsonResponse(
                'Invalid gallery ID',
                errorEnvelope('Invalid Gallery ID', ERROR_CODES.VALIDATION_ERROR, {
                    type: 'object',
                    additionalProperties: true
                })
            ),
            ...authMiddlewareErrorResponses(),
            '403': jsonResponse(
                'Not authorized or blocked by resource constraints',
                errorEnvelope('Not authorized to delete this file', ERROR_CODES.PERMISSION_DENIED, {
                    type: 'object',
                    additionalProperties: true
                }),
                {
                    notOwner: {
                        summary: 'Attempt to delete another user file',
                        value: {
                            success: false,
                            message: 'Not authorized to delete this file',
                            error_code: 'PERMISSION_DENIED',
                            error: { delete: 'Not authorized to delete this file' },
                            timestamp: '2026-01-01T10:00:00.000Z',
                            requestId: '2f62ace0-2fb6-4f35-9244-8f4f56f062fb'
                        }
                    },
                    inUse: {
                        summary: 'Gallery still referenced by another record',
                        value: {
                            success: false,
                            message: 'Cannot delete file — it is still in use by another resource (e.g., avatar, document)',
                            error_code: 'PERMISSION_DENIED',
                            error: {
                                delete: 'Cannot delete file — it is still in use by another resource (e.g., avatar, document)'
                            },
                            timestamp: '2026-01-01T10:00:00.000Z',
                            requestId: '8fbe357c-9f74-4f72-aad9-0572445cc611'
                        }
                    }
                }
            ),
            '404': jsonResponse(
                'Gallery not found',
                errorEnvelope('Gallery not found', ERROR_CODES.NOT_FOUND, {
                    type: 'object',
                    additionalProperties: true
                })
            )
        }
    }
];
