# Autenticação Google

O aplicativo obtém um ID token do Google e envia `POST /auth/google` com JSON `{ "idToken": "..." }`. O backend valida assinatura, emissor, audiência e validade com `google-auth-library`, exige e-mail verificado e emite a mesma sessão JWT usada pelo login com senha. A resposta contém apenas `user: { id, name, email }` e `token`.

## Configuração

1. Crie no Google Cloud um cliente OAuth do tipo **Aplicativo da Web** e configure a tela de consentimento. Use esse Client ID em `GOOGLE_WEB_CLIENT_ID` no backend e em `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` no aplicativo. São identificadores públicos; este fluxo não usa Client Secret.
2. Cadastre as origens web autorizadas utilizadas pelo Expo/web (incluindo a origem local com a porta correta e o domínio HTTPS de produção). Para Android/iOS, siga também a configuração de pacote, certificados e cliente iOS descrita no aplicativo.
3. Aplique a migration com `npx prisma migrate deploy` e gere o client com `npx prisma generate` antes de iniciar o backend atualizado. A migration adiciona `users.google_subject` único e permite senha nula; nenhuma senha existente é removida.
4. Use HTTPS em produção. A API precisa alcançar os certificados públicos do Google para validar tokens. Não registre ID tokens em logs.

Sem `GOOGLE_WEB_CLIENT_ID`, somente o endpoint Google retorna 503 com mensagem de configuração; o login por senha continua disponível. Cada rota de autenticação permite cinco tentativas por minuto por IP.

## Contas e vínculos

- `sub` do Google é a identidade estável. Retornos posteriores usam o vínculo salvo, mesmo se o e-mail da conta Google mudar. Nome, e-mail e senha do cadastro local não são sobrescritos.
- Usuários novos recebem conta sem senha e categorias padrão, criadas na mesma transação.
- Uma conta local existente só é vinculada automaticamente pelo e-mail se Google for autoritativo: Gmail, ou Workspace com `hd` e e-mail verificado. E-mails são comparados sem distinguir maiúsculas/minúsculas.
- E-mail de outro provedor sem `hd`, conta já vinculada a outro `sub` ou múltiplos cadastros legados com a mesma grafia de e-mail em caixa diferente retornam 409. Não há substituição silenciosa de vínculos. Nesses casos, o usuário deve usar seu método de acesso existente; um fluxo autenticado de vínculo manual não faz parte desta entrega.
- Unicidade de `google_subject`, transações serializáveis e tentativas limitadas evitam duplicação quando dois acessos Google ocorrem juntos.
- Contas Google sem senha são rejeitadas pelo endpoint de senha com o mesmo erro de credenciais inválidas, sem tentar comparar um hash nulo.

## Referência

[Validação de ID tokens no servidor — Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

Testes automatizados usam tokens sintéticos e mocks do verificador. A homologação real exige os Client IDs do projeto, configuração no Google Cloud e uma conta de teste.

## Validação local

- `npm run build`: aprovado.
- `npm test -- --runInBand`: 149 testes aprovados em 18 suítes.
- `npm run test:google`: seis cenários de persistência aprovados no PostgreSQL local, incluindo preservação de senha/dados e criação/vínculo simultâneos. O script bloqueia bancos remotos e remove somente os usuários fictícios criados na execução.
- ESLint dos arquivos de autenticação afetados: aprovado.
- Migration aplicada apenas no PostgreSQL local `fin9_db`. O banco de publicação ainda precisa receber a migration.

O passo a passo para consentimento, clientes OAuth, certificados Android, retorno iOS e nova build fica no [guia do aplicativo](../../fin-9-mobile/docs/google-auth.md).
