import { Transaction, TransactionType } from '../entities';

export interface TransactionFilters {
  userId: string;
  month?: number;
  year?: number;
  type?: TransactionType;
  categoryId?: string;
  orderBy?: 'date' | 'amount';
  orderDir?: 'asc' | 'desc';
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  accounts: {
    id: string;
    name: string;
    institution: string;
    balance: number;
    color: string;
    icon: string;
  }[];
  byCategory: { categoryId: string; categoryName: string; categoryColor: string; total: number; type: TransactionType }[];
}

export interface TransactionRepository {
  findById(id: string, userId: string): Promise<Transaction | null>;
  findAll(filters: TransactionFilters): Promise<Transaction[]>;
  create(data: {
    title: string;
    description?: string;
    amount: number;
    type: TransactionType;
    date: Date;
    categoryId: string;
    userId: string;
  }): Promise<Transaction>;
  update(id: string, userId: string, data: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<Transaction>;
  delete(id: string, userId: string): Promise<void>;
  getMonthlySummary(userId: string, month: number, year: number): Promise<MonthlySummary>;
}

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');
