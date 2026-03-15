export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export class Transaction {
  id: string;
  title: string;
  description?: string;
  amount: number;
  type: TransactionType;
  date: Date;
  categoryId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<Transaction>) {
    Object.assign(this, props);
  }
}
