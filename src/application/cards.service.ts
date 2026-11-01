import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  SaveCardDto,
  SaveCardPurchaseDto,
  PayCardInvoiceDto,
} from '../presentation/dtos/card.dto';
import { PageDto } from '../presentation/dtos/planning.dto';
import { serializable } from './finance-rules';
import { cardSchedule, currentDay } from './card-rules';
const invoiceRelations = {
  installments: { select: { amount: true } },
  payments: {
    where: { reversedAt: null },
    include: {
      account: {
        select: { id: true, name: true, isArchived: true, deletedAt: true },
      },
    },
  },
} satisfies Prisma.CardInvoiceInclude;
type Invoice = Prisma.CardInvoiceGetPayload<{
  include: typeof invoiceRelations;
}>;
const invoiceSummary = (row: Invoice) => ({
  id: row.id,
  cardId: row.cardId,
  year: row.year,
  month: row.month,
  closingDate: row.closingDate,
  dueDate: row.dueDate,
  total: row.installments
    .reduce((s, i) => s.plus(i.amount), new Prisma.Decimal(0))
    .toNumber(),
  itemCount: row.installments.length,
  status: row.payments.length
    ? 'PAID'
    : row.closingDate <= currentDay()
      ? 'CLOSED'
      : 'OPEN',
  overdue: !row.payments.length && row.dueDate < currentDay(),
  payment: row.payments[0]
    ? { ...row.payments[0], amount: row.payments[0].amount.toNumber() }
    : null,
});
@Injectable()
export class CardsService {
  constructor(private readonly db: PrismaService) {}
  private async card(tx: Prisma.TransactionClient, userId: string, id: string) {
    const row = await tx.creditCard.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Cartão não encontrado.');
    return row;
  }
  private outstanding(
    tx: Prisma.TransactionClient,
    userId: string,
    cardId: string,
  ) {
    return tx.cardInstallment.aggregate({
      where: {
        purchase: { userId, cardId },
        invoice: { payments: { none: { reversedAt: null } } },
      },
      _sum: { amount: true },
    });
  }
  async list(userId: string) {
    return this.db.$transaction(
      async (tx) => {
        const rows = await tx.creditCard.findMany({
          where: { userId },
          include: { invoices: { include: invoiceRelations } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        return rows.map((c) => {
          const invoices = c.invoices.map(invoiceSummary),
            used = invoices
              .filter((i) => i.status !== 'PAID')
              .reduce((sum, i) => sum.plus(i.total), new Prisma.Decimal(0));
          const { invoices: removed, ...card } = c;
          void removed;
          return {
            ...card,
            creditLimit: c.creditLimit.toNumber(),
            usedLimit: used.toNumber(),
            availableLimit: c.creditLimit.minus(used).toNumber(),
            unpaidInvoices: invoices.filter((i) => i.status !== 'PAID').length,
          };
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async detail(userId: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        const card = await this.card(tx, userId, id),
          rows = await tx.cardInvoice.findMany({
            where: { userId, cardId: id },
            include: invoiceRelations,
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
          }),
          invoices = rows.map(invoiceSummary),
          used = invoices
            .filter((i) => i.status !== 'PAID')
            .reduce((s, i) => s.plus(i.total), new Prisma.Decimal(0));
        return {
          card: {
            ...card,
            creditLimit: card.creditLimit.toNumber(),
            usedLimit: used.toNumber(),
            availableLimit: card.creditLimit.minus(used).toNumber(),
            hasPurchases: Boolean(
              await tx.cardPurchase.count({ where: { userId, cardId: id } }),
            ),
          },
          invoices,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async saveCard(userId: string, data: SaveCardDto, id?: string) {
    return serializable(this.db, async (tx) => {
      if (id) {
        const old = await this.card(tx, userId, id);
        if (
          (old.closingDay !== data.closingDay || old.dueDay !== data.dueDay) &&
          (await tx.cardInvoice.count({ where: { userId, cardId: id } }))
        )
          throw new ConflictException(
            'O ciclo de um cartão com faturas não pode ser alterado. Cadastre outro cartão para um novo ciclo.',
          );
        const used =
          (await this.outstanding(tx, userId, id))._sum.amount ||
          new Prisma.Decimal(0);
        if (used.gt(data.creditLimit))
          throw new BadRequestException(
            'O limite não pode ser menor que o valor comprometido.',
          );
      }
      const values = {
          name: data.name.trim(),
          creditLimit: new Prisma.Decimal(data.creditLimit),
          closingDay: data.closingDay,
          dueDay: data.dueDay,
          ...(data.isArchived !== undefined
            ? { isArchived: data.isArchived }
            : {}),
        },
        row = id
          ? await tx.creditCard.update({ where: { id, userId }, data: values })
          : await tx.creditCard.create({ data: { ...values, userId } });
      return { ...row, creditLimit: row.creditLimit.toNumber() };
    });
  }
  async purchase(userId: string, cardId: string, id: string) {
    await this.card(this.db, userId, cardId);
    const row = await this.db.cardPurchase.findFirst({
      where: { id, userId, cardId },
      include: {
        installments: {
          include: {
            invoice: {
              include: {
                payments: { where: { reversedAt: null }, select: { id: true } },
              },
            },
          },
          orderBy: { number: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Compra não encontrada.');
    return {
      ...row,
      amount: row.amount.toNumber(),
      canEdit: row.installments.every((i) => !i.invoice.payments.length),
      installments: row.installments.map((i) => ({
        ...i,
        amount: i.amount.toNumber(),
      })),
    };
  }
  async savePurchase(
    userId: string,
    cardId: string,
    data: SaveCardPurchaseDto,
    id?: string,
  ) {
    return serializable(this.db, async (tx) => {
      const card = await this.card(tx, userId, cardId);
      if (!id && data.requestId) {
        const previous = await tx.cardPurchase.findUnique({
          where: { userId_requestId: { userId, requestId: data.requestId } },
        });
        if (previous) {
          if (
            previous.cardId !== cardId ||
            previous.title !== data.title.trim() ||
            !previous.amount.eq(data.amount) ||
            previous.categoryId !== data.categoryId ||
            previous.installmentCount !== data.installmentCount ||
            previous.date.toISOString().slice(0, 10) !== data.date
          )
            throw new ConflictException(
              'Tentativa já registrada com outros dados. Reabra o formulário.',
            );
          return { ...previous, amount: previous.amount.toNumber() };
        }
      }
      if (card.isArchived)
        throw new BadRequestException(
          'Reative o cartão antes de registrar ou editar compras.',
        );
      if (
        !(await tx.category.findFirst({
          where: { id: data.categoryId, userId },
        }))
      )
        throw new BadRequestException('Categoria não encontrada.');
      const date = new Date(data.date);
      if (date > currentDay())
        throw new BadRequestException('A compra não pode ter data futura.');
      if (id) {
        const old = await tx.cardPurchase.findFirst({
          where: { id, userId, cardId },
          include: {
            installments: {
              include: {
                invoice: {
                  select: {
                    payments: {
                      where: { reversedAt: null },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        });
        if (!old) throw new NotFoundException('Compra não encontrada.');
        if (old.installments.some((i) => i.invoice.payments.length))
          throw new ConflictException(
            'Estorne os pagamentos das faturas desta compra antes de alterá-la.',
          );
        await tx.cardInstallment.deleteMany({ where: { purchaseId: id } });
      }
      const used =
        (await this.outstanding(tx, userId, cardId))._sum.amount ||
        new Prisma.Decimal(0);
      if (used.plus(data.amount).gt(card.creditLimit))
        throw new BadRequestException(
          'A compra excede o limite disponível do cartão.',
        );
      const schedule = cardSchedule(
          date,
          card.closingDay,
          card.dueDay,
          data.installmentCount,
          new Prisma.Decimal(data.amount),
        ),
        values = {
          title: data.title.trim(),
          amount: new Prisma.Decimal(data.amount),
          categoryId: data.categoryId,
          date,
          installmentCount: data.installmentCount,
        };
      const purchase = id
        ? await tx.cardPurchase.update({ where: { id, userId }, data: values })
        : await tx.cardPurchase.create({
            data: { ...values, userId, cardId, requestId: data.requestId },
          });
      for (const part of schedule) {
        const { number, amount, ...cycle } = part,
          invoice = await tx.cardInvoice.upsert({
            where: {
              cardId_year_month: { cardId, year: part.year, month: part.month },
            },
            create: { ...cycle, userId, cardId },
            update: {},
            include: {
              payments: { where: { reversedAt: null }, select: { id: true } },
            },
          });
        if (invoice.payments.length)
          throw new ConflictException(
            'Uma das faturas já está paga. Estorne o pagamento para incluir esta compra.',
          );
        await tx.cardInstallment.create({
          data: {
            purchaseId: purchase.id,
            invoiceId: invoice.id,
            number,
            amount,
          },
        });
      }
      await this.prune(tx, userId, cardId);
      return { ...purchase, amount: purchase.amount.toNumber() };
    });
  }
  private prune(tx: Prisma.TransactionClient, userId: string, cardId: string) {
    return tx.cardInvoice.deleteMany({
      where: {
        userId,
        cardId,
        installments: { none: {} },
        payments: { none: {} },
      },
    });
  }
  async removePurchase(userId: string, cardId: string, id: string) {
    return serializable(this.db, async (tx) => {
      await this.card(tx, userId, cardId);
      const old = await tx.cardPurchase.findFirst({
        where: { id, userId, cardId },
        include: {
          installments: {
            include: {
              invoice: {
                select: {
                  payments: {
                    where: { reversedAt: null },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!old) throw new NotFoundException('Compra não encontrada.');
      if (old.installments.some((i) => i.invoice.payments.length))
        throw new ConflictException(
          'Estorne os pagamentos das faturas desta compra antes de removê-la.',
        );
      await tx.cardInstallment.deleteMany({ where: { purchaseId: id } });
      await tx.cardPurchase.delete({ where: { id, userId } });
      await this.prune(tx, userId, cardId);
      return { success: true };
    });
  }
  async invoice(userId: string, cardId: string, id: string, page: PageDto) {
    return this.db.$transaction(
      async (tx) => {
        const card = await this.card(tx, userId, cardId),
          invoice = await tx.cardInvoice.findFirst({
            where: { id, userId, cardId },
            include: invoiceRelations,
          });
        if (!invoice) throw new NotFoundException('Fatura não encontrada.');
        const rows = await tx.cardInstallment.findMany({
            where: { invoiceId: id },
            include: { purchase: { include: { category: true } } },
            orderBy: [{ purchase: { date: 'desc' } }, { id: 'desc' }],
            skip: page.skip,
            take: page.take + 1,
          }),
          locked = await tx.cardPurchase.findMany({
            where: {
              id: { in: rows.map((i) => i.purchaseId) },
              installments: {
                some: { invoice: { payments: { some: { reversedAt: null } } } },
              },
            },
            select: { id: true },
          });
        return {
          card: { ...card, creditLimit: card.creditLimit.toNumber() },
          invoice: invoiceSummary(invoice),
          items: rows.slice(0, page.take).map((i) => ({
            ...i,
            amount: i.amount.toNumber(),
            purchase: { ...i.purchase, amount: i.purchase.amount.toNumber() },
            canEdit: !locked.some((p) => p.id === i.purchaseId),
          })),
          hasMore: rows.length > page.take,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async pay(
    userId: string,
    cardId: string,
    invoiceId: string,
    data: PayCardInvoiceDto,
  ) {
    return serializable(this.db, async (tx) => {
      const card = await this.card(tx, userId, cardId),
        previous = await tx.cardPayment.findUnique({
          where: { userId_requestId: { userId, requestId: data.requestId } },
        });
      if (previous) {
        if (
          previous.reversedAt ||
          previous.invoiceId !== invoiceId ||
          previous.accountId !== data.accountId ||
          previous.date.toISOString().slice(0, 10) !== data.date
        )
          throw new ConflictException(
            'Tentativa já utilizada ou estornada. Reabra o formulário de pagamento.',
          );
        return { ...previous, amount: previous.amount.toNumber() };
      }
      const invoice = await tx.cardInvoice.findFirst({
        where: { id: invoiceId, userId, cardId },
        include: {
          installments: { include: { purchase: true } },
          payments: { where: { reversedAt: null }, select: { id: true } },
        },
      });
      if (!invoice) throw new NotFoundException('Fatura não encontrada.');
      if (invoice.payments.length)
        throw new ConflictException('Esta fatura já está paga.');
      const date = new Date(data.date);
      if (
        invoice.closingDate > currentDay() ||
        date < invoice.closingDate ||
        date > currentDay()
      )
        throw new BadRequestException(
          'Registre o pagamento a partir do fechamento, sem data futura.',
        );
      const account = await tx.account.findFirst({
        where: {
          id: data.accountId,
          userId,
          isArchived: false,
          deletedAt: null,
        },
      });
      if (!account)
        throw new BadRequestException('Conta não encontrada ou arquivada.');
      const amount = invoice.installments.reduce(
        (s, i) => s.plus(i.amount),
        new Prisma.Decimal(0),
      );
      if (amount.lte(0))
        throw new BadRequestException(
          'A fatura não possui valores para pagar.',
        );
      const payment = await tx.cardPayment.create({
        data: {
          userId,
          invoiceId,
          accountId: account.id,
          amount,
          date,
          requestId: data.requestId,
        },
      });
      await tx.transaction.createMany({
        data: invoice.installments.map((i) => ({
          userId,
          accountId: account.id,
          categoryId: i.purchase.categoryId,
          title: (
            card.name +
            ' · ' +
            i.purchase.title +
            ' ' +
            i.number +
            '/' +
            i.purchase.installmentCount
          ).slice(0, 100),
          description:
            'Pagamento integral de fatura. Gerencie pela tela do cartão.',
          amount: i.amount,
          type: 'EXPENSE',
          status: 'CONFIRMED',
          date,
          cardPaymentId: payment.id,
        })),
      });
      await tx.account.update({
        where: { id: account.id, userId, isArchived: false, deletedAt: null },
        data: { balance: { decrement: amount } },
      });
      return { ...payment, amount: payment.amount.toNumber() };
    });
  }
  async reverse(userId: string, cardId: string, invoiceId: string, id: string) {
    return serializable(this.db, async (tx) => {
      await this.card(tx, userId, cardId);
      const payment = await tx.cardPayment.findFirst({
        where: { id, userId, invoiceId, invoice: { cardId } },
      });
      if (!payment) throw new NotFoundException('Pagamento não encontrado.');
      if (payment.reversedAt) return { success: true };
      const origin = await tx.account.findFirst({
        where: { id: payment.accountId, userId },
      });
      if (!origin || origin.deletedAt)
        throw new ConflictException(
          'Pagamentos de contas excluídas estão disponíveis apenas para consulta.',
        );
      await tx.transaction.deleteMany({ where: { userId, cardPaymentId: id } });
      await tx.account.update({
        where: { id: payment.accountId, userId },
        data: { balance: { increment: payment.amount } },
      });
      await tx.cardPayment.update({
        where: { id, userId },
        data: { reversedAt: new Date() },
      });
      return { success: true };
    });
  }
}
