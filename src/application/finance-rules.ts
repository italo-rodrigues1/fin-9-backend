import { Prisma } from '@prisma/client';
export function recurrenceDate(
  anchor: Date,
  interval: 'WEEKLY' | 'MONTHLY' | 'YEARLY',
  index: number,
): Date {
  if (interval === 'WEEKLY')
    return new Date(anchor.getTime() + index * 7 * 86400000);
  const year = anchor.getUTCFullYear() + (interval === 'YEARLY' ? index : 0);
  const month = anchor.getUTCMonth() + (interval === 'MONTHLY' ? index : 0);
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), last)));
}
export function progressPercentage(
  current: Prisma.Decimal,
  target: Prisma.Decimal,
) {
  return current
    .div(target)
    .mul(100)
    .toDecimalPlaces(1, Prisma.Decimal.ROUND_DOWN)
    .toNumber();
}
export function budgetProgress(limit: Prisma.Decimal, used: Prisma.Decimal) {
  const percentage = progressPercentage(used, limit);
  return {
    used: used.toNumber(),
    remaining: limit.minus(used).toNumber(),
    percentage,
    alert: used.gte(limit)
      ? 'EXCEEDED'
      : used.mul(100).gte(limit.mul(80))
        ? 'WARNING'
        : 'OK',
  };
}
export function isSerializationConflict(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  )
    return true;
  if (!error || typeof error !== 'object' || !('cause' in error)) return false;
  const cause = error.cause;
  return Boolean(
    cause &&
    typeof cause === 'object' &&
    'kind' in cause &&
    cause.kind === 'TransactionWriteConflict' &&
    'originalCode' in cause &&
    ['40001', '40P01'].includes(String(cause.originalCode)),
  );
}
export async function serializable<T>(
  prisma: {
    $transaction: (
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
      options: { isolationLevel: 'Serializable' },
    ) => Promise<T>;
  },
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++)
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt >= 2) throw error;
    }
}
