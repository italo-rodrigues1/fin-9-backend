const {
  createIntegrationDatabase,
  withDatabaseUser,
} = require('./database.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
require('reflect-metadata');
require('dotenv').config({ quiet: true });
if (
  !['localhost', '127.0.0.1', '::1'].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error('P1 integration tests require a local database.');
const {
  PrismaTransactionRepository,
} = require('../dist/src/infrastructure/repositories/prisma-transaction.repository');
const {
  PrismaAccountRepository,
} = require('../dist/src/infrastructure/repositories/prisma-account.repository');
const {
  PrismaUserRepository,
} = require('../dist/src/infrastructure/repositories/prisma-user.repository');
const { PlanningService } = require('../dist/src/application/planning.service');
const { TransactionType } = require('../dist/src/domain/entities');
const { recurrenceDate } = require('../dist/src/application/finance-rules');
test('P1 financial rules against PostgreSQL', { timeout: 60000 }, async (t) => {
  const { db, runtime } = createIntegrationDatabase();
  const repo = new PrismaTransactionRepository(runtime),
    planning = new PlanningService(runtime, repo),
    accountRepo = new PrismaAccountRepository(runtime),
    users = new PrismaUserRepository(runtime);
  const userId = randomUUID(),
    otherId = randomUUID();
  let a, b, category;
  await withDatabaseUser(userId, async () => {
    await db.$connect();
    try {
      await db.user.createMany({
        data: [
          {
            id: userId,
            name: 'P1 integration',
            email: userId + '@example.test',
            passwordHash: 'not-a-login',
          },
          {
            id: otherId,
            name: 'Other fixture',
            email: otherId + '@example.test',
            passwordHash: 'not-a-login',
          },
        ],
      });
      a = await db.account.create({
        data: { userId, name: 'Origin', institution: 'Test', balance: 1000 },
      });
      b = await db.account.create({
        data: {
          userId,
          name: 'Destination',
          institution: 'Test',
          balance: 500,
        },
      });
      category = await db.category.create({ data: { userId, name: 'Food' } });
      const payload = {
        userId,
        title: 'Food',
        type: TransactionType.EXPENSE,
        amount: 0.1,
        date: new Date('2026-10-31'),
        accountId: a.id,
        categoryId: category.id,
      };
      const balance = async (id) =>
        (
          await db.account.findUniqueOrThrow({ where: { id } })
        ).balance.toNumber();
      let planned;
      await t.test(
        'planned entries do not move money or enter confirmed reports',
        async () => {
          await repo.create(payload);
          await repo.create({ ...payload, amount: 0.2 });
          planned = await repo.create({
            ...payload,
            amount: 50,
            status: 'PLANNED',
          });
          assert.equal(await balance(a.id), 999.7);
          const summary = await repo.getMonthlySummary(userId, 10, 2026);
          assert.equal(summary.totalExpense, 0.3);
        },
      );
      await t.test(
        'concurrent confirmation debits exactly once; reverting restores the balance',
        async () => {
          await Promise.all([
            repo.update(planned.id, userId, { status: 'CONFIRMED' }),
            repo.update(planned.id, userId, { status: 'CONFIRMED' }),
          ]);
          assert.equal(await balance(a.id), 949.7);
          await repo.update(planned.id, userId, { status: 'PLANNED' });
          assert.equal(await balance(a.id), 999.7);
        },
      );
      const transfer = {
        fromAccountId: a.id,
        toAccountId: b.id,
        amount: 200,
        date: '2026-10-31',
      };
      await t.test(
        'transfer create, edit and delete preserve total money and report totals',
        async () => {
          const row = await planning.transfer(userId, transfer);
          assert.equal(await balance(a.id), 799.7);
          assert.equal(await balance(b.id), 700);
          await planning.transfer(userId, { ...transfer, amount: 300 }, row.id);
          assert.equal(await balance(a.id), 699.7);
          assert.equal(await balance(b.id), 800);
          assert.equal(
            (await repo.getMonthlySummary(userId, 10, 2026)).totalExpense,
            0.3,
          );
          await planning.deleteTransfer(userId, row.id);
          assert.equal(await balance(a.id), 999.7);
          assert.equal(await balance(b.id), 500);
        },
      );
      await t.test(
        'same-account, foreign-account and archived-account transfers are rejected without partial writes',
        async () => {
          await assert.rejects(
            planning.transfer(userId, { ...transfer, toAccountId: a.id }),
          );
          await assert.rejects(planning.transfer(otherId, transfer));
          await accountRepo.update(a.id, userId, { isArchived: true });
          await assert.rejects(planning.transfer(userId, transfer));
          await assert.rejects(repo.create(payload));
          assert.equal(await balance(a.id), 999.7);
          await accountRepo.update(a.id, userId, { isArchived: false });
        },
      );
      await t.test(
        'simultaneous transfers stay atomic under serialization conflicts',
        async () => {
          const results = await Promise.allSettled(
            Array.from({ length: 4 }, () =>
              planning.transfer(userId, { ...transfer, amount: 0.1 }),
            ),
          );
          const success = results.filter(
            (r) => r.status === 'fulfilled',
          ).length;
          assert.ok(success > 0);
          assert.equal(await db.transfer.count({ where: { userId } }), success);
          assert.equal(
            await balance(a.id),
            Number((999.7 - success * 0.1).toFixed(2)),
          );
          assert.equal(
            await balance(b.id),
            Number((500 + success * 0.1).toFixed(2)),
          );
          for (const row of results)
            if (row.status === 'rejected')
              assert.equal(row.reason.code, 'P2034');
        },
      );
      await t.test(
        'budgets track confirmed expenses and recalculate after edits and deletion',
        async () => {
          await planning.saveBudget(userId, {
            month: 10,
            year: 2026,
            categoryId: category.id,
            amount: 1,
          });
          let [budget] = await planning.budgets(userId, {
            month: 10,
            year: 2026,
          });
          assert.equal(budget.used, 0.3);
          assert.equal(budget.remaining, 0.7);
          const row = await repo.create({ ...payload, amount: 0.5 });
          [budget] = await planning.budgets(userId, { month: 10, year: 2026 });
          assert.equal(budget.alert, 'WARNING');
          await repo.update(row.id, userId, { amount: 0.7 });
          [budget] = await planning.budgets(userId, { month: 10, year: 2026 });
          assert.equal(budget.alert, 'EXCEEDED');
          await repo.delete(row.id, userId);
          [budget] = await planning.budgets(userId, { month: 10, year: 2026 });
          assert.equal(budget.alert, 'OK');
          assert.equal(budget.used, 0.3);
        },
      );
      await t.test(
        'monthly and yearly anchors recover month end and leap day',
        () => {
          assert.equal(
            recurrenceDate(new Date('2026-01-31'), 'MONTHLY', 1)
              .toISOString()
              .slice(0, 10),
            '2026-02-28',
          );
          assert.equal(
            recurrenceDate(new Date('2026-01-31'), 'MONTHLY', 2)
              .toISOString()
              .slice(0, 10),
            '2026-03-31',
          );
          assert.equal(
            recurrenceDate(new Date('2024-02-29'), 'YEARLY', 4)
              .toISOString()
              .slice(0, 10),
            '2028-02-29',
          );
        },
      );
      await t.test(
        'recurrences materialize once, preserve confirmed occurrences and stop future pending entries',
        async () => {
          const before = await balance(a.id);
          const start = new Date().toISOString().slice(0, 10);
          const rule = await planning.createRecurrence(userId, {
            title: 'Rent',
            amount: 10,
            type: 'EXPENSE',
            accountId: a.id,
            categoryId: category.id,
            interval: 'MONTHLY',
            startDate: start,
          });
          const count = await db.transaction.count({
            where: { recurrenceId: rule.id },
          });
          assert.ok(count >= 12);
          await Promise.all([
            planning.materialize(userId),
            planning.materialize(userId),
          ]);
          assert.equal(
            await db.transaction.count({ where: { recurrenceId: rule.id } }),
            count,
          );
          assert.equal(await balance(a.id), before);
          const first = await db.transaction.findFirstOrThrow({
            where: { recurrenceId: rule.id },
            orderBy: { date: 'asc' },
          });
          await repo.update(first.id, userId, { status: 'CONFIRMED' });
          await planning.editRecurrence(userId, rule.id, {
            effectiveDate: start,
            amount: 20,
            title: 'Updated rent',
          });
          assert.equal(
            (
              await db.transaction.findUniqueOrThrow({
                where: { id: first.id },
              })
            ).amount.toNumber(),
            10,
          );
          assert.equal(
            (
              await db.transaction.findFirstOrThrow({
                where: { recurrenceId: rule.id, status: 'PLANNED' },
              })
            ).amount.toNumber(),
            20,
          );
          const cutoff = recurrenceDate(new Date(start), 'MONTHLY', 1)
            .toISOString()
            .slice(0, 10);
          await planning.editRecurrence(userId, rule.id, {
            effectiveDate: start,
            endDate: cutoff,
          });
          await planning.materialize(userId);
          assert.equal(
            await db.transaction.count({ where: { recurrenceId: rule.id } }),
            2,
          );
          await planning.editRecurrence(userId, rule.id, {
            effectiveDate: start,
            endDate: null,
          });
          await planning.materialize(userId);
          assert.equal(
            await db.transaction.count({ where: { recurrenceId: rule.id } }),
            count,
          );
          await planning.editRecurrence(userId, rule.id, {
            effectiveDate: start,
            active: false,
          });
          assert.equal(
            await db.transaction.count({
              where: { recurrenceId: rule.id, status: 'PLANNED' },
            }),
            0,
          );
          assert.equal(
            await db.transaction.count({
              where: { recurrenceId: rule.id, status: 'CONFIRMED' },
            }),
            1,
          );
        },
      );
      await t.test(
        'combined filters and progressive history keep stable ownership and order',
        async () => {
          const found = await repo.findAll({
            userId,
            accountId: a.id,
            categoryId: category.id,
            type: TransactionType.EXPENSE,
            status: 'CONFIRMED',
            search: 'food',
            month: 10,
            year: 2026,
            skip: 0,
            take: 1,
            orderBy: 'amount',
            orderDir: 'desc',
          });
          assert.equal(found.length, 1);
          assert.equal(found[0].amount, 0.2);
          assert.equal(
            (await repo.findAll({ userId: otherId, search: 'food', take: 30 }))
              .length,
            0,
          );
          const statement = await planning.statement(userId, a.id, {
            skip: 0,
            take: 1,
          });
          assert.equal(statement.entries.length, 1);
          assert.equal(statement.hasMore, true);
          await assert.rejects(
            planning.statement(otherId, a.id, { skip: 0, take: 30 }),
          );
        },
      );
      await t.test(
        'archived accounts stay in totals and retain ledger access',
        async () => {
          const before = await planning.report(userId, {
            month: 10,
            year: 2026,
          });
          await accountRepo.update(a.id, userId, { isArchived: true });
          const after = await planning.report(userId, {
            month: 10,
            year: 2026,
          });
          assert.equal(after.currentBalance, before.currentBalance);
          assert.ok(after.accounts.find((row) => row.id === a.id).isArchived);
          assert.ok(
            (await planning.statement(userId, a.id, { skip: 0, take: 30 }))
              .entries.length > 0,
          );
        },
      );
    } finally {
      await withDatabaseUser(userId, () => users.delete(userId));
      await withDatabaseUser(otherId, () => users.delete(otherId));
      assert.equal(await db.transaction.count({ where: { userId } }), 0);
      assert.equal(await db.transfer.count({ where: { userId } }), 0);
      await db.$disconnect();
      await runtime.$disconnect();
    }
  });
});
