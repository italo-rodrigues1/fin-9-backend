import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTransactionDto, FilterTransactionDto } from './transaction.dto';
import { CreateAccountDto } from './account.dto';
import { CreateCategoryDto } from './category.dto';
import { TransactionType } from '../../domain/entities';

describe('DTO Validation — @MaxLength and @IsIn', () => {
  describe('CreateTransactionDto', () => {
    it('rejects title with more than 100 characters', async () => {
      const dto = plainToInstance(CreateTransactionDto, {
        title: 'a'.repeat(101),
        amount: 10,
        type: TransactionType.EXPENSE,
        date: '2024-01-01',
        categoryId: '00000000-0000-0000-0000-000000000001',
      });
      const errors = await validate(dto);
      const titleErrors = errors.find((e) => e.property === 'title');
      expect(titleErrors).toBeDefined();
      expect(titleErrors?.constraints).toHaveProperty('maxLength');
    });

    it('accepts title with exactly 100 characters', async () => {
      const dto = plainToInstance(CreateTransactionDto, {
        title: 'a'.repeat(100),
        amount: 10,
        type: TransactionType.EXPENSE,
        date: '2024-01-01',
        categoryId: '00000000-0000-0000-0000-000000000001',
      });
      const errors = await validate(dto);
      const titleErrors = errors.find((e) => e.property === 'title');
      expect(titleErrors).toBeUndefined();
    });
  });

  describe('FilterTransactionDto', () => {
    it('rejects orderBy with invalid value "__proto__"', async () => {
      const dto = plainToInstance(FilterTransactionDto, { orderBy: '__proto__' });
      const errors = await validate(dto);
      const orderByErrors = errors.find((e) => e.property === 'orderBy');
      expect(orderByErrors).toBeDefined();
      expect(orderByErrors?.constraints).toHaveProperty('isIn');
    });

    it('rejects orderDir with invalid value "invalid"', async () => {
      const dto = plainToInstance(FilterTransactionDto, { orderDir: 'invalid' });
      const errors = await validate(dto);
      const orderDirErrors = errors.find((e) => e.property === 'orderDir');
      expect(orderDirErrors).toBeDefined();
      expect(orderDirErrors?.constraints).toHaveProperty('isIn');
    });

    it('accepts orderBy with value "date"', async () => {
      const dto = plainToInstance(FilterTransactionDto, { orderBy: 'date' });
      const errors = await validate(dto);
      const orderByErrors = errors.find((e) => e.property === 'orderBy');
      expect(orderByErrors).toBeUndefined();
    });

    it('accepts orderBy with value "amount"', async () => {
      const dto = plainToInstance(FilterTransactionDto, { orderBy: 'amount' });
      const errors = await validate(dto);
      const orderByErrors = errors.find((e) => e.property === 'orderBy');
      expect(orderByErrors).toBeUndefined();
    });

    it('accepts orderDir with value "asc"', async () => {
      const dto = plainToInstance(FilterTransactionDto, { orderDir: 'asc' });
      const errors = await validate(dto);
      const orderDirErrors = errors.find((e) => e.property === 'orderDir');
      expect(orderDirErrors).toBeUndefined();
    });

    it('accepts orderDir with value "desc"', async () => {
      const dto = plainToInstance(FilterTransactionDto, { orderDir: 'desc' });
      const errors = await validate(dto);
      const orderDirErrors = errors.find((e) => e.property === 'orderDir');
      expect(orderDirErrors).toBeUndefined();
    });
  });

  describe('CreateAccountDto', () => {
    it('rejects name with more than 100 characters', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        name: 'a'.repeat(101),
        institution: 'Bank',
        balance: 0,
      });
      const errors = await validate(dto);
      const nameErrors = errors.find((e) => e.property === 'name');
      expect(nameErrors).toBeDefined();
      expect(nameErrors?.constraints).toHaveProperty('maxLength');
    });

    it('accepts name with exactly 100 characters', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        name: 'a'.repeat(100),
        institution: 'Bank',
        balance: 0,
      });
      const errors = await validate(dto);
      const nameErrors = errors.find((e) => e.property === 'name');
      expect(nameErrors).toBeUndefined();
    });
  });

  describe('CreateCategoryDto', () => {
    it('rejects name with more than 50 characters', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'a'.repeat(51),
      });
      const errors = await validate(dto);
      const nameErrors = errors.find((e) => e.property === 'name');
      expect(nameErrors).toBeDefined();
      expect(nameErrors?.constraints).toHaveProperty('maxLength');
    });

    it('accepts name with exactly 50 characters', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'a'.repeat(50),
      });
      const errors = await validate(dto);
      const nameErrors = errors.find((e) => e.property === 'name');
      expect(nameErrors).toBeUndefined();
    });
  });
});
