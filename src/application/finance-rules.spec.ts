import { serializable, isSerializationConflict } from './finance-rules';
import { Prisma } from '@prisma/client';
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
    expect(await serializable(db, async () => 42)).toBe(42);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });
  it('caps retries at three attempts', async () => {
    const conflict = Object.assign(new Error('commit conflict'), {
        cause: { kind: 'TransactionWriteConflict', originalCode: '40001' },
      }),
      db = { $transaction: jest.fn().mockRejectedValue(conflict) };
    await expect(serializable(db, async () => 0)).rejects.toBe(conflict);
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });
});
