import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UserRepository } from '../../domain/repositories';
import { User } from '../../domain/entities';

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

  async create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const user = await this.prisma.user.create({
      data,
      select: USER_SELECT,
    });
    return new User(user);
  }

  async update(id: string, data: Partial<Pick<User, 'name' | 'email'>>): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
    return new User(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
