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
  throw new Error('P2 integration tests require local PostgreSQL.');
const {
  PrismaService,
} = require('../dist/src/infrastructure/database/prisma.service');
const { GoalsService } = require('../dist/src/application/goals.service');
const {
  PrismaUserRepository,
} = require('../dist/src/infrastructure/repositories/prisma-user.repository');
const {
  PrismaAccountRepository,
} = require('../dist/src/infrastructure/repositories/prisma-account.repository');
const {
  PrismaTransactionRepository,
} = require('../dist/src/infrastructure/repositories/prisma-transaction.repository');
const { PlanningService } = require('../dist/src/application/planning.service');
test('P2 savings goals against PostgreSQL', { timeout: 60000 }, async (t) => {
  const db = new PrismaService(),
    service = new GoalsService(db),
    users = new PrismaUserRepository(db),
    accounts = new PrismaAccountRepository(db),
    transactions = new PrismaTransactionRepository(db),
    planning = new PlanningService(db, transactions),
    userId = randomUUID(),
    otherId = randomUUID();
  await db.$connect();
  try {
    await db.user.createMany({
      data: [userId, otherId].map((id) => ({
        id,
        name: 'P2 integration',
        email: id + '@example.test',
        passwordHash: 'not-a-login',
      })),
    });
    const a = await db.account.create({
        data: { userId, name: 'A', institution: 'Test', balance: 100 },
      }),
      b = await db.account.create({
        data: { userId, name: 'B', institution: 'Test', balance: 50 },
      }),
      foreign = await db.account.create({
        data: {
          userId: otherId,
          name: 'Foreign',
          institution: 'Test',
          balance: 900,
        },
      }),
      category = await db.category.create({ data: { userId, name: 'Food' } });
    let g, h, c;
    const page = { skip: 0, take: 30 },
      payload = (amount, accountId = a.id) => ({
        amount,
        accountId,
        date: '2026-10-31',
        note: 'Test',
      }),
      balance = async (id) =>
        (
          await db.account.findUniqueOrThrow({ where: { id } })
        ).balance.toNumber();
    await t.test(
      'creates and edits targets, optional deadlines and statuses',
      async () => {
        g = await service.saveGoal(userId, {
          name: 'Reserve',
          targetAmount: 100,
          deadline: '2026-10-30',
        });
        h = await service.saveGoal(userId, { name: 'Trip', targetAmount: 100 });
        assert.equal(
          (await service.detail(userId, g.id, page)).goal.status,
          'OVERDUE',
        );
        await service.saveGoal(
          userId,
          { name: 'Reserve edited', targetAmount: 80, deadline: null },
          g.id,
        );
        const detail = await service.detail(userId, g.id, page);
        assert.equal(detail.goal.deadline, null);
        assert.equal(detail.goal.name, 'Reserve edited');
        assert.equal(detail.goal.targetAmount, 80);
      },
    );
    await t.test(
      'contributions reference cash and leave balances, transactions and reports unchanged',
      async () => {
        const before = await planning.report(userId, { month: 10, year: 2026 });
        c = await service.saveContribution(userId, g.id, {
          ...payload(60),
          requestId: 'p2-test-' + randomUUID(),
        });
        const detail = await service.detail(userId, g.id, page);
        assert.equal(detail.goal.currentAmount, 60);
        assert.equal(detail.goal.percentage, 75);
        assert.equal(
          detail.accounts.find((x) => x.id === a.id).availableAmount,
          40,
        );
        assert.equal(await balance(a.id), 100);
        assert.equal(await db.transaction.count({ where: { userId } }), 0);
        assert.deepEqual(
          await planning.report(userId, { month: 10, year: 2026 }),
          before,
        );
      },
    );
    await t.test(
      'retries are idempotent and changed payloads cannot reuse a key',
      async () => {
        const data = {
          ...payload(1, b.id),
          requestId: 'p2-retry-' + randomUUID(),
        };
        const results = await Promise.all([
          service.saveContribution(userId, g.id, data),
          service.saveContribution(userId, g.id, data),
        ]);
        assert.equal(results[0].id, results[1].id);
        assert.equal(
          await db.goalContribution.count({
            where: { userId, requestId: data.requestId },
          }),
          1,
        );
        await assert.rejects(
          service.saveContribution(userId, g.id, { ...data, amount: 2 }),
          { status: 409 },
        );
        await service.deleteContribution(userId, g.id, results[0].id);
      },
    );
    await t.test(
      'concurrent allocations to different goals cannot reserve the same cash',
      async () => {
        const results = await Promise.allSettled([
          service.saveContribution(userId, g.id, payload(30)),
          service.saveContribution(userId, h.id, payload(30)),
        ]);
        assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
        assert.equal(
          (
            await db.goalContribution.aggregate({
              where: { userId, accountId: a.id },
              _sum: { amount: true },
            })
          )._sum.amount.toNumber(),
          90,
        );
        for (const row of results)
          if (row.status === 'fulfilled')
            await service.deleteContribution(
              userId,
              row.value.goalId,
              row.value.id,
            );
      },
    );
    await t.test(
      'foreign users, goals, accounts and contribution IDs are isolated',
      async () => {
        await assert.rejects(service.detail(otherId, g.id, page), {
          status: 404,
        });
        await assert.rejects(
          service.saveGoal(otherId, { name: 'x', targetAmount: 1 }, g.id),
          { status: 404 },
        );
        await assert.rejects(service.deleteGoal(otherId, g.id), {
          status: 404,
        });
        await assert.rejects(
          service.saveContribution(userId, g.id, payload(1, foreign.id)),
          { status: 400 },
        );
        await assert.rejects(service.getContribution(otherId, g.id, c.id), {
          status: 404,
        });
        await assert.rejects(
          service.saveContribution(userId, h.id, payload(1), c.id),
          { status: 404 },
        );
        await assert.rejects(service.deleteContribution(userId, h.id, c.id), {
          status: 404,
        });
        assert.equal((await service.overview(otherId)).goals.length, 0);
      },
    );
    await t.test(
      'moving and editing contributions validates destination cash',
      async () => {
        await assert.rejects(
          service.saveContribution(userId, g.id, payload(60, b.id), c.id),
          { status: 400 },
        );
        await service.saveContribution(userId, g.id, payload(40, b.id), c.id);
        assert.equal(
          (await service.detail(userId, g.id, page)).goal.currentAmount,
          40,
        );
        assert.equal(await balance(a.id), 100);
        assert.equal(await balance(b.id), 50);
        await service.saveContribution(userId, g.id, payload(60), c.id);
      },
    );
    await t.test(
      'spending reduces backed progress proportionally without changing allocations',
      async () => {
        await service.saveContribution(userId, h.id, payload(40));
        await transactions.create({
          userId,
          title: 'Food',
          type: 'EXPENSE',
          amount: 50,
          date: new Date('2026-10-31'),
          accountId: a.id,
          categoryId: category.id,
        });
        const snapshot = await service.overview(userId),
          one = snapshot.goals.find((x) => x.id === g.id),
          two = snapshot.goals.find((x) => x.id === h.id);
        assert.equal(one.currentAmount, 30);
        assert.equal(two.currentAmount, 20);
        assert.equal(one.allocatedAmount, 60);
        assert.equal(one.shortfall, 30);
        assert.equal(one.status, 'REVIEW');
        await assert.rejects(
          service.saveContribution(userId, g.id, payload(0.01)),
          { status: 400 },
        );
      },
    );
    await t.test(
      'archived accounts retain backing; reducing allocations remains possible',
      async () => {
        await accounts.update(a.id, userId, { isArchived: true });
        assert.equal(
          (await service.detail(userId, g.id, page)).goal.currentAmount,
          30,
        );
        await assert.rejects(
          service.saveContribution(userId, g.id, payload(1)),
          { status: 400 },
        );
        await assert.rejects(
          service.saveContribution(userId, g.id, payload(61), c.id),
          { status: 400 },
        );
        await service.saveContribution(userId, g.id, payload(50), c.id);
        assert.equal(
          (await service.detail(userId, g.id, page)).goal.allocatedAmount,
          50,
        );
      },
    );
    await t.test(
      'history pages are stable and removing goals releases allocations without moving cash',
      async () => {
        const before = await balance(b.id);
        for (let i = 0; i < 5; i++)
          await service.saveContribution(userId, g.id, payload(1, b.id));
        const first = await service.detail(userId, g.id, { skip: 0, take: 3 }),
          second = await service.detail(userId, g.id, { skip: 3, take: 3 });
        assert.equal(first.hasMore, true);
        assert.equal(second.hasMore, false);
        assert.equal(
          new Set(
            [...first.contributions, ...second.contributions].map((x) => x.id),
          ).size,
          6,
        );
        await service.deleteGoal(userId, g.id);
        assert.equal(
          await db.goalContribution.count({ where: { goalId: g.id } }),
          0,
        );
        assert.equal(await balance(b.id), before);
        assert.equal(
          (await service.overview(userId)).accounts.find((x) => x.id === b.id)
            .availableAmount,
          before,
        );
        await assert.rejects(service.getContribution(userId, g.id, c.id), {
          status: 404,
        });
      },
    );
    await t.test(
      'completion is determined by available cash and user deletion removes all goal data',
      async () => {
        await service.saveGoal(
          userId,
          { name: 'Trip', targetAmount: 40 },
          h.id,
        );
        assert.equal(
          (await service.detail(userId, h.id, page)).goal.status,
          'COMPLETED',
        );
        await users.delete(userId);
        assert.equal(await db.goal.count({ where: { userId } }), 0);
        assert.equal(await db.goalContribution.count({ where: { userId } }), 0);
      },
    );
  } finally {
    for (const id of [userId, otherId])
      if (await db.user.findUnique({ where: { id } })) await users.delete(id);
    await db.$disconnect();
  }
});
