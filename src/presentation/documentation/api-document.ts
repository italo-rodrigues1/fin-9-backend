import type { INestApplication, Type } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import {
  AccountController,
  AuthController,
  CategoryController,
  DashboardController,
  HealthController,
  TransactionController,
} from '../controllers';
import { CardsController } from '../controllers/cards.controller';
import { GoalsController } from '../controllers/goals.controller';
import { PlanningController } from '../controllers/planning.controller';
import { array, ref, requestSchemas, responseSchemas } from './api-schemas';

interface RouteDocumentation {
  summary: string;
  response: string;
  array?: boolean;
  body?: string;
  query?: string;
  public?: boolean;
}

const routes: [Type<unknown>, string, Record<string, RouteDocumentation>][] = [
  [
    HealthController,
    'Saúde',
    {
      check: {
        summary: 'Verificar disponibilidade',
        response: 'Health',
        public: true,
      },
    },
  ],
  [
    AuthController,
    'Autenticação',
    {
      register: {
        summary: 'Criar usuário e sessão',
        body: 'RegisterDto',
        response: 'AuthSession',
        public: true,
      },
      login: {
        summary: 'Entrar com email e senha',
        body: 'LoginDto',
        response: 'AuthSession',
        public: true,
      },
      google: {
        summary: 'Entrar com ID token Google',
        body: 'GoogleLoginDto',
        response: 'AuthSession',
        public: true,
      },
      me: { summary: 'Consultar meu perfil', response: 'Profile' },
      updateProfile: {
        summary: 'Atualizar meu nome',
        body: 'UpdateProfileDto',
        response: 'User',
      },
      deleteAccount: {
        summary: 'Excluir meu usuário e seus dados',
        response: 'Message',
      },
    },
  ],
  [
    AccountController,
    'Contas',
    {
      findAll: {
        summary: 'Listar minhas contas',
        response: 'Account',
        array: true,
      },
      create: {
        summary: 'Criar conta',
        body: 'CreateAccountDto',
        response: 'Account',
      },
      update: {
        summary: 'Atualizar ou arquivar conta',
        body: 'UpdateAccountDto',
        response: 'Account',
      },
      remove: {
        summary: 'Remover conta preservando o histórico',
        response: 'Message',
      },
    },
  ],
  [
    CategoryController,
    'Categorias',
    {
      findAll: {
        summary: 'Listar minhas categorias',
        response: 'Category',
        array: true,
      },
      create: {
        summary: 'Criar categoria personalizada',
        body: 'CreateCategoryDto',
        response: 'Category',
      },
      update: {
        summary: 'Atualizar categoria',
        body: 'UpdateCategoryDto',
        response: 'Category',
      },
      remove: { summary: 'Excluir categoria', response: 'Message' },
    },
  ],
  [
    TransactionController,
    'Transações',
    {
      findAll: {
        summary: 'Listar e filtrar transações',
        query: 'FilterTransactionDto',
        response: 'Transaction',
        array: true,
      },
      findOne: { summary: 'Consultar transação', response: 'Transaction' },
      create: {
        summary: 'Registrar receita ou despesa',
        body: 'CreateTransactionDto',
        response: 'Transaction',
      },
      update: {
        summary: 'Atualizar ou confirmar transação',
        body: 'UpdateTransactionDto',
        response: 'Transaction',
      },
      remove: {
        summary: 'Excluir transação e recompor saldo',
        response: 'Message',
      },
    },
  ],
  [
    DashboardController,
    'Relatórios',
    {
      getMonthlySummary: {
        summary: 'Consultar resumo mensal e histórico de seis meses',
        query: 'PeriodDto',
        response: 'Dashboard',
      },
    },
  ],
  [
    PlanningController,
    'Planejamento',
    {
      statement: {
        summary: 'Consultar extrato paginado da conta',
        query: 'PageDto',
        response: 'Statement',
      },
      getTransfer: {
        summary: 'Consultar transferência',
        response: 'TransferDetail',
      },
      transfers: {
        summary: 'Listar transferências',
        response: 'TransferDetail',
        array: true,
      },
      createTransfer: {
        summary: 'Transferir entre minhas contas',
        body: 'TransferDto',
        response: 'Transfer',
      },
      editTransfer: {
        summary: 'Atualizar transferência',
        body: 'TransferDto',
        response: 'Transfer',
      },
      deleteTransfer: {
        summary: 'Excluir transferência e recompor saldos',
        response: 'Success',
      },
      budgets: {
        summary: 'Consultar orçamentos e consumo mensal',
        query: 'BudgetPeriodDto',
        response: 'BudgetProgress',
        array: true,
      },
      saveBudget: {
        summary: 'Criar ou atualizar orçamento por categoria e mês',
        body: 'BudgetDto',
        response: 'SavedBudget',
      },
      deleteBudget: { summary: 'Excluir orçamento', response: 'Count' },
      recurrences: {
        summary: 'Listar recorrências e materializar previsões',
        response: 'RecurrenceDetail',
        array: true,
      },
      createRecurrence: {
        summary: 'Criar série recorrente',
        body: 'RecurrenceDto',
        response: 'Recurrence',
      },
      editRecurrence: {
        summary: 'Atualizar próximas ocorrências a partir de uma data',
        body: 'EditRecurrenceDto',
        response: 'Success',
      },
      upcoming: {
        summary: 'Listar até 100 lançamentos previstos',
        response: 'Transaction',
        array: true,
      },
    },
  ],
  [
    GoalsController,
    'Metas',
    {
      overview: {
        summary: 'Consultar metas e saldo disponível',
        response: 'GoalOverview',
      },
      create: { summary: 'Criar meta', body: 'SaveGoalDto', response: 'Goal' },
      detail: {
        summary: 'Consultar meta e contribuições paginadas',
        query: 'GoalPageDto',
        response: 'GoalDetail',
      },
      update: {
        summary: 'Atualizar meta',
        body: 'SaveGoalDto',
        response: 'Goal',
      },
      remove: { summary: 'Excluir meta', response: 'Success' },
      contribute: {
        summary: 'Destinar saldo de conta à meta',
        body: 'SaveGoalContributionDto',
        response: 'GoalContribution',
      },
      contribution: {
        summary: 'Consultar contribuição',
        response: 'GoalContribution',
      },
      editContribution: {
        summary: 'Atualizar contribuição',
        body: 'SaveGoalContributionDto',
        response: 'GoalContribution',
      },
      removeContribution: {
        summary: 'Excluir contribuição',
        response: 'Success',
      },
    },
  ],
  [
    CardsController,
    'Cartões',
    {
      list: {
        summary: 'Listar cartões e limites disponíveis',
        response: 'CardSummary',
        array: true,
      },
      create: {
        summary: 'Criar cartão',
        body: 'SaveCardDto',
        response: 'Card',
      },
      detail: { summary: 'Consultar cartão e faturas', response: 'CardDetail' },
      edit: {
        summary: 'Atualizar ou arquivar cartão',
        body: 'SaveCardDto',
        response: 'Card',
      },
      purchase: {
        summary: 'Registrar compra e parcelas',
        body: 'SaveCardPurchaseDto',
        response: 'CardPurchase',
      },
      getPurchase: {
        summary: 'Consultar compra e parcelas',
        response: 'PurchaseDetail',
      },
      editPurchase: {
        summary: 'Atualizar compra e parcelas não pagas',
        body: 'SaveCardPurchaseDto',
        response: 'CardPurchase',
      },
      removePurchase: {
        summary: 'Excluir compra não paga',
        response: 'Success',
      },
      invoice: {
        summary: 'Consultar fatura e itens paginados',
        query: 'PageDto',
        response: 'InvoiceDetail',
      },
      pay: {
        summary: 'Registrar pagamento integral da fatura',
        body: 'PayCardInvoiceDto',
        response: 'CardPayment',
      },
      reverse: {
        summary: 'Estornar registro de pagamento e recompor saldo',
        response: 'Success',
      },
    },
  ],
];

let metadataApplied = false;

function applyDocumentationMetadata() {
  if (metadataApplied) return;
  for (const [controller, tag, methods] of routes) {
    ApiTags(tag)(controller);
    const prototype = controller.prototype as object;
    for (const [name, route] of Object.entries(methods)) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (!descriptor || typeof descriptor.value !== 'function') {
        throw new Error(
          `API documentation references missing method ${controller.name}.${name}`,
        );
      }
      const handler = descriptor.value as (...args: unknown[]) => unknown;
      const decorate = (decorator: MethodDecorator) =>
        decorator(prototype, name, descriptor);
      decorate(
        ApiOperation({
          summary: route.summary,
          ...(route.public ? { security: [] } : {}),
        }),
      );
      if (route.body) decorate(ApiBody({ schema: ref(route.body) }));
      if (route.query) {
        const schema = requestSchemas[route.query];
        for (const [parameter, parameterSchema] of Object.entries(
          schema.properties || {},
        )) {
          decorate(
            ApiQuery({
              name: parameter,
              required: schema.required?.includes(parameter) || false,
              schema: parameterSchema as SchemaObject,
            }),
          );
        }
      }
      const method = Reflect.getMetadata(
        METHOD_METADATA,
        handler,
      ) as RequestMethod;
      const explicitStatus = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        handler,
      ) as number | undefined;
      decorate(
        ApiResponse({
          status: explicitStatus ?? (method === RequestMethod.POST ? 201 : 200),
          description: 'Operação concluída.',
          schema: route.array ? array(route.response) : ref(route.response),
        }),
      );
      if (!route.public)
        decorate(
          ApiResponse({
            status: 401,
            description: 'JWT ausente, inválido ou expirado.',
            schema: ref('ApiError'),
          }),
        );
      if (route.body || route.query)
        decorate(
          ApiResponse({
            status: 400,
            description:
              'Campo inválido, desconhecido ou controlado pelo servidor.',
            schema: ref('ApiError'),
          }),
        );
      if (name !== 'check')
        decorate(
          ApiResponse({
            status: 429,
            description: 'Limite de requisições excedido.',
            schema: ref('ApiError'),
          }),
        );
    }
  }
  metadataApplied = true;
}

export function createApiDocument(app: INestApplication): OpenAPIObject {
  applyDocumentationMetadata();
  const config = new DocumentBuilder()
    .setTitle('Fin-9 API')
    .setDescription(
      'API de finanças pessoais. Envie Authorization: Bearer <token> nas operações privadas. A identidade vem exclusivamente do JWT; userId e campos internos não são aceitos. Datas de entrada usam YYYY-MM-DD; datas de saída usam ISO 8601. Valores monetários têm no máximo duas casas decimais.',
    )
    .setVersion('1.0.0')
    .addServer('/')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addSecurityRequirements('bearer')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      ...requestSchemas,
      ...responseSchemas,
    },
  };
  for (const path of Object.values(document.paths)) {
    for (const method of [
      'get',
      'post',
      'patch',
      'delete',
      'put',
      'head',
      'options',
    ] as const) {
      const operation = path[method];
      if (!operation) continue;
      for (const parameter of operation.parameters || []) {
        if ('in' in parameter && parameter.in === 'path')
          parameter.schema = { type: 'string', format: 'uuid' };
      }
    }
  }
  return document;
}
