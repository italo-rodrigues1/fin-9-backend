import { join, dirname } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { createApiDocument } from './api-document';

/** Only Scalar needs inline UI scripts/styles. API routes retain Helmet's strict defaults. */
export function setupApiDocumentation(app: INestApplication) {
  const document = createApiDocument(app);
  app.use(
    '/reference',
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        // Preserve HTTP localhost usage; production HTTPS is enforced by deployment.
        upgradeInsecureRequests: null,
      },
    }),
  );
  SwaggerModule.setup('openapi', app, document, {
    ui: false,
    jsonDocumentUrl: '/openapi.json',
    raw: ['json'],
  });
  const scalarBundle = join(
    dirname(require.resolve('@scalar/api-reference')),
    'browser',
    'standalone.js',
  );
  app.use(
    '/reference/scalar.js',
    (_req: Request, res: Response, next: NextFunction) => {
      res.sendFile(scalarBundle, (error) => {
        if (error) next(error);
      });
    },
  );
  app.use(
    '/reference',
    apiReference({
      url: '/openapi.json',
      cdn: '/reference/scalar.js',
      pageTitle: 'Fin-9 — Scalar',
      withDefaultFonts: false,
      persistAuth: false,
      telemetry: false,
      proxyUrl: '',
    }),
  );
}
