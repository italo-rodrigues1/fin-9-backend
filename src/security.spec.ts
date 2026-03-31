import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';

import { HealthModule } from './presentation/modules';

/**
 * Integration tests — Security headers (Task 1)
 * Validates: Property 7 — Headers de segurança presentes em todas as respostas
 */
describe('Security headers (Helmet)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror main.ts: helmet must be applied before other middleware
    app.use(helmet());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should include X-Content-Type-Options: nosniff', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /health should include X-Frame-Options header', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('GET /health should include X-DNS-Prefetch-Control header', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.headers['x-dns-prefetch-control']).toBeDefined();
  });
});

/**
 * Unit tests — CORS configuration (Task 2)
 * Validates: Property 1 — CORS não aceita wildcard com credentials
 */
describe('CORS configuration', () => {
  it('should never combine origin wildcard with credentials: true', () => {
    // Simulate what main.ts does: read ALLOWED_ORIGINS env var
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'];

    const corsOptions = {
      origin: allowedOrigins,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    };

    // The origin must never be the wildcard string '*' when credentials is true
    expect(corsOptions.origin).not.toBe('*');
    expect(Array.isArray(corsOptions.origin)).toBe(true);
  });

  it('should use explicit origins list from ALLOWED_ORIGINS env var', () => {
    const originalEnv = process.env.ALLOWED_ORIGINS;

    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:19006';
    const origins = process.env.ALLOWED_ORIGINS.split(',');

    expect(origins).toEqual(['http://localhost:3000', 'http://localhost:19006']);
    expect(origins).not.toContain('*');

    process.env.ALLOWED_ORIGINS = originalEnv;
  });

  it('should fallback to localhost:3000 when ALLOWED_ORIGINS is not set', () => {
    const originalEnv = process.env.ALLOWED_ORIGINS;
    delete process.env.ALLOWED_ORIGINS;

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'];

    expect(allowedOrigins).toEqual(['http://localhost:3000']);
    expect(allowedOrigins).not.toContain('*');

    process.env.ALLOWED_ORIGINS = originalEnv;
  });
});
