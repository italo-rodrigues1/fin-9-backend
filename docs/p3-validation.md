# P3 — Cartão de crédito e parcelamento

Implementado em 31/10/2026. O checklist geral permanece no project.md da pasta que reúne os serviços.

## Entregas

- [x] Cartões com nome, limite, dia de fechamento e vencimento; edição, arquivamento e reativação.
- [x] Compras à vista no crédito ou em 2 a 36 parcelas sem juros, com categoria, valor total e data.
- [x] Distribuição exata em centavos: R$ 100 em três parcelas gera R$ 33,34 + R$ 33,33 + R$ 33,33.
- [x] Edição/exclusão do conjunto de parcelas quando nenhuma fatura da compra tiver pagamento ativo.
- [x] Faturas abertas, fechadas, pagas e aviso de vencida; filtro por situação e histórico progressivo de 30 parcelas.
- [x] Pagamento integral após fechamento, conta de origem, data e estorno do registro.
- [x] Limite disponível, comprometido e total, com resumo no Dashboard e acesso por Mais.
- [x] Skeletons, validação junto aos campos, mensagens de erro/sucesso e privacidade dos valores e proporções. Nenhum botão Atualizar.
- [x] API com JWT, UUIDs, validações e isolamento por usuário; rotas mobile protegidas por sessão.

## Regras de ciclo e competência

O mês de referência da fatura é o mês do fechamento. Compras anteriores ao fechamento entram no ciclo atual; compras no dia do fechamento ou depois entram no próximo. Dias inexistentes usam o último dia do mês, recuperando o dia original nos meses seguintes. Vencimento em dia menor ou igual ao fechamento ocorre no mês seguinte. O ciclo fica fixo após a criação de faturas; outro ciclo requer novo cartão.

O total da compra compromete o limite imediatamente, incluindo as parcelas futuras. A soma de todas as parcelas sem pagamento ativo determina o comprometido. Novas compras não podem superar o limite disponível, inclusive em concorrência; reduzir o limite abaixo do comprometido é impedido. Arquivar preserva dívida e histórico, bloqueia novas compras/edições e permite registrar pagamentos de faturas existentes.

Os relatórios mantêm o regime de caixa: compras e parcelas não são despesas realizadas por si só. O pagamento integral gera um lançamento confirmado por parcela, com sua categoria original e data de pagamento. O saldo da conta é debitado uma vez pelo total da fatura, na mesma transação do banco de dados. Os lançamentos entram nas consultas de transações, extrato, gráficos e orçamentos já existentes. Não podem ser alterados ou removidos isoladamente; a tela do lançamento oferece acesso à fatura.

Estornar o registro de pagamento recompõe o saldo e remove apenas seus lançamentos vinculados, em uma transação. O histórico do pagamento estornado é preservado: a mesma chave não pode reaplicar o débito; uma nova tentativa exige chave nova. Repetir um estorno antigo não afeta pagamentos posteriores. Estornos podem fazer o comprometido superar um limite reduzido após o pagamento; novas compras continuam bloqueadas pelo limite disponível.

Faturas não pagas com vencimento no mês entram em plannedCardExpense e plannedExpense da previsão geral de saldo. Não entram nos realizados ou no consumo efetivo dos orçamentos antes do pagamento. O filtro de uma conta específica não atribui faturas sem conta de pagamento definida.

O aplicativo registra um pagamento já realizado e não inicia pagamentos no banco. O registro exige data entre o fechamento e hoje, sem data futura; compras também não aceitam data futura. Assim como despesas manuais, o registro pode deixar o saldo negativo se o controle da conta estiver insuficiente. Esta entrega cobre pagamento integral e parcelas sem juros; pagamentos parciais, juros, rotativo, conciliação bancária e estorno de compra no estabelecimento ficam fora do escopo.

## Persistência e concorrência

- [x] Migration aditiva 20261031230000_p3_cards aplicada no PostgreSQL local; dados anteriores preservados.
- [x] Restrições de valores positivos, dias/ciclos válidos, unicidade de parcela e de chave de tentativa por usuário.
- [x] Índice parcial garante um único pagamento ativo por fatura.
- [x] Compras, pagamentos, estornos e validações de limite executados com isolamento serializável e até três tentativas.
- [x] Tratamento compartilhado reconhece tanto P2034 quanto conflitos de commit do adaptador PostgreSQL (TransactionWriteConflict / 40001 e 40P01), encontrado na regressão de P2.
- [x] Exclusão do usuário remove os registros de cartões na ordem das relações; exclusão de conta com histórico de pagamentos orienta arquivamento.

Em outro ambiente: executar npx prisma migrate deploy e npx prisma generate antes de iniciar o backend atualizado. O índice parcial e as restrições adicionais fazem parte do SQL versionado.

## API

GET/POST /cards; GET/PATCH /cards/:cardId; POST /cards/:cardId/purchases; GET/PATCH/DELETE /cards/:cardId/purchases/:id; GET /cards/:cardId/invoices/:id (skip/take, padrão 30, máximo 100); POST /cards/:cardId/invoices/:id/payments; DELETE /cards/:cardId/invoices/:invoiceId/payments/:id.

Compras aceitam requestId para repetição segura; pagamentos exigem essa chave. Valores aceitam duas casas decimais, até 999999999.99; datas usam YYYY-MM-DD. O mobile gera uma chave estável por formulário e bloqueia toques simultâneos.

## Validação

- [x] Build, Prisma validate e lint dos fontes TypeScript alterados do backend.
- [x] 89 testes Jest: regras de calendário, fechamento, meses curtos/ano bissexto, centavos, entradas inválidas e tentativas de concorrência.
- [x] 16 cenários P3 no PostgreSQL local: limite concorrente, idempotência, edição atômica, isolamento, paginação, pagamento, categorias, orçamento/extrato, proteção dos lançamentos, arquivamento, estorno concorrente, nova quitação, previsão e exclusão do usuário.
- [x] Regressão dos 10 cenários P1 e 10 cenários P2: 36 cenários no total (39 testes incluindo os agrupamentos).
- [x] TypeScript e 22 testes mobile, incluindo previsão das parcelas e total exato nas 36 opções.
- [x] Navegador a 390 × 844 com API real local e conta fictícia: login, acesso por Mais, validações, cadastro de cartão, compra de R$ 100 em três parcelas, faturas aberta/fechada, pagamento de R$ 33,34, limite recomposto, despesas/categoria sem duplicidade, lançamento protegido com acesso à fatura, cancelamento do diálogo de estorno e privacidade em cartões/faturas/parcelas.
- [x] Saldo fictício passou de R$ 4.000 para R$ 3.966,66 e as despesas realizadas foram exatamente R$ 33,34, sem repetir os R$ 100 da compra.
- [x] Bundles finais Android e web gerados com configuração normal.
- [x] Prévia encerrada e usuário fictício com todos os dados removido; os testes também limpam seus próprios usuários.
- [ ] Homologação adicional em aparelho Android/iOS real ou emulador.

Executar npm run test:p3 no backend. Os testes financeiros exigem PostgreSQL local e só alteram usuários temporários próprios. Não foi executado teste de carga.
