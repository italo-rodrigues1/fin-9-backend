import { PrismaUserRepository } from './prisma-user.repository';
import { User } from '../../domain/entities';

const mockPrismaUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaUserRepository(mockPrismaService as any);
  });

  describe('findById', () => {
    it('should return User without passwordHash', async () => {
      const { passwordHash: _, ...userWithoutHash } = mockPrismaUser;
      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutHash);

      const result = await repository.findById('user-1');

      expect(result).toBeInstanceOf(User);
      expect(result!.passwordHash).toBeUndefined();
    });

    it('should pass correct select to Prisma', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await repository.findById('user-1');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return User without passwordHash', async () => {
      const { passwordHash: _, ...userWithoutHash } = mockPrismaUser;
      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutHash);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toBeInstanceOf(User);
      expect(result!.passwordHash).toBeUndefined();
    });

    it('should pass correct select to Prisma', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await repository.findByEmail('test@example.com');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailWithHash', () => {
    it('should return User WITH passwordHash (for internal login use)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockPrismaUser);

      const result = await repository.findByEmailWithHash('test@example.com');

      expect(result).toBeInstanceOf(User);
      expect(result!.passwordHash).toBe('hashed-password');
    });

    it('should NOT pass select to Prisma (fetches all fields)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await repository.findByEmailWithHash('test@example.com');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('create', () => {
    it('should return User without passwordHash', async () => {
      const { passwordHash: _, ...userWithoutHash } = mockPrismaUser;
      mockPrismaService.user.create.mockResolvedValue(userWithoutHash);

      const result = await repository.create({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      });

      expect(result).toBeInstanceOf(User);
      expect(result.passwordHash).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should return User without passwordHash', async () => {
      const { passwordHash: _, ...userWithoutHash } = mockPrismaUser;
      mockPrismaService.user.update.mockResolvedValue(userWithoutHash);

      const result = await repository.update('user-1', { name: 'New Name' });

      expect(result).toBeInstanceOf(User);
      expect(result.passwordHash).toBeUndefined();
    });
  });
});
