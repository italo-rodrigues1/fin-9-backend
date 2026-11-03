import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getMetadataStorage } from 'class-validator';
import helmet from 'helmet';
import request from 'supertest';
import { CardsService } from '../../application/cards.service';
import { GoalsService } from '../../application/goals.service';
import { PlanningService } from '../../application/planning.service';
import {
  ACCOUNT_REPOSITORY,
  CATEGORY_REPOSITORY,
  TRANSACTION_REPOSITORY,
  USER_REPOSITORY,
} from '../../domain/repositories';
import { JwtAuthGuard } from '../../infrastructure/auth';
import { GoogleIdentityService } from '../../infrastructure/auth/google-identity.service';
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
import * as authDtos from '../dtos/auth.dto';
import * as accountDtos from '../dtos/account.dto';
import * as categoryDtos from '../dtos/category.dto';
import * as cardDtos from '../dtos/card.dto';
import * as goalDtos from '../dtos/goal.dto';
import * as planningDtos from '../dtos/planning.dto';
import * as transactionDtos from '../dtos/transaction.dto';
import { createApiDocument } from './api-document';
import { SwaggerModule } from '@nestjs/swagger';
import type {
  OpenAPIObject,
  ResponseObject,
  RequestBodyObject,
} from '@nestjs/swagger';
import { requestSchemas } from './api-schemas';

describe('API documentation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [
        AccountController,
        AuthController,
        CategoryController,
        DashboardController,
        HealthController,
        TransactionController,
        CardsController,
        GoalsController,
        PlanningController,
      ],
      providers: [
        ACCOUNT_REPOSITORY,
        CATEGORY_REPOSITORY,
        TRANSACTION_REPOSITORY,
        USER_REPOSITORY,
        JwtService,
        GoogleIdentityService,
        CardsService,
        GoalsService,
        PlanningService,
      ].map((provide) => ({ provide, useValue: {} })),
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = fixture.createNestApplication();
    app.use(helmet());
    SwaggerModule.setup('docs', app, createApiDocument(app), {
      jsonDocumentUrl: '/openapi.json',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents every route with request and response schemas and the correct authentication', () => {
    const document = createApiDocument(app);
    expect(document.security).toEqual([{ bearer: [] }]);
    expect(document.components?.securitySchemes?.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    const publicRoutes = [
      'get /health',
      'post /auth/register',
      'post /auth/login',
      'post /auth/google',
    ];
    let operations = 0;
    for (const [path, item] of Object.entries(document.paths)) {
      for (const method of ['get', 'post', 'patch', 'delete'] as const) {
        const operation = item[method];
        if (!operation) continue;
        operations++;
        const endpoint = `${method} ${path}`;
        expect(operation.summary).toBeTruthy();
        const success = operation.responses[
          method === 'post' && !['/auth/login', '/auth/google'].includes(path)
            ? '201'
            : '200'
        ] as ResponseObject;
        expect(success.content?.['application/json'].schema).toBeDefined();
        expect(operation.security || document.security).toEqual(
          publicRoutes.includes(endpoint) ? [] : [{ bearer: [] }],
        );
        if (method === 'post' || method === 'patch')
          expect(operation.requestBody).toBeDefined();
        for (const parameter of operation.parameters || []) {
          if ('in' in parameter && parameter.in === 'path')
            expect(parameter.schema).toEqual({
              type: 'string',
              format: 'uuid',
            });
        }
      }
    }
    expect(operations).toBe(54);
    expect(document.paths['/auth/login'].post?.responses['200']).toBeDefined();
    expect(
      document.paths['/budgets'].get?.parameters?.map((parameter) =>
        'name' in parameter ? parameter.name : '',
      ),
    ).toEqual(['month', 'year']);
    expect(JSON.stringify(document.components?.schemas)).not.toMatch(
      /passwordHash|googleSubject|userId/,
    );
  });

  it.each(Object.entries(requestSchemas))(
    '%s includes exactly the validated DTO properties',
    (name, schema) => {
      const dtos = {
        ...authDtos,
        ...accountDtos,
        ...categoryDtos,
        ...cardDtos,
        ...goalDtos,
        ...planningDtos,
        ...transactionDtos,
      };
      const dto = dtos[name as keyof typeof dtos];
      expect(dto).toBeDefined();
      const validated = getMetadataStorage().getTargetValidationMetadatas(
        dto,
        '',
        true,
        false,
      );
      expect(Object.keys(schema.properties || {}).sort()).toEqual(
        [...new Set(validated.map((field) => field.propertyName))].sort(),
      );
      expect(schema.additionalProperties).toBe(false);
    },
  );

  it('serves OpenAPI JSON with the full contract', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/openapi.json')
      .expect(200);
    const document = response.body as OpenAPIObject;
    expect(document.info.title).toBe('Fin-9 API');
    const body = document.paths['/transactions'].post
      ?.requestBody as RequestBodyObject;
    expect(body.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateTransactionDto',
    });
    expect(document.components?.schemas?.CreateTransactionDto).toMatchObject({
      additionalProperties: false,
    });
  });
});
