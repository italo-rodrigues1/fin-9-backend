import { Category } from '../entities';

export interface CategoryRepository {
  findById(id: string, userId: string): Promise<Category | null>;
  findAllByUser(userId: string): Promise<Category[]>;
  findByNameAndUser(name: string, userId: string): Promise<Category | null>;
  create(data: { name: string; color: string; icon: string; isDefault: boolean; userId: string }): Promise<Category>;
  update(id: string, userId: string, data: Partial<Pick<Category, 'name' | 'color' | 'icon'>>): Promise<Category>;
  delete(id: string, userId: string): Promise<void>;
  createDefaultCategories(userId: string): Promise<void>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
