import { Account } from '../entities';

export interface AccountRepository {
  findAll(userId: string): Promise<Account[]>;
  findById(id: string, userId: string): Promise<Account | null>;
  create(data: {
    name: string;
    institution: string;
    balance: number;
    color?: string;
    icon?: string;
    userId: string;
  }): Promise<Account>;
  update(
    id: string,
    userId: string,
    data: Partial<Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Account>;
  delete(id: string, userId: string): Promise<void>;
}

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');
