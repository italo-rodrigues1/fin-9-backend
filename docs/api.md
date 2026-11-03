# Contratos e documentação da API

O Scalar (`/reference`) apresenta o contrato OpenAPI (`/openapi.json`), gerado a partir das rotas da API. A configuração fica em `src/presentation/documentation`: `api-document.ts` associa as operações aos contratos; `api-schemas.ts` descreve entradas e saídas; `api-documentation.ts` publica o Scalar e seus assets locais. Os testes verificam os campos dos contratos contra os DTOs validados para identificar divergências.

## Autenticação e identidade

Somente `GET /health`, `POST /auth/register`, `POST /auth/login` e `POST /auth/google` são rotas públicas de aplicação. A documentação também é pública. Todas as operações de negócio exigem:

```http
Authorization: Bearer <token>
```

O cadastro e os logins retornam `{ user: { id, name, email }, token }`. Login por senha e Google retornam HTTP 200; cadastro retorna HTTP 201. No Scalar, escolha a autenticação Bearer para informar o token. Os tokens não persistem no armazenamento do navegador pela configuração da interface.

O usuário é determinado pelo JWT validado. Não envie `userId`, `passwordHash`, `googleSubject`, datas de criação ou outros campos internos no body ou nos filtros. Campos desconhecidos retornam HTTP 400. As respostas omitem identificadores de proprietário e credenciais; IDs de contas, categorias e outros recursos continuam disponíveis para os vínculos de negócio.

## Formato dos valores

- Entradas de data usam `YYYY-MM-DD`; saídas de `Date` usam ISO 8601.
- Valores monetários usam até duas casas decimais e os limites documentados em cada schema. Envie números JSON; strings decimais simples também são normalizadas pelos DTOs. Booleanos, arrays e valores não finitos são rejeitados.
- Identificadores de recursos são UUIDs; possuir um UUID não concede acesso ao recurso de outra pessoa.
- `skip` e `take` controlam a paginação nas rotas indicadas no OpenAPI, com limite de até 100 itens por página. Transações usam `skip=0` e `take=30` por padrão.
- Campos opcionais devem ser omitidos. `null` só é aceito onde o contrato declara explicitamente, como `brand`, `deadline` e `endDate`.
- Alguns retornos legados serializam valores Prisma Decimal como strings: o OpenAPI distingue esses campos dos valores convertidos para números, incluindo os saldos das contas relacionadas às transferências e o orçamento salvo.

## Exemplos

Criação de uma conta autenticada:

```http
POST /accounts
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Conta principal",
  "institution": "Meu banco",
  "balance": 1500.50,
  "color": "#7C3AED",
  "icon": "bank-outline"
}
```

Criação de uma despesa usando IDs que pertençam ao usuário autenticado:

```http
POST /transactions
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Mercado",
  "amount": 125.50,
  "type": "EXPENSE",
  "date": "2026-11-02",
  "categoryId": "f483c559-582c-4437-aaf7-a65fe6e316ce",
  "accountId": "78be12d4-84a1-4d66-9c46-b911725cedbb"
}
```

O saldo é ajustado pelas regras financeiras. A edição da conta aceita apenas metadados e arquivamento; não aceita reescrever o saldo pelo body. Para histórico progressivo, use `GET /transactions?skip=0&take=30&orderBy=date&orderDir=desc` ou `GET /accounts/{id}/statement?skip=0&take=30`. `month` no filtro de transações exige `year`; `GET /budgets` exige `month` e `year` e não recebe filtro de conta.

## Falhas

A aplicação retorna erros com `statusCode`, `message`, `error`, `path` e `timestamp`. Os principais códigos são 400 para entrada inválida, 401 para JWT ausente/inválido/expirado, 404 para recurso inacessível ou inexistente, 409 para conflitos e 429 para limite de requisições. Os logins têm limite de cinco tentativas por minuto por rota; o limite geral é definido em `src/rate-limit.config.ts`.

## Fontes das integrações

O pacote `@nestjs/swagger` usa a [integração OpenAPI oficial do NestJS](https://docs.nestjs.com/openapi/introduction) para gerar o contrato, sem publicar Swagger UI. Scalar usa o [middleware oficial para NestJS](https://scalar.com/products/api-references/integrations/nestjs). A dependência `@nestjs/swagger` permanece na versão 11, compatível com o NestJS do projeto.

As correções de dependências transitivas e a comparação com a árvore anterior estão registradas em [validação de segurança](security-validation.md).
