import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAccountDto, UpdateAccountDto } from './account.dto';
import { SaveCardDto, SaveCardPurchaseDto } from './card.dto';
import {
  BudgetDto,
  EditRecurrenceDto,
  PageDto,
  PeriodDto,
  TransferDto,
} from './planning.dto';
import {
  CreateTransactionDto,
  FilterTransactionDto,
  UpdateTransactionDto,
} from './transaction.dto';
import { Prisma } from '../../generated/client/client';
import { publicResponse } from '../interceptors/public-response.interceptor';

const uuid = 'b8147b1a-38ad-4b0e-9c71-f19fabed3158';

describe('Strict request validation', () => {
  it.each([true, false, [], [1], '', ' ', null, {}, '1e5', 'Infinity'])(
    'does not coerce %p into a financial number',
    async (balance) => {
      const errors = await validate(
        plainToInstance(CreateAccountDto, {
          name: 'Conta',
          institution: 'Banco',
          balance,
        }),
      );
      expect(errors.map((error) => error.property)).toContain('balance');
    },
  );

  it.each([
    [UpdateAccountDto, { name: null, isArchived: null }],
    [UpdateTransactionDto, { amount: null, accountId: null, status: null }],
    [
      SaveCardDto,
      {
        name: 'Cartão',
        creditLimit: 1,
        closingDay: 10,
        dueDay: 20,
        isArchived: null,
      },
    ],
    [
      EditRecurrenceDto,
      { effectiveDate: '2026-11-01', active: null, amount: null },
    ],
    [FilterTransactionDto, { take: null }],
  ])('rejects null in non-nullable optional fields', async (type, payload) => {
    const dto = plainToInstance(type as new () => object, payload);
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it.each([
    { month: 0 },
    { month: 13 },
    { month: 1.5 },
    { month: true },
    { year: 0 },
    { year: 9999 },
    { year: 2026.1 },
    { skip: 100001 },
    { take: 101 },
  ])('rejects invalid filter %p', async (payload) => {
    expect(
      (await validate(plainToInstance(FilterTransactionDto, payload))).length,
    ).toBeGreaterThan(0);
  });

  it.each(['2026-02-30', '2026-11-01T00:00:00Z', '11/01/2026'])(
    'rejects invalid or ambiguous transaction date %s',
    async (date) => {
      const errors = await validate(
        plainToInstance(CreateTransactionDto, {
          title: 'Compra',
          amount: 10,
          type: 'EXPENSE',
          categoryId: uuid,
          accountId: uuid,
          date,
        }),
      );
      expect(errors.map((error) => error.property)).toEqual(['date']);
    },
  );

  it.each([TransferDto, SaveCardPurchaseDto, EditRecurrenceDto])(
    'rejects impossible calendar dates in planning and card inputs',
    async (type) => {
      const dto = plainToInstance(type as new () => object, {
        fromAccountId: uuid,
        toAccountId: uuid,
        categoryId: uuid,
        title: 'Compra',
        amount: 10,
        installmentCount: 1,
        date: '2026-02-30',
        effectiveDate: '2026-02-30',
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );

  it('accepts numeric query strings and preserves pagination defaults', async () => {
    expect(
      await validate(plainToInstance(PeriodDto, { month: '11', year: '2026' })),
    ).toHaveLength(0);
    expect(plainToInstance(PageDto, {})).toMatchObject({ skip: 0, take: 30 });
    expect(plainToInstance(FilterTransactionDto, {})).toMatchObject({
      skip: 0,
      take: 30,
    });
  });

  it('does not accept the unused accountId in a budget body', async () => {
    const dto = plainToInstance(BudgetDto, {
      categoryId: uuid,
      month: 11,
      year: 2026,
      amount: 10,
      accountId: uuid,
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((error) => error.property)).toEqual(['accountId']);
  });

  it('keeps dates, Decimal JSON and business IDs while removing internal fields', () => {
    const date = new Date('2026-11-01T00:00:00Z');
    expect(
      publicResponse({
        userId: uuid,
        date,
        amount: new Prisma.Decimal('1.25'),
        account: { id: uuid, userId: uuid },
      }),
    ).toEqual({ date, amount: '1.25', account: { id: uuid } });
  });
});
