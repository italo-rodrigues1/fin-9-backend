import { Prisma } from '../generated/client/client';
type Account = { id: string; balance: Prisma.Decimal };
type Allocation = { goalId: string; accountId: string; amount: Prisma.Decimal };
/** Allocations reference existing cash. Floor each account/goal share so shortfalls never invent cents. */
export function goalFunding(accounts: Account[], allocations: Allocation[]) {
  const reserved = new Map<string, Prisma.Decimal>(),
    byGoal = new Map<string, Map<string, Prisma.Decimal>>();
  for (const row of allocations) {
    reserved.set(
      row.accountId,
      (reserved.get(row.accountId) || new Prisma.Decimal(0)).plus(row.amount),
    );
    const grouped = byGoal.get(row.goalId) || new Map<string, Prisma.Decimal>();
    grouped.set(
      row.accountId,
      (grouped.get(row.accountId) || new Prisma.Decimal(0)).plus(row.amount),
    );
    byGoal.set(row.goalId, grouped);
  }
  const cash = new Map(
    accounts.map((a) => [a.id, Prisma.Decimal.max(0, a.balance)]),
  );
  const goals = new Map<
    string,
    { allocated: Prisma.Decimal; funded: Prisma.Decimal }
  >();
  for (const [goalId, groups] of byGoal) {
    let allocated = new Prisma.Decimal(0),
      funded = new Prisma.Decimal(0);
    for (const [accountId, amount] of groups) {
      allocated = allocated.plus(amount);
      const total = reserved.get(accountId)!,
        balance = cash.get(accountId) || new Prisma.Decimal(0);
      funded = funded.plus(
        balance.gte(total)
          ? amount
          : amount
              .mul(balance)
              .div(total)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN),
      );
    }
    goals.set(goalId, { allocated, funded });
  }
  return {
    goals,
    reserved,
    available: new Map(
      accounts.map((a) => [
        a.id,
        Prisma.Decimal.max(0, a.balance.minus(reserved.get(a.id) || 0)),
      ]),
    ),
  };
}
