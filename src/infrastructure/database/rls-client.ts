import { Prisma, PrismaClient } from '../../generated/client/client';
import { getDatabaseContext } from './database-context';

type TransactionWork = (tx: Prisma.TransactionClient) => Promise<unknown>;

/** Every operation uses one connection and transaction-local RLS settings. */
export function protectPrismaClient<T extends PrismaClient>(client: T): T {
  const transaction = client.$transaction.bind(client);
  const models = new Set(
    Object.values(Prisma.ModelName).map(
      (name) => name[0].toLowerCase() + name.slice(1),
    ),
  );
  const delegates = new Map<string, object>();
  const rawOperations = new Set([
    '$queryRaw',
    '$executeRaw',
    '$queryRawUnsafe',
    '$executeRawUnsafe',
  ]);

  const run = (
    work: TransactionWork,
    options?: Parameters<PrismaClient['$transaction']>[1],
  ) => {
    const identity = getDatabaseContext();
    return transaction(async (tx) => {
      // The login may own tables or be a superuser; business queries never do.
      await tx.$executeRawUnsafe('SET LOCAL ROLE fin9_runtime');
      await tx.$queryRaw`
        SELECT set_config('app.user_id', ${identity.userId ?? ''}, true),
               set_config('app.auth_email', ${identity.authEmail ?? ''}, true),
               set_config('app.auth_subject', ${identity.authSubject ?? ''}, true)
      `;
      return work(tx);
    }, options);
  };

  return new Proxy(client, {
    get(target, property) {
      if (property === '$extends') {
        return () => {
          throw new TypeError(
            'Extend the RLS wrapper explicitly; $extends would expose an unprotected Prisma client',
          );
        };
      }
      if (property === '$transaction') {
        return (work: TransactionWork, options?: Parameters<typeof run>[1]) => {
          if (typeof work !== 'function') {
            throw new TypeError(
              'RLS requires an interactive transaction callback',
            );
          }
          return run(work, options);
        };
      }
      if (typeof property === 'string' && rawOperations.has(property)) {
        return (...args: unknown[]) =>
          run((tx) =>
            Reflect.apply(
              Reflect.get(tx, property) as (
                ...args: unknown[]
              ) => Promise<unknown>,
              tx,
              args,
            ),
          );
      }
      if (typeof property === 'string' && models.has(property)) {
        if (!delegates.has(property)) {
          delegates.set(
            property,
            new Proxy(Reflect.get(target, property) as object, {
              get(delegate, operation) {
                const value: unknown = Reflect.get(delegate, operation);
                if (typeof value !== 'function') return value;
                return (...args: unknown[]) =>
                  run((tx) => {
                    const scoped: object = Reflect.get(tx, property) as object;
                    return Reflect.apply(
                      Reflect.get(scoped, operation) as (
                        ...args: unknown[]
                      ) => Promise<unknown>,
                      scoped,
                      args,
                    );
                  });
              },
            }),
          );
        }
        return delegates.get(property);
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function'
        ? (value.bind(target) as unknown)
        : value;
    },
  });
}
