import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transaction, TransactionType } from '../../domain/entities';
import {
  MonthlySummary,
  TransactionFilters,
  TransactionRepository,
} from '../../domain/repositories';
import { PrismaService } from '../database/prisma.service';

function getBalanceDelta(
  type: TransactionType,
  amount: number,
  status = 'CONFIRMED',
): number {
  if (status === 'PLANNED') return 0;
  return type === TransactionType.INCOME ? amount : -amount;
}

@Injectable()
export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async runTransaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
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
  }

  async findById(id: string, userId: string): Promise<Transaction | null> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!tx) return null;
    return new Transaction({
      ...tx,
      description: tx.description ?? undefined,
      type: tx.type as TransactionType,
      amount: Number(tx.amount),
    });
  }

  async findAll(filters: TransactionFilters): Promise<Transaction[]> {
    const where: Prisma.TransactionWhereInput = { userId: filters.userId };

    if (filters.search)
      where.title = { contains: filters.search.trim(), mode: 'insensitive' };
    if (filters.status) where.status = filters.status;
    if (filters.accountId) {
      where.accountId = filters.accountId;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.startDate || filters.endDate) {
      where.date = {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      };
    } else if (filters.month && filters.year) {
      const start = new Date(Date.UTC(filters.year, filters.month - 1, 1));
      const end = new Date(Date.UTC(filters.year, filters.month, 1));
      where.date = { gte: start, lt: end };
    } else if (filters.year) {
      const start = new Date(Date.UTC(filters.year, 0, 1));
      const end = new Date(Date.UTC(filters.year + 1, 0, 1));
      where.date = { gte: start, lt: end };
    }

    const orderBy: Prisma.TransactionOrderByWithRelationInput = {};
    if (filters.orderBy === 'amount') {
      orderBy.amount = filters.orderDir || 'desc';
    } else {
      orderBy.date = filters.orderDir || 'desc';
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: [orderBy, { id: 'desc' }],
      ...(filters.skip !== undefined ? { skip: filters.skip } : {}),
      ...(filters.take !== undefined ? { take: filters.take } : {}),
      include: { category: true },
    });

    return transactions.map(
      (tx) =>
        new Transaction({
          ...tx,
          description: tx.description ?? undefined,
          type: tx.type as TransactionType,
          amount: Number(tx.amount),
        }),
    );
  }

  async create(data: {
    status?: 'CONFIRMED' | 'PLANNED';
    title: string;
    description?: string;
    amount: number;
    type: TransactionType;
    date: Date;
    categoryId: string;
    accountId: string;
    userId: string;
  }): Promise<Transaction> {
    const tx = await this.runTransaction(async (prisma) => {
      const created = await prisma.transaction.create({
        data: {
          ...data,
          amount: new Prisma.Decimal(data.amount),
        },
        include: { category: true },
      });

      await prisma.account.update({
        where: { id: data.accountId, userId: data.userId, isArchived: false },
        data: {
          balance: {
            increment: new Prisma.Decimal(
              getBalanceDelta(data.type, data.amount, data.status),
            ),
          },
        },
      });

      return created;
    });

    return new Transaction({
      ...tx,
      description: tx.description ?? undefined,
      type: tx.type as TransactionType,
      amount: Number(tx.amount),
    });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<
      Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<Transaction> {
    const updateData: Prisma.TransactionUpdateInput = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.amount !== undefined)
      updateData.amount = new Prisma.Decimal(data.amount);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.categoryId !== undefined) {
      updateData.category = { connect: { id: data.categoryId } };
    }
    if (data.accountId !== undefined) {
      updateData.account = { connect: { id: data.accountId } };
    }

    const tx = await this.runTransaction(async (prisma) => {
      const existing = await prisma.transaction.findFirstOrThrow({
        where: { id, userId },
      });
      const previousAmount = Number(existing.amount);
      const nextAmount = data.amount ?? previousAmount;
      const nextType = data.type ?? (existing.type as TransactionType);
      const nextAccountId = data.accountId ?? existing.accountId;

      await prisma.account.update({
        where: { id: existing.accountId, userId },
        data: {
          balance: {
            increment: new Prisma.Decimal(
              -getBalanceDelta(
                existing.type as TransactionType,
                previousAmount,
                existing.status,
              ),
            ),
          },
        },
      });

      const updated = await prisma.transaction.update({
        where: { id, userId },
        data: updateData,
        include: { category: true },
      });

      await prisma.account.update({
        where: { id: nextAccountId, userId },
        data: {
          balance: {
            increment: new Prisma.Decimal(
              getBalanceDelta(
                nextType,
                nextAmount,
                data.status ?? existing.status,
              ),
            ),
          },
        },
      });

      return updated;
    });

    return new Transaction({
      ...tx,
      description: tx.description ?? undefined,
      type: tx.type as TransactionType,
      amount: Number(tx.amount),
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.runTransaction(async (prisma) => {
      const existing = await prisma.transaction.findFirstOrThrow({
        where: { id, userId },
      });

      await prisma.transaction.delete({ where: { id, userId } });
      await prisma.account.update({
        where: { id: existing.accountId, userId },
        data: {
          balance: {
            increment: new Prisma.Decimal(
              -getBalanceDelta(
                existing.type as TransactionType,
                Number(existing.amount),
                existing.status,
              ),
            ),
          },
        },
      });
    });
  }

  async getMonthlySummary(
    userId: string,
    month: number,
    year: number,
    accountId?: string,
  ): Promise<MonthlySummary> {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lt: end },
        status: 'CONFIRMED',
        ...(accountId && { accountId }),
      },
      include: { category: true },
    });

    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    const categoryMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        total: Prisma.Decimal;
        type: TransactionType;
      }
    >();

    for (const tx of transactions) {
      const amount = new Prisma.Decimal(tx.amount);
      if (tx.type === 'INCOME') {
        totalIncome = totalIncome.plus(amount);
      } else {
        totalExpense = totalExpense.plus(amount);
      }

      const key = `${tx.categoryId}-${tx.type}`;
      const existing = categoryMap.get(key);
      if (existing) {
        existing.total = existing.total.plus(amount);
      } else {
        categoryMap.set(key, {
          categoryId: tx.categoryId,
          categoryName: tx.category.name,
          categoryColor: tx.category.color,
          total: amount,
          type: tx.type as TransactionType,
        });
      }
    }

    return {
      totalIncome: totalIncome.toNumber(),
      totalExpense: totalExpense.toNumber(),
      balance: totalIncome.minus(totalExpense).toNumber(),
      accounts: [],
      byCategory: Array.from(categoryMap.values()).map((item) => ({
        ...item,
        total: item.total.toNumber(),
      })),
    };
  }
}
