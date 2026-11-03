import { Prisma } from '../../generated/client/client';
import { PrismaTransactionRepository } from './prisma-transaction.repository';
import { PrismaService } from '../database/prisma.service';
import { TransactionType } from '../../domain/entities';

type Row = {
  id: string;
  title: string;
  description?: string;
  amount: Prisma.Decimal;
  type: TransactionType;
  date: Date;
  categoryId: string;
  accountId: string;
  userId: string;
  category: { name: string; color: string };
};
type Patch = Partial<Omit<Row, 'id' | 'category'>> & {
  account?: { connect: { id: string } };
};
type Query = { where: { date?: { gte?: Date; lt?: Date; lte?: Date } } };
function fixture() {
  const balances: Record<string, Prisma.Decimal> = {
    a: new Prisma.Decimal(100),
    b: new Prisma.Decimal(50),
  };
  const rows = new Map<string, Row>();
  let sequence = 0;
  const client = {
    account: {
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { balance: { increment: Prisma.Decimal } };
        }) => {
          balances[where.id] = balances[where.id].plus(data.balance.increment);
          return Promise.resolve({});
        },
      ),
    },
    transaction: {
      create: jest.fn(({ data }: { data: Omit<Row, 'id' | 'category'> }) => {
        const row: Row = {
          ...data,
          id: String(++sequence),
          category: { name: 'Teste', color: '#000000' },
        };
        rows.set(row.id, row);
        return Promise.resolve(row);
      }),
      findFirstOrThrow: jest.fn(({ where }: { where: { id: string } }) => {
        const row = rows.get(where.id);
        return row
          ? Promise.resolve({ ...row })
          : Promise.reject(new Error('not found'));
      }),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Patch }) => {
          const existing = rows.get(where.id);
          if (!existing) return Promise.reject(new Error('not found'));
          const row: Row = { ...existing, ...data };
          if (data.account) row.accountId = data.account.connect.id;
          rows.set(where.id, row);
          return Promise.resolve(row);
        },
      ),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        rows.delete(where.id);
        return Promise.resolve();
      }),
      findMany: jest.fn(({ where }: Query) =>
        Promise.resolve(
          [...rows.values()].filter(
            (row) =>
              !where.date ||
              ((!where.date.gte || row.date >= where.date.gte) &&
                (!where.date.lt || row.date < where.date.lt) &&
                (!where.date.lte || row.date <= where.date.lte)),
          ),
        ),
      ),
    },
  };
  const prisma = {
    ...client,
    $transaction: jest.fn(
      async (
        operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) => {
        expect(options?.isolationLevel).toBe(
          Prisma.TransactionIsolationLevel.Serializable,
        );
        const savedBalances = { ...balances },
          savedRows = new Map(rows);
        try {
          return await operation(client as unknown as Prisma.TransactionClient);
        } catch (error) {
          Object.assign(balances, savedBalances);
          rows.clear();
          savedRows.forEach((v, k) => rows.set(k, v));
          throw error;
        }
      },
    ),
  };
  const repo = new PrismaTransactionRepository(
    prisma as unknown as PrismaService,
  );
  const create = (
    amount = 10,
    type = TransactionType.EXPENSE,
    accountId = 'a',
    date = new Date('2026-12-31T00:00:00Z'),
  ) =>
    repo.create({
      title: 'Teste',
      amount,
      type,
      accountId,
      date,
      categoryId: 'category',
      userId: 'user',
    });
  return { repo, prisma, client, balances, rows, create };
}
describe('Financial balance invariants', () => {
  it('credits income, debits expenses, and restores balances on deletion', async () => {
    const f = fixture();
    const expense = await f.create(12.34);
    const income = await f.create(20, TransactionType.INCOME);
    expect(f.balances.a.toNumber()).toBe(107.66);
    await f.repo.delete(expense.id, 'user');
    expect(f.balances.a.toNumber()).toBe(120);
    await f.repo.delete(income.id, 'user');
    expect(f.balances.a.toNumber()).toBe(100);
  });
  it('reverses the old amount and applies edited amount and type', async () => {
    const f = fixture();
    const tx = await f.create(10);
    await f.repo.update(tx.id, 'user', { amount: 25 });
    expect(f.balances.a.toNumber()).toBe(75);
    await f.repo.update(tx.id, 'user', {
      type: TransactionType.INCOME,
      amount: 5.55,
    });
    expect(f.balances.a.toNumber()).toBe(105.55);
  });
  it('moves the financial impact when changing account', async () => {
    const f = fixture();
    const tx = await f.create(10);
    await f.repo.update(tx.id, 'user', { accountId: 'b', amount: 20 });
    expect(f.balances.a.toNumber()).toBe(100);
    expect(f.balances.b.toNumber()).toBe(30);
    await f.repo.delete(tx.id, 'user');
    expect(f.balances.b.toNumber()).toBe(50);
  });
  it('rolls back the transaction and balance if an account update fails', async () => {
    const f = fixture();
    f.client.account.update.mockRejectedValueOnce(
      new Error('database failure'),
    );
    await expect(f.create()).rejects.toThrow('database failure');
    expect(f.rows.size).toBe(0);
    expect(f.balances.a.toNumber()).toBe(100);
  });
  it('retains exact cents for balances, totals and categories', async () => {
    const f = fixture();
    await f.create(0.1, TransactionType.INCOME);
    await f.create(0.2, TransactionType.INCOME);
    await f.create(0.01);
    const summary = await f.repo.getMonthlySummary('user', 12, 2026);
    expect(summary.totalIncome).toBe(0.3);
    expect(summary.balance).toBe(0.29);
    expect(
      summary.byCategory.find((c) => c.type === TransactionType.INCOME)?.total,
    ).toBe(0.3);
    expect(f.balances.a.toNumber()).toBe(100.29);
  });
  it('includes the last day and excludes the next month at year rollover', async () => {
    const f = fixture();
    await f.create(10);
    await f.create(
      20,
      TransactionType.EXPENSE,
      'a',
      new Date('2027-01-01T00:00:00Z'),
    );
    const summary = await f.repo.getMonthlySummary('user', 12, 2026);
    expect(summary.totalExpense).toBe(10);
    const rows = await f.repo.findAll({
      userId: 'user',
      month: 12,
      year: 2026,
    });
    expect(rows).toHaveLength(1);
    expect(
      f.client.transaction.findMany.mock.lastCall?.[0].where.date?.lt,
    ).toEqual(new Date('2027-01-01T00:00:00Z'));
  });
  it('handles leap-year February and full-year filters in UTC', async () => {
    const f = fixture();
    await f.create(
      10,
      TransactionType.EXPENSE,
      'a',
      new Date('2028-02-29T00:00:00Z'),
    );
    await f.create(
      20,
      TransactionType.EXPENSE,
      'a',
      new Date('2029-01-01T00:00:00Z'),
    );
    expect(
      await f.repo.findAll({ userId: 'user', month: 2, year: 2028 }),
    ).toHaveLength(1);
    expect(await f.repo.findAll({ userId: 'user', year: 2028 })).toHaveLength(
      1,
    );
  });
  it('retries serialization conflicts with serializable isolation', async () => {
    const f = fixture();
    f.prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034',
        clientVersion: '7',
      }),
    );
    await f.create();
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(f.prisma.$transaction.mock.calls[1][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(f.balances.a.toNumber()).toBe(90);
  });
  it('bounds serialization retries and propagates other failures', async () => {
    const f = fixture();
    f.prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034',
        clientVersion: '7',
      }),
    );
    await expect(f.create()).rejects.toThrow('conflict');
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(3);
  });
  it('repeated updates to the same values do not double debit', async () => {
    const f = fixture();
    const tx = await f.create();
    await f.repo.update(tx.id, 'user', { amount: 20 });
    await f.repo.update(tx.id, 'user', { amount: 20 });
    expect(f.balances.a.toNumber()).toBe(80);
  });
});
