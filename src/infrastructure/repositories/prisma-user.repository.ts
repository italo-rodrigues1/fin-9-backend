import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UserRepository } from '../../domain/repositories';
import { User } from '../../domain/entities';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? new User(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? new User(user) : null;
  }

  async create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const user = await this.prisma.user.create({ data });
    return new User(user);
  }

  async update(id: string, data: Partial<Pick<User, 'name' | 'email'>>): Promise<User> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return new User(user);
  }
}
