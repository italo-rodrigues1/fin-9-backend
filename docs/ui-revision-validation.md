# Revisão após P3 — teclado, aparência e regras de negócio

Concluída em 31/10/2026. Referência funcional: [regras-de-negocio.md](regras-de-negocio.md).

## Entregas

- [x] Formulários de login/cadastro, perfil, contas, transações, filtros, categorias, orçamentos, transferências, recorrências, metas, contribuições, cartões, compras e pagamentos com superfície rolável e ajuste ao teclado.
- [x] Campos comunicam o foco ao contêiner rolável e são reposicionados após abrir o teclado; menu inferior oculto durante digitação no aplicativo nativo.
- [x] Formulário de categoria movido para dentro do cabeçalho da lista rolável, em vez de ocupar uma área fixa acima dela.
- [x] Tema Claro/Escuro/Seguir o sistema no Perfil, salvo no aparelho com ordenação das gravações.
- [x] Paleta semântica para telas, campos, bordas, cabeçalhos, navegação, modais e skeletons; contraste dos textos essenciais validado.
- [x] Configuração Android automática e resize do teclado, com expo-system-ui compatível com o SDK 58.
- [x] Arquivar/Reativar conta substituído na interface por Excluir conta do app, conforme a escolha aprovada de preservar histórico.
- [x] Saldo atual exclui a conta removida; histórico permanece nos relatórios, e lançamentos/transferências/pagamentos vinculados ficam somente para consulta.
- [x] Recorrências interrompidas e previsões/lembretes retirados; metas mantêm destinações históricas sem contar cobertura da conta excluída.
- [x] Exclusão repetida não subtrai novamente o saldo; valores negativos são removidos com seu sinal, sem criar receitas/despesas fictícias.
- [x] Exclusão de perfil e dados continua como operação separada e permanente.
- [x] Hoje e vencimentos do backend seguem o calendário de São Paulo; percentuais truncados não antecipam 100%, e alertas usam limiares monetários exatos.
- [x] Regras de negócio consolidadas em docs, com cópias versionadas nos dois serviços e referências nos registros antigos.

## Migração e execução

Migration aditiva 20261101010000_account_removal aplicada no PostgreSQL local. Acrescenta deleted_at, sem excluir ou alterar saldos das contas existentes. Em outro ambiente: npx prisma migrate deploy e npx prisma generate no backend antes de iniciar a nova versão.

No Android com development build, gerar nova build (npx expo run:android ou o fluxo EAS utilizado) para aplicar expo-system-ui e softwareKeyboardLayoutMode. Atualizar apenas o JavaScript não aplica a configuração nativa. Não foi gerado APK nesta revisão.

## Validação

- [x] Backend: build, lint dos fontes alterados e 93 testes Jest, incluindo viradas do dia no Brasil e percentuais próximos de 80%/100%.
- [x] PostgreSQL local: 45 cenários financeiros P1/P2/P3 e exclusão de contas (49 testes contando os agrupamentos).
- [x] Cenários de exclusão incluem saldo assinado, histórico, previsões/recorrências, metas, pagamentos, bloqueio de alterações em históricos, concorrência com transferência, isolamento entre usuários e exclusão completa do perfil.
- [x] Mobile: TypeScript e 27 testes, incluindo persistência/ordem de preferências, tema do sistema, contraste e paletas compatíveis.
- [x] Navegador com API real local e dados fictícios: login, tema escuro no Perfil, persistência após recarregar, Dashboard, menu de registro, contas, confirmação/cancelamento de exclusão e histórico em consulta.
- [x] Formulário de categoria em 390 × 420: campo, seleção de cor e botão alcançáveis com rolagem; revisão de contraste. Verificação adicional em 390 × 844.
- [x] Teste HTTP da conta fictícia: saldo total de R$ 3.975 passou a R$ 3.000 ao remover conta de R$ 975; despesa histórica de R$ 25 mantida. Duas chamadas DELETE retornaram sucesso, sem nova redução.
- [x] Bundles Android e web gerados com a configuração normal.
- [x] Prévia encerrada e usuário fictício com seus registros removido; testes financeiros limpam seus próprios usuários.
- [ ] Homologação do teclado virtual e aparência em aparelho Android/iOS ou emulador. A altura reduzida do navegador não substitui esse teste nativo.

Comandos: npm test -- --runInBand e npm run test:finance no backend; npm run typecheck e npm test no mobile. As suítes PostgreSQL compartilham o banco local e rodam sequencialmente entre arquivos; os cenários de concorrência permanecem dentro de cada suíte.

As alterações simultâneas de redesenho da tela de boas-vindas e dos cartões foram preservadas fora destes commits. A revisão inclui apenas a adaptação dos componentes anteriores ao tema, mantendo o trabalho em andamento no diretório compartilhado.
