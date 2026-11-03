import { AsyncLocalStorage } from 'node:async_hooks';

interface DatabaseContext {
  userId?: string;
  authEmail?: string;
  authSubject?: string;
}

const context = new AsyncLocalStorage<DatabaseContext>();

export function getDatabaseContext(): Readonly<DatabaseContext> {
  return context.getStore() ?? {};
}

/** Only call with an identity verified by the server, never a request body. */
export function withDatabaseUser<T>(userId: string, work: () => T): T {
  return context.run({ userId }, work);
}

/** Authentication can inspect matching identities, but cannot read finances. */
export function withAuthContext<T>(
  identity: { email: string; subject?: string },
  work: () => T,
): T {
  return context.run(
    { authEmail: identity.email, authSubject: identity.subject },
    work,
  );
}
