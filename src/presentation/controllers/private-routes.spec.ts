import 'reflect-metadata';
import {
  Controller,
  Get,
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { CardsService } from '../../application/cards.service';
import { GoalsService } from '../../application/goals.service';
import { PlanningService } from '../../application/planning.service';
import {
  ACCOUNT_REPOSITORY,
  CATEGORY_REPOSITORY,
  TRANSACTION_REPOSITORY,
  USER_REPOSITORY,
} from '../../domain/repositories';
import { JwtAuthGuard, JwtStrategy } from '../../infrastructure/auth';
import { GoogleIdentityService } from '../../infrastructure/auth/google-identity.service';
import { IS_PUBLIC_KEY } from '../../infrastructure/auth/public.decorator';
import { PublicResponseInterceptor } from '../interceptors/public-response.interceptor';
import { AccountController } from './account.controller';
import { AuthController } from './auth.controller';
import { CardsController } from './cards.controller';
import { CategoryController } from './category.controller';
import { DashboardController } from './dashboard.controller';
import { GoalsController } from './goals.controller';
import { HealthController } from './health.controller';
import { PlanningController } from './planning.controller';
import { TransactionController } from './transaction.controller';

@Controller('unguarded-test-route')
class UnguardedController {
  @Get() get() {
    return { reached: true };
  }
}

const controllers = [
  AccountController,
  AuthController,
  CardsController,
  CategoryController,
  DashboardController,
  GoalsController,
  HealthController,
  PlanningController,
  TransactionController,
  UnguardedController,
];
const secret = 'test-only-jwt-secret-at-least-32-characters';
const userId = 'b8147b1a-38ad-4b0e-9c71-f19fabed3158';
const privateRoutes = controllers.flatMap((controller) =>
  Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      controller.prototype,
      name,
    )?.value;
    if (typeof handler !== 'function') return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as
      | number
      | undefined;
    if (method === undefined || Reflect.getMetadata(IS_PUBLIC_KEY, handler))
      return [];
    const prefix =
      (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ||
      '';
    const suffix =
      (Reflect.getMetadata(PATH_METADATA, handler) as string | undefined) || '';
    const path = `/${prefix}/${suffix}`
      .replace(/\/+/g, '/')
      .replace(/\/$/, '')
      .replace(/:[^/]+/g, userId);
    return [
      {
        method: RequestMethod[method].toLowerCase() as
          | 'get'
          | 'post'
          | 'patch'
          | 'delete',
        path,
      },
    ];
  }),
);

describe('JWT protection and request boundaries', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let token: string;
  const accounts = {
    findAll: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };
  const categories = { create: jest.fn(), findByNameAndUser: jest.fn() };
  const transactions = { findAll: jest.fn(), findById: jest.fn() };
  const planning = { budgets: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret, signOptions: { expiresIn: '5m' } }),
      ],
      controllers,
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: secret }),
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: ACCOUNT_REPOSITORY, useValue: accounts },
        { provide: CATEGORY_REPOSITORY, useValue: categories },
        { provide: TRANSACTION_REPOSITORY, useValue: transactions },
        { provide: USER_REPOSITORY, useValue: {} },
        { provide: GoogleIdentityService, useValue: {} },
        { provide: PlanningService, useValue: planning },
        { provide: CardsService, useValue: {} },
        { provide: GoalsService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new PublicResponseInterceptor());
    await app.init();
    jwt = module.get(JwtService);
    token = jwt.sign({ sub: userId, email: 'user@example.com' });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(privateRoutes)(
    'requires JWT for $method $path',
    async ({ method, path }) => {
      await request(app.getHttpServer() as Server)
        [method](path)
        .expect(401);
    },
  );

  it('keeps only the four intended authentication/liveness routes public', async () => {
    await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(200);
    for (const route of ['register', 'login', 'google']) {
      await request(app.getHttpServer() as Server)
        .post(`/auth/${route}`)
        .send({})
        .expect(400);
    }
  });

  it('rejects missing identity, malformed subjects, missing expiry, expiry and unsupported signing algorithms', async () => {
    const claims = { sub: userId, email: 'user@example.com' };
    const invalidTokens = [
      'invalid-token',
      jwt.sign({ email: claims.email }),
      jwt.sign({ ...claims, sub: 'foreign-user' }),
      jwt.sign({ ...claims, sub: { id: userId } }),
      jwt.sign({ ...claims, email: [] }),
      new JwtService({ secret }).sign(claims),
      jwt.sign(claims, { expiresIn: -1 }),
      jwt.sign(claims, { algorithm: 'HS384' }),
    ];
    for (const invalid of invalidTokens) {
      await request(app.getHttpServer() as Server)
        .get('/accounts')
        .auth(invalid, { type: 'bearer' })
        .expect(401);
    }
    expect(accounts.findAll).not.toHaveBeenCalled();
  });

  it('takes ownership only from the verified token and removes internal fields recursively', async () => {
    accounts.findAll.mockResolvedValue([
      {
        id: userId,
        userId,
        name: 'Conta',
        balance: 20,
        nested: {
          userId,
          passwordHash: 'hash',
          googleSubject: 'google-id',
          accountId: userId,
        },
      },
    ]);
    const response = await request(app.getHttpServer() as Server)
      .get('/accounts')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(accounts.findAll).toHaveBeenCalledWith(userId);
    expect(response.body).toEqual([
      { id: userId, name: 'Conta', balance: 20, nested: { accountId: userId } },
    ]);
  });

  it.each(['userId', 'userid', 'isDefault', 'passwordHash', 'deletedAt'])(
    'rejects client-controlled %s on account creation',
    async (field) => {
      await request(app.getHttpServer() as Server)
        .post('/accounts')
        .auth(token, { type: 'bearer' })
        .send({
          name: 'Conta',
          institution: 'Banco',
          balance: 0,
          [field]: userId,
        })
        .expect(400);
      expect(accounts.create).not.toHaveBeenCalled();
    },
  );

  it.each(['userId', 'isDefault'])(
    'rejects client-controlled %s on categories',
    async (field) => {
      await request(app.getHttpServer() as Server)
        .post('/categories')
        .auth(token, { type: 'bearer' })
        .send({ name: 'Categoria', [field]: true })
        .expect(400);
      expect(categories.create).not.toHaveBeenCalled();
    },
  );

  it('rejects ownership query parameters and unsupported budget account filters', async () => {
    await request(app.getHttpServer() as Server)
      .get(`/transactions?userId=${userId}`)
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer() as Server)
      .get(`/budgets?month=11&year=2026&accountId=${userId}`)
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(transactions.findAll).not.toHaveBeenCalled();
    expect(planning.budgets).not.toHaveBeenCalled();
  });

  it.each([
    '/transactions/not-a-uuid',
    '/accounts/not-a-uuid',
    '/categories/not-a-uuid',
    '/transfers/not-a-uuid',
  ])('validates UUID route parameters for %s', async (path) => {
    const call =
      path.startsWith('/accounts') || path.startsWith('/categories')
        ? 'delete'
        : 'get';
    await request(app.getHttpServer() as Server)
      [call](path)
      .auth(token, { type: 'bearer' })
      .expect(400);
  });

  it('uses a bounded default transaction page', async () => {
    transactions.findAll.mockResolvedValue([]);
    await request(app.getHttpServer() as Server)
      .get('/transactions')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(transactions.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ userId, skip: 0, take: 30 }),
    );
  });

  it('rejects direct overwrites of an account balance', async () => {
    await request(app.getHttpServer() as Server)
      .patch(`/accounts/${userId}`)
      .auth(token, { type: 'bearer' })
      .send({ balance: 100 })
      .expect(400);
    expect(accounts.findById).not.toHaveBeenCalled();
  });

  it('does not silently ignore a month filter without its year', async () => {
    await request(app.getHttpServer() as Server)
      .get('/transactions?month=11')
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(transactions.findAll).not.toHaveBeenCalled();
  });
});
