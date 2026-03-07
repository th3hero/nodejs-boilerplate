export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface DocsRouteContract {
    method: HttpMethod;
    path: string;
    summary: string;
    description: string;
    operationId: string;
    tags: string[];
    requiresAuth?: boolean;
    pathParameters?: Array<Record<string, unknown>>;
    queryParameters?: Array<Record<string, unknown>>;
    requestBody?: {
        required?: boolean;
        description?: string;
        schema: Record<string, unknown>;
    };
    responses: Record<string, Record<string, unknown>>;
}
