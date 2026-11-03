import { ExecutionContext, INestApplication, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Server } from 'node:http';
import request from 'supertest';
import { API_RATE_LIMIT } from './rate-limit.config';
import { AccountController } from './presentation/controllers/account.controller';
import { TransactionController } from './presentation/controllers/transaction.controller';
import { AuthController } from './presentation/controllers/auth.controller';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter';
import { JwtAuthGuard } from './infrastructure/auth';
import { GoogleIdentityService } from './infrastructure/auth/google-identity.service';
import {
  ACCOUNT_REPOSITORY,
  CATEGORY_REPOSITORY,
  TRANSACTION_REPOSITORY,
  USER_REPOSITORY,
} from './domain/repositories';

describe('Mobile navigation rate limits', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([API_RATE_LIMIT]),
        JwtModule.register({ secret: 'local-rate-limit-test-secret' }),
      ],
      controllers: [AccountController, TransactionController, AuthController],
      providers: [
        { provide: GoogleIdentityService, useValue: { verify: jest.fn() } },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: ACCOUNT_REPOSITORY,
          useValue: { findAll: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: TRANSACTION_REPOSITORY,
          useValue: { findAll: jest.fn().mockResolvedValue([]) },
        },
        { provide: CATEGORY_REPOSITORY, useValue: {} },
        {
          provide: USER_REPOSITORY,
          useValue: { findByEmailWithHash: jest.fn().mockResolvedValue(null) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<{ user: { id: string } }>().user = {
            id: 'test-user',
          };
          return true;
        },
      })
      .compile();
    app = fixture.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });
  it('allows ordinary account navigation and still blocks excessive reads with an accurate 429 response', async () => {
    for (let index = 0; index < API_RATE_LIMIT.limit; index++) {
      const result = await request(app.getHttpServer() as Server).get(
        '/accounts',
      );
      expect(result.status).toBe(200);
    }
    const limited = await request(app.getHttpServer() as Server).get(
      '/accounts',
    );
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      path: '/accounts',
    });
    expect(limited.headers['retry-after']).toBeDefined();
  });
  it('allows more than ten monthly transaction reads per minute', async () => {
    for (let index = 0; index < 15; index++) {
      const result = await request(app.getHttpServer() as Server).get(
        '/transactions?month=10&year=2026',
      );
      expect(result.status).toBe(200);
    }
  });
  it('keeps the strict five-attempt login limit with the production general policy', async () => {
    for (let index = 0; index < 5; index++) {
      const result = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email: 'rate@example.test', password: 'Wrong1234' });
      expect(result.status).toBe(401);
      expect(result.body).toMatchObject({ error: 'Unauthorized' });
    }
    const limited = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email: 'rate@example.test', password: 'Wrong1234' });
    expect(limited.status).toBe(429);
  });
});
