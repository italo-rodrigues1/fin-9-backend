import type { ReferenceObject, SchemaObject } from '@nestjs/swagger';

type Properties = Record<string, SchemaObject | ReferenceObject>;
export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
export const array = (name: string): SchemaObject => ({
  type: 'array',
  items: ref(name),
});
const text = (maxLength?: number): SchemaObject => ({
  type: 'string',
  ...(maxLength ? { maxLength } : {}),
});
const number = (minimum?: number, maximum?: number): SchemaObject => ({
  type: 'number',
  ...(minimum !== undefined ? { minimum } : {}),
  ...(maximum !== undefined ? { maximum } : {}),
});
const integer = (minimum?: number, maximum?: number): SchemaObject => ({
  ...number(minimum, maximum),
  type: 'integer',
});
const boolean: SchemaObject = { type: 'boolean' };
const uuid: SchemaObject = { type: 'string', format: 'uuid' };
const date: SchemaObject = {
  type: 'string',
  format: 'date',
  example: '2026-11-02',
};
const timestamp: SchemaObject = { type: 'string', format: 'date-time' };
const money: SchemaObject = {
  ...number(0.01, 999999999.99),
  multipleOf: 0.01,
  example: 125.5,
};
const type: SchemaObject = { type: 'string', enum: ['INCOME', 'EXPENSE'] };
const status: SchemaObject = { type: 'string', enum: ['CONFIRMED', 'PLANNED'] };
const requestId: SchemaObject = {
  type: 'string',
  pattern: '^[a-zA-Z0-9-]{8,80}$',
  description:
    'Identificador de tentativa para evitar duplicação; reutilize apenas para repetir a mesma operação.',
};
const email: SchemaObject = { type: 'string', format: 'email', maxLength: 254 };
export const object = (
  properties: Properties,
  required = Object.keys(properties),
): SchemaObject => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const partial = (schema: SchemaObject): SchemaObject => ({
  ...schema,
  required: [],
});
const accountFields = {
  name: text(100),
  institution: text(100),
  balance: { ...money, minimum: 0 },
  color: {
    type: 'string',
    pattern: '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$',
  } as SchemaObject,
  icon: text(100),
};
const categoryFields = {
  name: text(50),
  color: accountFields.color,
  icon: text(100),
};
const transactionFields = {
  title: text(100),
  description: text(500),
  amount: money,
  type,
  date,
  categoryId: uuid,
  accountId: uuid,
  status,
};
const periodFields = { month: integer(1, 12), year: integer(1900, 9998) };
const pageFields = {
  skip: { ...integer(0, 100000), default: 0 },
  take: { ...integer(1, 100), default: 30 },
};
const recurrenceFields = {
  title: text(100),
  amount: money,
  type,
  accountId: uuid,
  categoryId: uuid,
  interval: {
    type: 'string',
    enum: ['WEEKLY', 'MONTHLY', 'YEARLY'],
  } as SchemaObject,
  startDate: date,
  endDate: { ...date, nullable: true },
};
const cardFields = {
  name: text(100),
  brand: {
    type: 'string',
    nullable: true,
    enum: ['VISA', 'MASTERCARD', 'ELO', 'AMERICAN_EXPRESS', 'HIPERCARD', null],
  } as SchemaObject,
  creditLimit: money,
  closingDay: integer(1, 31),
  dueDay: integer(1, 31),
  isArchived: boolean,
};
const purchaseFields = {
  title: text(100),
  categoryId: uuid,
  amount: money,
  date,
  installmentCount: integer(1, 36),
  requestId,
};

/** Explicit contracts shared by both documentation UIs; DTO parity is checked in api-documentation.spec.ts. */
export const requestSchemas: Record<string, SchemaObject> = {
  RegisterDto: object({
    name: text(100),
    email,
    password: {
      ...text(128),
      minLength: 8,
      pattern: '^(?=.*[A-Z])(?=.*\\d).+$',
      writeOnly: true,
    },
  }),
  LoginDto: object({
    email,
    password: { ...text(128), minLength: 1, writeOnly: true },
  }),
  GoogleLoginDto: object({
    idToken: {
      ...text(8192),
      minLength: 1,
      writeOnly: true,
      description: 'ID token Google; audiência deve ser GOOGLE_WEB_CLIENT_ID.',
    },
  }),
  UpdateProfileDto: object({ name: text(100) }),
  CreateAccountDto: object(accountFields, ['name', 'institution', 'balance']),
  UpdateAccountDto: partial(
    object({
      name: accountFields.name,
      institution: accountFields.institution,
      color: accountFields.color,
      icon: accountFields.icon,
      isArchived: boolean,
    }),
  ),
  CreateCategoryDto: object(categoryFields, ['name']),
  UpdateCategoryDto: partial(object(categoryFields)),
  CreateTransactionDto: object(transactionFields, [
    'title',
    'amount',
    'type',
    'date',
    'categoryId',
    'accountId',
  ]),
  UpdateTransactionDto: partial(object(transactionFields)),
  FilterTransactionDto: object(
    {
      search: text(100),
      ...pageFields,
      month: periodFields.month,
      year: periodFields.year,
      startDate: date,
      endDate: date,
      type,
      status,
      categoryId: uuid,
      accountId: uuid,
      orderBy: { type: 'string', enum: ['date', 'amount'] },
      orderDir: { type: 'string', enum: ['asc', 'desc'] },
    },
    [],
  ),
  BudgetPeriodDto: object(periodFields),
  PeriodDto: object({ ...periodFields, accountId: uuid }, ['month', 'year']),
  PageDto: object(pageFields, []),
  GoalPageDto: object(pageFields, []),
  TransferDto: object(
    {
      fromAccountId: uuid,
      toAccountId: uuid,
      amount: money,
      date,
      title: text(100),
    },
    ['fromAccountId', 'toAccountId', 'amount', 'date'],
  ),
  BudgetDto: object({ ...periodFields, categoryId: uuid, amount: money }),
  RecurrenceDto: object(recurrenceFields, [
    'title',
    'amount',
    'type',
    'accountId',
    'categoryId',
    'interval',
    'startDate',
  ]),
  EditRecurrenceDto: object(
    {
      effectiveDate: date,
      active: boolean,
      title: text(100),
      amount: money,
      type,
      accountId: uuid,
      categoryId: uuid,
      endDate: { ...date, nullable: true },
    },
    ['effectiveDate'],
  ),
  SaveGoalDto: object(
    {
      name: text(100),
      targetAmount: money,
      deadline: { ...date, nullable: true },
    },
    ['name', 'targetAmount'],
  ),
  SaveGoalContributionDto: object(
    { accountId: uuid, amount: money, date, note: text(200), requestId },
    ['accountId', 'amount', 'date'],
  ),
  SaveCardDto: object(cardFields, [
    'name',
    'creditLimit',
    'closingDay',
    'dueDay',
  ]),
  SaveCardPurchaseDto: object(purchaseFields, [
    'title',
    'categoryId',
    'amount',
    'date',
    'installmentCount',
  ]),
  PayCardInvoiceDto: object({ accountId: uuid, date, requestId }),
};

const entityFields = { id: uuid, createdAt: timestamp, updatedAt: timestamp };
const persistedMoney: SchemaObject = { type: 'number', example: 125.5 };
const decimalString: SchemaObject = {
  type: 'string',
  pattern: '^-?\\d+(\\.\\d+)?$',
  description: 'Decimal serializado pelo Prisma sem conversão para number.',
};
const account = {
  ...entityFields,
  ...accountFields,
  balance: persistedMoney,
  isArchived: boolean,
  deletedAt: { ...timestamp, nullable: true },
};
const category = { ...entityFields, ...categoryFields, isDefault: boolean };
const transaction = {
  ...entityFields,
  ...transactionFields,
  amount: persistedMoney,
  date: timestamp,
  recurrenceId: { ...uuid, nullable: true },
  occurrenceDate: { ...timestamp, nullable: true },
  cardPaymentId: { ...uuid, nullable: true },
  category: ref('Category'),
  account: ref('AccountReference'),
  cardPayment: {
    ...object({ id: uuid, invoiceId: uuid, invoice: object({ cardId: uuid }) }),
    nullable: true,
  },
};
const transfer = {
  ...entityFields,
  fromAccountId: uuid,
  toAccountId: uuid,
  amount: persistedMoney,
  date: timestamp,
  title: text(100),
};
const budget = {
  ...entityFields,
  ...periodFields,
  categoryId: uuid,
  amount: persistedMoney,
};
const goal = {
  ...entityFields,
  name: text(100),
  targetAmount: persistedMoney,
  deadline: { ...timestamp, nullable: true },
};
const contribution = {
  ...entityFields,
  goalId: uuid,
  accountId: uuid,
  amount: persistedMoney,
  date: timestamp,
  note: { ...text(200), nullable: true },
  requestId: { ...requestId, nullable: true },
};
const card = { ...entityFields, ...cardFields, creditLimit: persistedMoney };
const purchase = {
  ...entityFields,
  ...purchaseFields,
  amount: persistedMoney,
  date: timestamp,
  requestId: { ...requestId, nullable: true },
  cardId: uuid,
};
const payment = {
  id: uuid,
  invoiceId: uuid,
  accountId: uuid,
  amount: persistedMoney,
  date: timestamp,
  requestId,
  reversedAt: { ...timestamp, nullable: true },
  createdAt: timestamp,
};
const installment = {
  id: uuid,
  purchaseId: uuid,
  invoiceId: uuid,
  number: integer(1, 36),
  amount: persistedMoney,
};
const monthly = {
  month: integer(1, 12),
  year: integer(1900, 9998),
  totalIncome: persistedMoney,
  totalExpense: persistedMoney,
  balance: persistedMoney,
  accounts: array('Account'),
  byCategory: {
    type: 'array',
    items: object({
      categoryId: uuid,
      categoryName: text(),
      categoryColor: text(),
      total: persistedMoney,
      type,
    }),
  } as SchemaObject,
};

export const responseSchemas: Record<string, SchemaObject> = {
  ApiError: object({
    statusCode: integer(),
    message: text(),
    error: text(),
    path: text(),
    timestamp,
  }),
  Message: object({ message: text() }),
  Success: object({ success: { type: 'boolean', example: true } }),
  Count: object({ count: integer(0) }),
  Health: object({ status: { type: 'string', enum: ['ok'] }, timestamp }),
  User: object({ id: uuid, name: text(100), email }),
  Profile: object({ id: uuid, name: text(100), email, createdAt: timestamp }),
  AuthSession: object({
    user: ref('User'),
    token: {
      type: 'string',
      description: 'JWT para Authorization: Bearer <token>.',
    },
  }),
  Account: object(account),
  AccountReference: object(
    { id: uuid, name: text(100), deletedAt: account.deletedAt },
    ['id', 'name'],
  ),
  Category: object(category),
  Transaction: object(transaction, [
    'id',
    'title',
    'amount',
    'type',
    'status',
    'date',
    'categoryId',
    'accountId',
    'createdAt',
    'updatedAt',
  ]),
  StatementEntry: {
    oneOf: [
      object(
        { ...transaction, kind: { type: 'string', enum: ['TRANSACTION'] } },
        ['id', 'kind', 'title', 'date', 'type', 'status', 'amount'],
      ),
      object({
        id: uuid,
        kind: { type: 'string', enum: ['TRANSFER'] },
        title: text(),
        date: timestamp,
        type,
        status,
        amount: persistedMoney,
      }),
    ],
  },
  Statement: object({
    account: ref('Account'),
    entries: array('StatementEntry'),
    hasMore: boolean,
  }),
  Transfer: object(transfer),
  TransferDetail: object({
    ...transfer,
    fromAccount: ref('AccountDecimal'),
    toAccount: ref('AccountDecimal'),
  }),
  AccountDecimal: object({ ...account, balance: decimalString }),
  Budget: object(budget),
  SavedBudget: object({ ...budget, amount: decimalString }),
  BudgetProgress: object({
    ...budget,
    category: ref('Category'),
    used: persistedMoney,
    remaining: persistedMoney,
    percentage: number(),
    alert: { type: 'string', enum: ['EXCEEDED', 'WARNING', 'OK'] },
  }),
  Recurrence: object({
    ...entityFields,
    ...recurrenceFields,
    amount: persistedMoney,
    startDate: timestamp,
    endDate: { ...timestamp, nullable: true },
    active: boolean,
    nextIndex: integer(0),
  }),
  RecurrenceDetail: object({
    ...entityFields,
    ...recurrenceFields,
    amount: persistedMoney,
    startDate: timestamp,
    endDate: { ...timestamp, nullable: true },
    active: boolean,
    nextIndex: integer(0),
    account: ref('AccountDecimal'),
    category: ref('Category'),
  }),
  Goal: object(goal),
  GoalProgress: object({
    ...goal,
    allocatedAmount: persistedMoney,
    currentAmount: persistedMoney,
    shortfall: persistedMoney,
    remainingAmount: persistedMoney,
    percentage: number(),
    status: {
      type: 'string',
      enum: ['COMPLETED', 'REVIEW', 'OVERDUE', 'IN_PROGRESS'],
    },
  }),
  GoalAccount: object({
    id: uuid,
    name: text(100),
    institution: text(100),
    isArchived: boolean,
    balance: persistedMoney,
    allocatedAmount: persistedMoney,
    availableAmount: persistedMoney,
  }),
  GoalOverview: object({
    goals: array('GoalProgress'),
    accounts: array('GoalAccount'),
  }),
  GoalContribution: object(contribution),
  ContributionDetail: object({
    ...contribution,
    account: object({
      id: uuid,
      name: text(100),
      institution: text(100),
      isArchived: boolean,
      deletedAt: account.deletedAt,
    }),
  }),
  GoalDetail: object({
    goal: ref('GoalProgress'),
    accounts: array('GoalAccount'),
    contributions: array('ContributionDetail'),
    hasMore: boolean,
  }),
  Card: object(card),
  CardSummary: object({
    ...card,
    usedLimit: persistedMoney,
    availableLimit: persistedMoney,
    unpaidInvoices: integer(0),
  }),
  CardDetail: object({
    card: object({
      ...card,
      usedLimit: persistedMoney,
      availableLimit: persistedMoney,
      hasPurchases: boolean,
    }),
    invoices: array('InvoiceSummary'),
  }),
  CardPurchase: object(purchase),
  CardPayment: object(payment),
  InvoiceSummary: object({
    id: uuid,
    cardId: uuid,
    year: integer(),
    month: integer(),
    closingDate: timestamp,
    dueDate: timestamp,
    total: persistedMoney,
    itemCount: integer(),
    status: { type: 'string', enum: ['PAID', 'CLOSED', 'OPEN'] },
    overdue: boolean,
    payment: {
      ...object({
        ...payment,
        account: object({
          id: uuid,
          name: text(),
          isArchived: boolean,
          deletedAt: account.deletedAt,
        }),
      }),
      nullable: true,
    },
  }),
  CardInstallment: object(installment),
  PurchaseDetail: object({
    ...purchase,
    canEdit: boolean,
    installments: {
      type: 'array',
      items: object({
        ...installment,
        invoice: object({
          id: uuid,
          cardId: uuid,
          year: integer(),
          month: integer(),
          closingDate: timestamp,
          dueDate: timestamp,
          createdAt: timestamp,
          payments: { type: 'array', items: object({ id: uuid }) },
        }),
      }),
    },
  }),
  InvoiceDetail: object({
    card: ref('Card'),
    invoice: ref('InvoiceSummary'),
    items: {
      type: 'array',
      items: object({
        ...installment,
        canEdit: boolean,
        purchase: object({ ...purchase, category: ref('Category') }),
      }),
    },
    hasMore: boolean,
  }),
  MonthlySummary: object(monthly),
  Dashboard: object({
    ...monthly,
    currentBalance: persistedMoney,
    history: array('MonthlySummary'),
    previous: object({
      month: integer(),
      year: integer(),
      totalIncome: persistedMoney,
      totalExpense: persistedMoney,
      balance: persistedMoney,
    }),
    plannedIncome: persistedMoney,
    plannedExpense: persistedMoney,
    plannedCardExpense: persistedMoney,
    projectedBalance: persistedMoney,
  }),
};
