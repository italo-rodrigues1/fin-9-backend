import {
  serializable,
  isSerializationConflict,
  budgetProgress,
  progressPercentage,
} from './finance-rules';
import { Prisma } from '../generated/client/client';
describe('Serializable transaction retries', () => {
  it('recognizes Prisma and PostgreSQL adapter commit conflicts', () => {
    expect(
      isSerializationConflict(
        new Prisma.PrismaClientKnownRequestError('conflict', {
          code: 'P2034',
          clientVersion: '7.5',
        }),
      ),
    ).toBe(true);
    for (const originalCode of ['40001', '40P01'])
      expect(
        isSerializationConflict(
          Object.assign(new Error('adapter'), {
            cause: { kind: 'TransactionWriteConflict', originalCode },
          }),
        ),
      ).toBe(true);
  });
  it('does not retry unrelated failures', () => {
    for (const value of [
      null,
      {},
      new Error('network'),
      { cause: { kind: 'TransactionWriteConflict', originalCode: '23505' } },
      { cause: { kind: 'Other', originalCode: '40001' } },
    ])
      expect(isSerializationConflict(value)).toBe(false);
  });
  it('retries adapter commit conflicts and returns the successful transaction result', async () => {
    const conflict = Object.assign(new Error('commit conflict'), {
        cause: { kind: 'TransactionWriteConflict', originalCode: '40001' },
      }),
      db = {
        $transaction: jest
          .fn()
          .mockRejectedValueOnce(conflict)
          .mockResolvedValue(42),
      };
    expect(await serializable(db, () => Promise.resolve(42))).toBe(42);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });
  it('caps retries at three attempts', async () => {
    const conflict = Object.assign(new Error('commit conflict'), {
        cause: { kind: 'TransactionWriteConflict', originalCode: '40001' },
      }),
      db = { $transaction: jest.fn().mockRejectedValue(conflict) };
    await expect(serializable(db, () => Promise.resolve(0))).rejects.toBe(
      conflict,
    );
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });
});

describe('Financial percentage precision', () => {
  it('does not trigger budget alerts before exact monetary thresholds', () => {
    for (const [used, alert] of [
      [79.99, 'OK'],
      [80, 'WARNING'],
      [99.99, 'WARNING'],
      [100, 'EXCEEDED'],
    ] as const)
      expect(
        budgetProgress(new Prisma.Decimal(100), new Prisma.Decimal(used)).alert,
      ).toBe(alert);
  });
  it('does not display complete progress before the target is reached', () => {
    expect(
      progressPercentage(new Prisma.Decimal(99.99), new Prisma.Decimal(100)),
    ).toBe(99.9);
    expect(
      progressPercentage(new Prisma.Decimal(100), new Prisma.Decimal(100)),
    ).toBe(100);
  });
});
