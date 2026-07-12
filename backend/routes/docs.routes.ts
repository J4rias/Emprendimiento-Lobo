import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from '../docs/openapi';

const router = Router();

// Build once at startup
const spec = buildOpenApiSpec();

// Raw JSON spec
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(spec);
});

// Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(spec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Lobo ERP — API Docs',
}));

export = router;
