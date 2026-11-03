# Isolamento de dados no PostgreSQL

A migration `20261103010000_row_level_security` habilita `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY` nas 14 tabelas do domínio. As políticas são aplicadas exclusivamente à role `fin9_runtime`, que não pode fazer login, criar roles/bancos nem ignorar RLS.

Cada transação da API executa `SET LOCAL ROLE fin9_runtime` e define `app.user_id` a partir do JWT validado. As configurações são locais à transação, inclusive em consultas isoladas, para que conexões do pool não reaproveitem a identidade de outra requisição. Sem identidade, nenhuma linha financeira fica visível e nenhuma gravação é autorizada. As transações financeiras existentes continuam atômicas e preservam seu nível de isolamento.

As políticas `USING` restringem leitura, alteração e exclusão ao proprietário. As políticas `WITH CHECK` também verificam os proprietários das contas, categorias, recorrências, metas, cartões, compras, faturas e pagamentos relacionados. Uma chave estrangeira válida de outro usuário não autoriza a operação. Parcelas não têm `user_id`; seu acesso exige que a compra e a fatura pertençam ao usuário atual.

Os limites de propriedade são políticas `AS RESTRICTIVE`: outra política permissiva que venha a ser criada para a role de execução não consegue ampliar esse acesso. A migration inteira é transacional, incluindo a criação das políticas.

## Autenticação

O repositório pode definir internamente `app.auth_email` e `app.auth_subject` para consultar somente o usuário cujo e-mail ou identificador Google está sendo autenticado. O subject vem da verificação do token Google, e os contextos não são obtidos de campos genéricos enviados pelo cliente. Essas configurações permitem apenas leitura do usuário correspondente; não permitem alterar usuários nem acessar dados financeiros. Cadastro e vinculação Google definem o identificador do usuário dentro da mesma transação antes das gravações.

Não há política global de bypass nem função `SECURITY DEFINER`. A API continua responsável pela verificação das credenciais e por não expor hashes/identificadores internos em respostas.

## Aplicação e credenciais

1. Use `DIRECT_URL` com a credencial de migrations e execute `npm run prisma:migrate:deploy`. Essa credencial precisa criar/validar a role `fin9_runtime`, conceder sua associação e modificar as tabelas. A migration concede a associação à credencial que a executou.
2. Para um login de execução dedicado, execute [`prisma/security/bootstrap-runtime-role.sql`](../prisma/security/bootstrap-runtime-role.sql) como administrador depois da migration. Configure uma senha forte de forma interativa (`\password fin9_app` no psql) e use esse login em `DATABASE_URL`. Não coloque a senha no arquivo SQL nem no Git.
3. Se já houver um login próprio da aplicação, conceda `GRANT fin9_runtime TO seu_login;` usando a credencial administrativa. O login não deve ter atributos `SUPERUSER`, `BYPASSRLS`, `CREATEROLE`, associação a roles administrativas nem propriedade das tabelas. Mantenha a credencial administrativa apenas em `DIRECT_URL` e em ferramentas de manutenção.
4. Reinicie a API após a migration. O serviço verifica a role de execução no início e usa `SET LOCAL ROLE` para cada operação, mesmo se a conexão ainda utilizar a credencial de migrations.

No Supabase, use uma conexão direta ou o pooler de sessão para migrations. As políticas não concedem acesso às roles `anon`/`authenticated` do PostgREST; autenticação e autorização deste projeto continuam no NestJS. Nunca distribua a credencial PostgreSQL aos clientes mobile/web.

`FORCE` inclui proprietários comuns das tabelas, mas superusuários e roles `BYPASSRLS` ignoram RLS no PostgreSQL. O `SET LOCAL ROLE` da aplicação reduz os privilégios da operação; separar as credenciais evita que uma credencial de execução tenha privilégios administrativos disponíveis. RLS oferece defesa adicional contra consultas sem filtros e referências cruzadas; não substitui DTOs, guards e validações de negócio.

## Validação

Execute `node --test test/rls.integration.cjs`. O teste usa PostgreSQL via PGlite em memória, aplica todas as migrations e não lê `.env` nem acessa um banco remoto. Verifica todas as tabelas, duas identidades, ausência de contexto, gravações válidas, tentativa de trocar o proprietário, 18 referências cruzadas, parcelas, escopo de autenticação, limpeza de contexto, `FORCE` e roles não autorizadas.

As consultas SQL diretas de manutenção e os testes de integração que utilizam `PrismaService` também precisam executar no contexto explícito do usuário. Não remova as políticas para adaptar uma consulta que deixou de retornar dados.
