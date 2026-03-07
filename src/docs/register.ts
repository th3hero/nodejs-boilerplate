import type { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import environment from '@config/environment.config';
import { buildOpenApiDocument } from './openapi.builder';
import { createLogger } from '@services/index';

const log = createLogger('docs');

const normalizeDocsPath = (value: string): string => {
    if (!value.startsWith('/')) {
        return `/${value}`;
    }

    return value.replace(/\/+$/, '');
};

export const registerApiDocs = (app: Express): void => {
    if (!environment.docs.enabled) {
        return;
    }

    const docsPath = normalizeDocsPath(environment.docs.path);
    const jsonPath = `${docsPath}/openapi.json`;
    const openApiDocument = buildOpenApiDocument();
    const swaggerDocument = {
        ...openApiDocument,
        servers: [{ url: '/', description: 'Current origin' }]
    };

    app.get(jsonPath, (_req: Request, res: Response) => {
        res.type('application/json').status(200).send(openApiDocument);
    });

    app.use(
        docsPath,
        swaggerUi.serve,
        swaggerUi.setup(swaggerDocument, {
            customSiteTitle: `${environment.app.name} API Docs`,
            explorer: true
        })
    );

    log.info('API docs registered', { docsPath, jsonPath });
};
