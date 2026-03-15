export class User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<User>) {
    Object.assign(this, props);
  }
}
