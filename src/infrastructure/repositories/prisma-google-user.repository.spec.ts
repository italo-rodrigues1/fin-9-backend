import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../../generated/client/client';
import { PrismaUserRepository } from './prisma-user.repository';
import { DEFAULT_CATEGORIES } from './prisma-category.repository';
import type { GoogleIdentity } from '../../domain/repositories/user.repository';

const identity: GoogleIdentity = {
  subject: 'google-subject-1',
  name: 'Google Name',
  email: 'user@gmail.com',
  emailAuthoritative: true,
};
const publicUser = {
  id: 'user-1',
  name: 'Original Name',
  email: 'User@gmail.com',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('Google user persistence', () => {
  const tx = {
    $queryRaw: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = { $transaction: jest.fn() };
  let repo: PrismaUserRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.findMany.mockResolvedValue([]);
    tx.user.create.mockResolvedValue(publicUser);
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(
      (work: (value: typeof tx) => unknown) => work(tx),
    );
    repo = new PrismaUserRepository(prisma as never);
  });

  it('creates a passwordless user and all default categories in one serializable transaction', async () => {
    const user = await repo.findOrCreateGoogleUser(identity);
    expect(user).toMatchObject(publicUser);
    expect(user.passwordHash).toBeUndefined();
    expect(user).not.toHaveProperty('googleSubject');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          id: expect.any(String) as unknown,
          name: identity.name,
          email: identity.email,
          googleSubject: identity.subject,
          passwordHash: null,
          categories: {
            create: DEFAULT_CATEGORIES.map((c) => ({ ...c, isDefault: true })),
          },
        },
      }),
    );
  });

  it('returns an already linked subject without matching its changed email or recreating categories', async () => {
    tx.user.findUnique.mockResolvedValue(publicUser);
    const user = await repo.findOrCreateGoogleUser({
      ...identity,
      email: 'changed@gmail.com',
    });
    expect(user.email).toBe(publicUser.email);
    expect(tx.user.findMany).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('links an authoritative email case-insensitively without changing name, email or password', async () => {
    tx.user.findMany.mockResolvedValue([
      { ...publicUser, googleSubject: null },
    ]);
    const user = await repo.findOrCreateGoogleUser(identity);
    expect(user).toMatchObject(publicUser);
    expect(user).not.toHaveProperty('googleSubject');
    expect(tx.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: identity.email, mode: 'insensitive' } },
        take: 2,
      }),
    );
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: publicUser.id, googleSubject: null },
      data: { googleSubject: identity.subject },
    });
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('does not link a third-party email solely because Google marked it verified', async () => {
    tx.user.findMany.mockResolvedValue([
      { ...publicUser, googleSubject: null },
    ]);
    await expect(
      repo.findOrCreateGoogleUser({ ...identity, emailAuthoritative: false }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('never replaces a different Google subject linked to an existing email', async () => {
    tx.user.findMany.mockResolvedValue([
      { ...publicUser, googleSubject: 'another-subject' },
    ]);
    await expect(repo.findOrCreateGoogleUser(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects ambiguous legacy email matches', async () => {
    tx.user.findMany.mockResolvedValue([
      { ...publicUser, googleSubject: null },
      { ...publicUser, id: 'user-2', googleSubject: null },
    ]);
    await expect(repo.findOrCreateGoogleUser(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('does not overwrite a link when the conditional update loses a race', async () => {
    tx.user.findMany.mockResolvedValue([
      { ...publicUser, googleSubject: null },
    ]);
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(repo.findOrCreateGoogleUser(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it.each(['P2002', 'P2034'])(
    'retries %s and returns the winner without creating duplicate default categories',
    async (code) => {
      prisma.$transaction.mockRejectedValueOnce({ code });
      tx.user.findUnique.mockResolvedValue(publicUser);
      expect(await repo.findOrCreateGoogleUser(identity)).toMatchObject(
        publicUser,
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(tx.user.create).not.toHaveBeenCalled();
    },
  );

  it('bounds retries when concurrent writes keep conflicting', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(repo.findOrCreateGoogleUser(identity)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry unrelated database failures', async () => {
    const error = new Error('database disconnected');
    prisma.$transaction.mockRejectedValue(error);
    await expect(repo.findOrCreateGoogleUser(identity)).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
