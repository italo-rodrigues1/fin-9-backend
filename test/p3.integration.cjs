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
  throw Error('P3 tests require local PostgreSQL.');
const {
    PrismaService,
  } = require('../dist/src/infrastructure/database/prisma.service'),
  { CardsService } = require('../dist/src/application/cards.service'),
  {
    PrismaUserRepository,
  } = require('../dist/src/infrastructure/repositories/prisma-user.repository'),
  {
    PrismaTransactionRepository,
  } = require('../dist/src/infrastructure/repositories/prisma-transaction.repository'),
  {
    PrismaAccountRepository,
  } = require('../dist/src/infrastructure/repositories/prisma-account.repository'),
  { PlanningService } = require('../dist/src/application/planning.service'),
  { currentDay } = require('../dist/src/application/card-rules');
test('P3 credit cards against PostgreSQL', { timeout: 60000 }, async (t) => {
  const db = new PrismaService(),
    cards = new CardsService(db),
    users = new PrismaUserRepository(db),
    repo = new PrismaTransactionRepository(db),
    accounts = new PrismaAccountRepository(db),
    planning = new PlanningService(db, repo),
    userId = randomUUID(),
    otherId = randomUUID(),
    today = currentDay(),
    date = today.toISOString().slice(0, 10),
    purchaseDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 5),
    )
      .toISOString()
      .slice(0, 10),
    period = { month: today.getUTCMonth() + 1, year: today.getUTCFullYear() },
    page = { skip: 0, take: 30 };
  let card, purchase, single, invoice, payment;
  await db.$connect();
  try {
    await db.user.createMany({
      data: [userId, otherId].map((id) => ({
        id,
        name: 'P3 integration',
        email: id + '@example.test',
        passwordHash: 'not-a-login',
      })),
    });
    const account = await db.account.create({
        data: { userId, name: 'Cash', institution: 'Test', balance: 1000 },
      }),
      foreign = await db.account.create({
        data: {
          userId: otherId,
          name: 'Foreign',
          institution: 'Test',
          balance: 1000,
        },
      }),
      category = await db.category.create({
        data: { userId, name: 'Shopping' },
      }),
      secondCategory = await db.category.create({
        data: { userId, name: 'Travel' },
      }),
      foreignCategory = await db.category.create({
        data: { userId: otherId, name: 'Foreign' },
      }),
      cardData = {
        name: 'Test card',
        creditLimit: 500,
        closingDay: 10,
        dueDay: 15,
      },
      payload = {
        title: 'Laptop',
        amount: 100,
        date: purchaseDate,
        categoryId: category.id,
        installmentCount: 3,
      },
      balance = async () =>
        Number(
          (await db.account.findUniqueOrThrow({ where: { id: account.id } }))
            .balance,
        );
    await t.test(
      'creates and edits cards, then preserves cycles after invoices exist',
      async () => {
        card = await cards.saveCard(userId, cardData);
        await cards.saveCard(
          userId,
          { ...cardData, name: 'Edited card' },
          card.id,
        );
        assert.equal(
          (await cards.detail(userId, card.id)).card.name,
          'Edited card',
        );
      },
    );
    await t.test(
      'purchases create exact installments without moving cash or duplicating expenses',
      async () => {
        purchase = await cards.savePurchase(userId, card.id, {
          ...payload,
          requestId: 'purchase-' + randomUUID(),
        });
        const row = await cards.purchase(userId, card.id, purchase.id);
        assert.deepEqual(
          row.installments.map((i) => i.amount),
          [33.34, 33.33, 33.33],
        );
        assert.equal(
          row.installments.reduce((s, i) => s + Math.round(i.amount * 100), 0),
          10000,
        );
        const detail = await cards.detail(userId, card.id);
        assert.equal(detail.card.usedLimit, 100);
        assert.equal(detail.card.availableLimit, 400);
        assert.equal(await balance(), 1000);
        assert.equal(
          (await repo.getMonthlySummary(userId, period.month, period.year))
            .totalExpense,
          0,
        );
        assert.equal(await db.transaction.count({ where: { userId } }), 0);
        await assert.rejects(
          cards.saveCard(userId, { ...cardData, closingDay: 20 }, card.id),
          { status: 409 },
        );
        await assert.rejects(
          cards.saveCard(userId, { ...cardData, creditLimit: 99 }, card.id),
          { status: 400 },
        );
      },
    );
    await t.test(
      'repeated and concurrent purchase submissions share one record',
      async () => {
        const data = {
          ...payload,
          title: 'Single',
          amount: 50,
          installmentCount: 1,
          categoryId: secondCategory.id,
          requestId: 'purchase-' + randomUUID(),
        };
        const rows = await Promise.all([
          cards.savePurchase(userId, card.id, data),
          cards.savePurchase(userId, card.id, data),
        ]);
        assert.equal(rows[0].id, rows[1].id);
        single = rows[0];
        await assert.rejects(
          cards.savePurchase(userId, card.id, { ...data, amount: 51 }),
          { status: 409 },
        );
      },
    );
    await t.test(
      'concurrent purchases cannot overspend the available limit',
      async () => {
        const c = await cards.saveCard(userId, {
          ...cardData,
          name: 'Race',
          creditLimit: 50,
        });
        const results = await Promise.allSettled([
          cards.savePurchase(userId, c.id, {
            ...payload,
            amount: 30,
            installmentCount: 1,
          }),
          cards.savePurchase(userId, c.id, {
            ...payload,
            amount: 30,
            installmentCount: 1,
          }),
        ]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal((await cards.detail(userId, c.id)).card.usedLimit, 30);
      },
    );
    await t.test(
      'edits reallocate installments and release the previous commitment atomically',
      async () => {
        await cards.savePurchase(
          userId,
          card.id,
          { ...payload, amount: 101, installmentCount: 2 },
          purchase.id,
        );
        assert.equal((await cards.detail(userId, card.id)).card.usedLimit, 151);
        await cards.savePurchase(userId, card.id, payload, purchase.id);
        assert.equal((await cards.detail(userId, card.id)).card.usedLimit, 150);
        await assert.rejects(
          cards.savePurchase(
            userId,
            card.id,
            { ...payload, amount: 501 },
            purchase.id,
          ),
          { status: 400 },
        );
        assert.equal((await cards.detail(userId, card.id)).card.usedLimit, 150);
      },
    );
    await t.test(
      'invoice pagination, totals and category references stay consistent',
      async () => {
        const d = await cards.detail(userId, card.id);
        invoice = d.invoices.find((i) => i.total === 83.34);
        assert.ok(invoice);
        assert.equal(invoice.status, 'CLOSED');
        const first = await cards.invoice(userId, card.id, invoice.id, {
            skip: 0,
            take: 1,
          }),
          second = await cards.invoice(userId, card.id, invoice.id, {
            skip: 1,
            take: 1,
          });
        assert.equal(first.hasMore, true);
        assert.equal(second.hasMore, false);
        assert.notEqual(first.items[0].id, second.items[0].id);
        assert.equal(first.invoice.total, 83.34);
      },
    );
    await t.test(
      'open invoices and future-dated payments are rejected without changing cash',
      async () => {
        const opening = await cards.saveCard(userId, {
            ...cardData,
            name: 'Open',
            closingDay: 1,
            dueDay: 5,
          }),
          p = await cards.savePurchase(userId, opening.id, {
            ...payload,
            date,
            installmentCount: 1,
          }),
          d = await cards.purchase(userId, opening.id, p.id),
          open = d.installments[0].invoice;
        assert.ok(open.closingDate > today);
        await assert.rejects(
          cards.pay(userId, opening.id, open.id, {
            accountId: account.id,
            date,
            requestId: 'pay-' + randomUUID(),
          }),
          { status: 400 },
        );
        const future = new Date(today.getTime() + 86400000)
          .toISOString()
          .slice(0, 10);
        await assert.rejects(
          cards.pay(userId, card.id, invoice.id, {
            accountId: account.id,
            date: future,
            requestId: 'pay-' + randomUUID(),
          }),
          { status: 400 },
        );
        assert.equal(await balance(), 1000);
      },
    );
    await t.test(
      'foreign users, categories, accounts, purchases and invoices are isolated',
      async () => {
        await assert.rejects(cards.detail(otherId, card.id), { status: 404 });
        await assert.rejects(cards.purchase(otherId, card.id, purchase.id), {
          status: 404,
        });
        await assert.rejects(
          cards.invoice(otherId, card.id, invoice.id, page),
          { status: 404 },
        );
        await assert.rejects(
          cards.savePurchase(userId, card.id, {
            ...payload,
            categoryId: foreignCategory.id,
          }),
          { status: 400 },
        );
        await assert.rejects(
          cards.pay(userId, card.id, invoice.id, {
            accountId: foreign.id,
            date,
            requestId: 'pay-' + randomUUID(),
          }),
          { status: 400 },
        );
        await assert.rejects(
          cards.removePurchase(otherId, card.id, purchase.id),
          { status: 404 },
        );
        assert.equal((await cards.list(otherId)).length, 0);
      },
    );
    await t.test(
      'payment is idempotent, moves cash once and preserves purchase categories in reports and budgets',
      async () => {
        const pay = {
          accountId: account.id,
          date,
          requestId: 'pay-' + randomUUID(),
        };
        const results = await Promise.all([
          cards.pay(userId, card.id, invoice.id, pay),
          cards.pay(userId, card.id, invoice.id, pay),
        ]);
        assert.equal(results[0].id, results[1].id);
        payment = results[0];
        assert.equal(await balance(), 916.66);
        assert.equal(
          (await cards.invoice(userId, card.id, invoice.id, page)).invoice
            .status,
          'PAID',
        );
        assert.equal(
          (await cards.detail(userId, card.id)).card.usedLimit,
          66.66,
        );
        const report = await planning.report(userId, period);
        assert.equal(report.totalExpense, 83.34);
        assert.equal(
          report.byCategory.find((c) => c.categoryId === category.id).total,
          33.34,
        );
        assert.equal(
          report.byCategory.find((c) => c.categoryId === secondCategory.id)
            .total,
          50,
        );
        await planning.saveBudget(userId, {
          ...period,
          categoryId: category.id,
          amount: 100,
        });
        assert.equal((await planning.budgets(userId, period))[0].used, 33.34);
        const statement = await planning.statement(userId, account.id, page);
        assert.equal(statement.entries.length, 2);
      },
    );
    await t.test(
      'paid purchases and individual generated transactions cannot be mutated',
      async () => {
        await assert.rejects(
          cards.savePurchase(userId, card.id, payload, purchase.id),
          { status: 409 },
        );
        await assert.rejects(
          cards.removePurchase(userId, card.id, purchase.id),
          { status: 409 },
        );
        await assert.rejects(
          cards.savePurchase(userId, card.id, {
            ...payload,
            amount: 10,
            installmentCount: 1,
          }),
          { status: 409 },
        );
        const row = await db.transaction.findFirstOrThrow({
          where: { userId, cardPaymentId: payment.id },
        });
        await assert.rejects(repo.update(row.id, userId, { amount: 1 }), {
          status: 409,
        });
        await assert.rejects(repo.delete(row.id, userId), { status: 409 });
        const view = await repo.findById(row.id, userId);
        assert.equal(view.cardPayment.invoice.cardId, card.id);
        assert.equal(await balance(), 916.66);
      },
    );
    await t.test(
      'another payment key cannot debit an already paid invoice',
      async () => {
        await assert.rejects(
          cards.pay(userId, card.id, invoice.id, {
            accountId: account.id,
            date,
            requestId: 'pay-' + randomUUID(),
          }),
          { status: 409 },
        );
        assert.equal(await balance(), 916.66);
      },
    );
    await t.test(
      'archiving preserves invoices, debt and history while blocking new purchases',
      async () => {
        await cards.saveCard(
          userId,
          { ...cardData, isArchived: true },
          card.id,
        );
        assert.equal(
          (await cards.detail(userId, card.id)).card.usedLimit,
          66.66,
        );
        await assert.rejects(cards.savePurchase(userId, card.id, payload), {
          status: 400,
        });
      },
    );
    await t.test(
      'concurrent reversal restores cash and reports exactly once, even on archived accounts',
      async () => {
        await accounts.update(account.id, userId, { isArchived: true });
        await Promise.all([
          cards.reverse(userId, card.id, invoice.id, payment.id),
          cards.reverse(userId, card.id, invoice.id, payment.id),
        ]);
        assert.equal(await balance(), 1000);
        assert.equal(
          (await repo.getMonthlySummary(userId, period.month, period.year))
            .totalExpense,
          0,
        );
        assert.equal((await planning.budgets(userId, period))[0].used, 0);
        assert.equal((await cards.detail(userId, card.id)).card.usedLimit, 150);
        assert.equal(
          (await cards.invoice(userId, card.id, invoice.id, page)).invoice
            .status,
          'CLOSED',
        );
        await assert.rejects(
          cards.pay(userId, card.id, invoice.id, {
            accountId: account.id,
            date,
            requestId: payment.requestId,
          }),
          { status: 409 },
        );
        await accounts.update(account.id, userId, { isArchived: false });
      },
    );
    await t.test(
      'repaying uses a fresh key; retrying an old reversal cannot reverse the new payment',
      async () => {
        const next = await cards.pay(userId, card.id, invoice.id, {
          accountId: account.id,
          date,
          requestId: 'pay-' + randomUUID(),
        });
        await cards.reverse(userId, card.id, invoice.id, payment.id);
        assert.equal(await balance(), 916.66);
        assert.equal(
          (await cards.invoice(userId, card.id, invoice.id, page)).invoice
            .payment.id,
          next.id,
        );
        await cards.reverse(userId, card.id, invoice.id, next.id);
        await cards.saveCard(
          userId,
          { ...cardData, isArchived: false },
          card.id,
        );
      },
    );
    await t.test(
      'unpaid invoices enter the cash forecast without becoming realized expenses',
      async () => {
        const r = await planning.report(userId, period);
        const future = (
          await db.cardInstallment.aggregate({
            where: {
              invoice: {
                userId,
                dueDate: {
                  gte: new Date(Date.UTC(period.year, period.month - 1, 1)),
                  lt: new Date(Date.UTC(period.year, period.month, 1)),
                },
                payments: { none: { reversedAt: null } },
              },
            },
            _sum: { amount: true },
          })
        )._sum.amount;
        assert.equal(r.plannedCardExpense, Number(future || 0));
        assert.equal(r.totalExpense, 0);
        assert.equal(r.projectedBalance, 1000 - r.plannedCardExpense);
        assert.equal(
          (await planning.report(userId, { ...period, accountId: account.id }))
            .plannedCardExpense,
          0,
        );
      },
    );
    await t.test(
      'removing unpaid purchases frees credit without moving cash; account deletion clears all card data',
      async () => {
        await cards.removePurchase(userId, card.id, purchase.id);
        await cards.removePurchase(userId, card.id, single.id);
        assert.equal((await cards.detail(userId, card.id)).card.usedLimit, 0);
        assert.equal(await balance(), 1000);
        await users.delete(userId);
        for (const model of [
          'creditCard',
          'cardPurchase',
          'cardInvoice',
          'cardPayment',
          'transaction',
        ])
          assert.equal(await db[model].count({ where: { userId } }), 0);
      },
    );
  } finally {
    for (const id of [userId, otherId])
      if (await db.user.findUnique({ where: { id } })) await users.delete(id);
    await db.$disconnect();
  }
});
