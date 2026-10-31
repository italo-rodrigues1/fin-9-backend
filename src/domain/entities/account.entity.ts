export class Account {
  isArchived: boolean = false;
  id: string;
  name: string;
  institution: string;
  balance: number;
  color: string;
  icon: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<Account>) {
    Object.assign(this, props);
  }
}
