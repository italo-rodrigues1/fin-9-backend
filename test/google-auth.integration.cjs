const {
  createIntegrationDatabase,
  withDatabaseUser,
} = require('./database.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');
require('dotenv').config({ quiet: true });

if (
  !['localhost', '127.0.0.1', '::1'].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
) {
  throw new Error('Google persistence tests require a local database.');
}

const {
  PrismaUserRepository,
} = require('../dist/src/infrastructure/repositories/prisma-user.repository');
const {
  DEFAULT_CATEGORIES,
} = require('../dist/src/infrastructure/repositories/prisma-category.repository');

test(
  'Google identity persistence against PostgreSQL',
  { timeout: 60000 },
  async (t) => {
    const { db, runtime } = createIntegrationDatabase();
    const repo = new PrismaUserRepository(runtime);
    const cleanup = new Set();
    const prefix = randomUUID();
    const identity = (key, authoritative = true) => ({
      subject: `google-test-${prefix}-${key}`,
      email: `${prefix}-${key}@${authoritative ? 'gmail.com' : 'example.test'}`,
      name: 'Google integration fixture',
      emailAuthoritative: authoritative,
    });
    const createLocal = async (data) => {
      const id = randomUUID();
      cleanup.add(id);
      return db.user.create({
        data: {
          id,
          name: 'Original local profile',
          passwordHash: 'preserved-fixture-hash',
          ...data,
        },
      });
    };
    await db.$connect();
    try {
      await t.test(
        'a new Google account and its categories are committed once without a password',
        async () => {
          const profile = identity('new');
          const user = await repo.findOrCreateGoogleUser(profile);
          cleanup.add(user.id);
          const stored = await db.user.findUniqueOrThrow({
            where: { id: user.id },
          });
          assert.equal(stored.passwordHash, null);
          assert.equal(stored.googleSubject, profile.subject);
          assert.equal(user.passwordHash, undefined);
          assert.equal(user.googleSubject, undefined);
          assert.equal(
            await db.category.count({
              where: { userId: user.id, isDefault: true },
            }),
            DEFAULT_CATEGORIES.length,
          );
          const repeated = await repo.findOrCreateGoogleUser({
            ...profile,
            email: `${prefix}-changed@gmail.com`,
            name: 'Changed provider name',
          });
          assert.equal(repeated.id, user.id);
          assert.equal(repeated.email, profile.email);
          assert.equal(repeated.name, profile.name);
          assert.equal(
            await db.category.count({ where: { userId: user.id } }),
            DEFAULT_CATEGORIES.length,
          );
        },
      );

      await t.test(
        'linking preserves the original password, profile and financial records',
        async () => {
          const profile = identity('link');
          const local = await createLocal({
            email: profile.email.toUpperCase(),
          });
          const account = await db.account.create({
            data: {
              userId: local.id,
              name: 'Existing fixture wallet',
              institution: 'Test',
              balance: '123.45',
            },
          });
          await db.category.create({
            data: { userId: local.id, name: 'Existing category' },
          });
          const linked = await repo.findOrCreateGoogleUser(profile);
          const stored = await db.user.findUniqueOrThrow({
            where: { id: local.id },
          });
          assert.equal(linked.id, local.id);
          assert.equal(linked.name, local.name);
          assert.equal(linked.email, local.email);
          assert.equal(stored.passwordHash, 'preserved-fixture-hash');
          assert.equal(stored.googleSubject, profile.subject);
          assert.equal(
            (
              await db.account.findUniqueOrThrow({ where: { id: account.id } })
            ).balance.toFixed(2),
            '123.45',
          );
          assert.equal(
            await db.category.count({ where: { userId: local.id } }),
            1,
          );
        },
      );

      await t.test(
        'a third-party Google email cannot take over an existing local account',
        async () => {
          const profile = identity('external', false);
          const local = await createLocal({ email: profile.email });
          await assert.rejects(
            repo.findOrCreateGoogleUser(profile),
            (error) => error.getStatus() === 409,
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: local.id } }))
              .googleSubject,
            null,
          );
        },
      );

      await t.test(
        'a different Google subject never replaces an existing association',
        async () => {
          const profile = identity('different-subject');
          const originalSubject = `${profile.subject}-original`;
          const local = await createLocal({
            email: profile.email,
            googleSubject: originalSubject,
          });
          await assert.rejects(
            repo.findOrCreateGoogleUser(profile),
            (error) => error.getStatus() === 409,
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: local.id } }))
              .googleSubject,
            originalSubject,
          );
        },
      );

      await t.test(
        'two simultaneous first logins produce one account and one category set',
        async () => {
          const profile = identity('concurrent-new');
          const users = await Promise.all([
            repo.findOrCreateGoogleUser(profile),
            repo.findOrCreateGoogleUser(profile),
          ]);
          users.forEach((user) => cleanup.add(user.id));
          assert.equal(users[0].id, users[1].id);
          assert.equal(
            await db.user.count({ where: { googleSubject: profile.subject } }),
            1,
          );
          assert.equal(
            await db.category.count({ where: { userId: users[0].id } }),
            DEFAULT_CATEGORIES.length,
          );
        },
      );

      await t.test(
        'two simultaneous links retain the same local account and password',
        async () => {
          const profile = identity('concurrent-link');
          const local = await createLocal({ email: profile.email });
          const users = await Promise.all([
            repo.findOrCreateGoogleUser(profile),
            repo.findOrCreateGoogleUser(profile),
          ]);
          assert.ok(users.every((user) => user.id === local.id));
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: local.id } }))
              .passwordHash,
            'preserved-fixture-hash',
          );
          assert.equal(
            await db.category.count({ where: { userId: local.id } }),
            0,
          );
        },
      );
    } finally {
      try {
        // Remove only the fixture identities created by this test run.
        for (const id of cleanup)
          await withDatabaseUser(id, () => repo.delete(id));
      } finally {
        await db.$disconnect();
        await runtime.$disconnect();
      }
    }
  },
);
