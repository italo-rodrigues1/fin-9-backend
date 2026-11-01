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
  throw Error('Local database only.');
const {
    PrismaService,
  } = require('../dist/src/infrastructure/database/prisma.service'),
  {
    PrismaAccountRepository,
  } = require('../dist/src/infrastructure/repositories/prisma-account.repository'),
  {
    PrismaTransactionRepository,
  } = require('../dist/src/infrastructure/repositories/prisma-transaction.repository'),
  {
    PrismaUserRepository,
  } = require('../dist/src/infrastructure/repositories/prisma-user.repository'),
  { PlanningService } = require('../dist/src/application/planning.service'),
  { GoalsService } = require('../dist/src/application/goals.service'),
  { CardsService } = require('../dist/src/application/cards.service');
test(
  'Account removal preserves history while excluding cash',
  { timeout: 60000 },
  async (t) => {
    const db = new PrismaService(),
      accounts = new PrismaAccountRepository(db),
      transactions = new PrismaTransactionRepository(db),
      users = new PrismaUserRepository(db),
      planning = new PlanningService(db, transactions),
      goals = new GoalsService(db),
      cards = new CardsService(db),
      userId = randomUUID(),
      otherId = randomUUID(),
      now = require('../dist/src/application/business-day').businessDay(),
      date = now.toISOString().slice(0, 10),
      period = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
    await db.$connect();
    try {
      await db.user.createMany({
        data: [userId, otherId].map((id) => ({
          id,
          name: 'Removal integration',
          email: id + '@example.test',
          passwordHash: 'not-a-login',
        })),
      });
      const a = await accounts.create({
          userId,
          name: 'A',
          institution: 'Test',
          balance: 1000,
        }),
        b = await accounts.create({
          userId,
          name: 'B',
          institution: 'Test',
          balance: 500,
        }),
        negative = await db.account.create({
          data: { userId, name: 'Negative', institution: 'Test', balance: -50 },
        }),
        category = await db.category.create({ data: { userId, name: 'Food' } });
      const payload = {
          userId,
          title: 'Food',
          amount: 20,
          type: 'EXPENSE',
          date: new Date(date),
          accountId: a.id,
          categoryId: category.id,
        },
        expense = await transactions.create(payload);
      await transactions.create({
        ...payload,
        type: 'INCOME',
        amount: 5,
        accountId: b.id,
      });
      const transfer = await planning.transfer(userId, {
        fromAccountId: a.id,
        toAccountId: b.id,
        amount: 100,
        date,
      });
      const goal = await goals.saveGoal(userId, {
        name: 'Reserve',
        targetAmount: 1000,
      });
      await goals.saveContribution(userId, goal.id, {
        accountId: a.id,
        amount: 200,
        date,
      });
      await planning.createRecurrence(userId, {
        title: 'Bill',
        amount: 30,
        type: 'EXPENSE',
        accountId: a.id,
        categoryId: category.id,
        interval: 'MONTHLY',
        startDate: date,
      });
      await transactions.create({ ...payload, amount: 25, status: 'PLANNED' });
      await transactions.create({
        ...payload,
        accountId: b.id,
        amount: 40,
        status: 'PLANNED',
      });
      const card = await cards.saveCard(userId, {
          name: 'Card',
          creditLimit: 500,
          closingDay: 10,
          dueDay: 15,
        }),
        purchase = await cards.savePurchase(userId, card.id, {
          title: 'Purchase',
          amount: 200,
          installmentCount: 2,
          categoryId: category.id,
          date: new Date(Date.UTC(period.year, period.month - 3, 1))
            .toISOString()
            .slice(0, 10),
        }),
        parts = await cards.purchase(userId, card.id, purchase.id),
        invoiceId = parts.installments[0].invoiceId,
        payment = await cards.pay(userId, card.id, invoiceId, {
          accountId: a.id,
          date,
          requestId: 'remove-pay-' + randomUUID(),
        }),
        before = await planning.report(userId, period),
        amountA = Number(
          (await db.account.findUniqueOrThrow({ where: { id: a.id } })).balance,
        ),
        balanceB = Number(
          (await db.account.findUniqueOrThrow({ where: { id: b.id } })).balance,
        ),
        txCount = await db.transaction.count({ where: { userId } });
      await t.test(
        'removes the signed account balance once and leaves other accounts untouched',
        async () => {
          await accounts.delete(a.id, userId);
          const after = await planning.report(userId, period);
          assert.equal(after.currentBalance, before.currentBalance - amountA);
          assert.equal(
            Number(
              (await db.account.findUniqueOrThrow({ where: { id: b.id } }))
                .balance,
            ),
            balanceB,
          );
          assert.equal(await accounts.findById(a.id, userId), null);
          assert.ok(
            !(await accounts.findAll(userId)).some((x) => x.id === a.id),
          );
          assert.ok(
            (await db.account.findUniqueOrThrow({ where: { id: a.id } }))
              .deletedAt,
          );
          await accounts.delete(a.id, userId);
          assert.equal(
            (await planning.report(userId, period)).currentBalance,
            after.currentBalance,
          );
        },
      );
      await t.test(
        'retains realized transactions, transfers, payments and original report totals',
        async () => {
          const after = await planning.report(userId, period);
          assert.equal(after.totalExpense, before.totalExpense);
          assert.equal(after.totalIncome, before.totalIncome);
          assert.equal(
            await db.transaction.count({ where: { userId } }),
            txCount,
          );
          assert.equal(await db.transfer.count({ where: { userId } }), 1);
          assert.equal(await db.cardPayment.count({ where: { userId } }), 1);
          assert.ok(
            (await transactions.findById(expense.id, userId)).account.deletedAt,
          );
          assert.equal(
            (
              await cards.invoice(userId, card.id, invoiceId, {
                skip: 0,
                take: 30,
              })
            ).invoice.status,
            'PAID',
          );
        },
      );
      await t.test(
        'removes the account from forecasts and reminders, and stops recurrence generation',
        async () => {
          assert.equal(
            (await planning.report(userId, period)).plannedExpense,
            40,
          );
          assert.ok(
            (await planning.upcoming(userId)).every(
              (x) => x.accountId !== a.id,
            ),
          );
          assert.equal(
            (
              await db.recurrence.findFirstOrThrow({
                where: { userId, accountId: a.id },
              })
            ).active,
            false,
          );
          const count = await db.transaction.count({
            where: { userId, accountId: a.id },
          });
          await planning.materialize(userId);
          assert.equal(
            await db.transaction.count({ where: { userId, accountId: a.id } }),
            count,
          );
        },
      );
      await t.test(
        'keeps goal contribution history but no longer counts the removed cash as backing',
        async () => {
          const detail = await goals.detail(userId, goal.id, {
            skip: 0,
            take: 30,
          });
          assert.equal(detail.goal.currentAmount, 0);
          assert.equal(detail.goal.allocatedAmount, 200);
          assert.equal(detail.goal.shortfall, 200);
          assert.ok(detail.contributions[0].account.deletedAt);
          assert.ok(!detail.accounts.some((x) => x.id === a.id));
          await assert.rejects(
            goals.saveContribution(userId, goal.id, {
              accountId: a.id,
              amount: 1,
              date,
            }),
            { status: 400 },
          );
        },
      );
      await t.test(
        'prevents new financial writes and makes existing entries read-only',
        async () => {
          await assert.rejects(
            accounts.update(a.id, userId, { name: 'Changed' }),
          );
          await assert.rejects(transactions.create(payload));
          await assert.rejects(
            transactions.update(expense.id, userId, { amount: 30 }),
            { status: 409 },
          );
          await assert.rejects(transactions.delete(expense.id, userId), {
            status: 409,
          });
          await assert.rejects(
            planning.transfer(userId, {
              fromAccountId: a.id,
              toAccountId: b.id,
              amount: 1,
              date,
            }),
            { status: 400 },
          );
          await assert.rejects(
            planning.transfer(
              userId,
              { fromAccountId: b.id, toAccountId: b.id, amount: 1, date },
              transfer.id,
            ),
          );
          await assert.rejects(planning.deleteTransfer(userId, transfer.id), {
            status: 400,
          });
          await assert.rejects(
            cards.reverse(userId, card.id, invoiceId, payment.id),
            { status: 409 },
          );
          await assert.rejects(
            cards.pay(userId, card.id, parts.installments[1].invoiceId, {
              accountId: a.id,
              date,
              requestId: 'removed-' + randomUUID(),
            }),
            { status: 400 },
          );
          await assert.rejects(
            planning.createRecurrence(userId, {
              title: 'Bad',
              amount: 1,
              type: 'EXPENSE',
              accountId: a.id,
              categoryId: category.id,
              interval: 'MONTHLY',
              startDate: date,
            }),
            { status: 400 },
          );
          assert.equal(
            (await planning.report(userId, period)).totalExpense,
            before.totalExpense,
          );
        },
      );
      await t.test(
        'supports paying remaining invoices from another active account',
        async () => {
          await cards.pay(userId, card.id, parts.installments[1].invoiceId, {
            accountId: b.id,
            date,
            requestId: 'active-' + randomUUID(),
          });
          assert.equal(
            Number(
              (await db.account.findUniqueOrThrow({ where: { id: b.id } }))
                .balance,
            ),
            balanceB - 100,
          );
        },
      );
      await t.test(
        'removing negative balances subtracts their signed value, without changing reports',
        async () => {
          const beforeNegative = await planning.report(userId, period);
          await accounts.delete(negative.id, userId);
          const after = await planning.report(userId, period);
          assert.equal(
            after.currentBalance,
            beforeNegative.currentBalance + 50,
          );
          assert.equal(after.totalExpense, beforeNegative.totalExpense);
        },
      );
      await t.test(
        'concurrent deletion and transfer cannot leave a partial movement',
        async () => {
          const c = await accounts.create({
              userId,
              name: 'Race',
              institution: 'Test',
              balance: 100,
            }),
            previous = Number(
              (await db.account.findUniqueOrThrow({ where: { id: b.id } }))
                .balance,
            );
          const results = await Promise.allSettled([
            planning.transfer(userId, {
              fromAccountId: c.id,
              toAccountId: b.id,
              amount: 10,
              date,
            }),
            accounts.delete(c.id, userId),
          ]);
          assert.equal(results[1].status, 'fulfilled');
          assert.equal(
            Number(
              (await db.account.findUniqueOrThrow({ where: { id: b.id } }))
                .balance,
            ),
            previous + (results[0].status === 'fulfilled' ? 10 : 0),
          );
          assert.equal(await accounts.findById(c.id, userId), null);
        },
      );
      await t.test(
        'isolates ownership and allows permanent deletion of the full user profile',
        async () => {
          await assert.rejects(accounts.delete(b.id, otherId), { status: 404 });
          assert.ok(await accounts.findById(b.id, userId));
          await users.delete(userId);
          assert.equal(await db.account.count({ where: { userId } }), 0);
          assert.equal(await db.transaction.count({ where: { userId } }), 0);
        },
      );
    } finally {
      for (const id of [userId, otherId])
        if (await db.user.findUnique({ where: { id } })) await users.delete(id);
      await db.$disconnect();
    }
  },
);
