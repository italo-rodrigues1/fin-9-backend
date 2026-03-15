import { User } from '../entities';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: { name: string; email: string; passwordHash: string }): Promise<User>;
  update(id: string, data: Partial<Pick<User, 'name' | 'email'>>): Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
