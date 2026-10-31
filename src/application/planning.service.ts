import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PrismaTransactionRepository } from '../infrastructure/repositories/prisma-transaction.repository';
import {
  BudgetDto,
  EditRecurrenceDto,
  PageDto,
  PeriodDto,
  RecurrenceDto,
  TransferDto,
} from '../presentation/dtos/planning.dto';
import { budgetProgress, recurrenceDate, serializable } from './finance-rules';
const day = () => new Date(new Date().toISOString().slice(0, 10));
@Injectable()
export class PlanningService {
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: PrismaTransactionRepository,
  ) {}
  private async account(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    active = false,
  ) {
    const value = await tx.account.findFirst({
      where: { id, userId, ...(active ? { isArchived: false } : {}) },
    });
    if (!value)
      throw new BadRequestException('Conta não encontrada ou arquivada.');
    return value;
  }
  private async category(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
  ) {
    if (!(await tx.category.findFirst({ where: { id, userId } })))
      throw new BadRequestException('Categoria não encontrada.');
  }
  async report(userId: string, period: PeriodDto) {
    await this.materialize(userId);
    if (period.accountId) await this.account(this.db, userId, period.accountId);
    const accounts = await this.db.account.findMany({
      where: { userId, ...(period.accountId ? { id: period.accountId } : {}) },
    });
    const history = await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const date = new Date(
          Date.UTC(period.year, period.month - 6 + index, 1),
        );
        const summary = await this.transactions.getMonthlySummary(
          userId,
          date.getUTCMonth() + 1,
          date.getUTCFullYear(),
          period.accountId,
        );
        return {
          month: date.getUTCMonth() + 1,
          year: date.getUTCFullYear(),
          ...summary,
        };
      }),
    );
    const selected = history[5],
      previous = history[4];
    const start = new Date(Date.UTC(period.year, period.month - 1, 1)),
      end = new Date(Date.UTC(period.year, period.month, 1));
    const planned = await this.db.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        status: 'PLANNED',
        date: { gte: start, lt: end },
        ...(period.accountId ? { accountId: period.accountId } : {}),
      },
      _sum: { amount: true },
    });
    const cardPlanned = period.accountId
      ? new Prisma.Decimal(0)
      : (
          await this.db.cardInstallment.aggregate({
            where: {
              invoice: {
                userId,
                dueDate: { gte: start, lt: end },
                payments: { none: { reversedAt: null } },
              },
            },
            _sum: { amount: true },
          })
        )._sum.amount || new Prisma.Decimal(0);
    const plannedIncome =
        planned.find((row) => row.type === 'INCOME')?._sum.amount ||
        new Prisma.Decimal(0),
      plannedExpense = new Prisma.Decimal(
        planned.find((row) => row.type === 'EXPENSE')?._sum.amount || 0,
      ).plus(cardPlanned);
    const currentBalance = accounts.reduce(
      (total, a) => total.plus(a.balance),
      new Prisma.Decimal(0),
    );
    return {
      ...selected,
      accounts: accounts.map((a) => ({ ...a, balance: a.balance.toNumber() })),
      currentBalance: currentBalance.toNumber(),
      history,
      previous: {
        month: previous.month,
        year: previous.year,
        totalIncome: previous.totalIncome,
        totalExpense: previous.totalExpense,
        balance: previous.balance,
      },
      plannedIncome: plannedIncome.toNumber(),
      plannedExpense: plannedExpense.toNumber(),
      plannedCardExpense: cardPlanned.toNumber(),
      projectedBalance: currentBalance
        .plus(plannedIncome)
        .minus(plannedExpense)
        .toNumber(),
    };
  }
  async statement(userId: string, id: string, page: PageDto) {
    const account = await this.account(this.db, userId, id);
    // Each query reads only the prefix needed to merge the two ledgers correctly.
    const take = page.skip + page.take + 1;
    const [transactions, transfers] = await Promise.all([
      this.db.transaction.findMany({
        where: { userId, accountId: id },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take,
        include: { category: true },
      }),
      this.db.transfer.findMany({
        where: { userId, OR: [{ fromAccountId: id }, { toAccountId: id }] },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take,
        include: { fromAccount: true, toAccount: true },
      }),
    ]);
    const entries = [
      ...transactions.map((t) => ({
        ...t,
        kind: 'TRANSACTION',
        amount: t.amount.toNumber(),
      })),
      ...transfers.map((t) => ({
        id: t.id,
        kind: 'TRANSFER',
        title:
          t.fromAccountId === id
            ? 'Para ' + t.toAccount.name
            : 'De ' + t.fromAccount.name,
        date: t.date,
        type: t.fromAccountId === id ? 'EXPENSE' : 'INCOME',
        status: 'CONFIRMED',
        amount: t.amount.toNumber(),
      })),
    ].sort(
      (a, b) => b.date.getTime() - a.date.getTime() || b.id.localeCompare(a.id),
    );
    return {
      account: { ...account, balance: account.balance.toNumber() },
      entries: entries.slice(page.skip, page.skip + page.take),
      hasMore: entries.length > page.skip + page.take,
    };
  }
  async getTransfer(userId: string, id: string) {
    const row = await this.db.transfer.findFirst({
      where: { id, userId },
      include: { fromAccount: true, toAccount: true },
    });
    if (!row) throw new NotFoundException('Transferência não encontrada.');
    return { ...row, amount: row.amount.toNumber() };
  }
  async transfers(userId: string) {
    return (
      await this.db.transfer.findMany({
        where: { userId },
        include: { fromAccount: true, toAccount: true },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: 100,
      })
    ).map((t) => ({ ...t, amount: t.amount.toNumber() }));
  }
  async transfer(userId: string, data: TransferDto, id?: string) {
    if (data.fromAccountId === data.toAccountId)
      throw new BadRequestException('Selecione duas contas diferentes.');
    return serializable(this.db, async (tx) => {
      await this.account(tx, userId, data.fromAccountId, true);
      await this.account(tx, userId, data.toAccountId, true);
      if (id) {
        const old = await tx.transfer.findFirst({ where: { id, userId } });
        if (!old) throw new NotFoundException('Transferência não encontrada.');
        await tx.account.update({
          where: { id: old.fromAccountId, userId },
          data: { balance: { increment: old.amount } },
        });
        await tx.account.update({
          where: { id: old.toAccountId, userId },
          data: { balance: { decrement: old.amount } },
        });
      }
      const values = {
        userId,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: new Prisma.Decimal(data.amount),
        date: new Date(data.date),
        title: data.title?.trim() || 'Transferência entre contas',
      };
      const result = id
        ? await tx.transfer.update({ where: { id, userId }, data: values })
        : await tx.transfer.create({ data: values });
      await tx.account.update({
        where: { id: data.fromAccountId, userId },
        data: { balance: { decrement: values.amount } },
      });
      await tx.account.update({
        where: { id: data.toAccountId, userId },
        data: { balance: { increment: values.amount } },
      });
      return { ...result, amount: result.amount.toNumber() };
    });
  }
  async deleteTransfer(userId: string, id: string) {
    return serializable(this.db, async (tx) => {
      const old = await tx.transfer.findFirst({ where: { id, userId } });
      if (!old) throw new NotFoundException('Transferência não encontrada.');
      await tx.transfer.delete({ where: { id, userId } });
      await tx.account.update({
        where: { id: old.fromAccountId, userId },
        data: { balance: { increment: old.amount } },
      });
      await tx.account.update({
        where: { id: old.toAccountId, userId },
        data: { balance: { decrement: old.amount } },
      });
      return { success: true };
    });
  }
  async budgets(userId: string, period: PeriodDto) {
    const budgets = await this.db.budget.findMany({
      where: { userId, month: period.month, year: period.year },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    const spent = await this.db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        status: 'CONFIRMED',
        type: 'EXPENSE',
        date: {
          gte: new Date(Date.UTC(period.year, period.month - 1, 1)),
          lt: new Date(Date.UTC(period.year, period.month, 1)),
        },
      },
      _sum: { amount: true },
    });
    return budgets.map((b) => ({
      ...b,
      amount: b.amount.toNumber(),
      ...budgetProgress(
        b.amount,
        spent.find((t) => t.categoryId === b.categoryId)?._sum.amount ||
          new Prisma.Decimal(0),
      ),
    }));
  }
  async saveBudget(userId: string, data: BudgetDto) {
    await this.category(this.db, userId, data.categoryId);
    const { categoryId, month, year } = data;
    return this.db.budget.upsert({
      where: {
        userId_categoryId_month_year: { userId, categoryId, month, year },
      },
      create: {
        userId,
        categoryId,
        month,
        year,
        amount: new Prisma.Decimal(data.amount),
      },
      update: { amount: new Prisma.Decimal(data.amount) },
    });
  }
  async deleteBudget(userId: string, id: string) {
    return this.db.budget.deleteMany({ where: { id, userId } });
  }
  async recurrences(userId: string) {
    await this.materialize(userId);
    return (
      await this.db.recurrence.findMany({
        where: { userId },
        include: { account: true, category: true },
        orderBy: { createdAt: 'desc' },
      })
    ).map((r) => ({ ...r, amount: r.amount.toNumber() }));
  }
  async createRecurrence(userId: string, data: RecurrenceDto) {
    const start = new Date(data.startDate),
      end = data.endDate ? new Date(data.endDate) : null;
    if (start.getTime() < day().getTime() - 366 * 86400000)
      throw new BadRequestException(
        'A data inicial deve estar no último ano ou no futuro.',
      );
    if (end && end < start)
      throw new BadRequestException(
        'A data final deve ser igual ou posterior à inicial.',
      );
    await this.account(this.db, userId, data.accountId, true);
    await this.category(this.db, userId, data.categoryId);
    const row = await this.db.recurrence.create({
      data: {
        ...data,
        userId,
        amount: new Prisma.Decimal(data.amount),
        startDate: start,
        endDate: end,
      },
    });
    await this.materialize(userId);
    return { ...row, amount: row.amount.toNumber() };
  }
  async editRecurrence(userId: string, id: string, data: EditRecurrenceDto) {
    return serializable(this.db, async (tx) => {
      const old = await tx.recurrence.findFirst({ where: { id, userId } });
      if (!old) throw new NotFoundException('Recorrência não encontrada.');
      if (data.accountId) await this.account(tx, userId, data.accountId, true);
      if (data.categoryId) await this.category(tx, userId, data.categoryId);
      const { effectiveDate, active, ...fields } = data;
      const effective = new Date(effectiveDate);
      const horizon = new Date(
        Date.UTC(day().getUTCFullYear() + 1, day().getUTCMonth() + 1, 0),
      );
      if (effective > horizon)
        throw new BadRequestException(
          'Escolha uma data de alteração dentro dos próximos 12 meses.',
        );
      const values = {
        ...fields,
        ...(fields.amount !== undefined
          ? { amount: new Prisma.Decimal(fields.amount) }
          : {}),
        ...(fields.endDate ? { endDate: new Date(fields.endDate) } : {}),
      };
      if (
        values.endDate &&
        (values.endDate < old.startDate || values.endDate < effective)
      )
        throw new BadRequestException(
          'A data final é anterior ao início da recorrência.',
        );
      let nextIndex = old.nextIndex;
      if (values.endDate) {
        let firstAfter = 0;
        while (
          firstAfter < old.nextIndex &&
          recurrenceDate(old.startDate, old.interval, firstAfter) <=
            values.endDate
        )
          firstAfter++;
        nextIndex = Math.min(nextIndex, firstAfter);
      }
      await tx.recurrence.update({
        where: { id, userId },
        data: {
          ...values,
          nextIndex,
          ...(active !== undefined ? { active } : {}),
        },
      });
      const where = {
        userId,
        recurrenceId: id,
        status: 'PLANNED' as const,
        date: { gte: effective },
      };
      if (active === false) await tx.transaction.deleteMany({ where });
      else {
        const { endDate: removedEndDate, ...transactionValues } = values;
        void removedEndDate;
        await tx.transaction.updateMany({ where, data: transactionValues });
        if (values.endDate)
          await tx.transaction.deleteMany({
            where: { ...where, date: { gte: effective, gt: values.endDate } },
          });
      }
      return { success: true };
    });
  }
  async materialize(userId: string) {
    const rules = await this.db.recurrence.findMany({
      where: { userId, active: true },
      select: { id: true },
    });
    const horizon = new Date(
      Date.UTC(day().getUTCFullYear() + 1, day().getUTCMonth() + 1, 0),
    );
    for (const rule of rules)
      await serializable(this.db, async (tx) => {
        const r = await tx.recurrence.findFirst({
          where: { id: rule.id, userId, active: true },
        });
        if (!r) return;
        let index = r.nextIndex;
        const rows: Prisma.TransactionCreateManyInput[] = [];
        for (let count = 0; count < 1000; count++) {
          const date = recurrenceDate(r.startDate, r.interval, index);
          if (date > horizon || (r.endDate && date > r.endDate)) break;
          rows.push({
            title: r.title,
            amount: r.amount,
            type: r.type,
            date,
            status: 'PLANNED',
            userId,
            accountId: r.accountId,
            categoryId: r.categoryId,
            recurrenceId: r.id,
            occurrenceDate: date,
          });
          index++;
        }
        if (rows.length) {
          await tx.transaction.createMany({ data: rows, skipDuplicates: true });
          await tx.recurrence.update({
            where: { id: r.id, userId },
            data: { nextIndex: index },
          });
        }
      });
  }
  async upcoming(userId: string) {
    await this.materialize(userId);
    return (
      await this.db.transaction.findMany({
        where: { userId, status: 'PLANNED' },
        include: { category: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        take: 100,
      })
    ).map((t) => ({ ...t, amount: t.amount.toNumber() }));
  }
}
