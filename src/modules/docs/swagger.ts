import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';

/**
 * Resolve the openapi.yaml path in both dev and Docker production.
 *
 * Dev:        process.cwd() = project root  → docs/openapi.yaml
 * Production: process.cwd() = /app          → /app/docs/openapi.yaml
 *
 * We also try __dirname-relative paths as fallback.
 */
function resolveSpecPath(): string | null {
  const candidates = [
    // Production: compiled into dist alongside the swagger module
    path.resolve(__dirname, 'openapi.yaml'),
    // Primary: relative to working directory (works in Docker where cwd = /app)
    path.resolve(process.cwd(), 'docs/openapi.yaml'),
    // Dev (ts-node: __dirname = src/modules/docs)
    path.resolve(__dirname, '../../../docs/openapi.yaml'),
    // Production fallback (__dirname = dist/src/modules/docs)
    path.resolve(__dirname, '../../../../docs/openapi.yaml'),
  ];

  console.log('Searching for OpenAPI spec in:');
  for (const candidate of candidates) {
    const exists = fs.existsSync(candidate);
    console.log(`  ${exists ? '✓' : '✗'} ${candidate}`);
    if (exists) return candidate;
  }
  return null;
}

export function setupSwagger(app: Application): void {
  const yamlPath = resolveSpecPath();

  if (!yamlPath) {
    console.warn('OpenAPI spec not found — Swagger UI will not be available');
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
