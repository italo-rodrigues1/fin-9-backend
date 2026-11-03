import {
  ConflictException,
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { Server } from 'node:http';
import {
  CATEGORY_REPOSITORY,
  USER_REPOSITORY,
} from '../../domain/repositories';
import { GoogleIdentityService } from '../../infrastructure/auth/google-identity.service';
import { AuthController } from './auth.controller';

const identity = {
  subject: 'google-user-123',
  email: 'marina@gmail.com',
  name: 'Marina Souza',
  emailAuthoritative: true,
};
const user = {
  id: 'fin9-user-1',
  name: 'Marina Souza',
  email: 'marina@gmail.com',
  passwordHash: null,
  googleSubject: identity.subject,
};

describe('AuthController — Google login', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const userRepo = {
    findOrCreateGoogleUser: jest.fn(),
    findByEmailWithHash: jest.fn(),
  };
  const googleIdentity = { verify: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-only-jwt-secret-at-least-32-characters',
        }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: USER_REPOSITORY, useValue: userRepo },
        { provide: CATEGORY_REPOSITORY, useValue: {} },
        { provide: GoogleIdentityService, useValue: googleIdentity },
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
    await app.init();
    jwt = module.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    googleIdentity.verify.mockResolvedValue(identity);
    userRepo.findOrCreateGoogleUser.mockResolvedValue(user);
    userRepo.findByEmailWithHash.mockResolvedValue(user);
  });

  it('exchanges a verified Google identity for the standard app session', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/google')
      .send({ idToken: 'signed-google-id-token' });

    expect(response.status).toBe(200);
    expect(googleIdentity.verify).toHaveBeenCalledWith(
      'signed-google-id-token',
    );
    expect(userRepo.findOrCreateGoogleUser).toHaveBeenCalledWith(identity);
    const body = response.body as {
      user: { id: string; name: string; email: string };
      token: string;
    };
    expect(body.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    expect(body.token).toEqual(expect.any(String));
    expect(jwt.verify<Record<string, unknown>>(body.token)).toMatchObject({
      sub: user.id,
      email: user.email,
    });
    expect(response.body).not.toHaveProperty('idToken');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.user).not.toHaveProperty('googleSubject');
  });

  it.each([
    ['missing token', {}],
    ['empty token', { idToken: '' }],
    ['non-string token', { idToken: 123 }],
    ['oversized token', { idToken: 'x'.repeat(8193) }],
    [
      'client-supplied identity',
      { idToken: 'signed-token', email: 'attacker@example.com' },
    ],
  ])('rejects %s before verification', async (_label, payload) => {
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/google')
      .send(payload);
    expect(response.status).toBe(400);
    expect(googleIdentity.verify).not.toHaveBeenCalled();
    expect(userRepo.findOrCreateGoogleUser).not.toHaveBeenCalled();
  });

  it('does not create a user or issue a JWT when token verification fails', async () => {
    googleIdentity.verify.mockRejectedValue(
      new UnauthorizedException('Token inválido'),
    );
    const sign = jest.spyOn(jwt, 'sign');
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/google')
      .send({ idToken: 'invalid-token' });
    expect(response.status).toBe(401);
    expect(userRepo.findOrCreateGoogleUser).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
  });

  it('returns an actionable unavailable response when Google is not configured', async () => {
    googleIdentity.verify.mockRejectedValue(
      new ServiceUnavailableException('Login com Google não configurado'),
    );
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/google')
      .send({ idToken: 'token' });
    expect(response.status).toBe(503);
    expect(userRepo.findOrCreateGoogleUser).not.toHaveBeenCalled();
    expect(response.body).not.toHaveProperty('token');
  });

  it('does not issue a session when an existing account cannot be safely linked', async () => {
    userRepo.findOrCreateGoogleUser.mockRejectedValue(
      new ConflictException('Entre com sua senha'),
    );
    const sign = jest.spyOn(jwt, 'sign');
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/google')
      .send({ idToken: 'token' });
    expect(response.status).toBe(409);
    expect(sign).not.toHaveBeenCalled();
  });

  it('rejects password login for a Google-only account without attempting bcrypt on null', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({
        email: user.email,
        password: 'Password1',
      });
    expect(response.status).toBe(401);
    expect(response.body).not.toHaveProperty('token');
  });
});

describe('AuthController — Google rate limiting', () => {
  let app: INestApplication;
  const googleIdentity = { verify: jest.fn() };

  beforeAll(async () => {
    googleIdentity.verify.mockRejectedValue(
      new UnauthorizedException('Token inválido'),
    );
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
        JwtModule.register({
          secret: 'test-only-jwt-secret-at-least-32-characters',
        }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: USER_REPOSITORY, useValue: {} },
        { provide: CATEGORY_REPOSITORY, useValue: {} },
        { provide: GoogleIdentityService, useValue: googleIdentity },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('processes five attempts and rejects the sixth before Google verification', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/google')
        .send({ idToken: 'invalid-token' });
      expect(response.status).toBe(401);
    }
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/google')
      .send({ idToken: 'invalid-token' });
    expect(response.status).toBe(429);
    expect(googleIdentity.verify).toHaveBeenCalledTimes(5);
  });
});
