# P2 — Objetivos financeiros

Este é um registro histórico da etapa. Consulte as [regras de negócio atuais](regras-de-negocio.md), que substituem a regra antiga de arquivamento de contas.

Implementado em 31/10/2026. Checklist geral no project.md da pasta que reúne os serviços.

## Entregas

- [x] Nome, valor-alvo e prazo opcional, com criação, edição e exclusão de metas.
- [x] Contribuições por conta, valor, data e observação, com edição, remoção e histórico em páginas de 30 registros.
- [x] Valor disponível, valor-alvo, restante, percentual, prazo e estados em andamento, atingida, prazo encerrado e revisão.
- [x] Acesso por Mais e resumo das três metas mais recentes no Dashboard.
- [x] Skeletons, mensagens de erro e Tentar novamente; preservada a ausência de botões Atualizar.
- [x] Valores, percentuais e barras ocultos pela preferência compartilhada, inclusive na árvore de acessibilidade da lista e do histórico.
- [x] Rotas protegidas por sessão e API com JWT e isolamento por usuário.

## Relação com as contas

As contribuições são destinações de dinheiro existente, sem movimentar saldos e sem criar receitas, despesas ou transferências. Excluir uma contribuição ou meta remove apenas as destinações. A data identifica o registro; sua destinação vale imediatamente ao salvar.

Novas contribuições e aumentos validam a soma de todas as destinações da conta contra seu saldo não negativo, em transação serializável com tentativas limitadas. Uma chave por formulário protege a repetição de criação após falhas de conexão; dados diferentes não podem reutilizar a mesma chave. Bloqueio imediato por referência evita toques simultâneos.

Despesas e transferências normais continuam possíveis. Se diminuírem o saldo abaixo do total destinado, o progresso passa a considerar a cobertura proporcional entre as metas da conta. A soma das parcelas nunca supera o dinheiro disponível: agrupa-se por meta/conta antes de arredondar para baixo em centavos. Contas negativas cobrem zero. As destinações nominais são mantidas e um aviso informa a diferença sem cobertura; recompor saldo recompõe o progresso até o total destinado. A barra limita-se visualmente a 100%; contribuições acima do alvo continuam registradas.

Contas arquivadas preservam a cobertura existente; é possível editar ou reduzir contribuições sem aumentar seu valor. Novos valores exigem conta ativa. A exclusão de uma conta com contribuições é impedida com orientação para arquivar ou remover os vínculos. A exclusão do usuário remove também metas e contribuições em transação.

## Migração e execução

- [x] Migration aditiva 20261031210000_p2_goals aplicada no PostgreSQL local.
- [x] Restrições de valor positivo, unicidade de chave de tentativa por usuário, índices e exclusão em cascata da meta.

Em outro ambiente: executar npx prisma migrate deploy e npx prisma generate antes de iniciar o backend atualizado. Nenhuma alteração em saldos ou transações preexistentes.

API: GET/POST /goals; GET/PATCH/DELETE /goals/:id; POST /goals/:id/contributions; GET/PATCH/DELETE /goals/:id/contributions/:contributionId. O detalhe aceita skip e take (padrão 30, máximo 100). Nome e valor-alvo são obrigatórios ao salvar a meta; deadline null remove o prazo. Campos monetários aceitam até duas casas decimais e limite de 999999999.99. Datas são dias no formato YYYY-MM-DD.

## Validação

- [x] Backend: build, lint dos fontes alterados e 71 testes Jest.
- [x] 10 cenários P2 e regressão dos 10 cenários P1 no PostgreSQL local (22 testes incluindo os dois agrupamentos).
- [x] Concorrência entre metas, repetição de criação, saldo e relatórios invariantes, edição/mudança de conta, insuficiência de cobertura, arquivamento, isolamento entre usuários, paginação, exclusão em cascata e limpeza do usuário.
- [x] Precisão de centavos, agrupamento antes de arredondar, saldos negativos e validação de entradas nos testes unitários.
- [x] Mobile: TypeScript e 19 testes existentes.
- [x] Navegador a 390 × 844 com API real local e conta temporária: login, acesso por Mais, validações de campos, criação sem prazo, criação/edição de contribuição, edição de valor-alvo e prazo, recálculo de progresso, retorno à lista e privacidade no Dashboard/lista/histórico.
- [x] Saldo fictício permaneceu R$ 4.000 após criar e editar as contribuições; nenhuma receita ou despesa criada.
- [x] Bundles Android e web gerados com configuração normal.
- [x] Prévia local encerrada e sua conta temporária e registros removidos.
- [ ] Homologação adicional em aparelho Android/iOS real ou emulador.

Executar npm run test:p2 no backend. Os testes de integração exigem PostgreSQL local e removem exclusivamente seus usuários temporários ao terminar. Não foi executado teste de carga.
