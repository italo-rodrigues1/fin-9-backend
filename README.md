# Fin-9 API

Backend NestJS 11, Prisma 7 e PostgreSQL. Requer Node.js 22.12 ou superior e npm.

## Executar

```sh
npm ci
# Copie .env.example para .env e configure as variáveis.
npm run prisma:migrate:deploy
npm run start:dev
```

`JWT_SECRET` deve ter pelo menos 32 caracteres. A API usa `DATABASE_URL`; as migrations usam `DIRECT_URL` quando configurada. O usuário de execução do banco precisa obedecer RLS: veja [segurança do banco](docs/database-security.md) antes de configurar o ambiente.

`ALLOWED_ORIGINS` define as origens web permitidas, separadas por vírgula, por exemplo `http://localhost:8081,https://app.example.com`. Na ausência da variável são permitidas apenas as origens locais nas portas 3000, 8081 e 19006. Requisições nativas sem cabeçalho Origin continuam funcionando. A autenticação usa Bearer JWT e não depende de cookies.

## Documentação da API

Com a API executando na porta padrão 3333:

| Interface    | Endereço                           |
| ------------ | ---------------------------------- |
| Scalar       | http://localhost:3333/reference    |
| OpenAPI JSON | http://localhost:3333/openapi.json |

O Scalar apresenta o contrato OpenAPI e permite informar o Bearer token. Consulte [contratos, autenticação e exemplos](docs/api.md). Os assets são servidos localmente; Scalar não usa proxy, fontes externas ou telemetria. Os endpoints de documentação são públicos, e as operações de negócio exigem JWT. O pacote `@nestjs/swagger` gera o contrato OpenAPI, sem publicar Swagger UI.

## Validação

```sh
npm test -- --runInBand
npm run build
npm run test:rls
npm run test:security
```

`test:rls` executa políticas SQL em PostgreSQL embarcado, sem servidor externo. `test:security` usa exclusivamente um PostgreSQL local: cria um banco temporário, aplica todas as migrations, executa os testes HTTP e financeiros e remove esse banco ao terminar. O login local precisa de permissão `CREATEDB`.

As instruções de produção estão em [deploy no Render](docs/render-deploy.md).
