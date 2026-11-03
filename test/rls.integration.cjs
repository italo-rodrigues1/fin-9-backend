const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

// Runs real PostgreSQL policies in an isolated in-memory database. No .env is
// loaded, and no external database or existing user records are accessed.
const tables = [
  'users',
  'accounts',
  'categories',
  'transactions',
  'transfers',
  'recurrences',
  'budgets',
  'goals',
  'goal_contributions',
  'credit_cards',
  'card_purchases',
  'card_invoices',
  'card_installments',
  'card_payments',
];

async function insert(db, table, values) {
  const fields = Object.keys(values);
  return db.query(
    `INSERT INTO "${table}" (${fields.map((key) => `"${key}"`).join(', ')}) VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')})`,
    Object.values(values),
  );
}

async function fixture(db, key) {
  const now = '2026-11-03T00:00:00Z';
  const dated = { created_at: now, updated_at: now };
  const owned = { user_id: key, ...dated };
  await insert(db, 'users', {
    id: key,
    name: key,
    email: `${key}@example.test`,
    password_hash: 'fixture-only',
    google_subject: `google-${key}`,
    ...dated,
  });
  for (const suffix of ['', '-second']) {
    await insert(db, 'accounts', {
      id: `${key}-account${suffix}`,
      name: key,
      institution: 'Fixture',
      balance: 100,
      ...owned,
    });
  }
  await insert(db, 'categories', {
    id: `${key}-category`,
    name: key,
    ...owned,
  });
  await insert(db, 'goals', {
    id: `${key}-goal`,
    name: key,
    target_amount: 1000,
    ...owned,
  });
  await insert(db, 'credit_cards', {
    id: `${key}-card`,
    name: key,
    credit_limit: 1000,
    closing_day: 10,
    due_day: 20,
    ...owned,
  });
  await insert(db, 'recurrences', {
    id: `${key}-recurrence`,
    account_id: `${key}-account`,
    category_id: `${key}-category`,
    title: key,
    amount: 10,
    type: 'EXPENSE',
    interval: 'MONTHLY',
    start_date: '2026-11-01',
    ...owned,
  });
  await insert(db, 'card_purchases', {
    id: `${key}-purchase`,
    card_id: `${key}-card`,
    category_id: `${key}-category`,
    title: key,
    amount: 10,
    date: '2026-11-01',
    installment_count: 1,
    ...owned,
  });
  await insert(db, 'card_invoices', {
    id: `${key}-invoice`,
    user_id: key,
    card_id: `${key}-card`,
    year: 2026,
    month: 11,
    closing_date: '2026-11-10',
    due_date: '2026-11-20',
    created_at: now,
  });
  await insert(db, 'card_payments', {
    id: `${key}-payment`,
    user_id: key,
    invoice_id: `${key}-invoice`,
    account_id: `${key}-account`,
    amount: 10,
    date: '2026-11-20',
    request_id: `${key}-payment-request`,
    created_at: now,
  });
  await insert(db, 'transactions', {
    id: `${key}-transaction`,
    title: key,
    amount: 10,
    type: 'EXPENSE',
    date: '2026-11-01',
    category_id: `${key}-category`,
    account_id: `${key}-account`,
    recurrence_id: `${key}-recurrence`,
    card_payment_id: `${key}-payment`,
    ...owned,
  });
  await insert(db, 'transfers', {
    id: `${key}-transfer`,
    from_account_id: `${key}-account`,
    to_account_id: `${key}-account-second`,
    amount: 10,
    date: '2026-11-01',
    ...owned,
  });
  await insert(db, 'budgets', {
    id: `${key}-budget`,
    category_id: `${key}-category`,
    year: 2026,
    month: 11,
    amount: 100,
    ...owned,
  });
  await insert(db, 'goal_contributions', {
    id: `${key}-contribution`,
    goal_id: `${key}-goal`,
    account_id: `${key}-account`,
    amount: 10,
    date: '2026-11-01',
    ...owned,
  });
  await insert(db, 'card_installments', {
    id: `${key}-installment`,
    purchase_id: `${key}-purchase`,
    invoice_id: `${key}-invoice`,
    number: 1,
    amount: 10,
  });
}

async function context(db, identity, callback, role = 'fin9_runtime') {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    await db.query(
      `SELECT set_config('app.user_id', $1, true), set_config('app.auth_email', $2, true), set_config('app.auth_subject', $3, true)`,
      [identity.userId || '', identity.email || '', identity.subject || ''],
    );
    return await callback();
  } finally {
    await db.exec('ROLLBACK');
  }
}

test(
  'RLS isolates every table and linked financial records',
  { timeout: 120000 },
  async (t) => {
    const db = new PGlite();
    try {
      const migrations = path.join(__dirname, '..', 'prisma', 'migrations');
      for (const name of (await readdir(migrations))
        .filter((entry) => /^\d/.test(entry))
        .sort()) {
        await db.exec(
          await readFile(path.join(migrations, name, 'migration.sql'), 'utf8'),
        );
      }
      await fixture(db, 'alice');
      await fixture(db, 'bob');

      await t.test(
        'all 14 tables enable and force RLS; runtime cannot bypass',
        async () => {
          const result = await db.query(
            `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1::text[])`,
            [tables],
          );
          assert.equal(result.rows.length, tables.length);
          for (const row of result.rows) {
            assert.equal(row.relrowsecurity, true, row.relname);
            assert.equal(row.relforcerowsecurity, true, row.relname);
          }
          const role = (
            await db.query(
              `SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = 'fin9_runtime'`,
            )
          ).rows[0];
          assert.deepEqual(role, {
            rolsuper: false,
            rolbypassrls: false,
            rolcanlogin: false,
          });
        },
      );

      await t.test('missing context reads no rows from any table', async () => {
        await context(db, {}, async () => {
          for (const table of tables) {
            assert.equal(
              (await db.query(`SELECT * FROM "${table}"`)).rows.length,
              0,
              table,
            );
          }
        });
      });

      await t.test(
        'other permissive policies cannot widen runtime ownership',
        async () => {
          await db.exec(`
        CREATE POLICY legacy_access ON accounts FOR ALL TO fin9_runtime USING (true) WITH CHECK (true);
        CREATE POLICY legacy_access ON users FOR ALL TO fin9_runtime USING (true) WITH CHECK (true)
      `);
          try {
            await context(db, { userId: 'alice' }, async () => {
              assert.equal(
                (await db.query('SELECT id FROM accounts')).rows.length,
                2,
              );
              assert.deepEqual((await db.query('SELECT id FROM users')).rows, [
                { id: 'alice' },
              ]);
            });
            await context(db, {}, async () => {
              assert.equal(
                (await db.query('SELECT id FROM accounts')).rows.length,
                0,
              );
              assert.equal(
                (await db.query('SELECT id FROM users')).rows.length,
                0,
              );
            });
            await context(db, { email: 'alice@example.test' }, async () => {
              assert.equal(
                (
                  await db.query(
                    `UPDATE users SET name = 'changed' RETURNING id`,
                  )
                ).rows.length,
                0,
              );
            });
          } finally {
            await db.exec(
              'DROP POLICY legacy_access ON accounts; DROP POLICY legacy_access ON users',
            );
          }
        },
      );

      await t.test(
        'each owner sees and can update only their rows; foreign deletes affect zero rows',
        async () => {
          for (const userId of ['alice', 'bob']) {
            await context(db, { userId }, async () => {
              for (const table of tables) {
                const rows = (await db.query(`SELECT id FROM "${table}"`)).rows;
                assert.equal(
                  rows.length,
                  table === 'accounts' ? 2 : 1,
                  `${userId}/${table}`,
                );
                assert.ok(
                  rows.every((row) => row.id.startsWith(userId)),
                  table,
                );
                const updated = await db.query(
                  `UPDATE "${table}" SET id = id RETURNING id`,
                );
                assert.equal(updated.rows.length, rows.length, table);
                const removed = await db.query(
                  `DELETE FROM "${table}" WHERE id LIKE $1 RETURNING id`,
                  [`${userId === 'alice' ? 'bob' : 'alice'}%`],
                );
                assert.equal(removed.rows.length, 0, table);
              }
            });
          }
        },
      );

      await t.test(
        'owner can create a complete financial graph and delete unreferenced own rows',
        async () => {
          await context(db, { userId: 'carol' }, async () => {
            await fixture(db, 'carol');
            for (const table of tables) {
              assert.ok(
                (await db.query(`SELECT id FROM "${table}"`)).rows.every(
                  (row) => row.id.startsWith('carol'),
                ),
              );
            }
            await insert(db, 'goals', {
              id: 'temporary-goal',
              user_id: 'carol',
              name: 'Temporary',
              target_amount: 1,
              updated_at: new Date().toISOString(),
            });
            assert.equal(
              (
                await db.query(
                  `DELETE FROM goals WHERE id = 'temporary-goal' RETURNING id`,
                )
              ).rows.length,
              1,
            );
          });
        },
      );

      await t.test(
        'cannot assign another owner during insert or update',
        async () => {
          await assert.rejects(
            context(db, { userId: 'alice' }, () =>
              insert(db, 'accounts', {
                id: 'forged-owner',
                user_id: 'bob',
                name: 'Forged',
                institution: 'Fixture',
                balance: 0,
                updated_at: new Date().toISOString(),
              }),
            ),
            { code: '42501' },
          );
          await assert.rejects(
            context(db, { userId: 'alice' }, () =>
              db.query(
                `UPDATE accounts SET user_id = 'bob' WHERE id = 'alice-account'`,
              ),
            ),
            { code: '42501' },
          );
        },
      );

      const foreignReferences = [
        ['transactions', 'account_id', 'bob-account'],
        ['transactions', 'category_id', 'bob-category'],
        ['transactions', 'recurrence_id', 'bob-recurrence'],
        ['transactions', 'card_payment_id', 'bob-payment'],
        ['transfers', 'from_account_id', 'bob-account'],
        ['transfers', 'to_account_id', 'bob-account'],
        ['recurrences', 'account_id', 'bob-account'],
        ['recurrences', 'category_id', 'bob-category'],
        ['budgets', 'category_id', 'bob-category'],
        ['goal_contributions', 'goal_id', 'bob-goal'],
        ['goal_contributions', 'account_id', 'bob-account'],
        ['card_purchases', 'card_id', 'bob-card'],
        ['card_purchases', 'category_id', 'bob-category'],
        ['card_invoices', 'card_id', 'bob-card'],
        ['card_payments', 'invoice_id', 'bob-invoice'],
        ['card_payments', 'account_id', 'bob-account'],
        ['card_installments', 'purchase_id', 'bob-purchase'],
        ['card_installments', 'invoice_id', 'bob-invoice'],
      ];
      for (const [table, column, otherId] of foreignReferences) {
        await t.test(
          `rejects foreign ${table}.${column}, despite valid foreign key`,
          async () => {
            await assert.rejects(
              context(db, { userId: 'alice' }, () =>
                db.query(`UPDATE "${table}" SET "${column}" = $1`, [otherId]),
              ),
              { code: '42501' },
            );
          },
        );
      }

      await t.test(
        'auth lookup sees only matching user and no financial data or write permission',
        async () => {
          for (const identity of [
            { email: 'ALICE@example.test' },
            { subject: 'google-alice' },
          ]) {
            await context(db, identity, async () => {
              assert.deepEqual((await db.query('SELECT id FROM users')).rows, [
                { id: 'alice' },
              ]);
              assert.equal(
                (await db.query('SELECT * FROM accounts')).rows.length,
                0,
              );
              assert.equal(
                (
                  await db.query(
                    `UPDATE users SET name = 'changed' RETURNING id`,
                  )
                ).rows.length,
                0,
              );
            });
          }
          await context(
            db,
            { email: 'missing@example.test', subject: 'missing' },
            async () => {
              assert.equal(
                (await db.query('SELECT id FROM users')).rows.length,
                0,
              );
            },
          );
        },
      );

      await t.test(
        'transaction rollback clears the previous identity on a reused connection',
        async () => {
          await context(db, { userId: 'alice' }, () =>
            db.query('SELECT * FROM accounts'),
          );
          await db.exec('BEGIN; SET LOCAL ROLE fin9_runtime');
          try {
            assert.equal(
              (await db.query('SELECT * FROM accounts')).rows.length,
              0,
            );
          } finally {
            await db.exec('ROLLBACK');
          }
        },
      );

      await t.test(
        'FORCE protects an ordinary table owner as well',
        async () => {
          await db.exec(
            'CREATE ROLE fin9_test_owner NOLOGIN; GRANT fin9_runtime TO fin9_test_owner; ALTER TABLE accounts OWNER TO fin9_test_owner',
          );
          await context(
            db,
            {},
            async () => {
              assert.equal(
                (await db.query('SELECT * FROM accounts')).rows.length,
                0,
              );
            },
            'fin9_test_owner',
          );
        },
      );

      await t.test(
        'policies do not authorize unrelated database roles',
        async () => {
          await db.exec(
            'CREATE ROLE fin9_untrusted NOLOGIN; GRANT USAGE ON SCHEMA public TO fin9_untrusted; GRANT SELECT ON ALL TABLES IN SCHEMA public TO fin9_untrusted',
          );
          await context(
            db,
            { userId: 'alice', email: 'alice@example.test' },
            async () => {
              assert.equal(
                (await db.query('SELECT * FROM users')).rows.length,
                0,
              );
              assert.equal(
                (await db.query('SELECT * FROM accounts')).rows.length,
                0,
              );
            },
            'fin9_untrusted',
          );
        },
      );
    } finally {
      await db.close();
    }
  },
);
