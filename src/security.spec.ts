import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import helmet from 'helmet';
import { HealthModule } from './presentation/modules';
import { corsOptions } from './presentation/http.config';

describe('HTTP security configuration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();
    app = module.createNestApplication();
    app.use(helmet());
    app.enableCors(corsOptions('https://app.fin9.test,http://localhost:8081'));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies Helmet security headers', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['x-dns-prefetch-control']).toBeDefined();
  });

  it('allows configured browser origins without cookie credentials', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/health')
      .set('Origin', 'https://app.fin9.test')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://app.fin9.test',
    );
    expect(
      response.headers['access-control-allow-credentials'],
    ).toBeUndefined();
  });

  it('does not reflect arbitrary browser origins', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/health')
      .set('Origin', 'https://attacker.test')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepts native clients with no Origin header', async () => {
    await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(200);
  });

  it('allows bearer Authorization in preflight requests', async () => {
    const response = await request(app.getHttpServer() as Server)
      .options('/health')
      .set('Origin', 'https://app.fin9.test')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization')
      .expect(204);
    expect(response.headers['access-control-allow-headers']).toContain(
      'authorization',
    );
  });

  it('uses development defaults and rejects wildcards, paths and invalid origins', () => {
    expect(corsOptions().origin).toContain('http://localhost:8081');
    for (const origin of [
      '*',
      'null',
      'https://app.test/path',
      'ftp://app.test',
      'https://app.test,',
    ]) {
      expect(() => corsOptions(origin)).toThrow('ALLOWED_ORIGINS');
    }
  });
});
