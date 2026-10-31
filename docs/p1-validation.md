# P1 — Relatórios, controle e planejamento

Implementado em 31/10/2026. O checklist geral permanece em project.md na pasta que reúne os serviços.

## Entregas

- [x] Dashboard integrado a /dashboard/summary, com saldo atual, receitas, despesas, resultado, previsão e comparação com o mês anterior.
- [x] Gráficos de seis meses e despesas por categoria, com valores, legendas, texto acessível e ocultação de dados financeiros.
- [x] Detalhes de conta, edição de nome/instituição/cor/ícone, arquivamento, reativação e extrato progressivo.
- [x] Contas arquivadas continuam nos totais e no histórico, mas não recebem novos lançamentos manuais ou transferências.
- [x] Busca por título; conta, categoria, tipo, status e intervalo combinados; ordenação por data/valor e páginas de 30 transações.
- [x] Transferências em uma operação vinculada às duas contas, com criação/edição/exclusão atômicas, isolamento serializável e limite de tentativas. Não entram como receitas/despesas.
- [x] Previstos separados de confirmados; somente confirmados alteram saldo e relatórios. Confirmar no Planejamento registra a data efetiva de hoje.
- [x] Recorrências semanais, mensais e anuais com fim opcional, alteração de uma ocorrência ou próximas e encerramento. Confirmadas são preservadas.
- [x] Previsão móvel de 12 meses, criada ao consultar relatórios/planejamento, sem duplicar ocorrências; meses curtos preservam a âncora original.
- [x] Lembretes de vencimento no aplicativo: vencido, hoje e próximos três dias. Sem push ou notificações do sistema.
- [x] Orçamentos mensais por categoria, valores utilizados/restantes, percentual e avisos em 80%/100%, recalculados após alterações de despesas confirmadas.
- [x] Skeletons, mensagens de erro, Tentar novamente e menu central preservados; nenhum botão Atualizar foi reintroduzido.
- [x] Rotas financeiras protegidas e descartadas no logout.

## Migração

- [x] Migração aditiva 20261031190000_p1 aplicada no PostgreSQL local, preservando contas, saldos e transações existentes.
- [x] Transações antigas recebem status CONFIRMED e contas antigas continuam ativas.
- [x] Transferências têm restrições de valor positivo e contas distintas; orçamentos têm unicidade por usuário/categoria/mês/ano.

Em outro ambiente: executar npx prisma migrate deploy e npx prisma generate no backend antes de iniciar a nova versão. A exclusão do usuário remove também os dados de planejamento, em transação.

## Validação

- [x] 56 testes Jest existentes do backend passaram.
- [x] 10 cenários de integração financeira passaram no PostgreSQL local (11 testes contando o agrupamento): centavos, previstos, confirmação concorrente, transferências, rejeições sem alteração parcial, conflitos, orçamento, calendário, recorrência/encurtamento/extensão e isolamento do histórico.
- [x] 19 testes mobile e TypeScript passaram, incluindo paginação e descarte de páginas de filtros anteriores.
- [x] Lint dos arquivos TypeScript alterados do backend passou.
- [x] Validação no navegador a 390 × 844 com backend real local e usuário temporário: login, relatórios, privacidade, comparação mensal, passagem do mês para Transações, busca e conta combinadas, detalhes/extrato, arquivar/reativar, transferência, recálculo do orçamento, criar recorrência, confirmar compromisso e logout.
- [x] Acesso direto a /planning sem sessão redireciona às boas-vindas.
- [x] Bundles finais de Android e web gerados com a configuração normal.
- [x] Conta temporária do preview e seus registros removidos; usuários de integração também são removidos ao concluir os testes.
- [ ] Homologação adicional no aparelho Android/iOS.

Os testes de integração exigem banco local e criam/removem exclusivamente seus próprios usuários. Executar npm run test:p1 no backend. Não foi executado teste de carga.
