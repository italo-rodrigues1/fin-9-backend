import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountRepository } from '../../domain/repositories';
import { Account } from '../../domain/entities';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<Account[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    return accounts.map(
      (account) =>
        new Account({
          ...account,
          balance: Number(account.balance),
        }),
    );
  }

  async findById(id: string, userId: string): Promise<Account | null> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });

    if (!account) return null;

    return new Account({
      ...account,
      balance: Number(account.balance),
    });
  }

  async create(data: {
    name: string;
    institution: string;
    balance: number;
    color?: string;
    icon?: string;
    userId: string;
  }): Promise<Account> {
    const account = await this.prisma.account.create({
      data: {
        ...data,
        balance: new Prisma.Decimal(data.balance),
      },
    });

    return new Account({
      ...account,
      balance: Number(account.balance),
    });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Account> {
    const updateData: Prisma.AccountUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.institution !== undefined) updateData.institution = data.institution;
    if (data.balance !== undefined) updateData.balance = new Prisma.Decimal(data.balance);
    if (data.color !== undefined) updateData.color = data.color;
    if (data.icon !== undefined) updateData.icon = data.icon;

    const account = await this.prisma.account.update({
      where: { id, userId },
      data: updateData,
    });

    return new Account({
      ...account,
      balance: Number(account.balance),
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.account.delete({
      where: { id, userId },
    });
  }
}
