import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';

/**
 * Resolve the openapi.yaml path in both dev and Docker production.
 *
 * Dev:        __dirname = .../src/modules/docs      → ../../../docs/openapi.yaml
 * Production: __dirname = .../dist/src/modules/docs → ../../../../docs/openapi.yaml
 *
 * We try both and fall back to process.cwd()/docs/openapi.yaml as a last resort.
 */
function resolveSpecPath(): string | null {
  const candidates = [
    // Works in dev (ts-node: __dirname = src/modules/docs)
    path.resolve(__dirname, '../../../docs/openapi.yaml'),
    // Works in production (compiled: __dirname = dist/src/modules/docs)
    path.resolve(__dirname, '../../../../docs/openapi.yaml'),
    // Fallback: relative to working directory (works in Docker where cwd = /app)
    path.resolve(process.cwd(), 'docs/openapi.yaml'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function setupSwagger(app: Application): void {
  const yamlPath = resolveSpecPath();

  if (!yamlPath) {
    console.warn('OpenAPI spec not found — Swagger UI will not be available');
    console.warn('Searched paths:');
    console.warn('  ', path.resolve(__dirname, '../../../docs/openapi.yaml'));
    console.warn('  ', path.resolve(__dirname, '../../../../docs/openapi.yaml'));
    console.warn('  ', path.resolve(process.cwd(), 'docs/openapi.yaml'));
    return;
  }

  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  const spec = YAML.parse(yamlContent);

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'TaskFlow API Docs',
      swaggerOptions: {
        persistAuthorization: true,
      },
    })
  );

  console.log('Swagger UI available at /api-docs (spec loaded from:', yamlPath, ')');
}
