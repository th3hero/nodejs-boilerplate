import environment from '@config/environment.config';
import type { DocsRouteContract } from './types';
import { authDocsContracts } from '@http/modules/auth/docs.contract';
import { galleryDocsContracts } from '@http/modules/gallery/docs.contract';

const mergeRouteIntoPaths = (paths: Record<string, Record<string, unknown>>, route: DocsRouteContract): void => {
    if (!paths[route.path]) {
        paths[route.path] = {};
    }

    const operation: Record<string, unknown> = {
        summary: route.summary,
        description: route.description,
        operationId: route.operationId,
        tags: route.tags,
        responses: route.responses
    };

    if (route.requiresAuth) {
        operation['security'] = [{ bearerAuth: [] }];
    }

    const parameters = [...(route.pathParameters ?? []), ...(route.queryParameters ?? [])];
    if (parameters.length > 0) {
        operation['parameters'] = parameters;
    }

    if (route.requestBody) {
        operation['requestBody'] = {
            required: route.requestBody.required ?? true,
            description: route.requestBody.description,
            content: {
                'application/json': {
                    schema: route.requestBody.schema
                }
            }
        };
    }

    const pathItem = paths[route.path];
    if (!pathItem) {
        return;
    }

    pathItem[route.method] = operation;
};

const getContracts = (): DocsRouteContract[] => {
    return [...authDocsContracts, ...galleryDocsContracts];
};

export const buildOpenApiDocument = (): Record<string, unknown> => {
    const paths: Record<string, Record<string, unknown>> = {};
    const contracts = getContracts();
    const apiBasePath = `/v${environment.app.version}`;

    contracts.forEach(contract => {
        const normalizedPath = `${apiBasePath}${contract.path}`;
        mergeRouteIntoPaths(paths, { ...contract, path: normalizedPath });
    });

    paths['/'] = {
        get: {
            tags: ['System'],
            summary: 'API landing endpoint',
            description: 'Returns service metadata.',
            operationId: 'app_landing',
            responses: {
                '200': {
                    description: 'Landing response',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    message: { type: 'string' },
                                    version: { type: 'string' },
                                    environment: { type: 'string' },
                                    timestamp: { type: 'string', format: 'date-time' }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    paths['/health'] = {
        get: {
            tags: ['System'],
            summary: 'Health check',
            description: 'Returns service and dependency health snapshot.',
            operationId: 'app_health',
            responses: {
                '200': {
                    description: 'Healthy',
                    content: {
                        'application/json': {
                            schema: { type: 'object', additionalProperties: true }
                        }
                    }
                },
                '503': {
                    description: 'Degraded',
                    content: {
                        'application/json': {
                            schema: { type: 'object', additionalProperties: true }
                        }
                    }
                },
                '500': {
                    description: 'Unhealthy',
                    content: {
                        'application/json': {
                            schema: { type: 'object', additionalProperties: true }
                        }
                    }
                }
            }
        }
    };

    return {
        openapi: '3.0.3',
        info: {
            title: `${environment.app.name} API`,
            version: String(environment.app.version),
            description: environment.app.description
        },
        servers: [
            {
                url: '/',
                description: 'Current origin (Swagger UI safe default)'
            },
            {
                url: environment.app.url,
                description: `${environment.basic.environment} environment`
            }
        ],
        tags: [
            { name: 'System', description: 'System level endpoints' },
            { name: 'Auth', description: 'Authentication and session management endpoints' },
            { name: 'Gallery', description: 'File upload and retrieval endpoints' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        },
        paths
    };
};
