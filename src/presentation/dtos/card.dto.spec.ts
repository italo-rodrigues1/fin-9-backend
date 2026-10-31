import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  SaveCardDto,
  SaveCardPurchaseDto,
  PayCardInvoiceDto,
} from './card.dto';
describe('Credit card input validation', () => {
  it('validates card names, positive limits and calendar days', async () => {
    expect(
      await validate(
        plainToInstance(SaveCardDto, {
          name: ' Cartão ',
          creditLimit: 1000,
          closingDay: 31,
          dueDay: 5,
        }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(SaveCardDto, {
            name: ' ',
            creditLimit: 0,
            closingDay: 32,
            dueDay: 0,
          }),
        )
      ).length,
    ).toBe(4);
  });
  it.each([0, -1, 1.001, 1000000000])(
    'rejects invalid purchase totals %s',
    async (amount) => {
      expect(
        (
          await validate(
            plainToInstance(SaveCardPurchaseDto, {
              title: 'Compra',
              categoryId: 'b8147b1a-38ad-4b0e-9c71-f19fabed3158',
              date: '2026-10-01',
              amount,
              installmentCount: 1,
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it('rejects impossible dates and invalid installments', async () => {
    expect(
      (
        await validate(
          plainToInstance(SaveCardPurchaseDto, {
            title: 'Compra',
            categoryId: 'b8147b1a-38ad-4b0e-9c71-f19fabed3158',
            date: '2026-02-30',
            amount: 100,
            installmentCount: 37,
          }),
        )
      ).length,
    ).toBe(2);
  });
  it('requires account, calendar date and retry key when paying', async () => {
    expect(
      (
        await validate(
          plainToInstance(PayCardInvoiceDto, {
            accountId: 'x',
            date: '2026-02-30',
            requestId: 'bad',
          }),
        )
      ).length,
    ).toBe(3);
  });
});
