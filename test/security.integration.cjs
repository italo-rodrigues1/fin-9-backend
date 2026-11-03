const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');
require('dotenv').config({ quiet: true });

if (
  !['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
) {
  throw new Error(
    'Security integration tests require a local migrated PostgreSQL database.',
  );
}
process.env.JWT_SECRET =
  'security-integration-only-secret-at-least-32-characters';
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const helmet = require('helmet').default ?? require('helmet');
const request = require('supertest');
const { AppModule } = require('../dist/src/app.module');
const {
  setupApiDocumentation,
} = require('../dist/src/presentation/documentation/api-documentation');
const {
  PrismaService,
} = require('../dist/src/infrastructure/database/prisma.service');
const {
  withDatabaseUser,
} = require('../dist/src/infrastructure/database/database-context');
const {
  GlobalExceptionFilter,
} = require('../dist/src/presentation/filters/global-exception.filter');

test(
  'HTTP authentication and PostgreSQL RLS work together',
  { timeout: 60000 },
  async (t) => {
    const app = await NestFactory.create(AppModule, { logger: false });
    app.use(helmet());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    setupApiDocumentation(app);
    await app.init();
    const http = app.getHttpServer();
    const db = app.get(PrismaService);
    const profiles = [];
    const password = 'Security123!';
    const register = async () => {
      const email = `security-${randomUUID()}@example.test`;
      const response = await request(http)
        .post('/auth/register')
        .send({ name: 'Security fixture', email, password });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      profiles.push(response.body);
      return { ...response.body, email };
    };
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    try {
      await t.test(
        'Swagger, Scalar and local assets load with security headers',
        async () => {
          for (const url of [
            '/docs',
            '/reference',
            '/openapi.json',
            '/reference/scalar.js',
          ]) {
            const response = await request(http).get(url);
            assert.equal(response.status, 200, url);
            assert.equal(response.headers['x-content-type-options'], 'nosniff');
          }
          const api = await request(http).get('/health');
          assert.ok(
            !api.headers['content-security-policy'].includes(
              "script-src 'self' 'unsafe-inline'",
            ),
          );
        },
      );
      const a = await register();
      const b = await register();
      let accountA, accountB, categoryA, categoryB;
      await t.test(
        'anonymous access and owner injection are rejected',
        async () => {
          assert.equal((await request(http).get('/accounts')).status, 401);
          const response = await request(http)
            .post('/accounts')
            .set(auth(a.token))
            .send({
              name: 'Injected',
              institution: 'Test',
              balance: 0,
              userId: b.user.id,
            });
          assert.equal(response.status, 400);
        },
      );
      await t.test(
        'signup, login and private responses expose only public fields',
        async () => {
          const login = await request(http)
            .post('/auth/login')
            .send({ email: a.email, password });
          assert.equal(login.status, 200);
          assert.deepEqual(Object.keys(login.body).sort(), ['token', 'user']);
          const create = async (profile) => {
            const response = await request(http)
              .post('/accounts')
              .set(auth(profile.token))
              .send({ name: 'Cash', institution: 'Test', balance: 100 });
            assert.equal(response.status, 201, JSON.stringify(response.body));
            assert.equal('userId' in response.body, false);
            return response.body;
          };
          accountA = await create(a);
          accountB = await create(b);
          const categories = async (profile) => {
            const response = await request(http)
              .get('/categories')
              .set(auth(profile.token));
            assert.equal(response.status, 200);
            assert.ok(response.body.length > 0);
            return response.body[0];
          };
          categoryA = await categories(a);
          categoryB = await categories(b);
          const me = await request(http).get('/auth/me').set(auth(a.token));
          assert.equal(me.status, 200);
          assert.equal('passwordHash' in me.body, false);
          assert.equal('googleSubject' in me.body, false);
        },
      );
      await t.test(
        'HTTP lookups and writes cannot cross account boundaries',
        async () => {
          const list = await request(http).get('/accounts').set(auth(a.token));
          assert.deepEqual(
            list.body.map((row) => row.id),
            [accountA.id],
          );
          assert.equal(
            (
              await request(http)
                .patch(`/accounts/${accountB.id}`)
                .set(auth(a.token))
                .send({ name: 'Stolen' })
            ).status,
            404,
          );
          const payload = {
            title: 'Expense',
            amount: 10,
            type: 'EXPENSE',
            date: '2026-11-02',
            accountId: accountA.id,
            categoryId: categoryB.id,
          };
          assert.equal(
            (
              await request(http)
                .post('/transactions')
                .set(auth(a.token))
                .send(payload)
            ).status,
            400,
          );
          payload.categoryId = categoryA.id;
          const valid = await request(http)
            .post('/transactions')
            .set(auth(a.token))
            .send(payload);
          assert.equal(valid.status, 201, JSON.stringify(valid.body));
          assert.equal('userId' in valid.body, false);
        },
      );
      await t.test(
        'unfiltered Prisma and raw queries are isolated by the database',
        async () => {
          const rows = await withDatabaseUser(a.user.id, () =>
            db.account.findMany(),
          );
          assert.deepEqual(
            rows.map((row) => row.id),
            [accountA.id],
          );
          const raw = await withDatabaseUser(
            b.user.id,
            () => db.$queryRaw`SELECT id FROM public.accounts`,
          );
          assert.deepEqual(
            raw.map((row) => row.id),
            [accountB.id],
          );
          await assert.rejects(
            withDatabaseUser(a.user.id, () =>
              db.account.create({
                data: {
                  userId: b.user.id,
                  name: 'Forbidden',
                  institution: 'Test',
                  balance: 0,
                },
              }),
            ),
          );
          assert.deepEqual(await db.account.findMany(), []);
        },
      );
      await t.test(
        'transaction-local role and identity survive retries without leaking through the pool',
        async () => {
          const results = await Promise.all(
            [a, b, a, b].map((profile) =>
              withDatabaseUser(profile.user.id, () =>
                db.$transaction(
                  async (tx) => {
                    const context =
                      await tx.$queryRaw`SELECT current_user AS role, current_setting('app.user_id') AS id`;
                    assert.equal(context[0].role, 'fin9_runtime');
                    assert.equal(context[0].id, profile.user.id);
                    return tx.account.findMany();
                  },
                  { isolationLevel: 'Serializable' },
                ),
              ),
            ),
          );
          results.forEach((rows, index) =>
            assert.equal(rows[0].id, index % 2 ? accountB.id : accountA.id),
          );
          assert.deepEqual(await db.account.findMany(), []);
        },
      );
    } finally {
      try {
        for (const profile of profiles) {
          const response = await request(http)
            .delete('/auth/account')
            .set(auth(profile.token));
          assert.equal(response.status, 200, JSON.stringify(response.body));
        }
      } finally {
        await app.close();
      }
    }
  },
);
