import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/client/client';
import { PrismaService } from '../database/prisma.service';
import { UserRepository } from '../../domain/repositories';
import type { GoogleIdentity } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities';
import { DEFAULT_CATEGORIES } from './prisma-category.repository';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    return user ? new User(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: USER_SELECT,
    });
    return user ? new User(user) : null;
  }

  async findByEmailWithHash(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? new User(user) : null;
  }

  async findOrCreateGoogleUser(identity: GoogleIdentity): Promise<User> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Subject is the stable identity; a later Google email change must not
            // transfer the association to another local account.
            const linked = await tx.user.findUnique({
              where: { googleSubject: identity.subject },
              select: USER_SELECT,
            });
            if (linked) return new User(linked);

            const matches = await tx.user.findMany({
              where: { email: { equals: identity.email, mode: 'insensitive' } },
              select: { ...USER_SELECT, googleSubject: true },
              take: 2,
            });
            if (matches.length > 1) {
              throw new ConflictException(
                'Há mais de uma conta com este e-mail. Entre com sua senha.',
              );
            }

            const existing = matches[0];
            if (existing) {
              if (!identity.emailAuthoritative || existing.googleSubject) {
                throw new ConflictException(
                  'Este e-mail já possui uma conta. Entre com sua senha ou com a conta Google vinculada.',
                );
              }
              // A conditional write also prevents replacing a link established by
              // a concurrent sign-in. Serializable conflicts are retried below.
              const updated = await tx.user.updateMany({
                where: { id: existing.id, googleSubject: null },
                data: { googleSubject: identity.subject },
              });
              if (updated.count !== 1) {
                throw new ConflictException(
                  'Esta conta já está vinculada a outra conta Google.',
                );
              }
              return new User({
                id: existing.id,
                name: existing.name,
                email: existing.email,
                createdAt: existing.createdAt,
                updatedAt: existing.updatedAt,
              });
            }

            const created = await tx.user.create({
              data: {
                name: identity.name,
                email: identity.email,
                googleSubject: identity.subject,
                passwordHash: null,
                categories: {
                  create: DEFAULT_CATEGORIES.map((category) => ({
                    ...category,
                    isDefault: true,
                  })),
                },
              },
              select: USER_SELECT,
            });
            return new User(created);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? error.code
            : undefined;
        if (code !== 'P2002' && code !== 'P2034') throw error;
        if (attempt === 2) {
          throw new ServiceUnavailableException(
            'Não foi possível concluir o acesso com Google. Tente novamente.',
          );
        }
      }
    }
    throw new ServiceUnavailableException(
      'Não foi possível concluir o acesso com Google. Tente novamente.',
    );
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    const user = await this.prisma.user.create({
      data,
      select: USER_SELECT,
    });
    return new User(user);
  }

  async update(
    id: string,
    data: Partial<Pick<User, 'name' | 'email'>>,
  ): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
    return new User(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.goalContribution.deleteMany({ where: { userId: id } });
      await tx.goal.deleteMany({ where: { userId: id } });
      await tx.transaction.deleteMany({ where: { userId: id } });
      await tx.cardPayment.deleteMany({ where: { userId: id } });
      await tx.cardInstallment.deleteMany({
        where: { purchase: { userId: id } },
      });
      await tx.cardPurchase.deleteMany({ where: { userId: id } });
      await tx.cardInvoice.deleteMany({ where: { userId: id } });
      await tx.creditCard.deleteMany({ where: { userId: id } });
      await tx.transfer.deleteMany({ where: { userId: id } });
      await tx.budget.deleteMany({ where: { userId: id } });
      await tx.recurrence.deleteMany({ where: { userId: id } });
      await tx.account.deleteMany({ where: { userId: id } });
      await tx.category.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
  }
}
