import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CategoryRepository } from '../../domain/repositories';
import { Category } from '../../domain/entities';

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', color: '#ef4444', icon: 'utensils' },
  { name: 'Transporte', color: '#3b82f6', icon: 'car' },
  { name: 'Moradia', color: '#8b5cf6', icon: 'home' },
  { name: 'Saúde', color: '#10b981', icon: 'heart' },
  { name: 'Educação', color: '#f59e0b', icon: 'book' },
  { name: 'Lazer', color: '#ec4899', icon: 'gamepad' },
  { name: 'Salário', color: '#22c55e', icon: 'briefcase' },
  { name: 'Investimentos', color: '#06b6d4', icon: 'trending-up' },
  { name: 'Outros', color: '#6b7280', icon: 'tag' },
];

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, userId: string): Promise<Category | null> {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    return category ? new Category(category) : null;
  }

  async findAllByUser(userId: string): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    return categories.map((c) => new Category(c));
  }

  async findByNameAndUser(name: string, userId: string): Promise<Category | null> {
    const category = await this.prisma.category.findFirst({
      where: { name, userId },
    });
    return category ? new Category(category) : null;
  }

  async create(data: { name: string; color: string; icon: string; isDefault: boolean; userId: string }): Promise<Category> {
    const category = await this.prisma.category.create({ data });
    return new Category(category);
  }

  async update(id: string, userId: string, data: Partial<Pick<Category, 'name' | 'color' | 'icon'>>): Promise<Category> {
    const category = await this.prisma.category.update({
      where: { id, userId },
      data,
    });
    return new Category(category);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.category.delete({ where: { id, userId } });
  }

  async createDefaultCategories(userId: string): Promise<void> {
    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        isDefault: true,
        userId,
      })),
    });
  }
}
