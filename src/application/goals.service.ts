import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  GoalPageDto,
  SaveGoalContributionDto,
  SaveGoalDto,
} from '../presentation/dtos/goal.dto';
import { serializable } from './finance-rules';
import { goalFunding } from './goal-funding';
@Injectable()
export class GoalsService {
  constructor(private readonly db: PrismaService) {}
  private async ownedGoal(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
  ) {
    const goal = await tx.goal.findFirst({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Meta não encontrada.');
    return goal;
  }
  private async snapshot(tx: Prisma.TransactionClient, userId: string) {
    const [goals, accounts, allocations] = await Promise.all([
      tx.goal.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      tx.account.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      tx.goalContribution.groupBy({
        by: ['goalId', 'accountId'],
        where: { userId },
        _sum: { amount: true },
      }),
    ]);
    const funding = goalFunding(
      accounts,
      allocations.map((a) => ({
        goalId: a.goalId,
        accountId: a.accountId,
        amount: a._sum.amount || new Prisma.Decimal(0),
      })),
    );
    const today = new Date(new Date().toISOString().slice(0, 10));
    const summaries = goals.map((goal) => {
      const totals = funding.goals.get(goal.id) || {
        allocated: new Prisma.Decimal(0),
        funded: new Prisma.Decimal(0),
      };
      return {
        ...goal,
        targetAmount: goal.targetAmount.toNumber(),
        allocatedAmount: totals.allocated.toNumber(),
        currentAmount: totals.funded.toNumber(),
        shortfall: totals.allocated.minus(totals.funded).toNumber(),
        remainingAmount: Prisma.Decimal.max(
          0,
          goal.targetAmount.minus(totals.funded),
        ).toNumber(),
        percentage: totals.funded
          .div(goal.targetAmount)
          .mul(100)
          .toDecimalPlaces(1)
          .toNumber(),
        status: totals.funded.gte(goal.targetAmount)
          ? 'COMPLETED'
          : totals.funded.lt(totals.allocated)
            ? 'REVIEW'
            : goal.deadline && goal.deadline < today
              ? 'OVERDUE'
              : 'IN_PROGRESS',
      };
    });
    return {
      goals: summaries,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        isArchived: a.isArchived,
        balance: a.balance.toNumber(),
        allocatedAmount: (
          funding.reserved.get(a.id) || new Prisma.Decimal(0)
        ).toNumber(),
        availableAmount: (
          funding.available.get(a.id) || new Prisma.Decimal(0)
        ).toNumber(),
      })),
    };
  }
  async overview(userId: string) {
    return this.db.$transaction((tx) => this.snapshot(tx, userId), {
      isolationLevel: 'RepeatableRead',
    });
  }
  async detail(userId: string, id: string, page: GoalPageDto) {
    return this.db.$transaction(
      async (tx) => {
        await this.ownedGoal(tx, userId, id);
        const snapshot = await this.snapshot(tx, userId);
        const contributions = await tx.goalContribution.findMany({
          where: { userId, goalId: id },
          include: {
            account: {
              select: {
                id: true,
                name: true,
                institution: true,
                isArchived: true,
              },
            },
          },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          skip: page.skip,
          take: page.take + 1,
        });
        return {
          goal: snapshot.goals.find((g) => g.id === id)!,
          accounts: snapshot.accounts,
          contributions: contributions
            .slice(0, page.take)
            .map((c) => ({ ...c, amount: c.amount.toNumber() })),
          hasMore: contributions.length > page.take,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async saveGoal(userId: string, data: SaveGoalDto, id?: string) {
    return serializable(this.db, async (tx) => {
      if (id) await this.ownedGoal(tx, userId, id);
      const values = {
        name: data.name.trim(),
        targetAmount: new Prisma.Decimal(data.targetAmount),
        deadline: data.deadline ? new Date(data.deadline) : null,
      };
      const result = id
        ? await tx.goal.update({ where: { id, userId }, data: values })
        : await tx.goal.create({ data: { ...values, userId } });
      return { ...result, targetAmount: result.targetAmount.toNumber() };
    });
  }
  async deleteGoal(userId: string, id: string) {
    return serializable(this.db, async (tx) => {
      await this.ownedGoal(tx, userId, id);
      await tx.goal.delete({ where: { id, userId } });
      return { success: true };
    });
  }
  async saveContribution(
    userId: string,
    goalId: string,
    data: SaveGoalContributionDto,
    id?: string,
  ) {
    return serializable(this.db, async (tx) => {
      await this.ownedGoal(tx, userId, goalId);
      if (!id && data.requestId) {
        const previous = await tx.goalContribution.findUnique({
          where: { userId_requestId: { userId, requestId: data.requestId } },
        });
        if (previous) {
          if (
            previous.goalId !== goalId ||
            previous.accountId !== data.accountId ||
            !previous.amount.eq(data.amount) ||
            previous.date.toISOString().slice(0, 10) !== data.date ||
            (previous.note || '') !== (data.note?.trim() || '')
          )
            throw new ConflictException(
              'Esta tentativa já foi registrada com outros dados. Reabra o formulário.',
            );
          return { ...previous, amount: previous.amount.toNumber() };
        }
      }
      const old = id
        ? await tx.goalContribution.findFirst({ where: { id, userId, goalId } })
        : null;
      if (id && !old)
        throw new NotFoundException('Contribuição não encontrada.');
      const account = await tx.account.findFirst({
        where: { id: data.accountId, userId },
      });
      if (!account) throw new BadRequestException('Conta não encontrada.');
      const amount = new Prisma.Decimal(data.amount),
        reducing = Boolean(
          old && old.accountId === account.id && amount.lte(old.amount),
        );
      if (account.isArchived && !reducing)
        throw new BadRequestException(
          'Reative a conta antes de destinar novos valores.',
        );
      if (!reducing) {
        const total = await tx.goalContribution.aggregate({
          where: {
            userId,
            accountId: account.id,
            ...(id ? { id: { not: id } } : {}),
          },
          _sum: { amount: true },
        });
        if (
          amount
            .plus(total._sum.amount || 0)
            .gt(Prisma.Decimal.max(0, account.balance))
        )
          throw new BadRequestException(
            'O valor excede o saldo disponível para destinar nesta conta.',
          );
      }
      const values = {
        accountId: account.id,
        amount,
        date: new Date(data.date),
        note: data.note?.trim() || null,
      };
      const result = id
        ? await tx.goalContribution.update({
            where: { id, userId },
            data: values,
          })
        : await tx.goalContribution.create({
            data: { ...values, userId, goalId, requestId: data.requestId },
          });
      return { ...result, amount: result.amount.toNumber() };
    });
  }
  async getContribution(userId: string, goalId: string, id: string) {
    await this.ownedGoal(this.db, userId, goalId);
    const row = await this.db.goalContribution.findFirst({
      where: { id, userId, goalId },
    });
    if (!row) throw new NotFoundException('Contribuição não encontrada.');
    return { ...row, amount: row.amount.toNumber() };
  }
  async deleteContribution(userId: string, goalId: string, id: string) {
    return serializable(this.db, async (tx) => {
      await this.ownedGoal(tx, userId, goalId);
      const row = await tx.goalContribution.findFirst({
        where: { id, userId, goalId },
      });
      if (!row) throw new NotFoundException('Contribuição não encontrada.');
      await tx.goalContribution.delete({ where: { id, userId } });
      return { success: true };
    });
  }
}
