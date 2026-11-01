# Regras de negócio do Fin-9

Este documento é a referência funcional atual. Os arquivos p0/p1/p2/p3-validation.md registram entregas anteriores e não substituem estas regras. A revisão de 31/10/2026 incorpora a decisão de excluir contas do app preservando o histórico.

## Precisão monetária e datas

- Valores persistidos usam Decimal no backend e DECIMAL(12,2) no PostgreSQL. Somas, débitos, créditos, limites e distribuições usam centavos exatos; não se somam valores financeiros com ponto flutuante no banco.
- Entradas monetárias aceitam até duas casas decimais, com teto de R$ 999.999.999,99. Compras, parcelas, contribuições e limites devem ser positivos; saldo inicial de conta pode ser zero.
- Despesas e pagamentos registrados podem levar uma conta a saldo negativo. A remoção de uma conta subtrai seu saldo com sinal: retirar uma conta de -R$ 50 aumenta o total exibido em R$ 50.
- Percentuais são exibidos com uma casa decimal, truncada para baixo. Alerta de orçamento e conclusão de meta são decididos pelos valores exatos, não pela aproximação visual. Não se mostra 100% antes de atingir o alvo.
- Datas de lançamentos são dias civis (YYYY-MM-DD), armazenadas como DATE. A formatação mantém esse dia, sem deslocamento pelo fuso. A referência de hoje do backend usa America/Sao_Paulo; 00h UTC ainda pode ser o dia anterior no Brasil.
- Filtragem mensal usa início inclusivo e primeiro dia do mês seguinte exclusivo. Meses curtos e anos bissextos preservam o dia original como âncora, usando o último dia disponível quando necessário.
- Operações financeiras que afetam mais de um registro usam transações serializáveis e até três tentativas para conflitos. Não há alterações parciais: falhar reverte a operação inteira.

## Contas e saldo atual

O saldo atual é a soma dos saldos das contas cadastradas e não excluídas. Ele é diferente do resultado mensal (receitas realizadas menos despesas realizadas) e do limite disponível de cartões.

Uma conta tem nome, instituição, saldo inicial, cor e ícone. O extrato combina lançamentos e transferências com ordenação e carregamento progressivo. Alterar nome/cor/ícone não altera o dinheiro registrado.

### Excluir conta do app

Decisão aprovada: a ação Excluir conta do app substitui Arquivar/Reativar na interface das contas financeiras. A conta sai das listas e seletores; seu saldo deixa de compor o total. O registro financeiro histórico é preservado por exclusão lógica, sem movimentação bancária, nova despesa ou reversão de transferências.

| Informação vinculada | Comportamento após a exclusão |
| --- | --- |
| Saldo atual | Total depois = total antes - saldo da conta removida. Os saldos das outras contas não mudam. |
| Receitas/despesas confirmadas | Permanecem nos relatórios, categorias, transações e consumo efetivo dos orçamentos. Lançamentos da conta ficam somente para consulta. |
| Transferências | Histórico e saldo da outra conta são preservados. Uma transferência com conta excluída fica somente para consulta; não pode ser revertida parcialmente. |
| Previstos | Registros anteriores são preservados para consulta, mas deixam de entrar em lembretes e previsão de saldo. |
| Recorrências | São interrompidas para a conta; nenhuma nova ocorrência é gerada. |
| Metas | As contribuições são preservadas, mas o dinheiro da conta excluída não cobre mais seu progresso. A meta sinaliza falta de cobertura; o usuário pode remover a destinação ou vinculá-la a outra conta com saldo disponível. |
| Faturas pagas pela conta | Permanecem pagas, com lançamentos e categorias preservados. O pagamento em conta excluída fica somente para consulta. Faturas restantes podem ser pagas por outra conta ativa. |
| Repetição da exclusão | Não subtrai o saldo novamente nem altera o histórico. A API responde com sucesso para uma conta já removida do mesmo usuário. |

A confirmação explica o impacto antes de remover. Se o dinheiro foi transferido entre contas acompanhadas, registre a transferência antes de excluir a origem para manter o total patrimonial coerente. A exclusão de uma conta do app não encerra a conta na instituição financeira.

Contas arquivadas de versões antigas continuam preservadas por compatibilidade; não são apagadas nem excluídas do total automaticamente pela atualização. Elas podem ser removidas pela nova ação. O arquivamento de cartões continua sendo uma operação diferente.

## Transações e relatórios

- Receita confirmada aumenta o saldo da conta; despesa confirmada diminui. Editar reverte o efeito anterior e aplica o novo valor/tipo/conta atomicamente. Excluir reverte o efeito de um lançamento comum.
- Previsto não altera saldo nem relatórios realizados. Confirmar registra o efeito uma vez; voltar a previsto desfaz esse efeito.
- Lançamentos preservados de contas excluídas e lançamentos gerados por pagamento de fatura não podem ser editados/excluídos isoladamente. O pagamento de fatura é gerenciado na respectiva fatura enquanto a conta de pagamento existir.
- Relatórios mensais mostram receitas, despesas, resultado, categorias, comparação e histórico de seis meses. O histórico de contas removidas permanece nos valores realizados; o saldo atual inclui apenas contas não excluídas.
- Busca e filtros por conta, categoria, tipo, situação e datas podem ser combinados. Históricos carregam em páginas de 30, com desempate por identificador.

## Transferências

Uma transferência move um valor positivo entre duas contas diferentes do mesmo usuário. Origem e destino são atualizados na mesma transação. O saldo total é preservado, e o movimento não vira receita ou despesa nos relatórios.

Edição/exclusão reverte os dois lados juntos. Contas excluídas não recebem novos movimentos e tornam suas transferências anteriores somente para consulta. Erros e conflitos não deixam um lado atualizado sem o outro.

## Planejamento, recorrências e lembretes

Lançamentos previstos compõem o planejamento, separados de realizados. As frequências disponíveis são semanal, mensal e anual, com início e término opcional. As previsões são materializadas sem duplicação até o fim do mês correspondente no ano seguinte.

Editar um lançamento altera somente aquela ocorrência. Editar próximas preserva confirmadas e altera as previstas a partir da data escolhida. Alterar frequência ou âncora exige encerrar a série e criar outra. Encerrar impede novas ocorrências previstas, preservando realizadas.

Confirmar pelo Planejamento registra a data efetiva de hoje e altera o saldo uma vez. Os lembretes são internos ao aplicativo: vencidos, hoje e próximos dias; não há push do sistema. Contas excluídas deixam de participar dessas previsões e têm suas recorrências interrompidas.

## Orçamentos por categoria

Cada orçamento pertence a um usuário, categoria, mês e ano. Salvar novamente essa combinação altera o limite, sem criar outro orçamento.

O utilizado soma despesas confirmadas da categoria, inclusive parcelas de cartão quando a fatura é paga. Compras ainda não pagas e previstos não consomem o orçamento realizado. Despesas históricas de contas excluídas permanecem.

O restante é limite menos utilizado, podendo ser negativo. O aviso de atenção começa em 80% exatos e o de limite atingido em 100% exatos. Edições/exclusões permitidas e estornos de registros de pagamento recalculam o consumo. Remover um orçamento não remove despesas.

## Metas financeiras

Uma meta tem nome, valor-alvo positivo e prazo opcional, podendo ser alterada ou removida. Contribuições têm conta, valor, data e observação; representam destinações de dinheiro existente, sem criar receita/despesa/transferência nem alterar saldos.

Novas contribuições e aumentos verificam o saldo livre depois de todas as destinações da conta, inclusive em concorrência. O mesmo dinheiro não pode ser destinado a várias metas.

O progresso usa a cobertura atual das contas. Se o saldo cair abaixo do total destinado, a cobertura é dividida proporcionalmente entre as metas da conta. Agrupa-se por meta/conta antes de truncar cada parcela para centavos; a soma coberta nunca excede o dinheiro disponível. Saldo negativo cobre zero. Contas excluídas fornecem cobertura zero, mantendo as destinações nominais no histórico.

Concluir uma meta exige cobertura maior ou igual ao alvo. Valores sem cobertura geram revisão; prazo passado sem conclusão indica atraso quando não houver revisão prioritária. Excluir meta/contribuição remove a destinação, mantendo os saldos das contas. A data identifica o registro e a destinação vale ao salvar.

## Cartões, compras e faturas

### Cartão e limite

O cartão tem nome, limite positivo, dia de fechamento e dia de vencimento entre 1 e 31. O limite comprometido inclui todas as parcelas sem pagamento ativo, inclusive futuras; disponível é limite total menos comprometido. Não se reduz o limite abaixo do comprometido.

Arquivar cartão preserva dívida e histórico, bloqueia novas compras/edições e permite pagar faturas existentes. O ciclo fica fixo depois de criar faturas; outro ciclo requer novo cartão.

### Compra e parcelamento

Compras no crédito podem ser à vista (uma parcela) ou em até 36 parcelas sem juros, com categoria e data não futura. O valor total compromete o limite imediatamente, sem alterar saldo de contas ou despesas realizadas.

As parcelas preservam o total em centavos: R$ 100/3 resulta em R$ 33,34 + R$ 33,33 + R$ 33,33. Não há parcela de zero centavo. A compra inteira pode ser editada/excluída se nenhuma parcela tiver pagamento ativo; depois é necessário estornar os pagamentos permitidos primeiro.

### Ciclo da fatura

A fatura é identificada pelo mês do fechamento. Compra anterior ao fechamento entra no ciclo atual; no dia do fechamento ou depois, entra no próximo. Em meses curtos, usa-se o último dia do mês; o dia original volta nos meses seguintes. Se o dia do vencimento for menor ou igual ao fechamento, o vencimento fica no mês seguinte.

Faturas são abertas antes do fechamento, fechadas a partir dele e pagas quando há pagamento ativo. Não paga e com vencimento anterior a hoje é também vencida. Compras não são inseridas em fatura já paga.

### Pagamento e estorno do registro

O aplicativo registra um pagamento integral já realizado no banco; não efetua pagamentos bancários. A data deve estar entre fechamento e hoje. A conta escolhida deve pertencer ao usuário e estar disponível.

O pagamento debita o saldo uma vez e gera uma despesa confirmada por parcela, com categoria original e data de pagamento. A compra não é contabilizada novamente: relatórios, gráficos, orçamento e extrato usam esses lançamentos. Uma chave por formulário protege repetição de envio; uma fatura só tem um pagamento ativo.

Estornar o registro, enquanto a conta de pagamento existir, recompõe o saldo e remove os lançamentos vinculados atomicamente. A tentativa estornada é preservada: reutilizar a chave não reaplica o débito, e repetir estorno antigo não afeta um pagamento novo. Contas excluídas tornam esses pagamentos somente para consulta. O estorno do registro não cancela um pagamento no banco.

Pagamentos parciais, juros, rotativo, conciliação bancária e devolução de compra no estabelecimento ficam fora do escopo atual.

## Saldo previsto

Previsão geral = saldo atual + receitas previstas do mês - despesas previstas do mês - faturas não pagas com vencimento no mês. Ela não é um segundo saldo bancário.

Consultas de uma conta específica não atribuem faturas ainda sem conta de pagamento definida. Previsto de conta excluída não participa. Fatura paga deixa a previsão pendente e passa aos realizados pela data do pagamento, sem repetição.

## Interface, aparência e privacidade

Todos os carregamentos usam skeletons. Erro de consulta oferece Tentar novamente; não há botões Atualizar. Formulários rolam em altura reduzida e ajustam-se ao teclado, incluindo campos em listas; o menu inferior não ocupa a área do teclado.

O Perfil oferece Claro, Escuro e Seguir o sistema. A preferência é local ao aparelho e permanece ao reabrir o app. Cores de superfície, texto, bordas, campos, diálogos, skeletons e navegação acompanham o tema.

Ocultar valores esconde valores, percentuais e formas de gráficos que os revelem, inclusive textos acessíveis. A aparência não altera dados financeiros nem a preferência de privacidade.

## Perfil, propriedade e exclusão de todos os dados

Todas as consultas e alterações são vinculadas ao usuário autenticado. Identificadores de outro usuário não dão acesso a dados financeiros.

Excluir conta do app (conta financeira) é diferente de Excluir perfil e dados. A exclusão do perfil exige confirmação adicional e remove definitivamente o usuário e seus registros financeiros, incluindo contas preservadas, lançamentos, transferências, planejamento, metas e cartões, em transação.

## Referências

A escolha de preservar histórico considera a distinção entre encerramento e exclusão documentada pelo [YNAB](https://support.ynab.com/how-to-close-or-delete-an-account-in-ynab-ry_409Gko?mobile-help=true) e pelo [Actual Budget](https://actualbudget.org/docs/accounts/). As regras acima são decisões específicas do Fin-9, aprovadas para este aplicativo.

A implementação de aparência e teclado segue as APIs instaladas do Expo/React Native e os guias oficiais de [temas no NativeWind](https://www.nativewind.dev/docs/guides/themes), [cores no Expo](https://docs.expo.dev/develop/user-interface/color-themes/) e [teclado no React Native](https://reactnative.dev/docs/keyboardavoidingview).
