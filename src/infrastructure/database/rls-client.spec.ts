import { protectPrismaClient } from './rls-client';
import {
  getDatabaseContext,
  withDatabaseUser,
  withAuthContext,
} from './database-context';
import { PrismaClient } from '../../generated/client/client';

function fixture() {
  const calls: unknown[][] = [];
  const tx = {
    $executeRawUnsafe: jest.fn((sql: string) => {
      calls.push([sql]);
      return Promise.resolve(0);
    }),
    $queryRaw: jest.fn((strings: TemplateStringsArray, ...args: unknown[]) => {
      calls.push([...strings, ...args]);
      return Promise.resolve([]);
    }),
    account: {
      findMany: jest.fn(() => Promise.resolve([{ id: 'owned-account' }])),
    },
  };
  const base = {
    account: { findMany: jest.fn() },
    $extends: jest.fn(),
    $transaction: jest.fn(
      async (work: (value: typeof tx) => Promise<unknown>) => work(tx),
    ),
  };
  const client = protectPrismaClient(base as unknown as PrismaClient);
  return { calls, tx, base, client };
}

describe('RLS Prisma isolation', () => {
  it('does not expose an unprotected client through Prisma extensions', () => {
    const f = fixture();
    expect(() => f.client.$extends({})).toThrow('unprotected Prisma client');
    expect(f.base.$extends).not.toHaveBeenCalled();
  });

  it('sets the restricted role and local identity before executing model queries', async () => {
    const f = fixture();
    await withDatabaseUser('user-a', () => f.client.account.findMany());
    expect(f.calls[0]).toEqual(['SET LOCAL ROLE fin9_runtime']);
    expect(f.calls[1].slice(-3)).toEqual(['user-a', '', '']);
    expect(f.tx.account.findMany).toHaveBeenCalledWith();
    expect(f.base.account.findMany).not.toHaveBeenCalled();
  });

  it('uses an empty identity outside a request, rather than reusing the previous user', async () => {
    const f = fixture();
    await withDatabaseUser('user-a', () => f.client.account.findMany());
    await f.client.account.findMany();
    expect(f.calls[3].slice(-3)).toEqual(['', '', '']);
  });

  it('preserves serializable transaction options and initializes the same transaction', async () => {
    const f = fixture();
    await withDatabaseUser('user-a', () =>
      f.client.$transaction((tx) => tx.account.findMany(), {
        isolationLevel: 'Serializable',
      }),
    );
    expect(f.base.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(f.tx.account.findMany).toHaveBeenCalledTimes(1);
    expect(() => f.client.$transaction([])).toThrow('interactive transaction');
  });

  it('keeps concurrent asynchronous identities separate and restores authentication scopes', async () => {
    const identities = await Promise.all(
      ['a', 'b'].map((id) =>
        withDatabaseUser(id, async () => {
          await Promise.resolve();
          expect(getDatabaseContext().userId).toBe(id);
          withAuthContext({ email: `${id}@example.test` }, () => {
            expect(getDatabaseContext()).toEqual({
              authEmail: `${id}@example.test`,
              authSubject: undefined,
            });
          });
          return getDatabaseContext().userId;
        }),
      ),
    );
    expect(identities).toEqual(['a', 'b']);
    expect(getDatabaseContext()).toEqual({});
  });
});
