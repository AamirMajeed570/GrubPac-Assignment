import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';

export function setupSwagger(app: Application): void {
  const yamlPath = path.resolve(__dirname, '../../../docs/openapi.yaml');

  if (!fs.existsSync(yamlPath)) {
    console.warn('OpenAPI spec not found at:', yamlPath);
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
}
