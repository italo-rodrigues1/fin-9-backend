import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TransactionRepository, TransactionFilters, MonthlySummary } from '../../domain/repositories';
import { Transaction, TransactionType } from '../../domain/entities';

@Injectable()
export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, userId: string): Promise<Transaction | null> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!tx) return null;
    return new Transaction({ ...tx, description: tx.description ?? undefined, type: tx.type as TransactionType, amount: Number(tx.amount) });
  }

  async findAll(filters: TransactionFilters): Promise<Transaction[]> {
    const where: Prisma.TransactionWhereInput = { userId: filters.userId };

    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.month && filters.year) {
      const start = new Date(filters.year, filters.month - 1, 1);
      const end = new Date(filters.year, filters.month, 0);
      where.date = { gte: start, lte: end };
    } else if (filters.year) {
      const start = new Date(filters.year, 0, 1);
      const end = new Date(filters.year, 11, 31);
      where.date = { gte: start, lte: end };
    }

    const orderBy: Prisma.TransactionOrderByWithRelationInput = {};
    if (filters.orderBy === 'amount') {
      orderBy.amount = filters.orderDir || 'desc';
    } else {
      orderBy.date = filters.orderDir || 'desc';
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy,
      include: { category: true },
    });

    return transactions.map(
      (tx) => new Transaction({ ...tx, description: tx.description ?? undefined, type: tx.type as TransactionType, amount: Number(tx.amount) }),
    );
  }

  async create(data: {
    title: string;
    description?: string;
    amount: number;
    type: TransactionType;
    date: Date;
    categoryId: string;
    userId: string;
  }): Promise<Transaction> {
    const tx = await this.prisma.transaction.create({
      data: {
        ...data,
        amount: new Prisma.Decimal(data.amount),
      },
      include: { category: true },
    });
    return new Transaction({ ...tx, description: tx.description ?? undefined, type: tx.type as TransactionType, amount: Number(tx.amount) });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Transaction> {
    const updateData: Prisma.TransactionUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.categoryId !== undefined) {
      updateData.category = { connect: { id: data.categoryId } };
    }

    const tx = await this.prisma.transaction.update({
      where: { id, userId },
      data: updateData,
      include: { category: true },
    });
    return new Transaction({ ...tx, description: tx.description ?? undefined, type: tx.type as TransactionType, amount: Number(tx.amount) });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.transaction.delete({ where: { id, userId } });
  }

  async getMonthlySummary(userId: string, month: number, year: number): Promise<MonthlySummary> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
      include: { category: true },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; categoryColor: string; total: number; type: TransactionType }>();

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (tx.type === 'INCOME') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }

      const key = `${tx.categoryId}-${tx.type}`;
      const existing = categoryMap.get(key);
      if (existing) {
        existing.total += amount;
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
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      accounts: [],
      byCategory: Array.from(categoryMap.values()),
    };
  }
}
