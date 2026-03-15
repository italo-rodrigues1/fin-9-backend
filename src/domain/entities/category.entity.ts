export class Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<Category>) {
    Object.assign(this, props);
  }
}
