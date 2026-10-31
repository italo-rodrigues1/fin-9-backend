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
export function budgetProgress(limit: Prisma.Decimal, used: Prisma.Decimal) {
  const percentage = used.div(limit).mul(100).toDecimalPlaces(1).toNumber();
  return {
    used: used.toNumber(),
    remaining: limit.minus(used).toNumber(),
    percentage,
    alert: percentage >= 100 ? 'EXCEEDED' : percentage >= 80 ? 'WARNING' : 'OK',
  };
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
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034' ||
        attempt >= 2
      )
        throw error;
    }
}
