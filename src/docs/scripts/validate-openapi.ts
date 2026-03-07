import path from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { getProjectRoot } from '@core/utils/path.utils';

const validate = async (): Promise<void> => {
    const projectRoot = getProjectRoot();
    const specPath = path.join(projectRoot, 'docs', 'openapi.json');

    await SwaggerParser.validate(specPath);
    console.log(`OpenAPI spec is valid: ${specPath}`);
};

validate().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`OpenAPI validation failed: ${message}`);
    process.exit(1);
});
