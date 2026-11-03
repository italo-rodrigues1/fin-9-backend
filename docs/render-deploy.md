# Deploy do backend no Render

Execute os comandos na pasta que contém o `package.json` do backend. Use Node.js 22.12 ou superior na linha 22, compatível com Prisma 7.

Configure o serviço com:

```text
Build Command: npm ci --include=dev && npm run build
Start Command: npm run start:prod
```

O `prebuild` executa `prisma generate` antes de `nest build`. As dependências de desenvolvimento são necessárias durante o build, pois incluem Prisma CLI, Nest CLI e TypeScript. O `&&` impede que o build continue se a instalação falhar.

Mantenha `DATABASE_URL` configurada no ambiente do Render: `prisma.config.ts` lê essa variável também durante a geração. As demais variáveis de execução da aplicação continuam necessárias.

O schema usa `provider = "prisma-client"` e gera o cliente em `src/generated/client`, excluído do Git. Importe `PrismaClient`, `Prisma` e tipos de modelos desse diretório; enums ficam em `src/generated/client/enums`. O pacote `@prisma/client` permanece instalado como dependência do runtime gerado.

Em um clone novo, execute `npm run prisma:generate` antes de iniciar `start:dev` ou os scripts alternativos de teste, como `test:watch`, `test:cov` e `test:e2e`. Os comandos `npm run build` e `npm test` já geram o cliente automaticamente.

O cliente é gerado com `moduleFormat = "cjs"`, compatível com a saída CommonJS do backend. Imports internos sem extensão também permitem executar os testes com Jest. O serviço PostgreSQL sempre fornece `@prisma/adapter-pg`, exigido pelo cliente Prisma 7.

O comando `start:prod` abre `dist/src/main.js`. Esse é o caminho produzido pela configuração atual, que também compila `prisma.config.ts` na raiz do projeto.

Para validar a compilação e os testes unitários localmente:

```bash
npm run build
npm test -- --runInBand
```

A geração do cliente não aplica migrations. Quando uma feature alterar o banco, aplique as migrations de produção com `npx prisma migrate deploy` na etapa de deploy apropriada.
