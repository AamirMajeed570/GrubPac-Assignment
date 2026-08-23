import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';

function resolveSpecPath(): string | null {
  const candidates = [
    path.resolve(__dirname, 'openapi.yaml'),
    path.resolve(process.cwd(), 'docs/openapi.yaml'),
    path.resolve(__dirname, '../../../docs/openapi.yaml'),
    path.resolve(__dirname, '../../../../docs/openapi.yaml'),
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
    return;
  }

  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  const spec = YAML.parse(yamlContent);

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'TaskFlow API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );
}
