import fs from 'node:fs';
import path from 'node:path';
import { buildOpenApiDocument } from '@/docs/openapi.builder';
import { getProjectRoot } from '@core/utils/path.utils';

const projectRoot = getProjectRoot();
const docsDir = path.join(projectRoot, 'docs');
const outputPath = path.join(docsDir, 'openapi.json');

const document = buildOpenApiDocument();

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

console.log(`OpenAPI spec generated at: ${outputPath}`);
