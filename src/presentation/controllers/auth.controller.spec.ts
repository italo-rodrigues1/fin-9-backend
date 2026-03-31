import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

import { AuthController } from './auth.controller';
import {
  CATEGORY_REPOSITORY,
  USER_REPOSITORY,
} from '../../domain/repositories';

/**
 * Integration tests — Email domain whitelist removed (Task 5)
 * Validates: Property 4 — E-mail válido fora da whitelist é aceito
 */
describe('AuthController — email domain acceptance', () => {
  let app: INestApplication;

  const mockUserRepo = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCategoryRepo = {
    createDefaultCategories: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
        JwtModule.register({ secret: 'test-secret-for-unit-tests-only-32chars' }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: CATEGORY_REPOSITORY, useValue: mockCategoryRepo },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.create.mockResolvedValue({
      id: 'user-id-1',
      name: 'Test User',
      email: 'user@empresa.com.br',
    });
    mockCategoryRepo.createDefaultCategories.mockResolvedValue(undefined);
  });

  it.each([
    ['user@empresa.com.br'],
    ['user@company.io'],
    ['admin@corp.org'],
    ['contact@startup.dev'],
  ])('should accept registration with email %s (non-whitelisted domain)', async (email) => {
    const payload = { name: 'Test User', email, password: 'Password1' };

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload);

    expect(res.status).not.toBe(409);
    expect(res.status).toBe(201);
  });

  it('should still reject syntactically invalid emails', async () => {
    const payload = { name: 'Test User', email: 'not-an-email', password: 'Password1' };

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload);

    expect(res.status).toBe(400);
  });
});

/**
 * Integration tests — Rate limiting on auth endpoints (Task 4)
 * Validates: Property 2 — Rate limiting retorna 429 após limite excedido
 */
describe('AuthController — rate limiting', () => {
  let app: INestApplication;

  const mockUserRepo = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCategoryRepo = {
    createDefaultCategories: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
        JwtModule.register({ secret: 'test-secret-for-unit-tests-only-32chars' }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: CATEGORY_REPOSITORY, useValue: mockCategoryRepo },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Return invalid credentials so login returns 401 (not 200) — we just need to count requests
    mockUserRepo.findByEmail.mockResolvedValue(null);
  });

  it('should return 429 on the 6th POST /auth/login request within the TTL window', async () => {
    const payload = { email: 'test@example.com', password: 'Password1' };

    // First 5 requests should be processed (401 — invalid credentials, not rate limited)
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(payload);
      expect(res.status).not.toBe(429);
    }

    // 6th request must be rate limited
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(payload);
    expect(res.status).toBe(429);
  });
});
