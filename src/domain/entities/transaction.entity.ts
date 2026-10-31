export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export class Transaction {
  status: 'CONFIRMED' | 'PLANNED' = 'CONFIRMED';
  recurrenceId?: string | null;
  occurrenceDate?: Date | null;
  id: string;
  title: string;
  description?: string;
  amount: number;
  type: TransactionType;
  date: Date;
  categoryId: string;
  accountId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<Transaction>) {
    Object.assign(this, props);
  }
}
